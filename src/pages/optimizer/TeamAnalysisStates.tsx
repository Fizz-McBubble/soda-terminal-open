import { type RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import { AccountRequiredState } from '../../components/ui/AccountRequiredState'
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
  const readyDiscCount = accountSummary?.discCount ?? 0
  if (!accountHydrating && (!accountSummary?.accountId || accountSummary.agentCount === 0))
    return !accountSummary?.accountId ? (
      <AccountRequiredState title="先创建或选择账户" />
    ) : (
      <section className="f5v-box-analysis-entry f5v-box-analysis-entry--exception" role="status">
        <h1>先记录拥有的代理人</h1>
        <p>队伍建议只会使用当前账户中明确标记为已拥有的代理人。</p>
        <Link className="f5v-box-analysis-entry__action" to="/assets/agents">
          前往代理人录入
        </Link>
      </section>
    )
  if (!accountHydrating && readyDiscCount === 0)
    return (
      <section className="f5v-box-analysis-entry f5v-box-analysis-entry--exception" role="status">
        <h1>先导入驱动盘再分析队伍</h1>
        <p>当前账户还没有驱动盘。先完成扫描或导入，才能用仓库中的驱动盘搭配装备。</p>
        <Link className="f5v-box-analysis-entry__action" to="/system/scanner">
          前往扫描与导入
        </Link>
      </section>
    )

  return (
    <>
      {hardConstraintPanel}
      <section className="f5v-box-analysis-entry">
        <div className="f5v-box-analysis-entry__heading">
          <div>
            <h1>分析当前账户的队伍</h1>
          </div>
          {remainingBoxSelector}
        </div>
        <div className="f5v-box-analysis-entry__workspace">
          <div className="f5v-box-analysis-entry__primary">
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
              <p className="f5v-box-analysis-entry__boundary">
                分析不会修改代理人、邦布、驱动盘或已有方案。
              </p>
            </div>
            <TeamSavedPlanList
              plans={savedTeamPlans ?? []}
              publicItems={currentSavedPlanItems}
              warehouse={savedPlanWarehouse ?? undefined}
              onOpen={onOpenPlan}
            />
          </div>
        </div>
      </section>
    </>
  )
}

export function TeamAnalysisRunning({
  stage,
  analysisSnapshot,
}: {
  stage: number
  analysisSnapshot: TeamAnalysisSnapshot | null
}) {
  const stageLabel = teamAnalysisStages[stage - 1]!
  return (
    <section className="f5v-box-analysis-entry" aria-live="polite">
      <div className="f5v-box-analysis-entry__heading">
        <div>
          <h1>分析当前队伍</h1>
          <p>先选队伍，再搭配装备。</p>
        </div>
      </div>
      <div className="f5v-box-analysis-entry__workspace">
        <div className="f5v-box-analysis-entry__primary">
          <h2>正在分析当前队伍</h2>
          <p className="f5v-box-analysis-entry__lead-copy">
            正在按开始分析时的账户资产生成队伍建议。
          </p>
          <p role="status">{stageLabel}，请稍候。</p>
          <p className="f5v-box-analysis-entry__boundary">分析不会更改你的角色或装备。</p>
        </div>
        <aside className="f5v-box-analysis-entry__scope">
          <h2>本次分析</h2>
          <p>正在使用已拥有的角色和驱动盘仓库。</p>
          <dl className="f5v-box-analysis-entry__scope-list">
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
        </aside>
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
      <p>{message ?? '暂时无法完成分析，请重试。你的角色、装备和已保存方案都没有改变。'}</p>
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
