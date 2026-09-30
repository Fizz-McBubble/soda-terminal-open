import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppHealth } from '../../appHealthContext'
import { AccountMigrationPreflightPanel } from '../../components/AccountMigrationPreflightPanel'
import { driveDiscData } from '../../data/gameData'
import { database, importDriveDiscsFromJson } from '../../db/database'
import {
  createBackup,
  getBackupFilename,
  preflightBackup,
  restoreBackup,
  type BackupPreflight,
} from '../../domain/backup'
import { preflightDriveDiscImport, type DriveDiscImportPreflight } from '../../domain/discImport'
import { BackupAndRestorePanels } from './BackupAndRestorePanels'
import { DataFoundationStatus } from './DataFoundationStatus'
import { DriveDiscImportPanel } from './DriveDiscImportPanel'
import { ScanStagingPanel } from './ScanStagingPanel'
import { useScanStagingManagement } from './useScanStagingManagement'

export function AdvancedDataManagement() {
  const { data } = useAppHealth()
  const [message, setMessage] = useState('')
  const [preflight, setPreflight] = useState<BackupPreflight | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [discImportInput, setDiscImportInput] = useState<unknown | null>(null)
  const [discImportPreflight, setDiscImportPreflight] = useState<DriveDiscImportPreflight | null>(
    null,
  )
  const [discImportResult, setDiscImportResult] = useState<DriveDiscImportPreflight | null>(null)
  const [importingDiscs, setImportingDiscs] = useState(false)

  const localCounts = useLiveQuery(
    async () => ({
      driveDiscs: await database.driveDiscs.count(),
      discEvaluations: await database.discEvaluations.count(),
      buildProfiles: await database.buildProfiles.count(),
      settings: await database.settings.count(),
    }),
    [],
  )

  const staging = useScanStagingManagement({ setMessage })

  async function exportData() {
    try {
      const backup = await createBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = getBackupFilename()
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage('完整备份已通过 schema 自检并导出。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败。')
    }
  }

  async function inspectFile(file: File | undefined) {
    setMessage('')
    if (!file) return setPreflight(null)
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      setPreflight(preflightBackup(parsed))
    } catch {
      setPreflight({ success: false, errors: ['文件不是有效 JSON。'], risks: [] })
    }
  }

  async function confirmRestore() {
    if (!preflight?.success || !preflight.backup) return
    setRestoring(true)
    try {
      const counts = await restoreBackup(preflight.backup)
      setMessage(
        `恢复完成：${counts.driveDiscs} 张档案、${counts.discEvaluations} 条评价、${counts.buildProfiles} 个模板。`,
      )
      setPreflight(null)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `恢复失败，原数据已保留：${error.message}`
          : '恢复失败，原数据已保留。',
      )
    } finally {
      setRestoring(false)
    }
  }

  async function inspectDiscImportFile(file: File | undefined) {
    setMessage('')
    setDiscImportResult(null)
    setDiscImportInput(null)
    if (!file) return setDiscImportPreflight(null)
    if (!data) {
      setDiscImportPreflight({
        format: 'soda-terminal-drive-disc-import',
        formatVersion: 1,
        batchId: 'unavailable',
        sourceAdapter: 'unknown',
        readyDiscs: [],
        items: [
          {
            index: 0,
            status: 'failed',
            issues: [{ index: 0, message: '游戏数据尚未加载，无法校验驱动盘套装。' }],
          },
        ],
        summary: { total: 0, ready: 0, skipped: 0, failed: 1 },
      })
      return
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const existingDiscs = await database.driveDiscs.toArray()
      const next = preflightDriveDiscImport(parsed, {
        driveDiscSets: data.driveDiscSets,
        driveDiscRules: driveDiscData?.rules,
        gameDataVersion: data.gameVersion,
        existingDiscs,
      })
      setDiscImportInput(parsed)
      setDiscImportPreflight(next)
    } catch {
      setDiscImportPreflight({
        format: 'soda-terminal-drive-disc-import',
        formatVersion: 1,
        batchId: 'unparsed',
        sourceAdapter: 'unknown',
        readyDiscs: [],
        items: [
          {
            index: 0,
            status: 'failed',
            issues: [{ index: 0, message: '文件不是有效 JSON。' }],
          },
        ],
        summary: { total: 0, ready: 0, skipped: 0, failed: 1 },
      })
    }
  }

  async function confirmDiscImport() {
    if (!data || !discImportInput || !discImportPreflight?.summary.ready || importingDiscs) return
    setImportingDiscs(true)
    try {
      const result = await importDriveDiscsFromJson(discImportInput, {
        driveDiscSets: data.driveDiscSets,
        driveDiscRules: driveDiscData?.rules,
        gameDataVersion: data.gameVersion,
        batchId: discImportPreflight.batchId,
      })
      setDiscImportResult(result)
      setDiscImportPreflight(result)
      setMessage(
        `驱动盘导入完成：新增 ${result.summary.ready} 张，跳过 ${result.summary.skipped} 张，失败 ${result.summary.failed} 张。`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `驱动盘导入失败，原仓库已保留：${error.message}`
          : '驱动盘导入失败，原仓库已保留。',
      )
    } finally {
      setImportingDiscs(false)
    }
  }

  return (
    <div className="page-stack management-page">
      <header className="workflow-header">
        <div>
          <span className="eyebrow">账户与资料</span>
          <h1>数据管理</h1>
          <p>导入先做纯预检。只有明确确认后，才以备份完整替换本地业务数据。</p>
        </div>
      </header>
      <DataFoundationStatus />
      <section className="data-management-grid">
        <AccountMigrationPreflightPanel />
        <ScanStagingPanel staging={staging} />
        <DriveDiscImportPanel
          discImportPreflight={discImportPreflight}
          discImportResult={discImportResult}
          importingDiscs={importingDiscs}
          onInspectFile={inspectDiscImportFile}
          onConfirmDiscImport={confirmDiscImport}
        />
        <BackupAndRestorePanels
          localCounts={localCounts}
          preflight={preflight}
          restoring={restoring}
          onExportData={exportData}
          onInspectFile={inspectFile}
          onConfirmRestore={confirmRestore}
        />
      </section>
      {message && (
        <p
          className="form-message"
          role={/失败|不可|未保存/.test(message) ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  )
}
