import type { AccountDecisionWorldContextValue } from '../../application/accountDecisionWorldModel'
import { SavedPlanExecutionRefreshStatus } from '../teamExecutionWorkspaceParts'

/** Keep the saved allocation visible while the current account result is pending. */
export function SavedPlanAccountAnalysisStatus({
  world,
}: {
  world: AccountDecisionWorldContextValue
}) {
  if (world.calculationCancelled) {
    return (
      <section className="panel status-card" role="status" aria-label="已保存方案分析状态">
        <p>本次分析已取消。</p>
      </section>
    )
  }
  if (world.run && !world.analysisIssue) return null
  if (world.run && world.analysisIssue) {
    return (
      <section className="panel status-card" role="status" aria-label="已保存方案分析状态">
        <p>{world.analysisIssue.message}</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void world.refresh()}
        >
          重试分析
        </button>
      </section>
    )
  }
  const failed = world.status === 'error' || world.status === 'unavailable'
  return (
    <SavedPlanExecutionRefreshStatus
      state={failed ? 'error' : 'loading'}
      detail={world.status === 'error' ? world.message : undefined}
      onRetry={() =>
        void (world.status === 'error' && world.canRepairApplicationData
          ? world.repairApplicationData()
          : world.refresh())
      }
    />
  )
}
