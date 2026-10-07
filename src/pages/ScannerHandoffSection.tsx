import { ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import type { useScannerTargetBinding } from './useScannerTargetBinding'
import { FormalDiscImportPage } from './FormalDiscImportPage'
import type { ScannerAccounts } from './ScannerAccountHydrationGate'
import type { HandoffState } from './scannerAssistantPresentation'
import { playerResultMessage } from './scannerAssistantStatePresentation'
import { ScannerDiscardDraftDialog } from './ScannerDiscardDraftDialog'
import { ScannerTargetAccountPicker } from './ScannerTargetAccountPicker'

export function ScannerHandoffSection({
  inlineImportOpen,
  snapshot,
  accountState,
  selectedAccount,
  effectiveSelectedAccountId,
  frozenTargetValidation,
  resultEligibleForFormalReview,
  completedBindingIssue,
  scanIdentityEvidence,
  currentReceivingAccountName,
  resultSummary,
  newAccountName,
  onSetNewAccountName,
  onCreateTargetAccount,
  handoffState,
  diagnosticFeedback,
  onImportError,
  discardDraftConfirmationOpen,
  onSelectAccountId,
  onReturnToTargetSelection,
  onImportSuccess,
  onHandOffResult,
  onBindCompletedResult,
  onSetDiscardDraftConfirmationOpen,
  onDiscardIncompleteDraftAndRetry,
  onRepairCompletedBatchAndRetry,
}: {
  inlineImportOpen: boolean
  snapshot: ScannerAssistantSnapshot
  accountState: ScannerAccounts
  selectedAccount: ScannerAccounts['accounts'][number] | undefined
  effectiveSelectedAccountId: string
  frozenTargetValidation: ReturnType<
    typeof useScannerTargetBinding
  >['binding']['frozenTargetValidation']
  resultEligibleForFormalReview: boolean
  completedBindingIssue: { title: string; message: string } | null
  scanIdentityEvidence: { source: string; value: string }
  currentReceivingAccountName: string
  resultSummary: React.ReactNode
  newAccountName?: string
  onSetNewAccountName?: (name: string) => void
  onCreateTargetAccount?: () => void
  handoffState: HandoffState
  diagnosticFeedback?: React.ReactNode
  onImportError?: (issueCode: 'scan_import_failed' | 'scan_file_invalid', message: string) => void
  discardDraftConfirmationOpen: boolean
  onSelectAccountId: (id: string) => void
  onReturnToTargetSelection: () => void
  onImportSuccess: (imported: number) => void
  onHandOffResult: () => void
  onBindCompletedResult: () => void
  onSetDiscardDraftConfirmationOpen: (open: boolean) => void
  onDiscardIncompleteDraftAndRetry: () => void
  onRepairCompletedBatchAndRetry: () => void
}) {
  const discardTriggerRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="scanner-web__handoff">
      {inlineImportOpen ? (
        <FormalDiscImportPage
          embedded
          compact
          secondaryAction={
            <button
              className="button button--quiet"
              type="button"
              onClick={onReturnToTargetSelection}
            >
              返回准备，重新扫描
            </button>
          }
          onImportSuccess={onImportSuccess}
          onError={onImportError}
        />
      ) : frozenTargetValidation.valid && resultEligibleForFormalReview ? (
        <section className="scanner-result-ready" aria-label="扫描结果与下一步">
          <div className="scanner-result-ready__facts">
            <div className="scanner-completed-account">
              <span>本次扫描保存到</span>
              <strong title={frozenTargetValidation.binding.displayName}>
                {frozenTargetValidation.binding.displayName}
              </strong>
            </div>
            {resultSummary}
          </div>
          <div className="scanner-result-ready__next">
            <div className="scanner-result-ready__actions">
              <button
                className="button button--primary scanner-web__primary-action"
                type="button"
                disabled={handoffState.status === 'working'}
                onClick={onHandOffResult}
              >
                {handoffState.status === 'working'
                  ? '正在检查结果'
                  : snapshot.summary?.needsReview
                    ? '检查需确认的记录'
                    : '查看扫描结果'}
                <ChevronRight aria-hidden="true" size={18} />
              </button>
              <button
                className="button button--quiet"
                type="button"
                onClick={onReturnToTargetSelection}
              >
                {handoffState.status === 'working' ? '取消读取并返回准备' : '放弃此结果并重新扫描'}
              </button>
            </div>
            <p>确认导入前不会更新账户仓库。</p>
          </div>
        </section>
      ) : completedBindingIssue ? (
        <section
          className="scanner-target-review"
          role="alert"
          aria-labelledby="scanner-target-review-heading"
        >
          <h3 className="visually-hidden" id="scanner-target-review-heading">
            {completedBindingIssue.title}
          </h3>
          <p className="visually-hidden">{completedBindingIssue.message}</p>
          <dl className="scanner-account-evidence" aria-label="账户归属比较" role="group">
            <div>
              <dt>扫描识别账户</dt>
              <dd title={`${scanIdentityEvidence.source}：${scanIdentityEvidence.value}`}>
                <strong>{scanIdentityEvidence.value}</strong>
              </dd>
            </div>
            <div>
              <dt>当前接收账户</dt>
              <dd title={`账户选择器当前指向：${currentReceivingAccountName}`}>
                <strong>{currentReceivingAccountName}</strong>
              </dd>
            </div>
          </dl>
          {accountState?.accounts.length ? (
            <ScannerTargetAccountPicker
              accounts={accountState.accounts.map((account) => ({
                id: account.id,
                displayName: account.displayName,
                discCount: accountState.discCounts.get(account.id) ?? 0,
              }))}
              selectedAccountId={effectiveSelectedAccountId}
              onSelect={onSelectAccountId}
            />
          ) : null}
          {resultSummary}
          <div className="scanner-target-review__actions">
            <button
              className="button button--primary scanner-web__primary-action"
              type="button"
              disabled={!selectedAccount || handoffState.status === 'working'}
              onClick={onBindCompletedResult}
            >
              {handoffState.status === 'working' ? '正在准备结果' : '确认账户并继续'}
              <ChevronRight aria-hidden="true" size={18} />
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={onReturnToTargetSelection}
            >
              {handoffState.status === 'working' ? '取消读取并返回准备' : '放弃此结果并重新扫描'}
            </button>
          </div>
          <p className="scanner-target-review__footnote">
            仅为已有扫描结果选择接收账户，不会重新扫描、启动游戏或改动账户仓库。
          </p>
        </section>
      ) : (
        <section className="scanner-completed-review" aria-label="已完成扫描结果">
          {accountState?.accounts.length ? (
            <ScannerTargetAccountPicker
              accounts={accountState.accounts.map((account) => ({
                id: account.id,
                displayName: account.displayName,
                discCount: accountState.discCounts.get(account.id) ?? 0,
              }))}
              selectedAccountId={effectiveSelectedAccountId}
              onSelect={onSelectAccountId}
            />
          ) : (
            <div className="scanner-completed-account-setup">
              <p>本次扫描结果尚未绑定账户。先创建独立本机账户，再继续检查。</p>
              <div className="scanner-target-account__create">
                <label>
                  <span id="scanner-target-account-heading">新账户名称</span>
                  <input
                    className="scanner-input"
                    aria-label="新账户名称"
                    maxLength={40}
                    value={newAccountName ?? ''}
                    onChange={(event) => onSetNewAccountName?.(event.target.value)}
                    placeholder="例如：我的主账号"
                  />
                </label>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={!newAccountName?.trim()}
                  onClick={onCreateTargetAccount}
                >
                  创建账户并继续检查
                </button>
              </div>
            </div>
          )}
          {resultSummary}
          {snapshot.summary?.resultStatus === 'blocked_import' ? (
            <p role="alert">本次结果无法安全导入，请重新扫描。</p>
          ) : null}
          <div className="scanner-result-ready__actions">
            {snapshot.summary?.resultStatus === 'blocked_import' ? (
              <button
                className="button button--primary scanner-web__primary-action"
                type="button"
                onClick={onReturnToTargetSelection}
              >
                返回准备步骤
              </button>
            ) : (
              <>
                <button
                  className="button button--primary scanner-web__primary-action"
                  type="button"
                  disabled={!selectedAccount || handoffState.status === 'working'}
                  onClick={onBindCompletedResult}
                >
                  确认账户并继续
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={onReturnToTargetSelection}
                >
                  {handoffState.status === 'working'
                    ? '取消读取并返回准备'
                    : '放弃此结果并重新扫描'}
                </button>
              </>
            )}
          </div>
        </section>
      )}
      {handoffState.status !== 'idle' && handoffState.status !== 'success' ? (
        <p role={handoffState.status === 'error' ? 'alert' : 'status'} aria-live="polite">
          {playerResultMessage(handoffState.message)}
        </p>
      ) : null}
      {handoffState.status === 'error' ? diagnosticFeedback : null}
      {handoffState.status === 'error' && handoffState.message.includes('不完整的同源识别结果') ? (
        <>
          <button
            ref={discardTriggerRef}
            className="button button--quiet"
            type="button"
            onClick={() => onSetDiscardDraftConfirmationOpen(true)}
          >
            重新读取扫描结果
          </button>
          <ScannerDiscardDraftDialog
            open={discardDraftConfirmationOpen}
            triggerRef={discardTriggerRef}
            targetDisplayName={
              frozenTargetValidation.valid ? frozenTargetValidation.binding.displayName : '当前账户'
            }
            onCancel={() => onSetDiscardDraftConfirmationOpen(false)}
            onConfirm={onDiscardIncompleteDraftAndRetry}
          />
        </>
      ) : null}
      {handoffState.status === 'error' &&
      handoffState.message.includes('不完整扫描草稿包含已导入记录') ? (
        <button
          className="button button--quiet"
          type="button"
          onClick={onRepairCompletedBatchAndRetry}
        >
          恢复结果状态并继续
        </button>
      ) : null}
    </div>
  )
}
