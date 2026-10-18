import './asset-dialog.css'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { detectLocalDataFileKind } from '../../../application/localDataFile'
import type { AssetGoldenProps, BackupPreview } from './types'
import { SelectMenu } from './SelectMenu'
import { JsonFileDropTarget } from '../../JsonFileDropTarget'
import { JsonFilePicker } from '../../JsonFilePicker'
import './account-file-drop.css'
import { RestoreRecoveryCopies } from '../../dataCenter/RestoreRecoveryCopies'
import { AccountDeleteDialog, AccountRenameDialog } from './AccountWorkspaceDialogs'
import { AccountRestorePreview } from './AccountRestorePreview'

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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const renameDialogRef = useRef<HTMLDialogElement>(null)
  const renameOpenerRef = useRef<HTMLButtonElement | null>(null)
  const renamePendingRef = useRef(false)
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
  const [renameTarget, setRenameTarget] = useState<{ id: string; displayName: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const restorePendingRef = useRef(false)
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
        if (kind === 'asset-snapshot') {
          setOperationError(
            '这是资产快读结果，请到“扫描与导入”页面使用“选择或拖入 JSON”继续。账户资料未被修改。',
          )
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
  const closeRenameDialog = () => {
    if (renamePendingRef.current) return
    if (typeof renameDialogRef.current?.close === 'function') renameDialogRef.current.close()
    setRenameDialogOpen(false)
    setRenameTarget(null)
    renameOpenerRef.current?.focus()
  }
  const saveRename = async () => {
    if (!renameTarget || renamePendingRef.current) return
    const displayName = renameValue.trim()
    if (!displayName) {
      setRenameError('账户名称不能为空。')
      return
    }
    renamePendingRef.current = true
    setRenaming(true)
    setRenameError(null)
    try {
      await props.onRenameAccount(renameTarget.id, displayName)
      renamePendingRef.current = false
      closeRenameDialog()
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : '无法重命名账户，请重试。')
    } finally {
      renamePendingRef.current = false
      setRenaming(false)
    }
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
                    <div className="account-management-actions">
                      <button
                        className="quiet"
                        type="button"
                        onClick={(event) => {
                          renameOpenerRef.current = event.currentTarget
                          setRenameTarget(account)
                          setRenameValue(account.displayName)
                          setRenameError(null)
                          if (typeof renameDialogRef.current?.showModal === 'function') {
                            renameDialogRef.current.showModal()
                          } else setRenameDialogOpen(true)
                        }}
                      >
                        重命名
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => openDeleteDialog(account)}
                      >
                        删除账户
                      </button>
                    </div>
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
              <RestoreRecoveryCopies accountId={hasAccount ? props.accountId : undefined} />
            </header>
            <JsonFilePicker
              buttonRef={openerRef}
              disabled={restoring}
              checking={inspecting}
              onFile={choose}
            />
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
      <AccountRenameDialog
        dialogRef={renameDialogRef}
        open={renameDialogOpen}
        pendingRef={renamePendingRef}
        value={renameValue}
        renaming={renaming}
        error={renameError}
        onClose={closeRenameDialog}
        onChangeValue={(val) => {
          setRenameValue(val)
          setRenameError(null)
        }}
        onSave={() => void saveRename()}
      />
      <dialog
        className="soda-asset-dialog"
        ref={dialogRef}
        open={restoreDialogOpen || undefined}
        aria-labelledby="restore-title"
        onCancel={(event) => {
          event.preventDefault()
          if (!restorePendingRef.current) closeRestoreDialog()
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
            <AccountRestorePreview preview={preview} restoring={restoring} onChange={setPreview} />
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
                if (!preview || restorePendingRef.current) return
                restorePendingRef.current = true
                const generation = inspectionGeneration.current
                const beforeCommit = () => {
                  if (generation !== inspectionGeneration.current)
                    throw new Error('本次恢复已失效，请重新选择备份。')
                }
                setOperationError(null)
                setRestoring(true)
                void props
                  .onRestore(preview, beforeCommit)
                  .then(closeRestoreDialog)
                  .catch((error) =>
                    setOperationError(
                      error instanceof Error ? error.message : '无法恢复这份备份。',
                    ),
                  )
                  .finally(() => {
                    restorePendingRef.current = false
                    setRestoring(false)
                  })
              }}
            >
              {restoring
                ? '正在恢复…'
                : preview?.identity === 'same_name_different_id'
                  ? '作为独立账号恢复'
                  : '恢复这份备份'}
            </button>
          </footer>
        </form>
      </dialog>
      <AccountDeleteDialog
        dialogRef={deleteDialogRef}
        open={deleteDialogOpen}
        deleting={deleting}
        deleteTarget={deleteTarget}
        onClose={closeDeleteDialog}
        onConfirmDelete={() => {
          if (!deleteTarget) return
          setDeleting(true)
          void props
            .onDeleteAccount(deleteTarget.id)
            .then((deleted) => {
              if (deleted) closeDeleteDialog()
            })
            .finally(() => setDeleting(false))
        }}
      />
    </>
  )
}
