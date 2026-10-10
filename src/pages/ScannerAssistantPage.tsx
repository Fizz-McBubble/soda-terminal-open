import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, ScanLine } from 'lucide-react'
import { F5ScannerGoldenView } from '../components/F5GoldenViews'
import { JsonFileDropTarget } from '../components/JsonFileDropTarget'
import { assessScannerAssistantInput } from '../scanner/assistant'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'
import { useScannerAssistantRuntime } from '../scanner/runtime'
import { useScannerHelperAction } from '../scanner/runtimeHelperVersion'
import { useScannerFailureDiagnostic } from '../scanner/scanFeedback'
import { ScannerDiagnosticFeedback } from './ScannerDiagnosticFeedback'
import { ScannerInstallerAction } from './ScannerInstallerAction'
import { ScannerAccountGate, type ScannerAccounts } from './ScannerAccountHydrationGate'
import {
  completedScannerImportKey,
  getScannerPresentedStateCopy,
  getScannerStateCopy,
  readCompletedScannerImport,
  type CompletedScannerImport,
} from './scannerAssistantStatePresentation'
import { AssetQuickReadController } from './AssetQuickReadController'
import { AssetCaptureMethodsNotice, AssetCaptureRiskNotice } from './AssetCaptureMethodsNotice'
import {
  ScannerAccountBackupReview,
  type ScannerAccountBackupReviewState,
} from './ScannerAccountBackupReview'
import { ScannerTargetAccountPicker } from './ScannerTargetAccountPicker'
import { PrepareChecklist } from './ScannerPrepareChecklist'
import { ScannerGuide } from './ScannerGuide'
import { ScannerHandoffSection } from './ScannerHandoffSection'
import { ScannerJourneyCards } from './ScannerJourneyCards'
import { ScannerCompletedSummary } from './ScannerCompletedSummary'
import { ScannerFallbackJsonSection } from './ScannerFallbackJsonSection'
import { ScannerPrepareSection } from './ScannerPrepareSection'
import { createPrepareChecks } from './scannerPrepareChecks'
import { ScannerScanningSection } from './ScannerScanningSection'
import { useScannerTargetBinding } from './useScannerTargetBinding'
import { beginUsageOperation } from '../usageStatistics/client'
import { detectLocalDataFileKind } from '../application/localDataFile'
import { useScannerDataFileHandoff } from '../scanner/useScannerDataFileHandoff'
import './scanner-workbench.css'

export function ScannerAssistantPage() {
  return (
    <ScannerAccountGate>
      {(accountState, refreshAccounts) => (
        <HydratedScannerAssistantPage
          accountState={accountState}
          refreshAccounts={refreshAccounts}
        />
      )}
    </ScannerAccountGate>
  )
}

function HydratedScannerAssistantPage({
  accountState,
  refreshAccounts,
}: {
  accountState: ScannerAccounts
  refreshAccounts: () => void
}) {
  const navigate = useNavigate()
  const { snapshot: runtimeSnapshot, commands } = useScannerAssistantRuntime()
  const [assessment, setAssessment] = useState(() => assessScannerAssistantInput({ kind: 'empty' }))
  const [selectedJson, setSelectedJson] = useState<File | null>(null)
  const [taskSource, setTaskSource] = useState<'scanner' | 'scan-file' | 'quick-read' | 'backup'>(
    'scanner',
  )
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupRevision, setBackupRevision] = useState(0)
  const [backupState, setBackupState] = useState<ScannerAccountBackupReviewState>('checking')
  const [filePending, setFilePending] = useState(false)
  const filePendingRef = useRef(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const creatingAccountRef = useRef(false)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [installerAttention, setInstallerAttention] = useState(false)
  const [actionIssueCode, setActionIssueCode] = useState<string | null>(null)
  const snapshot = useScannerHelperAction(runtimeSnapshot, actionIssueCode)
  useScannerDataFileHandoff(snapshot.state, inspectJson)
  const [actionPending, setActionPending] = useState(false)
  const actionPendingRef = useRef(false)
  const [inlineImportOpen, setInlineImportOpen] = useState(false)
  const [importedThisVisit, setImportedThisVisit] = useState(false)
  const [preparingAnotherScan, setPreparingAnotherScan] = useState(false)
  const [completedImport, setCompletedImport] = useState<CompletedScannerImport | null>(
    readCompletedScannerImport,
  )
  const stageHeadingRef = useRef<HTMLHeadingElement>(null)
  const stageFocusRequestedRef = useRef(false)
  const distribution = snapshot.distribution ?? initialDistributionSnapshot
  const canOpenInstalledHelper =
    !snapshot.readiness.helperConnected &&
    snapshot.error?.diagnosticCode !== 'helper_incompatible' &&
    scannerDistributionManifest.runtime.releaseState !== 'not_published'
  const prepareGateReady = useMemo(
    () => createPrepareChecks(snapshot).every((check) => check.status === 'ready'),
    [snapshot],
  )
  const effectiveSelectedAccountId =
    selectedAccountId || accountState?.activeAccount?.id || accountState?.accounts[0]?.id || ''
  const selectedAccount = accountState?.accounts.find(
    (account) => account.id === effectiveSelectedAccountId,
  )
  const targetReady = Boolean(selectedAccount)
  const completedImportCount =
    completedImport &&
    completedImport.accountId === selectedAccount?.id &&
    !['checking', 'awaiting_elevation', 'scanning', 'paused'].includes(snapshot.state) &&
    !(
      completedImport.attemptReportId &&
      snapshot.diagnostics?.reportId &&
      completedImport.attemptReportId !== snapshot.diagnostics.reportId
    ) &&
    !(
      completedImport.resultFileHandle &&
      snapshot.summary?.resultFileHandle &&
      completedImport.resultFileHandle !== snapshot.summary.resultFileHandle
    )
      ? completedImport.count
      : null

  useEffect(() => {
    if (
      !stageFocusRequestedRef.current ||
      snapshot.state === 'connecting' ||
      snapshot.state === 'checking' ||
      snapshot.state === 'awaiting_elevation'
    )
      return
    stageHeadingRef.current?.focus()
    stageFocusRequestedRef.current = false
  }, [snapshot.state])

  async function runScannerAction(
    action: () => void | Promise<void>,
    issueCode = 'scanner_failure',
  ) {
    stageFocusRequestedRef.current = true
    setActionFeedback(null)
    setActionIssueCode(null)
    try {
      await action()
    } catch (error) {
      setActionIssueCode(
        error instanceof Error && error.name === 'ScannerHelperCompatibilityError'
          ? 'helper_incompatible'
          : error instanceof Error && error.message === 'helper_pairing_denied'
            ? 'helper_pairing_denied'
            : issueCode,
      )
      setActionFeedback(
        error instanceof Error && error.message.includes('扫描')
          ? error.message
          : window.location.protocol === 'https:'
            ? '未能连接扫描助手。请确认助手已运行，并允许本站连接本机设备后重试。'
            : '未能连接扫描助手，请确认助手已运行后重试。',
      )
    }
  }

  async function connectScanner(action: () => void | Promise<void>) {
    if (actionPendingRef.current) return
    actionPendingRef.current = true
    setActionPending(true)
    const finishUsage = beginUsageOperation('scanner_connection')
    try {
      await runScannerAction(async () => {
        try {
          await action()
          finishUsage('success')
        } catch (error) {
          finishUsage('failure')
          throw error
        }
      }, 'helper_unavailable')
    } finally {
      actionPendingRef.current = false
      setActionPending(false)
    }
  }

  const {
    binding: {
      targetBinding,
      setTargetBinding,
      frozenTargetValidation,
      frozenTargetIssue,
      completedBindingIssue,
      scanIdentityEvidence,
    },
    handoff: {
      handoffState,
      setHandoffState,
      discardDraftConfirmationOpen,
      setDiscardDraftConfirmationOpen,
      discardedCompletedResultHandle,
    },
    actions: {
      startPending,
      startBoundScan,
      createTargetAccount,
      returnToTargetSelection,
      handOffResult,
      discardIncompleteDraftAndRetry,
      repairCompletedBatchAndRetry,
      bindCompletedResultToSelectedAccount,
      handOffFallbackJson,
    },
  } = useScannerTargetBinding({
    account: { accountState, refreshAccounts, selectedAccount, newAccountName, selectedJson },
    runtime: { snapshot, commands, runScannerAction, stageFocusRequestedRef },
    update: {
      setSelectedAccountId,
      setNewAccountName,
      setAccountMessage,
      setCompletedImport,
      setPreparingAnotherScan,
      setInlineImportOpen,
    },
  })

  const failureDiagnostic = useScannerFailureDiagnostic(
    snapshot,
    handoffState.status === 'error'
      ? (handoffState.issueCode ?? 'scan_import_handoff_failed')
      : actionFeedback
        ? actionIssueCode
        : null,
  )
  const jsonReadRef = useRef(0)
  const jsonTargetRef = useRef(effectiveSelectedAccountId)
  useEffect(() => {
    if (['checking', 'awaiting_elevation', 'scanning', 'paused'].includes(snapshot.state))
      jsonReadRef.current += 1
    return () => {
      jsonReadRef.current += 1
    }
  }, [snapshot.state, snapshot.diagnostics?.reportId, snapshot.summary?.resultFileHandle])
  useEffect(() => {
    const previous = jsonTargetRef.current
    jsonTargetRef.current = effectiveSelectedAccountId
    if (previous && previous !== effectiveSelectedAccountId && filePendingRef.current) {
      jsonReadRef.current += 1
      filePendingRef.current = false
      setFilePending(false)
      setTaskSource('scan-file')
      setHandoffState({
        status: 'error',
        message: '目标账户已变化，请重新选择文件。账户资产尚未更新。',
        issueCode: 'scan_file_invalid',
      })
    }
  }, [effectiveSelectedAccountId, setHandoffState])

  async function inspectJson(
    file: File | undefined,
    inspectQuickFile?: (file: File) => Promise<void>,
  ) {
    if (!file || scannerBusy || backupPending) return
    filePendingRef.current = true
    setFilePending(true)
    setPreparingAnotherScan(true)
    const requestId = ++jsonReadRef.current
    setSelectedJson(null)
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error('file_too_large')
      const text = await file.text()
      if (requestId !== jsonReadRef.current) return
      if (detectLocalDataFileKind(text) === 'account-backup') {
        setTaskSource('backup')
        setBackupState('checking')
        setBackupRevision((revision) => revision + 1)
        setBackupFile(file)
        return
      }
      const value: unknown = JSON.parse(text)
      if (
        value &&
        typeof value === 'object' &&
        'schema' in value &&
        value.schema === 'soda-asset-snapshot-probe/v1'
      ) {
        if (!inspectQuickFile) throw new Error('quick_read_handler_unavailable')
        setTaskSource('quick-read')
        await inspectQuickFile(file)
        return
      }
      setTaskSource('scan-file')
      const next = assessScannerAssistantInput({ kind: 'json', name: file.name, text })
      setAssessment(next)
      setPreparingAnotherScan(true)
      if (next.canHandOff) {
        setSelectedJson(file)
        setHandoffState({ status: 'idle' })
        if (targetReady) await handOffFallbackJson(file)
      } else
        setHandoffState({ status: 'error', message: next.message, issueCode: 'scan_file_invalid' })
    } catch {
      if (requestId !== jsonReadRef.current) return
      setTaskSource('scan-file')
      setHandoffState({
        status: 'error',
        message: '无法读取这份文件，请重新选择有效的扫描结果文件（JSON）。',
        issueCode: 'scan_file_invalid',
      })
    } finally {
      if (requestId === jsonReadRef.current) {
        filePendingRef.current = false
        setFilePending(false)
      }
    }
  }

  const stateCopy = useMemo(
    () => getScannerStateCopy(snapshot, targetReady, prepareGateReady),
    [prepareGateReady, snapshot, targetReady],
  )

  const resultEligibleForFormalReview =
    snapshot.summary?.resultStatus === 'ready_for_review' ||
    snapshot.summary?.resultStatus === 'needs_review'
  const restartingAfterCompletedResult =
    snapshot.state === 'completed' &&
    Boolean(snapshot.summary?.resultFileHandle) &&
    discardedCompletedResultHandle === snapshot.summary?.resultFileHandle
  // Reconnecting can replay the old completion before its result handle is known.
  // Only an explicit new start leaves preparation, not a late helper snapshot.
  const preparingNewScan = preparingAnotherScan
  const showImportComplete =
    completedImportCount !== null &&
    !inlineImportOpen &&
    !restartingAfterCompletedResult &&
    !preparingNewScan
  const showPreparation =
    !showImportComplete &&
    !inlineImportOpen &&
    ([
      'unchecked',
      'connecting',
      'checking',
      'awaiting_elevation',
      'connection_failed',
      'ready',
    ].includes(snapshot.state) ||
      restartingAfterCompletedResult ||
      preparingNewScan)
  const fallbackJson =
    !showImportComplete &&
    !inlineImportOpen &&
    !['scanning', 'paused', 'checking', 'awaiting_elevation'].includes(snapshot.state) &&
    (snapshot.state !== 'completed' ||
      preparingNewScan ||
      restartingAfterCompletedResult ||
      handoffState.status === 'error') ? (
      <ScannerFallbackJsonSection
        selectedJson={selectedJson}
        assessment={assessment}
        targetReady={targetReady}
        busy={handoffState.status === 'working'}
        onInspectJson={(file) => void inspectJson(file)}
        onHandOffFallbackJson={() => void handOffFallbackJson()}
      />
    ) : null
  const visualState =
    restartingAfterCompletedResult || preparingNewScan
      ? 'ready'
      : snapshot.state === 'completed'
        ? completedBindingIssue
          ? 'review_required'
          : frozenTargetValidation.valid && resultEligibleForFormalReview
            ? 'import_ready'
            : 'completed'
        : snapshot.state
  const currentReceivingAccountName = selectedAccount?.displayName ?? '尚未选择接收账户'
  const accountDisclosure = selectedAccount ? (
    <p className="scanner-target-account__summary">
      <strong>
        {(accountState?.discCounts.get(selectedAccount.id) ?? 0) === 0
          ? '建立驱动盘仓库'
          : '更新此账户仓库'}
      </strong>
      <span>
        “{selectedAccount.displayName}”当前
        {(accountState?.discCounts.get(selectedAccount.id) ?? 0) === 0
          ? '为空仓库'
          : `有 ${accountState?.discCounts.get(selectedAccount.id) ?? 0} 张驱动盘`}
        ；确认后完整替换此账户的驱动盘，不合并。扫描期间不会改动账户。
      </span>
    </p>
  ) : null

  const renderInstaller = (connectionBlocked = false) => (
    <ScannerInstallerAction
      distribution={distribution}
      issueCode={snapshot.error?.diagnosticCode}
      onConnect={() => connectScanner(commands.retryConnection)}
      connectionBlocked={connectionBlocked}
      onAttentionChange={setInstallerAttention}
    />
  )
  const installer = renderInstaller()

  const presentedStateCopy = getScannerPresentedStateCopy({
    restartingAfterCompletedResult,
    preparingNewScan,
    selectedAccount: Boolean(selectedAccount),
    completedImportCount,
    snapshotState: snapshot.state,
    visualState,
    scanIdentityEvidenceValue: scanIdentityEvidence.value,
    currentReceivingAccountName,
    stateCopy,
  })

  const journeyStep =
    preparingNewScan || restartingAfterCompletedResult
      ? 0
      : inlineImportOpen
        ? 2
        : showImportComplete
          ? 3
          : snapshot.state === 'completed'
            ? 2
            : ['scanning', 'paused'].includes(snapshot.state)
              ? 1
              : ['capture', 'scroll', 'ocr'].includes(failureDiagnostic?.stage ?? '')
                ? 1
                : ['result', 'import'].includes(failureDiagnostic?.stage ?? '')
                  ? 2
                  : 0

  const resultSummary = (
    <ScannerCompletedSummary snapshot={snapshot} completedImportCount={completedImportCount} />
  )

  const scannerBusy =
    actionPending ||
    startPending ||
    handoffState.status === 'working' ||
    ['connecting', 'checking', 'awaiting_elevation', 'scanning', 'paused'].includes(snapshot.state)
  const scannerReviewPending =
    inlineImportOpen ||
    (snapshot.state === 'completed' &&
      !showImportComplete &&
      !preparingNewScan &&
      !restartingAfterCompletedResult)
  const backupPending = Boolean(backupFile && !['completed', 'error'].includes(backupState))
  const hasScannerTask =
    startPending ||
    ['scanning', 'paused'].includes(snapshot.state) ||
    (scannerBusy && !actionPending) ||
    scannerReviewPending ||
    showImportComplete ||
    taskSource === 'scan-file' ||
    Boolean(
      snapshot.error &&
      (snapshot.diagnostics?.reportId ||
        (snapshot.state === 'connection_failed' && snapshot.readiness.helperConnected) ||
        snapshot.progress?.processed),
    )
  const scannerTask = (
    <>
      <ScannerPrepareSection
        showPreparation={showPreparation}
        fallbackJson={fallbackJson}
        taskOnly
        showImportComplete={showImportComplete}
        importedThisVisit={importedThisVisit}
        completedImportCount={completedImportCount}
        selectedAccount={selectedAccount}
        stageHeadingRef={stageHeadingRef}
        onReturnToTargetSelection={() => void returnToTargetSelection()}
        actionFeedback={actionFeedback}
        snapshot={snapshot}
        diagnosticFeedback={
          (snapshot.state !== 'completed' || preparingNewScan || restartingAfterCompletedResult) &&
          failureDiagnostic ? (
            <ScannerDiagnosticFeedback report={failureDiagnostic} />
          ) : null
        }
        restartingAfterCompletedResult={restartingAfterCompletedResult}
        preparingNewScan={preparingNewScan}
        inlineImportOpen={inlineImportOpen}
        presentedStateCopy={presentedStateCopy}
        actionPending={actionPending || startPending}
        targetReady={targetReady}
        installer={installer}
        accountDisclosure={accountDisclosure}
        accountMessage={accountMessage}
        accountState={accountState}
        effectiveSelectedAccountId={effectiveSelectedAccountId}
        newAccountName={newAccountName}
        onSetSelectedAccountId={(id) => {
          setSelectedAccountId(id)
          setAccountMessage('')
        }}
        onSetNewAccountName={setNewAccountName}
        onCreateTargetAccount={() => void createTargetAccount()}
        canOpenInstalledHelper={canOpenInstalledHelper}
        onConnectOpenHelper={() => void connectScanner(() => commands.openHelper(true))}
        onConnectRetry={() => void connectScanner(() => commands.retryConnection())}
        onRevokePairing={() => void runScannerAction(() => commands.revokePairing())}
        onStartBoundScan={() => void startBoundScan()}
      />

      {['scanning', 'paused'].includes(snapshot.state) ? (
        <ScannerScanningSection
          targetBinding={targetBinding}
          frozenTargetIssue={frozenTargetIssue}
          snapshot={snapshot}
          onReturnToTargetSelection={() => void returnToTargetSelection()}
          onSafeStop={() => runScannerAction(() => commands.safeStop())}
        />
      ) : null}

      {!showImportComplete &&
      (snapshot.state === 'completed' || inlineImportOpen) &&
      !['scanning', 'paused', 'checking', 'awaiting_elevation'].includes(snapshot.state) &&
      !restartingAfterCompletedResult &&
      !preparingNewScan ? (
        <ScannerHandoffSection
          sharedTargetSelection
          inlineImportOpen={inlineImportOpen}
          snapshot={snapshot}
          accountState={accountState}
          selectedAccount={selectedAccount}
          effectiveSelectedAccountId={effectiveSelectedAccountId}
          frozenTargetValidation={frozenTargetValidation}
          resultEligibleForFormalReview={resultEligibleForFormalReview}
          completedBindingIssue={completedBindingIssue}
          scanIdentityEvidence={scanIdentityEvidence}
          currentReceivingAccountName={currentReceivingAccountName}
          resultSummary={resultSummary}
          newAccountName={newAccountName}
          onSetNewAccountName={setNewAccountName}
          onCreateTargetAccount={() => void createTargetAccount()}
          handoffState={handoffState}
          diagnosticFeedback={<ScannerDiagnosticFeedback report={failureDiagnostic} />}
          onImportError={(issueCode, message) =>
            setHandoffState({ status: 'error', message, issueCode })
          }
          discardDraftConfirmationOpen={discardDraftConfirmationOpen}
          onSelectAccountId={(accountId) => {
            setSelectedAccountId(accountId)
            setAccountMessage('')
            setHandoffState({ status: 'idle' })
          }}
          onReturnToTargetSelection={() => void returnToTargetSelection()}
          onImportSuccess={(imported) => {
            const next = {
              count: imported,
              accountId: selectedAccount?.id ?? '',
              attemptReportId: snapshot.diagnostics?.reportId,
              resultFileHandle: snapshot.summary?.resultFileHandle,
            }
            // The committed import and live UI remain authoritative when
            // optional browser storage is full or disabled.
            try {
              window.localStorage.setItem(completedScannerImportKey, JSON.stringify(next))
            } catch {
              // Formal import proof in IndexedDB can restore completion.
            }
            setImportedThisVisit(true)
            setCompletedImport(next)
            setInlineImportOpen(false)
            setPreparingAnotherScan(false)
            setTargetBinding(null)
            refreshAccounts()
          }}
          onHandOffResult={() => void handOffResult()}
          onBindCompletedResult={() => void bindCompletedResultToSelectedAccount()}
          onSetDiscardDraftConfirmationOpen={setDiscardDraftConfirmationOpen}
          onDiscardIncompleteDraftAndRetry={() => void discardIncompleteDraftAndRetry()}
          onRepairCompletedBatchAndRetry={() => void repairCompletedBatchAndRetry()}
        />
      ) : null}

      {taskSource === 'scan-file' && !inlineImportOpen && !showImportComplete && (
        <section className="scanner-workbench__file-check" aria-label="扫描结果文件检查">
          <h2>
            {filePending
              ? '正在识别本机文件'
              : assessment.canHandOff
                ? '扫描结果文件已就绪'
                : '检查本机文件'}
          </h2>
          {selectedJson && <p>{selectedJson.name}</p>}
          <p role={handoffState.status === 'error' ? 'alert' : 'status'}>
            {handoffState.status === 'error' ? handoffState.message : assessment.message}
          </p>
          {selectedJson && (
            <button
              className="button button--primary"
              type="button"
              disabled={!targetReady || scannerBusy}
              onClick={() => void handOffFallbackJson()}
            >
              继续检查并导入
            </button>
          )}
          <button
            className="button button--quiet"
            type="button"
            disabled={scannerBusy}
            onClick={() => {
              setSelectedJson(null)
              setHandoffState({ status: 'idle' })
              setTaskSource('scanner')
            }}
          >
            关闭文件检查
          </button>
        </section>
      )}
    </>
  )

  return (
    <AssetQuickReadController
      targetAccountId={selectedAccount?.id}
      targetAccountName={selectedAccount?.displayName}
      activeAccountId={accountState.activeAccount?.id}
      onImported={refreshAccounts}
      onTaskStart={() => setTaskSource('quick-read')}
      onViewAssets={() => navigate('/assets/agents')}
      riskNoticeHref="#scanner-capture-methods"
      preparationCondensed={hasScannerTask || Boolean(backupFile) || filePending}
      blocked={scannerBusy || scannerReviewPending || backupPending}
      workbench={(quick) => {
        const quickPending = quick.busy || quick.state === 'received'
        const otherTaskPending = quickPending || backupPending || filePending
        const accountLocked = scannerBusy || quick.busy || filePending || backupPending
        const activeTask =
          taskSource === 'backup' && backupFile
            ? 'backup'
            : taskSource === 'quick-read' && quick.hasTask
              ? 'quick-read'
              : hasScannerTask
                ? taskSource === 'scan-file'
                  ? 'scan-file'
                  : 'scanner'
                : null
        const currentStep =
          activeTask === 'quick-read'
            ? quick.state === 'completed'
              ? 3
              : quick.state === 'received'
                ? 2
                : ['starting', 'capturing'].includes(quick.state)
                  ? 1
                  : 0
            : activeTask === 'backup'
              ? backupState === 'completed'
                ? 3
                : 2
              : journeyStep
        const condenseScannerPreparation =
          Boolean(activeTask) &&
          !installerAttention &&
          !(activeTask === 'scanner' && snapshot.error)
        const newAccountForm = (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (accountLocked || creatingAccountRef.current) return
              creatingAccountRef.current = true
              setCreatingAccount(true)
              void createTargetAccount().finally(() => {
                creatingAccountRef.current = false
                setCreatingAccount(false)
              })
            }}
          >
            <label>
              新账户名称
              <input
                className="scanner-input"
                aria-label="新账户名称"
                maxLength={40}
                disabled={accountLocked || creatingAccount}
                placeholder="例如：我的主账号"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
              />
            </label>
            <button
              className="button button--quiet"
              type="submit"
              disabled={accountLocked || creatingAccount || !newAccountName.trim()}
            >
              {creatingAccount ? '正在创建账户' : '创建并用于本次操作'}
            </button>
          </form>
        )
        const fileLocked =
          scannerBusy ||
          (scannerReviewPending && handoffState.status !== 'error') ||
          quickPending ||
          backupPending ||
          filePending
        return (
          <F5ScannerGoldenView
            runtimeState={snapshot.state}
            visualState={visualState}
            task={
              <JsonFileDropTarget
                className="scanner-task scanner-workbench"
                aria-labelledby="scanner-page-heading"
                disabled={fileLocked}
                onFile={(file) => inspectJson(file, quick.inspectFile)}
                onRejected={setAccountMessage}
              >
                <h1 id="scanner-page-heading" className="scanner-workbench__page-heading">
                  扫描与导入
                </h1>
                <section className="scanner-workbench__target" aria-label="本次操作目标账户">
                  <div className="scanner-workbench__account">
                    <ScannerTargetAccountPicker
                      label="目标账户"
                      showCount={false}
                      disabled={accountLocked}
                      accounts={accountState.accounts.map((account) => ({
                        ...account,
                        discCount: accountState.discCounts.get(account.id) ?? 0,
                      }))}
                      selectedAccountId={effectiveSelectedAccountId}
                      onSelect={(id) => {
                        setSelectedAccountId(id)
                        setAccountMessage('')
                        setHandoffState({ status: 'idle' })
                      }}
                    />
                  </div>
                  {accountState.accounts.length > 0 ? (
                    <details
                      className="scanner-workbench__new-account"
                      open={!targetReady || undefined}
                    >
                      <summary>新建账户</summary>
                      {newAccountForm}
                    </details>
                  ) : (
                    <div className="scanner-workbench__new-account is-empty">{newAccountForm}</div>
                  )}
                  <label
                    className={`button button--quiet scanner-workbench__file-button${fileLocked ? ' is-disabled' : ''}`}
                    title="点击选择或直接拖入一个 JSON 文件；检查后再确认写入账户"
                  >
                    <FileUp size={18} aria-hidden="true" />
                    选择或拖入 JSON
                    <input
                      type="file"
                      accept=".json,application/json"
                      aria-label="选择本机文件（JSON）"
                      disabled={fileLocked}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        void inspectJson(file, quick.inspectFile)
                      }}
                    />
                  </label>
                  {accountMessage && !inlineImportOpen && handoffState.status === 'idle' && (
                    <p className="scanner-workbench__account-message" role="status">
                      {accountMessage}
                    </p>
                  )}
                </section>
                <AssetCaptureRiskNotice detailHref="#scanner-capture-methods" />
                <section className="scanner-workbench__acquisition" aria-label="获取资产">
                  <h2>获取资产</h2>
                  <div className="scanner-workbench__methods">
                    <section
                      className="scanner-workbench__method scanner-workbench__ocr"
                      aria-labelledby="scanner-method-heading"
                    >
                      <header className="scanner-workbench__method-heading">
                        <h3 id="scanner-method-heading">
                          <ScanLine size={22} aria-hidden="true" />
                          画面扫描
                        </h3>
                        <ScannerGuide />
                      </header>
                      <p className="scanner-workbench__scope">S 级驱动盘 · 无需重新登录</p>
                      {scannerReviewPending ? (
                        <p role="status">扫描结果已收到，请在下方完成检查或放弃本次结果。</p>
                      ) : scannerBusy && !actionPending ? (
                        <>
                          <p role="status">本次扫描正在进行，进度与停止操作见下方任务。</p>
                          {['checking', 'awaiting_elevation'].includes(snapshot.state) && (
                            <button
                              className="button button--primary"
                              type="button"
                              disabled
                              aria-busy="true"
                            >
                              {snapshot.state === 'checking' ? '正在检查' : '等待 Windows 权限确认'}
                            </button>
                          )}
                        </>
                      ) : (
                        <details
                          className="scanner-workbench__controls scanner-workbench__preparation"
                          open={!condenseScannerPreparation}
                          data-condensed={Boolean(activeTask)}
                        >
                          <summary hidden={!activeTask}>扫描准备与工具</summary>
                          <PrepareChecklist
                            compact
                            blocked={otherTaskPending}
                            snapshot={snapshot}
                            actionPending={actionPending || startPending}
                            eyebrow={presentedStateCopy.eyebrow}
                            title={
                              snapshot.readiness.helperConnected
                                ? '扫描助手已连接'
                                : '扫描助手未连接'
                            }
                            body={
                              (hasScannerTask && snapshot.state === 'connection_failed'
                                ? '本次扫描未完成，处理情况与恢复操作见下方任务。'
                                : snapshot.error?.userMessage) ??
                              (snapshot.readiness.helperConnected
                                ? snapshot.distribution?.state === 'ready'
                                  ? '开始扫描后，助手会自动检查游戏画面。'
                                  : (snapshot.distribution?.message ?? presentedStateCopy.body)
                                : '首次使用先下载并安装扫描助手，再连接。')
                            }
                            headingRef={stageHeadingRef}
                            targetReady={targetReady}
                            targetPanel={null}
                            installer={renderInstaller(otherTaskPending)}
                            accountDisclosure={accountDisclosure}
                            diagnosticFeedback={
                              failureDiagnostic && !hasScannerTask ? (
                                <ScannerDiagnosticFeedback report={failureDiagnostic} />
                              ) : null
                            }
                            onRecover={
                              canOpenInstalledHelper
                                ? () => void connectScanner(() => commands.openHelper(true))
                                : undefined
                            }
                            onReconnect={() =>
                              void connectScanner(() => commands.retryConnection())
                            }
                            onRevoke={() => void runScannerAction(() => commands.revokePairing())}
                            onStart={() => {
                              if (otherTaskPending || filePendingRef.current) return
                              setTaskSource('scanner')
                              setSelectedJson(null)
                              void startBoundScan()
                            }}
                          />
                          {actionFeedback && (
                            <p className="scanner-task__feedback is-error" role="alert">
                              {actionFeedback}
                            </p>
                          )}
                        </details>
                      )}
                    </section>
                    <fieldset
                      className="scanner-workbench__method scanner-workbench__quick scanner-workbench__controls"
                      disabled={filePending}
                    >
                      {quick.preparation}
                    </fieldset>
                  </div>
                </section>
                {filePending && !activeTask && <p role="status">正在识别本机文件…</p>}
                {activeTask && (
                  <section className="scanner-workbench__task" aria-label="本次任务">
                    <header className="scanner-workbench__task-heading">
                      <h2>本次任务</h2>
                      <span>
                        {activeTask === 'backup'
                          ? '账户备份'
                          : activeTask === 'quick-read'
                            ? '资产快读'
                            : activeTask === 'scan-file'
                              ? '扫描文件'
                              : '画面扫描'}
                        {activeTask !== 'backup' && selectedAccount
                          ? ` · ${selectedAccount.displayName}`
                          : ''}
                      </span>
                    </header>
                    <ScannerJourneyCards shared currentStep={currentStep} />
                    {activeTask === 'backup' && backupFile ? (
                      <ScannerAccountBackupReview
                        file={backupFile}
                        scopeKey={`backup-file:${backupRevision}`}
                        disabled={scannerBusy || quickPending}
                        onStateChange={setBackupState}
                        onRestored={refreshAccounts}
                        onClose={() => {
                          setBackupFile(null)
                          setTaskSource('scanner')
                        }}
                      />
                    ) : activeTask === 'quick-read' ? (
                      quick.task
                    ) : (
                      scannerTask
                    )}
                  </section>
                )}
                {quick.recovery}
                <AssetCaptureMethodsNotice id="scanner-capture-methods" showCommon={false} />
              </JsonFileDropTarget>
            }
          />
        )
      }}
    />
  )
}
