import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, ShieldCheck } from 'lucide-react'
import { F5ScannerGoldenView } from '../components/F5GoldenViews'
import { assessScannerAssistantInput } from '../scanner/assistant'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'
import { useScannerAssistantRuntime } from '../scanner/runtime'
import { ScannerAccountGate, type ScannerAccounts } from './ScannerAccountHydrationGate'
import {
  completedScannerImportKey,
  getScannerPresentedStateCopy,
  getScannerStateCopy,
  readCompletedScannerImport,
  type CompletedScannerImport,
} from './scannerAssistantStatePresentation'
import { ScannerFallbackJsonSection } from './ScannerFallbackJsonSection'
import { ScannerHandoffSection } from './ScannerHandoffSection'
import { ScannerJourneyCards } from './ScannerJourneyCards'
import { ScannerPrepareSection } from './ScannerPrepareSection'
import { createPrepareChecks } from './scannerPrepareChecks'
import { ScannerScanningSection } from './ScannerScanningSection'
import { useScannerTargetBinding } from './useScannerTargetBinding'
import { beginUsageOperation } from '../usageStatistics/client'

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
  const { snapshot, commands } = useScannerAssistantRuntime()
  const [assessment, setAssessment] = useState(() => assessScannerAssistantInput({ kind: 'empty' }))
  const [selectedJson, setSelectedJson] = useState<File | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
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
    completedImport && completedImport.accountId === selectedAccount?.id
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

  async function runScannerAction(action: () => void | Promise<void>) {
    stageFocusRequestedRef.current = true
    setActionFeedback(null)
    try {
      await action()
    } catch (error) {
      setActionFeedback(
        error instanceof Error && error.message.includes('扫描')
          ? error.message
          : '扫描助手未就绪，可重新连接。',
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
      })
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

  async function inspectJson(file: File | undefined) {
    if (!file) return
    setSelectedJson(null)
    const text = await file.text()
    const next = assessScannerAssistantInput({ kind: 'json', name: file.name, text })
    setAssessment(next)
    if (next.canHandOff) setSelectedJson(file)
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

  const installer =
    distribution.state !== 'ready' &&
    scannerDistributionManifest.runtime.releaseState !== 'not_published' ? (
      <a
        className="button button--quiet scanner-prepare__download"
        href={scannerDistributionManifest.helper.downloadUrl}
        download
        title="首次安装或修复扫描助手"
      >
        <Download aria-hidden="true" size={17} />
        首次使用：下载安装
      </a>
    ) : null

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
        : completedImportCount !== null
          ? 3
          : snapshot.state === 'completed'
            ? 2
            : ['scanning', 'paused'].includes(snapshot.state)
              ? 1
              : 0

  const resultSummary =
    snapshot.state === 'completed' ? (
      <div className="scanner-web__summary" aria-label="驱动盘导入摘要">
        <article>
          <AlertTriangle aria-hidden="true" size={20} />
          <span>本次结果</span>
          <strong>{snapshot.summary?.uniqueRecords ?? 0}</strong>
          <small>
            可直接导入 {snapshot.summary?.reliable ?? 0} · 待检查{' '}
            {snapshot.summary?.needsReview ?? 0}
          </small>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" size={20} />
          <span>更新账户</span>
          <strong>{completedImportCount ?? 0}</strong>
          <small>
            {completedImportCount === null ? '确认导入前不会改动账户' : '当前账户已更新'}
          </small>
        </article>
      </div>
    ) : null

  return (
    <F5ScannerGoldenView
      runtimeState={snapshot.state}
      visualState={visualState}
      task={
        <section className="scanner-task" aria-labelledby="scanner-page-heading">
          <header className="scanner-task__top">
            <div>
              <h1 id="scanner-page-heading">扫描与导入</h1>
              <p>扫描游戏中的驱动盘，核对结果后，由你确认导入当前账户。</p>
            </div>
          </header>
          <ScannerJourneyCards currentStep={journeyStep} />
          <ScannerPrepareSection
            showImportComplete={showImportComplete}
            importedThisVisit={importedThisVisit}
            completedImportCount={completedImportCount}
            selectedAccount={selectedAccount}
            stageHeadingRef={stageHeadingRef}
            onReturnToTargetSelection={() => void returnToTargetSelection()}
            actionFeedback={actionFeedback}
            snapshot={snapshot}
            restartingAfterCompletedResult={restartingAfterCompletedResult}
            preparingNewScan={preparingNewScan}
            inlineImportOpen={inlineImportOpen}
            presentedStateCopy={presentedStateCopy}
            actionPending={actionPending}
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

          {snapshot.state === 'scanning' ? (
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
          !restartingAfterCompletedResult &&
          !preparingNewScan ? (
            <ScannerHandoffSection
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
              discardDraftConfirmationOpen={discardDraftConfirmationOpen}
              onSelectAccountId={(accountId) => {
                setSelectedAccountId(accountId)
                setAccountMessage('')
                setHandoffState({ status: 'idle' })
              }}
              onReturnToTargetSelection={() => void returnToTargetSelection()}
              onImportSuccess={(imported) => {
                const next = { count: imported, accountId: selectedAccount?.id ?? '' }
                window.localStorage.setItem(completedScannerImportKey, JSON.stringify(next))
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

          {!showImportComplete &&
          !inlineImportOpen &&
          (snapshot.state === 'connection_failed' ||
            (selectedJson !== null && !['scanning', 'completed'].includes(snapshot.state))) ? (
            <ScannerFallbackJsonSection
              selectedJson={selectedJson}
              assessment={assessment}
              targetReady={targetReady}
              onInspectJson={(file) => void inspectJson(file)}
              onHandOffFallbackJson={() => void handOffFallbackJson()}
            />
          ) : null}
        </section>
      }
    />
  )
}
