import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createAccountBackup,
  createVaultBackup,
  getAccountBackupFilename,
  getVaultBackupFilename,
} from '../accounts/backup'
import { createAccount, saveAccountPreference, setActiveAccount } from '../accounts/repository'
import { useAppHealth } from '../appHealthContext'
import { driveDiscData } from '../data/gameData'
import './account-backup-ux-r1.css'
import {
  backupSummary,
  downloadJson,
  idleFileState,
  lastFullBackupPreference,
} from './dataCenter/dataCenterTypes'
import { useDataCenterAccountState } from './dataCenter/useDataCenterAccountState'
import { useDataCenterFileOperations } from './dataCenter/useDataCenterFileOperations'
import { DataCenterAccountCard } from './dataCenter/DataCenterAccountCard'
import { DataCenterAccountTools } from './dataCenter/DataCenterAccountTools'
import { DataCenterBackupPanels } from './dataCenter/DataCenterBackupPanels'
import { DataCenterRestoreConfirmationDialog } from './dataCenter/DataCenterRestoreConfirmationDialog'

export function DataCenterPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data } = useAppHealth()
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [createValue, setCreateValue] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [restoringAccount, setRestoringAccount] = useState(false)
  const [message, setMessage] = useState('')
  const [switchingAccountName, setSwitchingAccountName] = useState<string | null>(null)
  const [activatingAccountId, setActivatingAccountId] = useState<string | null>(null)
  const [activationError, setActivationError] = useState<string | null>(null)
  const [repreflightFeedback, setRepreflightFeedback] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')

  const restoreDialogRef = useRef<HTMLDivElement>(null)
  const restoreCancelRef = useRef<HTMLButtonElement>(null)
  const restoreTriggerRef = useRef<HTMLDivElement>(null)
  const createActionTriggerRef = useRef<HTMLButtonElement>(null)
  const restoreActionTriggerRef = useRef<HTMLButtonElement>(null)

  const accountState = useDataCenterAccountState(revision)

  const {
    fileState,
    setFileState,
    restoreConfirmation,
    setRestoreConfirmation,
    restoreDisplayName,
    setRestoreDisplayName,
    inspectFile,
    executeRecognition,
    confirmAccountRestore,
  } = useDataCenterFileOperations({
    accountState,
    data,
    discData: driveDiscData,
    setBusy,
    setMessage,
    setRevision,
  })

  useEffect(() => {
    if (!restoreConfirmation) return
    window.requestAnimationFrame(() => restoreCancelRef.current?.focus())
  }, [restoreConfirmation])

  useEffect(() => {
    if (!restoringAccount) return
    window.requestAnimationFrame(() => restoreTriggerRef.current?.focus())
  }, [restoringAccount])

  async function exportAccount(accountId = accountState?.active?.id) {
    const account = accountState?.accounts.find((candidate) => candidate.id === accountId)
    if (!account) return
    setBusy(true)
    try {
      const backup = await createAccountBackup(account.id)
      downloadJson(backup, getAccountBackupFilename(account.id))
      await saveAccountPreference(account.id, lastFullBackupPreference, backup.exportedAt)
      setMessage(`“${account.displayName}”的备份已下载。`)
      setRevision((current) => current + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份导出失败。')
    } finally {
      setBusy(false)
    }
  }

  async function exportVault() {
    setBusy(true)
    try {
      const backup = await createVaultBackup()
      downloadJson(backup, getVaultBackupFilename())
      setMessage('全部账号保险库备份已生成并下载。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保险库备份导出失败。')
    } finally {
      setBusy(false)
    }
  }

  async function selectAccount(accountId: string) {
    const nextAccount = accountState?.accounts.find((account) => account.id === accountId)
    setSwitchingAccountName(nextAccount?.displayName ?? '所选账户')
    try {
      await setActiveAccount(accountId)
      setFileState(idleFileState)
      setRevision((current) => current + 1)
    } finally {
      setSwitchingAccountName(null)
    }
  }

  async function activateLocalAccount(accountId: string) {
    const account = accountState?.accounts.find((candidate) => candidate.id === accountId)
    if (!account) return
    setActivatingAccountId(accountId)
    setActivationError(null)
    try {
      await setActiveAccount(accountId)
      setMessage(`已设为当前账户：${account.displayName}。`)
      setRevision((current) => current + 1)
    } catch (error) {
      setActivationError(
        error instanceof Error
          ? `${error.message} 未切换，账户数据未改动。`
          : '未切换，账户数据未改动。请重试。',
      )
    } finally {
      setActivatingAccountId(null)
    }
  }

  async function saveNewAccount() {
    const displayName = createValue.trim()
    if (!displayName) {
      setMessage('请先填写新账户名称。')
      return
    }
    setBusy(true)
    try {
      const account = await createAccount(displayName)
      await setActiveAccount(account.id)
      setCreateValue('')
      setCreatingAccount(false)
      setFileState(idleFileState)
      setMessage(`已创建并切换到 ${account.displayName}。`)
      setRevision((current) => current + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '账户创建失败，原数据未变化。')
    } finally {
      setBusy(false)
    }
  }

  function closeInlineAction(action: 'create' | 'restore') {
    if (action === 'create') {
      setCreatingAccount(false)
      window.requestAnimationFrame(() => createActionTriggerRef.current?.focus())
      return
    }
    setRestoringAccount(false)
    window.requestAnimationFrame(() => restoreActionTriggerRef.current?.focus())
  }

  function handleInlineActionKeys(event: KeyboardEvent<HTMLElement>, action: 'create' | 'restore') {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    closeInlineAction(action)
  }

  function handleRestoreDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setRestoreConfirmation(null)
      window.requestAnimationFrame(() => restoreTriggerRef.current?.focus())
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), summary, a[href]',
      ),
    )
    if (!controls.length) return
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function previewRepreflight() {
    if (!accountState?.active) {
      setRepreflightFeedback('error')
      return
    }
    setRepreflightFeedback('loading')
    window.setTimeout(() => setRepreflightFeedback('success'), 0)
  }

  const pendingBackup =
    fileState.recognition?.kind === 'account_backup'
      ? fileState.recognition.backupPreflight.backup
      : undefined
  const backupScope = pendingBackup ? backupSummary(pendingBackup) : null
  const matchingLocalAccount = pendingBackup
    ? accountState?.accounts.find((account) => account.id === pendingBackup.account.id)
    : undefined
  const sameNameLocalAccounts = pendingBackup
    ? (accountState?.accounts.filter(
        (account) =>
          account.id !== pendingBackup.account.id &&
          account.displayName.toLocaleLowerCase() ===
            pendingBackup.account.displayName.toLocaleLowerCase(),
      ) ?? [])
    : []

  return (
    <div className="page-stack data-center-page account-backup-r1">
      {!embedded ? (
        <header className="workflow-header">
          <div>
            <h1>账户与备份</h1>
            <p>查看当前账户的数据状态，并在需要时安全处理备份。</p>
          </div>
        </header>
      ) : null}

      {message && (
        <p className="form-message" aria-live="polite">
          {message}
        </p>
      )}
      {!embedded ? (
        <section className="panel" aria-labelledby="data-center-scanner-heading">
          <div className="panel__header">
            <div>
              <span className="eyebrow">LOCAL TOOL</span>
              <h2 id="data-center-scanner-heading">扫描与导入</h2>
            </div>
          </div>
          <p>先在独立本地助手检查截图或扫描暂存 JSON；助手不会读取账户或直接导入。</p>
          <Link className="button button--quiet" to="/system/scanner">
            打开扫描助手
          </Link>
        </section>
      ) : null}
      <section aria-label="账户与备份" className="data-center-account account-backup-r1__workspace">
        {!embedded && (
          <DataCenterAccountCard
            embedded={embedded}
            accountState={accountState}
            switchingAccountName={switchingAccountName}
            activatingAccountId={activatingAccountId}
            activationError={activationError}
            repreflightFeedback={repreflightFeedback}
            onActivateLocalAccount={activateLocalAccount}
            onPreviewRepreflight={previewRepreflight}
          />
        )}

        <DataCenterAccountTools
          accountState={accountState}
          busy={busy}
          switchingAccountName={switchingAccountName}
          creatingAccount={creatingAccount}
          restoringAccount={restoringAccount}
          createValue={createValue}
          fileState={fileState}
          createActionTriggerRef={createActionTriggerRef}
          restoreActionTriggerRef={restoreActionTriggerRef}
          restoreTriggerRef={restoreTriggerRef}
          onSelectAccount={selectAccount}
          onExportAccount={exportAccount}
          onToggleCreatingAccount={() => {
            setCreatingAccount((current) => !current)
            setRestoringAccount(false)
          }}
          onToggleRestoringAccount={() => {
            setRestoringAccount((current) => !current)
            setCreatingAccount(false)
          }}
          onSetCreateValue={setCreateValue}
          onSaveNewAccount={saveNewAccount}
          onCloseInlineAction={closeInlineAction}
          onHandleInlineActionKeys={handleInlineActionKeys}
          onInspectFile={inspectFile}
          onSetFilePhase={(phase) => setFileState((current) => ({ ...current, phase }))}
          onExecuteRecognition={executeRecognition}
          onResetFileState={() => setFileState(idleFileState)}
        />

        {!embedded && (
          <DataCenterBackupPanels
            accountState={accountState}
            busy={busy}
            fileState={fileState}
            restoreTriggerRef={restoreTriggerRef}
            onExportAccount={exportAccount}
            onExportVault={exportVault}
            onInspectFile={inspectFile}
            onSetFilePhase={(phase) => setFileState((current) => ({ ...current, phase }))}
            onExecuteRecognition={executeRecognition}
            onResetFileState={() => setFileState(idleFileState)}
          />
        )}
      </section>

      {restoreConfirmation && pendingBackup && backupScope && (
        <DataCenterRestoreConfirmationDialog
          restoreConfirmation={restoreConfirmation}
          pendingBackup={pendingBackup}
          backupScope={backupScope}
          matchingLocalAccount={matchingLocalAccount}
          sameNameLocalAccounts={sameNameLocalAccounts}
          restoreDisplayName={restoreDisplayName}
          onRestoreDisplayNameChange={setRestoreDisplayName}
          onCancel={() => {
            setRestoreConfirmation(null)
            window.requestAnimationFrame(() => restoreTriggerRef.current?.focus())
          }}
          onConfirm={confirmAccountRestore}
          restoreDialogRef={restoreDialogRef}
          restoreCancelRef={restoreCancelRef}
          handleRestoreDialogKeys={handleRestoreDialogKeys}
        />
      )}
    </div>
  )
}
