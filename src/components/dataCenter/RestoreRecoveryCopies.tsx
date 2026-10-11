import { useId, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createAccountBackup, getAccountBackupFilename } from '../../accounts/backup'
import { readRestoreRecoveries, removeSavedRestoreRecovery } from '../../accounts/restoreRecovery'
import { removeSavedAssetQuickReadRecovery } from '../../assetQuickRead/accountImport'
import { contentHash } from '../../application/contentHash'
import { database } from '../../db/databaseCore'
import { downloadJson } from './dataCenterTypes'
import './restore-recovery.css'

export function RestoreRecoveryCopies({ accountId }: { accountId?: string }) {
  const [message, setMessage] = useState('')
  const [downloaded, setDownloaded] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const copies = useLiveQuery(
    async () => {
      const replacements = (await readRestoreRecoveries()).map((row) => ({
        key: row.key,
        date: row.createdAt,
        scope: row.scope,
        hash: row.backupHash,
        backup: row.backup,
        quickRead: false,
      }))
      const quickReads = accountId
        ? (await database.accountPreferences.where('accountId').equals(accountId).toArray())
            .filter((row) => /^asset-quick-read-recovery-[a-f0-9]{64}$/.test(row.key))
            .map((row) => ({
              key: row.key,
              date: row.updatedAt,
              scope: '当前账户资产快读',
              hash: contentHash(row.value),
              backup: row.value,
              quickRead: true,
            }))
        : []
      return [...replacements, ...quickReads]
    },
    [accountId],
    [],
  )
  if (!copies.length && !open) return null

  function close() {
    dialogRef.current?.close?.()
    setOpen(false)
    openerRef.current?.focus()
  }

  async function perform(copy: (typeof copies)[number], remove: boolean) {
    setBusy(true)
    try {
      if (!remove) {
        if (copy.quickRead && accountId) {
          const backup = await createAccountBackup(accountId)
          const saved = backup.data.preferences.find((row) => row.key === copy.key)
          if (!saved || contentHash(saved.value) !== copy.hash)
            throw new Error('恢复副本已变化，请重新下载。')
          downloadJson(backup, getAccountBackupFilename(accountId))
        } else
          downloadJson(
            copy.backup,
            `soda-terminal-before-restore-${copy.date.slice(0, 10)}-${copy.key.slice(-8)}.json`,
          )
        setDownloaded((current) => ({ ...current, [copy.key]: copy.hash }))
        setMessage('已开始下载，请保管好文件。')
      } else {
        if (downloaded[copy.key] !== copy.hash)
          throw new Error('请先下载此副本并确认文件已妥善保管。')
        if (
          !window.confirm(
            `已妥善保管“${copy.scope}”在 ${new Date(copy.date).toLocaleString()} 的恢复副本？\n确认后仅移除此本机副本，账户资产保持不变；后续恢复须使用下载文件。`,
          )
        )
          return
        if (copy.quickRead && accountId)
          await removeSavedAssetQuickReadRecovery(
            accountId,
            copy.key,
            copy.hash,
            'downloaded_and_keep_external_copy',
          )
        else
          await removeSavedRestoreRecovery(copy.key, copy.hash, 'downloaded_and_keep_external_copy')
        setMessage('已移除本机副本，账户资料未改动。')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '恢复副本操作失败。')
    } finally {
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
        {copies.map((copy) => (
          <div className="restore-recovery__row" key={copy.key}>
            <p>
              {copy.scope} · {new Date(copy.date).toLocaleString()}
            </p>
            <button
              type="button"
              className="button button--quiet"
              disabled={busy}
              onClick={() => void perform(copy, false)}
            >
              下载备份
            </button>
            <button
              type="button"
              className="button button--quiet"
              disabled={busy || downloaded[copy.key] !== copy.hash}
              onClick={() => void perform(copy, true)}
            >
              移除本机副本
            </button>
          </div>
        ))}
        {message && <p role="status">{message}</p>}
      </dialog>
    </>
  )
}
