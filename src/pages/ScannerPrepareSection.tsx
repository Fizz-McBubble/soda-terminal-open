import { type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2 } from 'lucide-react'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import type { ScannerAccounts } from './ScannerAccountHydrationGate'
import { playerResultMessage } from './scannerAssistantStatePresentation'
import { PrepareChecklist } from './ScannerPrepareChecklist'
import { ScannerTargetAccountPicker } from './ScannerTargetAccountPicker'

export function ScannerPrepareSection({
  showPreparation,
  fallbackJson,
  showImportComplete,
  importedThisVisit,
  completedImportCount,
  selectedAccount,
  stageHeadingRef,
  onReturnToTargetSelection,
  actionFeedback,
  snapshot,
  diagnosticFeedback,
  restartingAfterCompletedResult,
  preparingNewScan,
  inlineImportOpen,
  presentedStateCopy,
  actionPending,
  targetReady,
  installer,
  accountDisclosure,
  accountMessage,
  accountState,
  effectiveSelectedAccountId,
  newAccountName,
  onSetSelectedAccountId,
  onSetNewAccountName,
  onCreateTargetAccount,
  canOpenInstalledHelper,
  onConnectOpenHelper,
  onConnectRetry,
  onRevokePairing,
  onStartBoundScan,
}: {
  showPreparation: boolean
  fallbackJson: React.ReactNode
  showImportComplete: boolean
  importedThisVisit: boolean
  completedImportCount: number | null
  selectedAccount: ScannerAccounts['accounts'][number] | undefined
  stageHeadingRef: RefObject<HTMLHeadingElement | null>
  onReturnToTargetSelection: () => void
  actionFeedback: string | null
  snapshot: ScannerAssistantSnapshot
  diagnosticFeedback?: React.ReactNode
  restartingAfterCompletedResult: boolean
  preparingNewScan: boolean
  inlineImportOpen: boolean
  presentedStateCopy: { eyebrow: string; title: string; body: string }
  actionPending: boolean
  targetReady: boolean
  installer: React.ReactNode
  accountDisclosure: React.ReactNode
  accountMessage: string
  accountState: ScannerAccounts
  effectiveSelectedAccountId: string
  newAccountName: string
  onSetSelectedAccountId: (id: string) => void
  onSetNewAccountName: (name: string) => void
  onCreateTargetAccount: () => void
  canOpenInstalledHelper: boolean
  onConnectOpenHelper: () => void
  onConnectRetry: () => void
  onRevokePairing: () => void
  onStartBoundScan: () => void
}) {
  const newAccountControls = (
    <div className="scanner-target-account__create">
      <label>
        <span id="scanner-target-account-heading">新账户名称</span>
        <input
          className="scanner-input"
          aria-label="新账户名称"
          maxLength={40}
          value={newAccountName}
          onChange={(event) => onSetNewAccountName(event.target.value)}
          placeholder="例如：我的主账号"
        />
      </label>
      <button
        className="button button--quiet"
        type="button"
        disabled={!newAccountName.trim()}
        onClick={onCreateTargetAccount}
      >
        {snapshot.state === 'completed' && !restartingAfterCompletedResult
          ? '创建账户并继续检查'
          : '创建并用于本次扫描'}
      </button>
    </div>
  )

  return (
    <>
      {showImportComplete ? (
        <section className="scanner-import-complete" aria-label="已导入扫描结果">
          <div className="scanner-task__completion" role="status" aria-live="polite">
            <CheckCircle2 aria-hidden="true" size={28} />
            <div>
              <h2 id="scanner-stage-heading" ref={stageHeadingRef} tabIndex={-1}>
                {importedThisVisit ? '驱动盘已进入当前账户' : '上次导入已完成'}
              </h2>
              <span>
                {completedImportCount} 张驱动盘已更新至
                {selectedAccount?.displayName ? `“${selectedAccount.displayName}”` : '当前账户'}
              </span>
            </div>
          </div>
          <div className="scanner-import-complete__next">
            <button
              className="button button--quiet"
              type="button"
              onClick={onReturnToTargetSelection}
            >
              重新扫描
            </button>
            <Link className="button button--primary scanner-web__primary-action" to="/assets/discs">
              查看驱动盘
            </Link>
          </div>
        </section>
      ) : null}
      {actionFeedback ? (
        <p className="scanner-task__feedback is-error" role="alert" aria-live="polite">
          {actionFeedback}
        </p>
      ) : null}
      {!showImportComplete &&
      !inlineImportOpen &&
      ['scanning', 'completed'].includes(snapshot.state) &&
      !restartingAfterCompletedResult &&
      !preparingNewScan ? (
        <div className="scanner-task__state-copy">
          <h2 id="scanner-stage-heading" ref={stageHeadingRef} tabIndex={-1}>
            {presentedStateCopy.title}
          </h2>
          <p>{presentedStateCopy.body}</p>
        </div>
      ) : null}

      {showPreparation ? (
        <PrepareChecklist
          fallbackJson={fallbackJson}
          snapshot={snapshot}
          diagnosticFeedback={diagnosticFeedback}
          actionPending={actionPending}
          eyebrow={presentedStateCopy.eyebrow}
          title={presentedStateCopy.title}
          body={presentedStateCopy.body}
          headingRef={stageHeadingRef}
          targetReady={targetReady}
          installer={installer}
          accountDisclosure={
            accountDisclosure || accountMessage ? (
              <>
                {accountDisclosure}
                {accountMessage ? (
                  <p role={targetReady ? 'status' : 'alert'} aria-live="polite">
                    {playerResultMessage(accountMessage)}
                  </p>
                ) : null}
              </>
            ) : null
          }
          targetPanel={
            <li
              className={`scanner-target-account is-${targetReady ? 'ready' : 'blocked'}`}
              aria-labelledby="scanner-target-account-heading"
            >
              <span className="scanner-prepare__check-icon" aria-hidden="true">
                {targetReady ? <Check size={16} strokeWidth={3} /> : <AlertTriangle size={16} />}
              </span>
              <div className="scanner-target-account__content">
                {accountState?.accounts.length ? (
                  <>
                    <ScannerTargetAccountPicker
                      accounts={accountState.accounts.map((account) => ({
                        id: account.id,
                        displayName: account.displayName,
                        discCount: accountState.discCounts.get(account.id) ?? 0,
                      }))}
                      selectedAccountId={effectiveSelectedAccountId}
                      onSelect={(accountId) => onSetSelectedAccountId(accountId)}
                    />
                    {newAccountControls}
                  </>
                ) : (
                  newAccountControls
                )}
              </div>
            </li>
          }
          onRecover={canOpenInstalledHelper ? onConnectOpenHelper : undefined}
          onReconnect={onConnectRetry}
          onRevoke={onRevokePairing}
          onStart={onStartBoundScan}
        />
      ) : null}
    </>
  )
}
