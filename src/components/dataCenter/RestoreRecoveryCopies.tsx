import { playerErrorMessage } from '../../application/playerErrorMessage'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createAccountBackup, getAccountBackupFilename } from '../../accounts/backup'
import {
  readRestoreRecoveryInventory,
  removeDamagedRestoreRecovery,
  removeSavedRestoreRecovery,
  restoreRecoveryLimit,
  type RestoreRecoveryDamageReason,
  type RestoreRecoverySafetyIssue,
} from '../../accounts/restoreRecovery'
import { removeSavedAssetQuickReadRecovery } from '../../assetQuickRead/accountImport'
import { contentHash } from '../../application/contentHash'
import { database } from '../../db/databaseCore'
import { downloadJson } from './dataCenterTypes'
import './restore-recovery.css'

const damageReasonLabels: Record<RestoreRecoveryDamageReason, string> = {
  record_invalid: '记录结构无法识别',
  key_mismatch: '记录身份与存储键不一致',
  scope_invalid: '副本范围缺失',
  created_at_invalid: '创建时间无效',
  backup_missing: '原始备份内容缺失',
  backup_hash_mismatch: '原始备份内容校验失败',
  record_not_json_safe: '备份文件无法完整保留这条记录',
}

const safetyIssueLabels: Record<RestoreRecoverySafetyIssue, string> = {
  undefined_value: '未完整记录的内容',
  non_finite_number: '无效数值',
  negative_zero: '不受支持的数字格式',
  bigint: '超出备份支持范围的数字',
  unsupported_value: '不支持的值类型',
  cycle: '循环引用',
  sparse_array: '存在空缺的列表',
  map: '不受支持的关联表格式',
  set: '不受支持的集合格式',
  blob: '无法直接保存的文件内容',
  array_buffer: '无法直接保存的二进制内容',
  typed_array: '不受支持的数字列表格式',
  date: '未转换的日期',
  regexp: '不受支持的匹配规则',
  non_plain_object: '非普通对象',
}

type RecoveryCopy = {
  key: string
  date: string | null
  scope: string
  hash: string | null
  backup: unknown
  kind: 'restore-valid' | 'restore-damaged' | 'quick-read'
  exportable: boolean
  issue?: string
}

function recoveryFilenameSuffix(key: string) {
  return key.slice(-8).replace(/^-+/, '') || 'record'
}

export function RestoreRecoveryCopies({ accountId }: { accountId?: string }) {
  const [message, setMessage] = useState('')
  const [downloaded, setDownloaded] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<RecoveryCopy | null>(null)
  const [confirmationError, setConfirmationError] = useState('')
  const removalPending = useRef(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmDialogRef = useRef<HTMLDialogElement>(null)
  const confirmCancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const confirmTitleId = useId()
  const confirmDescId = useId()
  const copies = useLiveQuery(
    async () => {
      const replacements: RecoveryCopy[] = (await readRestoreRecoveryInventory(database)).map(
        (entry) =>
          entry.status === 'valid'
            ? {
                key: entry.recovery.key,
                date: entry.recovery.createdAt,
                scope: entry.recovery.scope,
                hash: entry.recovery.backupHash,
                backup: entry.recovery.backup,
                kind: 'restore-valid',
                exportable: true,
              }
            : {
                key: entry.key,
                date: entry.createdAt,
                scope: entry.scope ?? '范围无法读取的恢复前备份',
                hash: entry.recordHash,
                backup: entry.rawValue,
                kind: 'restore-damaged',
                exportable: entry.exportable,
                issue: entry.safetyIssue
                  ? `检测到 ${safetyIssueLabels[entry.safetyIssue]}；该记录不能以 JSON 无损导出或保持原记录类型。`
                  : damageReasonLabels[entry.reason],
              },
      )
      const quickReads: RecoveryCopy[] = accountId
        ? (await database.accountPreferences.where('accountId').equals(accountId).toArray())
            .filter((row) => /^asset-quick-read-recovery-[a-f0-9]{64}$/.test(row.key))
            .map((row) => ({
              key: row.key,
              date: row.updatedAt,
              scope: '当前账户资产快读',
              hash: contentHash(row.value),
              backup: row.value,
              kind: 'quick-read' as const,
              exportable: true,
            }))
        : []
      return [...replacements, ...quickReads]
    },
    [accountId],
    [],
  )
  useLayoutEffect(() => {
    if (!confirmTarget) return
    const modal = confirmDialogRef.current
    const previous = document.activeElement
    if (modal && !modal.open) {
      if (typeof modal.showModal === 'function') modal.showModal()
      else modal.setAttribute('open', '')
    }
    confirmCancelRef.current?.focus()
    return () => {
      if (modal?.open) modal.close?.()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [confirmTarget])
  const restoreCopies = copies.filter((copy) => copy.kind !== 'quick-read')
  const damagedCopies = restoreCopies.filter((copy) => copy.kind === 'restore-damaged')
  const unexportableCopies = damagedCopies.filter((copy) => !copy.exportable)
  const quotaReached = restoreCopies.length >= restoreRecoveryLimit
  if (!copies.length && !open) return null

  function close() {
    dialogRef.current?.close?.()
    setOpen(false)
    cancelRemoval()
    openerRef.current?.focus()
  }

  function cancelRemoval() {
    confirmDialogRef.current?.close?.()
    setConfirmTarget(null)
  }

  async function downloadCopy(copy: (typeof copies)[number]) {
    setBusy(true)
    try {
      if (!copy.exportable || copy.hash === null)
        throw new Error('该记录无法以 JSON 无损导出，不会标记为已下载或允许移除。')
      if (copy.kind === 'quick-read' && accountId) {
        const backup = await createAccountBackup(accountId)
        const saved = backup.data.preferences.find((row) => row.key === copy.key)
        if (!saved || contentHash(saved.value) !== copy.hash)
          throw new Error('恢复副本已变化，请重新下载。')
        downloadJson(backup, getAccountBackupFilename(accountId))
      } else
        downloadJson(
          copy.backup,
          copy.kind === 'restore-damaged'
            ? `soda-terminal-damaged-restore-recovery-${copy.date?.slice(0, 10) ?? 'unknown'}-${recoveryFilenameSuffix(copy.key)}.json`
            : `soda-terminal-before-restore-${copy.date?.slice(0, 10) ?? 'unknown'}-${recoveryFilenameSuffix(copy.key)}.json`,
        )
      const downloadedHash = copy.hash
      setDownloaded((current) => ({ ...current, [copy.key]: downloadedHash }))
      setMessage(
        copy.kind === 'restore-damaged'
          ? '已开始下载损坏记录的原始内容，请确认文件已妥善保管。'
          : '已开始下载，请保管好文件。',
      )
    } catch (error) {
      setMessage(playerErrorMessage(error, '恢复副本操作失败。'))
    } finally {
      setBusy(false)
    }
  }

  function requestRemoval(copy: (typeof copies)[number]) {
    try {
      if (!copy.exportable || copy.hash === null)
        throw new Error('该记录无法以 JSON 无损导出，不能确认保管或移除。')
      if (downloaded[copy.key] !== copy.hash)
        throw new Error('请先下载此副本并确认文件已妥善保管。')
      setConfirmTarget(copy)
      setConfirmationError('')
    } catch (error) {
      setMessage(playerErrorMessage(error, '恢复副本操作失败。'))
    }
  }

  async function confirmAndRemove() {
    if (!confirmTarget || removalPending.current) return
    const copy = confirmTarget
    removalPending.current = true
    setBusy(true)
    setConfirmationError('')
    try {
      if (copy.kind === 'quick-read' && accountId)
        await removeSavedAssetQuickReadRecovery(
          accountId,
          copy.key,
          copy.hash!,
          'downloaded_and_keep_external_copy',
        )
      else if (copy.kind === 'restore-damaged')
        await removeDamagedRestoreRecovery(
          copy.key,
          copy.hash!,
          'downloaded_and_keep_external_copy',
        )
      else
        await removeSavedRestoreRecovery(copy.key, copy.hash!, 'downloaded_and_keep_external_copy')
      setMessage(
        copy.kind === 'restore-damaged'
          ? '已移除这条损坏记录，账户资料、活动账户与其他副本未改动。'
          : '已移除本机副本，账户资料未改动。',
      )
      cancelRemoval()
    } catch (error) {
      setConfirmationError(playerErrorMessage(error, '恢复副本操作失败。'))
      setMessage(playerErrorMessage(error, '恢复副本操作失败。'))
    } finally {
      removalPending.current = false
      setBusy(false)
    }
  }

  return (
    <>
      {copies.length > 0 && (
        <button
          ref={openerRef}
          type="button"
          className="button button--quiet quiet"
          onClick={() => {
            setMessage('')
            setOpen(true)
            dialogRef.current?.showModal?.()
          }}
        >
          恢复前备份（{copies.length}）
        </button>
      )}
      <dialog
        ref={dialogRef}
        open={open || undefined}
        className="soda-asset-dialog restore-recovery__dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (busy) event.preventDefault()
        }}
        onClose={() => {
          setOpen(false)
          openerRef.current?.focus()
        }}
      >
        <header>
          <h2 id={titleId}>恢复前备份</h2>
          <button
            type="button"
            className="button button--quiet quiet"
            disabled={busy}
            onClick={close}
          >
            关闭
          </button>
        </header>
        <p>下载并保管文件后，可移除本机副本。</p>
        {damagedCopies.length > 0 && (
          <p role="alert">
            其中 {damagedCopies.length} 份记录已损坏，不能用于恢复，但仍占用配额。仅可无损 JSON
            导出的损坏记录可按原记录指纹移除。
            {unexportableCopies.length > 0 &&
              ` 另有 ${unexportableCopies.length} 份包含非 JSON 安全值，不会提供有损下载完成标记或移除操作。`}
          </p>
        )}
        {quotaReached && (
          <p role="status">
            恢复前副本已达 {restoreRecoveryLimit}{' '}
            份上限。系统不会自动清理；请下载保管后明确移除，当前账户和其他副本不会被改动。
          </p>
        )}
        {copies.map((copy) => (
          <div
            className="restore-recovery__row"
            data-recovery-state={copy.kind === 'restore-damaged' ? 'damaged' : 'usable'}
            key={copy.key}
          >
            <p>
              {copy.kind === 'restore-damaged' && '损坏记录 · '}
              {copy.scope} · {copy.date ? new Date(copy.date).toLocaleString() : '创建时间无法读取'}
            </p>
            {copy.issue && (
              <p>
                {copy.issue}；
                {copy.exportable
                  ? '可下载原始内容留档，不能用于恢复。'
                  : '为保护原记录，不提供有损下载完成标记或移除。'}
              </p>
            )}
            <button
              type="button"
              className="button button--quiet"
              disabled={busy || !copy.exportable}
              onClick={() => void downloadCopy(copy)}
            >
              {copy.exportable
                ? copy.kind === 'restore-damaged'
                  ? '下载原始记录'
                  : '下载备份'
                : '无法安全导出'}
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={
                busy || !copy.exportable || copy.hash === null || downloaded[copy.key] !== copy.hash
              }
              onClick={() => requestRemoval(copy)}
            >
              {copy.exportable
                ? copy.kind === 'restore-damaged'
                  ? '移除损坏记录'
                  : '移除本机副本'
                : '无法安全移除'}
            </button>
          </div>
        ))}
        {message && <p role="status">{message}</p>}
      </dialog>
      {confirmTarget && (
        <dialog
          ref={confirmDialogRef}
          className="soda-asset-dialog restore-recovery__dialog restore-recovery__confirm-dialog"
          aria-labelledby={confirmTitleId}
          aria-describedby={confirmDescId}
          aria-modal="true"
          onCancel={(event) => {
            if (busy) event.preventDefault()
            else cancelRemoval()
          }}
          onClose={cancelRemoval}
        >
          <header>
            <h2 id={confirmTitleId}>
              {confirmTarget.kind === 'restore-damaged'
                ? `确认已妥善保管“${confirmTarget.scope}”的损坏原始记录？`
                : `确认已妥善保管“${confirmTarget.scope}”的恢复副本？`}
            </h2>
            <button
              type="button"
              className="button button--quiet quiet"
              disabled={busy}
              onClick={cancelRemoval}
            >
              关闭
            </button>
          </header>
          <p id={confirmDescId}>
            {confirmTarget.kind === 'restore-damaged'
              ? '确认后仅移除此条损坏记录，当前账户、活动账户指针和其他恢复副本保持不变。'
              : `副本创建于 ${confirmTarget.date ? new Date(confirmTarget.date).toLocaleString() : '未知时间'}。确认后仅移除此本机副本，账户资产保持不变；后续恢复须使用下载文件。`}
          </p>
          {confirmationError ? <p role="alert">{confirmationError}</p> : null}
          <div className="restore-recovery__confirm-actions">
            <button
              ref={confirmCancelRef}
              type="button"
              className="button button--quiet quiet"
              disabled={busy}
              onClick={cancelRemoval}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={() => void confirmAndRemove()}
            >
              {confirmTarget.kind === 'restore-damaged' ? '确认移除损坏记录' : '确认移除本机副本'}
            </button>
          </div>
        </dialog>
      )}
    </>
  )
}
