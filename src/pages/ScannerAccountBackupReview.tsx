import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { DataCenterFileRecognition } from '../accounts/dataCenter'
import { recognizeAccountBackupFile } from '../accounts/accountBackupRecognition'
import { restoreAccountBackup, restoreAccountBackupIndependently } from '../accounts/backup'
import { useAppHealth } from '../appHealthContext'
import { publicScannerDriveDiscData } from '../application/publicScannerCatalog'
import { DataCenterRestoreConfirmationDialog } from '../components/dataCenter/DataCenterRestoreConfirmationDialog'
import { ScopeSummary } from '../components/dataCenter/ScopeSummary'
import { backupSummary } from '../components/dataCenter/dataCenterTypes'
import { useDataCenterAccountState } from '../components/dataCenter/useDataCenterAccountState'
import { usePageOperationScope } from '../components/usePageOperationScope'

type BackupRecognition = Extract<DataCenterFileRecognition, { kind: 'account_backup' }>
export type ScannerAccountBackupReviewState =
  | 'checking'
  | 'ready'
  | 'restoring'
  | 'completed'
  | 'error'

export type ScannerAccountBackupReviewProps = {
  file: File
  disabled?: boolean
  scopeKey: string
  onClose: () => void
  onRestored: () => void
  onStateChange?: (state: ScannerAccountBackupReviewState) => void
}

/** Only the existing single-account transaction may write; file inspection stays local and read-only. */
export function ScannerAccountBackupReview({
  file,
  disabled = false,
  scopeKey,
  onClose,
  onRestored,
  onStateChange,
}: ScannerAccountBackupReviewProps) {
  const { databaseStatus } = useAppHealth()
  const accountState = useDataCenterAccountState(0)
  const captureScope = usePageOperationScope(scopeKey)
  const [review, setReview] = useState<{
    file: File
    scopeKey: string
    state: ScannerAccountBackupReviewState
    recognition: BackupRecognition | null
    message: string
  } | null>(null)
  const [confirmation, setConfirmation] = useState<'replace' | 'independent' | null>(null)
  const [displayName, setDisplayName] = useState('')
  const busyRef = useRef(false)
  const generation = useRef(0)
  const callbacks = useRef({ onStateChange, onRestored })
  useEffect(() => {
    callbacks.current = { onStateChange, onRestored }
  }, [onStateChange, onRestored])
  const headingRef = useRef<HTMLHeadingElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const token = ++generation.current
    const isScopeCurrent = captureScope()
    const isCurrent = () => token === generation.current && isScopeCurrent()
    let active = true
    async function inspect() {
      if (!active || !isCurrent()) return
      setConfirmation(null)
      setReview({ file, scopeKey, state: 'checking', recognition: null, message: '' })
      callbacks.current.onStateChange?.('checking')
      try {
        if (databaseStatus !== 'ready')
          throw new Error('本地存储尚未就绪，请待存储恢复后重新检查。')
        const input: unknown = JSON.parse(await file.text())
        if (!isCurrent()) return
        if (
          !input ||
          typeof input !== 'object' ||
          (input as Record<string, unknown>).format !== 'soda-terminal-account-backup'
        ) {
          throw new Error(
            '这里只能恢复 Soda 单账户备份。请关闭检查并选择单账户备份 JSON；其他文件请使用对应导入入口。',
          )
        }
        if (!publicScannerDriveDiscData) throw new Error('游戏数据尚未就绪，请重新加载后检查备份。')
        const recognition = await recognizeAccountBackupFile(input)
        if (!isCurrent()) return
        if (
          recognition.kind !== 'account_backup' ||
          recognition.errors.length ||
          !recognition.backupPreflight.backup
        ) {
          throw new Error(
            `${recognition.errors.join('；') || '单账户备份预检失败。'} 请重新导出完整备份后选择文件。`,
          )
        }
        setDisplayName(`${recognition.targetAccountName ?? '玩家账户'}（恢复副本）`)
        setReview({ file, scopeKey, state: 'ready', recognition, message: '' })
        callbacks.current.onStateChange?.('ready')
        headingRef.current?.focus()
      } catch (error) {
        if (!isCurrent()) return
        setReview({
          file,
          scopeKey,
          state: 'error',
          recognition: null,
          message: `${error instanceof Error ? error.message : '文件无法读取。'} 请检查文件内容，关闭检查后重新选择有效的单账户备份。本地账户数据未改动。`,
        })
        callbacks.current.onStateChange?.('error')
      }
    }
    void inspect()
    return () => {
      active = false
      generation.current += 1
    }
  }, [file, scopeKey, databaseStatus, captureScope])

  useEffect(() => {
    if (confirmation) cancelRef.current?.focus()
  }, [confirmation])

  const current = review?.file === file && review.scopeKey === scopeKey ? review : null
  const recognition = current?.recognition
  const backup = recognition?.backupPreflight.backup
  const scope = backup ? backupSummary(backup) : null
  const matching = accountState?.accounts.find((item) => item.id === backup?.account.id)
  const sameName =
    accountState?.accounts.filter(
      (item) =>
        item.id !== backup?.account.id &&
        item.displayName.toLocaleLowerCase() === backup?.account.displayName.toLocaleLowerCase(),
    ) ?? []
  const restoring = current?.state === 'restoring'

  function cancelConfirmation() {
    if (busyRef.current) return
    setConfirmation(null)
    triggerRef.current?.focus()
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelConfirmation()
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), summary, a[href]',
      ),
    )
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  async function confirmRestore() {
    if (!current || !recognition || !confirmation || disabled || busyRef.current) return
    const token = generation.current
    const isScopeCurrent = captureScope()
    const isCurrent = () => token === generation.current && isScopeCurrent()
    if (!isCurrent()) return
    const mode = confirmation
    busyRef.current = true
    setConfirmation(null)
    setReview({ ...current, state: 'restoring', message: '' })
    callbacks.current.onStateChange?.('restoring')
    try {
      // The preview can become stale while its dialog is open. Require a new confirmation if identity changed.
      const fresh = await recognizeAccountBackupFile(recognition.input)
      if (!isCurrent()) return
      if (fresh.kind !== 'account_backup' || fresh.errors.length || !fresh.backupPreflight.backup)
        throw new Error('备份复检失败，请关闭检查并重新选择有效备份。')
      if (fresh.backupPreflight.identity !== recognition.backupPreflight.identity) {
        setReview({
          ...current,
          recognition: fresh,
          state: 'error',
          message: '本机账户身份已变化，请查看更新后的恢复范围并再次确认。本地账户数据未改动。',
        })
        callbacks.current.onStateChange?.('error')
        return
      }
      const beforeCommit = () => {
        if (!isCurrent()) throw new Error('本次检查已失效，恢复事务已取消。请重新检查备份。')
      }
      const result =
        mode === 'independent'
          ? await restoreAccountBackupIndependently(
              recognition.input,
              { displayName },
              undefined,
              beforeCommit,
            )
          : {
              counts: await restoreAccountBackup(recognition.input, undefined, beforeCommit),
              account: fresh.backupPreflight.backup.account,
            }
      const { counts } = result
      if (!isCurrent()) return
      setReview({
        ...current,
        state: 'completed',
        message: `恢复完成：${counts.driveDiscs} 张正式驱动盘、${counts.discEvaluations} 条评价、${counts.scanBatches} 个扫描批次、${counts.scanItems} 条暂存、${counts.optimizationResults} 个配装结果、${counts.planningDrafts} 份规划草稿、${counts.preferences} 项偏好。${mode === 'independent' ? '独立恢复账户' : '备份对应账户'}“${result.account.displayName}”（识别码 …${result.account.id.slice(-6)}）已设为当前账户。`,
      })
      callbacks.current.onStateChange?.('completed')
      callbacks.current.onRestored()
    } catch (error) {
      if (!isCurrent()) return
      setReview({
        ...current,
        state: 'error',
        message: `${error instanceof Error ? error.message : '恢复失败。'} 本地账户数据未改动；请检查原因后再次明确确认恢复。`,
      })
      callbacks.current.onStateChange?.('error')
    } finally {
      busyRef.current = false
    }
  }

  return (
    <section className="panel scanner-backup-review" aria-label="单账户备份检查">
      <h2 ref={headingRef} tabIndex={-1}>
        检查单账户备份
      </h2>
      <p>{file.name} · 仅在本机检查</p>
      {(!current || current.state === 'checking') && <p role="status">正在只读检查备份…</p>}
      {current?.message && (
        <p role={current.state === 'error' ? 'alert' : 'status'}>{current.message}</p>
      )}
      {backup && scope && current?.state !== 'completed' && (
        <>
          <p>
            备份账户：{backup.account.displayName} · 备份时间：
            {new Date(backup.exportedAt).toLocaleString()}
          </p>
          <p>
            恢复目标：
            {recognition?.backupPreflight.identity === 'same_name_different_id'
              ? `新建独立账户“${displayName}”；现有同名账户不受影响。`
              : `备份对应账户“${matching?.displayName ?? backup.account.displayName}”（识别码 …${backup.account.id.slice(-6)}）。${matching ? '完整替换该账户' : '按备份身份恢复新账户'}，恢复后设为当前账户。`}
          </p>
          <p>
            恢复目标由备份身份决定；顶部所选账户不会成为合并目标。失败时事务回滚，其他账户不受影响。
          </p>
          <ScopeSummary title="备份恢复范围" summary={scope} />
          <p>
            另包含 {backup.counts.planningDrafts} 份账户规划草稿；音擎 {scope.wEngines}{' '}
            个随角色档案恢复。
          </p>
          {recognition?.risks.map((risk) => (
            <p key={risk}>{risk}</p>
          ))}
        </>
      )}
      {restoring && <p role="status">正在确认身份并恢复，请等待事务完成…</p>}
      <div className="data-center-actions">
        {recognition && current?.state !== 'completed' && (
          <button
            ref={triggerRef}
            type="button"
            className="button button--primary"
            disabled={disabled || restoring}
            onClick={() =>
              setConfirmation(
                recognition.backupPreflight.identity === 'same_name_different_id'
                  ? 'independent'
                  : 'replace',
              )
            }
          >
            确认恢复范围
          </button>
        )}
        <button
          type="button"
          className="button button--quiet"
          disabled={restoring}
          onClick={() => {
            generation.current += 1
            setConfirmation(null)
            onClose()
          }}
        >
          关闭检查
        </button>
      </div>
      {confirmation && backup && scope && !disabled && !restoring && (
        <DataCenterRestoreConfirmationDialog
          restoreConfirmation={confirmation}
          pendingBackup={backup}
          backupScope={scope}
          matchingLocalAccount={matching}
          sameNameLocalAccounts={sameName}
          restoreDisplayName={displayName}
          onRestoreDisplayNameChange={setDisplayName}
          onCancel={cancelConfirmation}
          onConfirm={confirmRestore}
          restoreDialogRef={dialogRef}
          restoreCancelRef={cancelRef}
          handleRestoreDialogKeys={handleDialogKeys}
        />
      )}
    </section>
  )
}
