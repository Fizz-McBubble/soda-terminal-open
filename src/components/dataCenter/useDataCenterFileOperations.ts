import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  importRecognizedScanDataToActiveAccount,
  recognizeDataCenterFile,
} from '../../accounts/dataCenter'
import {
  restoreAccountBackup,
  restoreAccountBackupIndependently,
  restoreVaultBackup,
} from '../../accounts/backup'
import { restoreBackup } from '../../domain/backup'
import { persistScanImportStaging, reassessScanImportBatch } from '../../db/database'
import type { useAppHealth } from '../../appHealthContext'
import type { driveDiscData } from '../../data/gameData'
import {
  idleFileState,
  recognitionPhase,
  type AccountState,
  type FileState,
} from './dataCenterTypes'

export function useDataCenterFileOperations({
  accountState,
  data,
  discData,
  setBusy,
  setMessage,
  setRevision,
}: {
  accountState: AccountState
  data: ReturnType<typeof useAppHealth>['data']
  discData: typeof driveDiscData
  setBusy: (busy: boolean) => void
  setMessage: (message: string) => void
  setRevision: Dispatch<SetStateAction<number>>
}) {
  const [fileState, setFileState] = useState<FileState>(idleFileState)
  const [restoreConfirmation, setRestoreConfirmation] = useState<'replace' | 'independent' | null>(
    null,
  )
  const [restoreDisplayName, setRestoreDisplayName] = useState('')

  async function inspectFile(file: File) {
    setFileState({
      phase: 'reading',
      fileName: file.name,
      fileSize: file.size,
      recognition: null,
      success: null,
    })
    setMessage('')
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      if (!data || !discData) throw new Error('游戏数据尚未加载，暂时无法安全预检。')
      setFileState({
        phase: 'recognized',
        fileName: file.name,
        fileSize: file.size,
        recognition: null,
        success: null,
      })
      const recognition = await recognizeDataCenterFile(parsed, {
        accountId: accountState?.active?.id ?? null,
        accountName: accountState?.active?.displayName ?? null,
        driveDiscSets: data.driveDiscSets,
        rules: discData.rules,
        gameDataVersion: discData.dataVersion,
      })
      setFileState({
        phase: recognitionPhase(recognition),
        fileName: file.name,
        fileSize: file.size,
        recognition,
        success: null,
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : '文件无法读取。'
      setFileState({
        phase: 'error',
        fileName: file.name,
        fileSize: file.size,
        recognition: {
          kind: 'unknown',
          label: '无法识别',
          targetAccountId: accountState?.active?.id ?? null,
          targetAccountName: accountState?.active?.displayName ?? null,
          counts: { total: 0, add: 0, skip: 0, confirm: 0, failed: 1 },
          preservesOriginal: true,
          replacementScope: null,
          errors: [`${detail} 原数据未变化。`],
          risks: [],
          input: null,
        },
        success: null,
      })
    }
  }

  async function executeRecognition() {
    const recognition = fileState.recognition
    if (!recognition || !data || !discData) return
    const accountId = accountState?.active?.id
    setBusy(true)
    try {
      if (recognition.kind === 'scan_data') {
        const result = await importRecognizedScanDataToActiveAccount(recognition, accountId, {
          driveDiscSets: data.driveDiscSets,
          rules: discData.rules,
          gameDataVersion: discData.dataVersion,
        })
        setFileState((current) => ({
          ...current,
          phase: 'success',
          success: {
            title: '扫描数据已导入',
            detail: `新增 ${result.summary.ready} 张，重复跳过 ${result.summary.skipped} 张，失败 ${result.summary.failed} 张。`,
            batchId: result.batchId,
          },
        }))
      } else if (recognition.kind === 'scan_staging') {
        if (recognition.counts.confirm > 0) {
          await persistScanImportStaging(recognition.staging, {
            driveDiscSets: data.driveDiscSets,
            rules: discData.rules,
            dataVersion: discData.dataVersion,
          })
          await reassessScanImportBatch(recognition.staging.batch.id, {
            driveDiscSets: data.driveDiscSets,
            rules: discData.rules,
            dataVersion: discData.dataVersion,
          })
          setMessage(`已载入 ${recognition.counts.confirm} 条需要确认的记录；请在下方完成确认。`)
        } else {
          throw new Error('该扫描暂存无需确认，请导出标准扫描数据后再导入。')
        }
      } else if (recognition.kind === 'account_backup') {
        const identity = recognition.backupPreflight.identity
        setRestoreDisplayName(`${recognition.targetAccountName ?? '玩家账户'}（恢复副本）`)
        setRestoreConfirmation(identity === 'same_name_different_id' ? 'independent' : 'replace')
      } else if (recognition.kind === 'vault_backup') {
        const count = await restoreVaultBackup(recognition.input)
        setFileState((current) => ({
          ...current,
          phase: 'success',
          success: { title: '保险库恢复完成', detail: `已完整恢复 ${count} 个账号。` },
        }))
      } else if (recognition.kind === 'legacy_backup') {
        if (!recognition.legacyPreflight.backup) return
        const counts = await restoreBackup(recognition.legacyPreflight.backup)
        setFileState((current) => ({
          ...current,
          phase: 'success',
          success: {
            title: '旧版备份恢复完成',
            detail: `已恢复 ${counts.driveDiscs} 张档案；原子事务已完成。`,
          },
        }))
      }
      setRevision((current) => current + 1)
    } catch (error) {
      const detail = error instanceof Error ? error.message : '操作失败。'
      setFileState((current) => ({
        ...current,
        phase: 'error',
        recognition: current.recognition
          ? { ...current.recognition, errors: [`${detail} 原数据未变化。`] }
          : current.recognition,
      }))
    } finally {
      setBusy(false)
    }
  }

  async function confirmAccountRestore() {
    const recognition = fileState.recognition
    if (recognition?.kind !== 'account_backup' || !restoreConfirmation) return
    setBusy(true)
    try {
      const result =
        restoreConfirmation === 'independent'
          ? await restoreAccountBackupIndependently(recognition.input, {
              displayName: restoreDisplayName,
            })
          : { counts: await restoreAccountBackup(recognition.input) }
      setRestoreConfirmation(null)
      setFileState((current) => ({
        ...current,
        phase: 'success',
        success: {
          title: '账号恢复完成',
          detail:
            restoreConfirmation === 'independent'
              ? `已作为独立玩家账户恢复 ${result.counts.driveDiscs} 张正式驱动盘，并设为当前账户。`
              : `已完整替换目标玩家账户：${result.counts.driveDiscs} 张正式驱动盘，并设为当前账户。`,
        },
      }))
      setRevision((current) => current + 1)
    } catch (error) {
      setRestoreConfirmation(null)
      const detail = error instanceof Error ? error.message : '恢复失败。'
      setFileState((current) => ({
        ...current,
        phase: 'error',
        recognition: current.recognition
          ? { ...current.recognition, errors: [`${detail} 本地账户数据未改动。`] }
          : current.recognition,
      }))
    } finally {
      setBusy(false)
    }
  }

  return {
    fileState,
    setFileState,
    restoreConfirmation,
    setRestoreConfirmation,
    restoreDisplayName,
    setRestoreDisplayName,
    inspectFile,
    executeRecognition,
    confirmAccountRestore,
  }
}
