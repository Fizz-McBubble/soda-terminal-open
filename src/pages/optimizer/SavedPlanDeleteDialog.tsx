import { useContext, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import { deleteAccountPlanningDraft } from '../../accounts/planningDrafts'
import type { AccountPlanningDraft } from '../../accounts/types'
import {
  CalculationQueryClientContext,
  type useAccountDecisionWorld,
} from '../../application/accountDecisionWorldHooks'
import { savedPlanDisplayName } from '../../application/savedPlanDisplayName'
import type { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { PlanningDialog } from '../TeamSolverWorkspaceParts'
import {
  loadCurrentTeamOverviewFromQuery,
  restoreCurrentTeamAnalysisSession,
  retainTeamAnalysisAfterSavedPlanDeletion,
} from '../teamAnalysisRecovery'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from '../teamAnalysisSession'

export function SavedPlanDeleteDialog({
  plan,
  warehouse,
  accountSummary,
  decisionWorld,
  onClose,
  isCurrent,
}: {
  plan: AccountPlanningDraft
  warehouse: CoreWarehouse
  accountSummary: ReturnType<typeof useF5AccountSummary>
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  onClose: () => void
  isCurrent: () => boolean
}) {
  const navigate = useNavigate()
  const calculationClient = useContext(CalculationQueryClientContext)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)
  const cancel = () => {
    if (!deletingRef.current) onClose()
  }

  return (
    <PlanningDialog
      title="删除已保存方案？"
      description={`将删除 1 个已保存方案“${savedPlanDisplayName(plan)}”。不会影响资产、仓库或游戏数据。`}
      onCancel={cancel}
    >
      {deleteError ? <p role="alert">{deleteError}</p> : null}
      {deleting ? <p role="status">正在删除方案…</p> : null}
      <div className="button-row">
        <button autoFocus disabled={deleting} onClick={cancel}>
          取消
        </button>
        <button
          type="button"
          className="button--danger"
          disabled={deleting}
          onClick={async () => {
            if (deletingRef.current) return
            deletingRef.current = true
            setDeleting(true)
            setDeleteError(null)
            try {
              if (!warehouse.accountId) throw new Error('account unavailable')
              await deleteAccountPlanningDraft(warehouse.accountId, plan.id)
            } catch {
              deletingRef.current = false
              setDeleting(false)
              setDeleteError('删除失败，请重试。')
              return
            }
            if (!isCurrent()) return
            if (plan.kind === 'team') {
              // Remove the persisted row from any retained overview before refreshing.
              // A failed refresh must not project the successfully deleted row again.
              const previous = currentTeamAnalysisSession
              const retained = previous
                ? retainTeamAnalysisAfterSavedPlanDeletion(previous, plan.id)
                : null
              if (retained) setCurrentTeamAnalysisSession(retained)
              let refreshUnavailable = !accountSummary
              if (accountSummary) {
                try {
                  const refreshed = await decisionWorld.refresh()
                  if (!isCurrent()) return
                  if (refreshed) {
                    const overviewModel = await loadCurrentTeamOverviewFromQuery(
                      refreshed,
                      calculationClient,
                    )
                    if (!isCurrent()) return
                    const next = restoreCurrentTeamAnalysisSession(
                      accountSummary,
                      {
                        status: 'current',
                        run: refreshed,
                        liveFingerprint: refreshed.snapshot.fingerprint.inputHash,
                      },
                      null,
                      overviewModel,
                    )
                    if (next) {
                      next.result.overviewUiState = retained?.result.overviewUiState
                      setCurrentTeamAnalysisSession(next)
                    } else {
                      refreshUnavailable = true
                    }
                  } else {
                    refreshUnavailable = true
                  }
                } catch {
                  refreshUnavailable = true
                }
              }
              if (refreshUnavailable && retained) {
                setCurrentTeamAnalysisSession(
                  retainTeamAnalysisAfterSavedPlanDeletion(
                    retained,
                    plan.id,
                    `已删除“${savedPlanDisplayName(plan)}”；队伍建议暂未更新。`,
                  ),
                )
              }
            }
            if (isCurrent()) navigate(`/loadouts/${plan.kind}`, { replace: true })
          }}
        >
          确认删除
        </button>
      </div>
    </PlanningDialog>
  )
}
