import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import { deleteAccountPlanningDraft } from '../../accounts/planningDrafts'
import type { AccountPlanningDraft } from '../../accounts/types'
import type { useAccountDecisionWorld } from '../../application/accountDecisionWorldHooks'
import { savedPlanDisplayName } from '../../application/savedPlanDisplayName'
import type { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { PlanningDialog } from '../TeamSolverWorkspaceParts'
import {
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
  onDeletingChange,
}: {
  plan: AccountPlanningDraft
  warehouse: CoreWarehouse
  accountSummary: ReturnType<typeof useF5AccountSummary>
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  onClose: () => void
  onDeletingChange?: (deleting: boolean) => void
}) {
  const navigate = useNavigate()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  return (
    <PlanningDialog
      title="删除已保存方案？"
      description={`将删除 1 个已保存方案“${savedPlanDisplayName(plan)}”。不会影响资产、仓库或游戏数据。`}
      onCancel={onClose}
    >
      {deleteError ? <p role="alert">{deleteError}</p> : null}
      <div className="button-row">
        <button autoFocus onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="button--danger"
          onClick={async () => {
            setDeleteError(null)
            onDeletingChange?.(true)
            try {
              if (!warehouse.accountId) throw new Error('account unavailable')
              await deleteAccountPlanningDraft(warehouse.accountId, plan.id)
            } catch {
              onDeletingChange?.(false)
              setDeleteError('删除失败，方案仍保留，请重试。')
              return
            }
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
                  if (refreshed) {
                    const next = restoreCurrentTeamAnalysisSession(
                      accountSummary,
                      {
                        status: 'current',
                        run: refreshed,
                        liveFingerprint: refreshed.snapshot.fingerprint.inputHash,
                      },
                      null,
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
                    `已删除“${savedPlanDisplayName(plan)}”；队伍建议暂未更新，可稍后重新分析。`,
                  ),
                )
              }
            }
            navigate(`/loadouts/${plan.kind}`, { replace: true })
          }}
        >
          确认删除
        </button>
      </div>
    </PlanningDialog>
  )
}
