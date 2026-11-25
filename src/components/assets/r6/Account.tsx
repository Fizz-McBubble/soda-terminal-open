import { playerErrorMessage } from '../../../application/playerErrorMessage'
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
import { AccountRestoreDialog } from './AccountRestoreDialog'

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
  const restoreCancelRef = useRef<HTMLButtonElement>(null)
  const deleteOpenerRef = useRef<HTMLButtonElement | null>(null)
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
  const [backupOperation, setBackupOperation] = useState<{
    accountId: string
    status: 'idle' | 'exporting' | 'success'
  }>({ accountId: props.accountId, status: 'idle' })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const hasAccount = props.accountId !== 'no-account'
  const ownedAgents = props.roster.agents.filter((item) => item.owned).length
  const backupState =
    backupOperation.accountId === props.accountId ? backupOperation.status : 'idle'
  useEffect(() => {
    const dialog = dialogRef.current
    const focus = () => openerRef.current?.focus()
    dialog?.addEventListener('close', focus)
    return () => dialog?.removeEventListener('close', focus)
  }, [])
  const openRestoreDialog = () => {
    if (typeof dialogRef.current?.showModal === 'function') dialogRef.current.showModal()
    else setRestoreDialogOpen(true)
    window.requestAnimationFrame(() => restoreCancelRef.current?.focus())
  }
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
      openRestoreDialog()
    } catch (error) {
      if (generation !== inspectionGeneration.current) return
      setPreview(null)
      setOperationError(playerErrorMessage(error, '无法检查这份备份。'))
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
  const openDeleteDialog = (
    account: { id: string; displayName: string },
    opener: HTMLButtonElement,
  ) => {
    deleteOpenerRef.current = opener
    setDeleteError(null)
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
    setDeleteError(null)
    window.requestAnimationFrame(() => deleteOpenerRef.current?.focus())
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
      setRenameError(playerErrorMessage(error, '无法重命名账户，请重试。'))
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
            <p>先建立本机账户，再记录代理人。音擎与邦布可先浏览图鉴。</p>
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
                    setOperationError(playerErrorMessage(error, '无法切换当前账户。')),
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
                        onClick={(event) => openDeleteDialog(account, event.currentTarget)}
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
                <h2 id="range-title">账户记录概览</h2>
              </div>
              <dl className="range-facts">
                <div>
                  <dt>已拥有代理人</dt>
                  <dd>{ownedAgents} 名</dd>
                </div>
                <div>
                  <dt>已记录驱动盘</dt>
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
                <p>
                  将当前账户的养成资料、驱动盘、鉴定和已保存方案一起导出。恢复时先核对备份里的账户。
                </p>
              </div>
              <button
                className="primary"
                aria-busy={backupState === 'exporting' || undefined}
                disabled={backupState === 'exporting'}
                onClick={() => {
                  const exportingAccountId = props.accountId
                  setOperationError(null)
                  setBackupOperation({ accountId: exportingAccountId, status: 'exporting' })
                  void props
                    .onCreateBackup()
                    .then(() =>
                      setBackupOperation((current) =>
                        current.accountId === exportingAccountId
                          ? { accountId: exportingAccountId, status: 'success' }
                          : current,
                      ),
                    )
                    .catch((error) => {
                      setBackupOperation((current) =>
                        current.accountId === exportingAccountId
                          ? { accountId: exportingAccountId, status: 'idle' }
                          : current,
                      )
                      setOperationError(playerErrorMessage(error, '无法导出当前账户备份。'))
                    })
                }}
              >
                {backupState === 'exporting' ? '正在准备备份…' : '导出备份文件'}
              </button>
              {backupState === 'success' ? (
                <p className="account-action-feedback" role="status">
                  备份文件已生成，请检查浏览器下载列表。
                </p>
              ) : null}
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
      <AccountRestoreDialog
        dialogRef={dialogRef}
        open={restoreDialogOpen}
        restoring={restoring}
        restorePendingRef={restorePendingRef}
        preview={preview}
        operationError={operationError}
        restoreCancelRef={restoreCancelRef}
        onClose={closeRestoreDialog}
        onNativeClose={() => setRestoreDialogOpen(false)}
        onPreviewChange={setPreview}
        onConfirmRestore={() => {
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
            .catch((error) => setOperationError(playerErrorMessage(error, '无法恢复这份备份。')))
            .finally(() => {
              restorePendingRef.current = false
              setRestoring(false)
            })
        }}
      />
      <AccountDeleteDialog
        dialogRef={deleteDialogRef}
        open={deleteDialogOpen}
        deleting={deleting}
        error={deleteError}
        deleteTarget={deleteTarget}
        onClose={closeDeleteDialog}
        onConfirmDelete={() => {
          if (!deleteTarget) return
          setDeleteError(null)
          setDeleting(true)
          void props
            .onDeleteAccount(deleteTarget.id)
            .then((deleted) => {
              if (deleted) closeDeleteDialog()
              else setDeleteError('删除失败，请重试。')
            })
            .catch((error) =>
              setDeleteError(playerErrorMessage(error, '删除失败，账户资料保持不变。')),
            )
            .finally(() => setDeleting(false))
        }}
      />
    </>
  )
}
