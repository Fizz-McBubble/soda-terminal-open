import { AppLoadingState } from '../../components/AppEntryState'
import { type RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import { AccountRequiredState } from '../../components/ui/AccountRequiredState'
import { WorkbenchEmptyState } from '../../components/AppEntryState'
import type { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { TeamSavedPlanList } from '../TeamLoadoutOverviewParts'
import type { TeamLoadoutOverviewItem } from '../teamLoadoutOverviewTypes'
import { type LastCompleteAnalysis, type TeamAnalysisSnapshot } from '../teamAnalysisSession'
import { teamAnalysisStages } from '../teamAnalysisRecovery'

export function TeamAnalysisReady({
  accountHydrating,
  accountSummary,
  hardConstraintPanel,
  remainingBoxSelector,
  onStartAnalysis,
  savedTeamPlans,
  currentSavedPlanItems,
  savedPlanWarehouse,
  onOpenPlan,
}: {
  accountHydrating: boolean
  accountSummary: ReturnType<typeof useF5AccountSummary>
  hardConstraintPanel: React.ReactNode
  remainingBoxSelector: React.ReactNode
  onStartAnalysis: () => void
  savedTeamPlans: AccountPlanningDraft[] | undefined
  currentSavedPlanItems: TeamLoadoutOverviewItem[]
  savedPlanWarehouse: CoreWarehouse | undefined
  onOpenPlan: (planId: string) => void
}) {
  if (accountHydrating) return <AppLoadingState title="正在读取当前账户" />
  const readyDiscCount = accountSummary?.discCount ?? 0
  if (!accountSummary?.accountId || accountSummary.agentCount === 0)
    return !accountSummary?.accountId ? (
      <AccountRequiredState title="先创建或选择账户" />
    ) : (
      <WorkbenchEmptyState
        title="先记录拥有的代理人"
        description="队伍建议只会使用当前账户中明确标记为已拥有的代理人。"
        action={
          <Link className="button button--primary" to="/assets/agents">
            前往代理人录入
          </Link>
        }
      />
    )
  if (readyDiscCount === 0)
    return (
      <WorkbenchEmptyState
        title="先导入驱动盘再分析队伍"
        description="当前账户还没有驱动盘。先完成扫描或导入，才能用仓库中的驱动盘搭配装备。"
        action={
          <Link className="button button--primary" to="/system/scanner">
            前往扫描与导入
          </Link>
        }
      />
    )

  return (
    <>
      {hardConstraintPanel}
      <section className="f5v-box-analysis-entry f5v-box-analysis-entry--ready">
        <div className="f5v-box-analysis-entry__heading">
          <div>
            <h1>分析当前账户的队伍</h1>
          </div>
          {remainingBoxSelector}
        </div>
        <div className="f5v-box-analysis-entry__content">
          <p className="f5v-box-analysis-entry__lead-copy">
            从已拥有的角色中选择队伍，再搭配驱动盘。
          </p>
          <div className="f5v-box-analysis-entry__action-block">
            <button
              className="f5v-box-analysis-entry__action"
              type="button"
              onClick={onStartAnalysis}
            >
              分析当前队伍
            </button>
          </div>
          <TeamSavedPlanList
            plans={savedTeamPlans ?? []}
            publicItems={currentSavedPlanItems}
            warehouse={savedPlanWarehouse ?? undefined}
            onOpen={onOpenPlan}
          />
        </div>
      </section>
    </>
  )
}

export function TeamAnalysisRunning({
  stage,
  analysisSnapshot,
  onCancel,
}: {
  stage: number
  analysisSnapshot: TeamAnalysisSnapshot | null
  onCancel: () => void
}) {
  const stageLabel = teamAnalysisStages[stage - 1]!
  return (
    <section className="f5v-box-analysis-entry f5v-box-analysis-entry--running">
      <div className="f5v-box-analysis-entry__heading">
        <h1>正在分析当前队伍</h1>
        <button className="button button--quiet" type="button" onClick={onCancel}>
          取消分析
        </button>
      </div>
      <div className="f5v-box-analysis-entry__content">
        <p className="f5v-box-analysis-entry__status" role="status">
          {stageLabel}，请稍候。
        </p>
        <dl className="f5v-box-analysis-entry__snapshot">
          <div>
            <dt>当前账户</dt>
            <dd>{analysisSnapshot?.accountName ?? '正在读取'}</dd>
          </div>
          <div>
            <dt>已拥有代理人</dt>
            <dd>{analysisSnapshot ? `${analysisSnapshot.ownedAgentCount} 名` : '正在读取'}</dd>
          </div>
          <div>
            <dt>驱动盘仓库</dt>
            <dd>{analysisSnapshot ? `${analysisSnapshot.discCount} 张` : '正在读取'}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

export function TeamAnalysisUnable({
  reason,
  analysisSnapshot,
  accountSummary,
  exceptionHeadingRef,
  onResetReady,
}: {
  reason: string | undefined
  analysisSnapshot: TeamAnalysisSnapshot | null
  accountSummary: ReturnType<typeof useF5AccountSummary>
  exceptionHeadingRef: RefObject<HTMLHeadingElement | null>
  onResetReady: () => void
}) {
  const emptyWarehouse = reason === 'empty_warehouse'
  return (
    <section
      className="f5v-box-analysis-entry f5v-box-analysis-entry--exception f5v-box-analysis-entry--unable"
      role="status"
    >
      <h1 ref={exceptionHeadingRef} tabIndex={-1}>
        {emptyWarehouse ? '当前账户还没有可用的驱动盘' : '尚未选择账户'}
      </h1>
      <p>
        {emptyWarehouse ? (
          <>
            账户“{analysisSnapshot?.accountName ?? accountSummary?.name ?? '当前账户'}”
            已就绪，但仓库中没有驱动盘。请先完成扫描与导入，再返回分析。
          </>
        ) : (
          '请先在“我的资产 → 账户与备份”选择账户。'
        )}
      </p>
      <div className="f5v-box-analysis-entry__button-row">
        <Link
          className="f5v-box-analysis-entry__action"
          to={emptyWarehouse ? '/system/scanner' : '/assets/account'}
        >
          {emptyWarehouse ? '前往扫描与导入' : '前往账户与备份'}
        </Link>
        {emptyWarehouse ? (
          <button
            className="f5v-box-analysis-entry__secondary-action"
            type="button"
            onClick={onResetReady}
          >
            重新核对账户
          </button>
        ) : null}
      </div>
      {emptyWarehouse ? (
        <dl className="f5v-box-analysis-entry__state-meta">
          <div>
            <dt>当前账户</dt>
            <dd>{analysisSnapshot?.accountName ?? accountSummary?.name ?? '当前账户'}</dd>
          </div>
          <div>
            <dt>已拥有代理人</dt>
            <dd>{analysisSnapshot?.ownedAgentCount ?? accountSummary?.agentCount ?? 0} 名</dd>
          </div>
          <div>
            <dt>驱动盘</dt>
            <dd>0 张</dd>
          </div>
        </dl>
      ) : null}
    </section>
  )
}

export function TeamAnalysisError({
  message,
  exceptionHeadingRef,
  onStartAnalysis,
  lastCompleteAnalysis,
  onRestoreLastComplete,
}: {
  message: string | undefined
  exceptionHeadingRef: RefObject<HTMLHeadingElement | null>
  onStartAnalysis: () => void
  lastCompleteAnalysis: LastCompleteAnalysis | null
  onRestoreLastComplete: () => void
}) {
  return (
    <section
      className="f5v-box-analysis-entry f5v-box-analysis-entry--exception f5v-box-analysis-entry--error"
      role="alert"
    >
      <h1 ref={exceptionHeadingRef} tabIndex={-1}>
        本次分析未完成
      </h1>
      <p>{message ?? '暂时无法完成分析，请重试。'}</p>
      <div className="f5v-box-analysis-entry__button-row">
        <button className="f5v-box-analysis-entry__action" type="button" onClick={onStartAnalysis}>
          重新分析当前队伍
        </button>
        {lastCompleteAnalysis ? (
          <button
            className="f5v-box-analysis-entry__secondary-action"
            type="button"
            onClick={onRestoreLastComplete}
          >
            查看上次完整结果
          </button>
        ) : null}
      </div>
    </section>
  )
}
