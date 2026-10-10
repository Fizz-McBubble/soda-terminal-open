import './asset-dialog.css'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { detectLocalDataFileKind } from '../../../application/localDataFile'
import type { AssetGoldenProps, BackupPreview } from './types'
import { SelectMenu } from './SelectMenu'
import { JsonFileDropTarget } from '../../JsonFileDropTarget'
import './account-file-drop.css'

export function AccountWorkspace({ props }: { props: AssetGoldenProps }) {
  const backupSectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const locateBackup = () => {
      if (window.location.hash === '#restore-backup')
        backupSectionRef.current?.scrollIntoView({ block: 'start' })
    }
    const frame = window.requestAnimationFrame(locateBackup)
    window.addEventListener('hashchange', locateBackup)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', locateBackup)
    }
  }, [])
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const inspectionGeneration = useRef(0)
  const [inspecting, setInspecting] = useState(false)
  useEffect(
    () => () => {
      inspectionGeneration.current += 1
    },
    [],
  )
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; displayName: string } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const hasAccount = props.accountId !== 'no-account'
  const ownedAgents = props.roster.agents.filter((item) => item.owned).length
  useEffect(() => {
    const dialog = dialogRef.current
    const focus = () => openerRef.current?.focus()
    dialog?.addEventListener('close', focus)
    return () => dialog?.removeEventListener('close', focus)
  }, [])
  const choose = async (file: File) => {
    const generation = ++inspectionGeneration.current
    setInspecting(true)
    setPreview(null)
    setOperationError(null)
    try {
      if (props.onOpenScanFile) {
        const kind = detectLocalDataFileKind(await file.text())
        if (generation !== inspectionGeneration.current) return
        if (kind === 'scan-result') {
          props.onOpenScanFile(file)
          return
        }
      }
      const next = await props.onInspectBackup(file)
      if (generation !== inspectionGeneration.current) return
      setPreview(next)
      if (typeof dialogRef.current?.showModal === 'function') {
        dialogRef.current.showModal()
      } else {
        setRestoreDialogOpen(true)
      }
    } catch (error) {
      if (generation !== inspectionGeneration.current) return
      setPreview(null)
      setOperationError(error instanceof Error ? error.message : '无法检查这份备份。')
    } finally {
      if (generation === inspectionGeneration.current) setInspecting(false)
    }
  }
  const receiveBackup = useEffectEvent((file: File) => {
    void choose(file)
    props.onIncomingBackupHandled?.()
  })
  useEffect(() => {
    const file = props.incomingBackupFile
    if (!file) return
    let active = true
    // Deliver the transferred selection after mounting; a cancelled mount must not inspect it.
    queueMicrotask(() => {
      if (active) receiveBackup(file)
    })
    return () => {
      active = false
    }
  }, [props.incomingBackupFile])
  const closeRestoreDialog = () => {
    inspectionGeneration.current += 1
    setPreview(null)
    setInspecting(false)
    if (typeof dialogRef.current?.close === 'function') dialogRef.current.close()
    else {
      setRestoreDialogOpen(false)
      openerRef.current?.focus()
    }
  }
  const openDeleteDialog = (account: { id: string; displayName: string }) => {
    setDeleteTarget(account)
    if (typeof deleteDialogRef.current?.showModal === 'function') {
      deleteDialogRef.current.showModal()
    } else {
      setDeleteDialogOpen(true)
    }
  }
  const closeDeleteDialog = () => {
    if (typeof deleteDialogRef.current?.close === 'function') deleteDialogRef.current.close()
    else setDeleteDialogOpen(false)
    setDeleteTarget(null)
  }
  return (
    <>
      <section className="account-overview account-flow">
        {operationError && !preview ? (
          <p className="r6-message" role="alert">
            {operationError}
          </p>
        ) : null}
        <header className="account-source">
          <div>
            <span className="kicker">当前账户</span>
            <h1>{props.accountName}</h1>
          </div>
          {hasAccount ? (
            <dl>
              <div>
                <dt>资料来源</dt>
                <dd>本机账户</dd>
              </div>
            </dl>
          ) : (
            <p>先建立独立本机账户，再录入代理人和驱动盘；音擎、邦布只在方案需要时确认。</p>
          )}
        </header>
        <aside className="account-sidebar" aria-label="本机账户">
          {props.accountOptions.length ? (
            <section className="account-switcher" aria-labelledby="account-switcher-title">
              <h2 id="account-switcher-title">切换当前账户</h2>
              <SelectMenu
                label="当前查看账户"
                value={props.accountId}
                options={props.accountOptions.map((account) => ({
                  value: account.id,
                  label: account.displayName,
                }))}
                onChange={(accountId) => {
                  setOperationError(null)
                  void Promise.resolve(props.onSelectAccount(accountId)).catch((error) =>
                    setOperationError(
                      error instanceof Error ? error.message : '无法切换当前账户。',
                    ),
                  )
                }}
              />
            </section>
          ) : null}
          <section className="account-management" aria-labelledby="account-management-title">
            <header className="account-management__header">
              <h2 id="account-management-title">账户管理</h2>
              <button
                className="primary"
                type="button"
                onClick={() => props.onPrimaryNavigate('/system/scanner')}
              >
                新建账户
              </button>
            </header>
            {props.accountOptions.length ? (
              <ul className="account-management-list" aria-label="本机账户列表">
                {props.accountOptions.map((account) => (
                  <li key={account.id}>
                    <span>
                      <strong>{account.displayName}</strong>
                      <small>{account.id === props.accountId ? '当前账户' : '本机账户'}</small>
                    </span>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => openDeleteDialog(account)}
                    >
                      删除账户
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="account-empty-note">当前没有本机账户。</p>
            )}
          </section>
        </aside>
        <div className="account-main">
          {hasAccount ? (
            <section className="account-range" aria-labelledby="range-title">
              <div>
                <h2 id="range-title">账户资产</h2>
              </div>
              <dl className="range-facts">
                <div>
                  <dt>代理人</dt>
                  <dd>
                    {ownedAgents} / {props.catalog.agents.length}
                  </dd>
                </div>
                <div>
                  <dt>驱动盘</dt>
                  <dd>{props.discs.length} 张</dd>
                </div>
              </dl>
            </section>
          ) : null}
          {hasAccount ? (
            <section className="backup-create">
              <div>
                <span className="kicker">创建备份</span>
                <h2>保存当前资料</h2>
                <p>将当前账户资料下载到本机，方便之后恢复。</p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setOperationError(null)
                  void props
                    .onCreateBackup()
                    .catch((error) =>
                      setOperationError(
                        error instanceof Error ? error.message : '无法导出当前账户备份。',
                      ),
                    )
                }}
              >
                导出备份文件
              </button>
            </section>
          ) : null}
          <JsonFileDropTarget
            className="backup-history"
            id="restore-backup"
            ref={backupSectionRef}
            aria-label="选择或拖入本机备份"
            disabled={restoring || Boolean(preview)}
            onFile={choose}
            onRejected={setOperationError}
          >
            <header>
              <div>
                <span className="kicker">恢复资料</span>
                <h2>选择本机备份</h2>
              </div>
              <small>先检查备份内容，确认恢复后才会改动账户。</small>
            </header>
            <div className="backup-row">
              <span>
                <strong>选择或拖入备份文件</strong>
                <small>账户备份或扫描结果（JSON），自动识别后检查</small>
              </span>
              <button
                ref={openerRef}
                className="quiet"
                disabled={restoring}
                title="支持直接拖入一个 JSON 文件，检查后再确认恢复"
                onClick={() => inputRef.current?.click()}
              >
                {inspecting ? '正在检查，可重新选择' : '选择并检查'}
              </button>
              <input
                ref={inputRef}
                hidden
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void choose(file)
                  event.currentTarget.value = ''
                }}
              />
            </div>
          </JsonFileDropTarget>
          {props.onRestoreAcceptanceAccount ? (
            <section className="acceptance-recovery" aria-labelledby="acceptance-recovery-title">
              <div>
                <span className="kicker">产品验收</span>
                <h2 id="acceptance-recovery-title">恢复隔离的完整验收账户</h2>
                <p>
                  显式重建 57 名代理人、当前音擎目录、41 名邦布与 400
                  张测试驱动盘；不会覆盖其他账户或已保存方案。
                </p>
              </div>
              <button
                className="primary"
                type="button"
                onClick={() => void props.onRestoreAcceptanceAccount?.()}
              >
                恢复 N2 验收账户
              </button>
            </section>
          ) : null}
        </div>
      </section>
      <dialog
        className="soda-asset-dialog"
        ref={dialogRef}
        open={restoreDialogOpen || undefined}
        aria-labelledby="restore-title"
        onCancel={(event) => {
          if (restoring) event.preventDefault()
        }}
        onClose={() => setRestoreDialogOpen(false)}
      >
        <form>
          <header>
            <div>
              <small>恢复确认</small>
              <h2 id="restore-title">用所选备份恢复账户？</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="关闭"
              disabled={restoring}
              onClick={closeRestoreDialog}
            >
              ×
            </button>
          </header>
          {preview && (
            <>
              <p>
                将恢复“{preview.accountName}”在 {new Date(preview.exportedAt).toLocaleString()}{' '}
                导出的资料。若备份对应的账户已存在，其资料将被完整替换；其他账户不受影响。
              </p>
              <dl className="restore-facts">
                <div>
                  <dt>文件</dt>
                  <dd>{preview.fileName}</dd>
                </div>
                <div>
                  <dt>备份内容</dt>
                  <dd>{preview.scope}</dd>
                </div>
              </dl>
            </>
          )}
          {operationError && preview ? <p role="alert">{operationError}</p> : null}
          <footer>
            <button
              type="button"
              className="quiet"
              disabled={restoring}
              onClick={closeRestoreDialog}
            >
              取消
            </button>
            <button
              type="button"
              className="danger"
              disabled={restoring}
              onClick={() => {
                if (!preview) return
                setOperationError(null)
                setRestoring(true)
                void props
                  .onRestore(preview)
                  .then(closeRestoreDialog)
                  .catch((error) =>
                    setOperationError(
                      error instanceof Error ? error.message : '无法恢复这份备份。',
                    ),
                  )
                  .finally(() => setRestoring(false))
              }}
            >
              {restoring ? '正在恢复…' : '恢复这份备份'}
            </button>
          </footer>
        </form>
      </dialog>
      <dialog
        className="soda-asset-dialog"
        ref={deleteDialogRef}
        open={deleteDialogOpen || undefined}
        aria-labelledby="delete-account-title"
        onCancel={(event) => {
          if (deleting) event.preventDefault()
        }}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <form>
          <header>
            <div>
              <small>永久删除</small>
              <h2 id="delete-account-title">删除“{deleteTarget?.displayName}”？</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="关闭"
              disabled={deleting}
              onClick={closeDeleteDialog}
            >
              ×
            </button>
          </header>
          <p>该账户的代理人、音擎、邦布、驱动盘、扫描记录、偏好与已保存方案都会永久删除。</p>
          <p>页面内不能撤销；只有此前导出的备份可以恢复。</p>
          <footer>
            <button type="button" className="quiet" disabled={deleting} onClick={closeDeleteDialog}>
              取消
            </button>
            <button
              type="button"
              className="danger"
              disabled={deleting || !deleteTarget}
              onClick={() => {
                if (!deleteTarget) return
                setDeleting(true)
                void props
                  .onDeleteAccount(deleteTarget.id)
                  .then((deleted) => {
                    if (deleted) closeDeleteDialog()
                  })
                  .finally(() => setDeleting(false))
              }}
            >
              {deleting ? '正在删除…' : '永久删除账户'}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  )
}
