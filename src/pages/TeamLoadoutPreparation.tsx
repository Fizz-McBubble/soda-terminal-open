import { playerErrorMessage } from '../application/playerErrorMessage'
import { useState } from 'react'
import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { SavedPlanGraduationLabel } from './savedTeamGraduationPresentation'
import { currentSavedTeamRatingLabel } from './savedTeamRatingPresentation'
import {
  getTeamPortfolioPreference,
  restoreDefaultTeamRecommendation,
} from '../accounts/teamPortfolioPreference'
import { getAgentName } from '../application/publicRosterNames'
import { savedPlanDisplayName } from '../application/savedPlanDisplayName'
import { TeamLoadoutRowContent } from './TeamLoadoutRowContent'
import { currentTeamCultivation } from '../application/formedCultivationGaps'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { orderTeamMembersForDisplay } from '../application/teamMemberDisplayOrder'

type SavedTeamPlanSummary = Pick<
  AccountPlanningDraft,
  | 'id'
  | 'name'
  | 'selection'
  | 'teamPortfolioSnapshot'
  | 'teamExecutionSnapshot'
  | 'candidateWarehouse'
  | 'solutionContext'
>

export function TeamSavedPlanList({
  plans,
  onOpen,
  warehouse,
  publicItems,
}: {
  plans: readonly SavedTeamPlanSummary[]
  onOpen: (planId: string) => void
  warehouse?: CoreWarehouse
  /** Saved rows from the identity-checked current Query, if online analysis was allowed. */
  publicItems?: readonly TeamLoadoutOverviewItem[]
}) {
  if (!plans.length) return null

  return (
    <section
      className="f5v-box-analysis-entry__saved-plans"
      aria-labelledby="saved-team-plans-title"
    >
      <header>
        <h2 id="saved-team-plans-title">已保存方案</h2>
        <p>选择方案查看配装。</p>
      </header>
      <div
        className="f5v-box-team-overview f5v-box-analysis-entry__saved-plan-list"
        role="list"
        aria-label="已保存方案"
      >
        {plans.map((plan) => {
          const portfolio = plan.teamPortfolioSnapshot
          const agentIds = portfolio
            ? portfolio.executions.flatMap((execution) =>
                orderTeamMembersForDisplay(
                  execution.memberIds,
                  (id) => id,
                  execution.deploymentOrder,
                ),
              )
            : orderTeamMembersForDisplay(
                plan.selection.agentIds,
                (id) => id,
                plan.teamExecutionSnapshot?.deploymentOrder,
              )
          const memberNames = agentIds.map(getAgentName).join(' · ')
          const bangbooSummary = portfolio
            ? portfolio.executions
                .map((execution) =>
                  execution.bangbooId
                    ? playerFacingBangbooLabel(execution.bangbooId)
                    : '邦布未记录',
                )
                .join(' · ')
            : null
          const savedDiscs = new Set(plan.candidateWarehouse?.loadouts
            .filter((member) => plan.selection.agentIds.includes(member.agentId))
            .flatMap((member) => member.discIds))
          const discSummary = savedDiscs.size ? `已保存 ${savedDiscs.size} 张不同驱动盘` : null
          const summary = portfolio
            ? `${portfolio.requestedTeamCount} 队 · ${memberNames} · ${bangbooSummary} · ${portfolio.uniquePhysicalDiscIds.length}/${portfolio.requestedTeamCount * 18} 张驱动盘`
            : memberNames || '成员未记录'
          const rating = currentSavedTeamRatingLabel({
            plan: plan as AccountPlanningDraft,
            publicItem: publicItems?.find((item) => item.id === `saved:${plan.id}`),
          })
          const firstExecution = portfolio?.executions[0]
          const portraitAgentIds = portfolio
            ? (firstExecution?.memberIds ?? [])
            : plan.selection.agentIds
          const bangbooId = portfolio
            ? (firstExecution?.bangbooId ?? null)
            : plan.selection.bangbooId
          const item = {
            agentIds: portraitAgentIds,
            deploymentOrder: portfolio
              ? firstExecution?.deploymentOrder
              : plan.teamExecutionSnapshot?.deploymentOrder,
            formedTeamReference: portfolio ? undefined : plan.solutionContext?.formedTeamReference,
            currentMemberCultivation: warehouse
              ? currentTeamCultivation(portraitAgentIds, warehouse.roster)
              : undefined,
            bangbooId,
            bangbooLabel: bangbooId ? playerFacingBangbooLabel(bangbooId) : '',
          }
          return (
            <div key={plan.id} role="listitem">
              <button
                className="f5v-box-team-row"
                type="button"
                aria-label={`${savedPlanDisplayName(plan)}，${summary}${!portfolio && bangbooId ? `，${playerFacingBangbooLabel(bangbooId)}` : ''}，打开已保存方案`}
                data-player-route={`/loadouts/plans/${encodeURIComponent(plan.id)}`}
                onClick={() => onOpen(plan.id)}
              >
                <TeamLoadoutRowContent
                  item={item}
                  title={savedPlanDisplayName(plan)}
                  rating={
                    rating ? <small className="f5v-box-team-reference">{rating}</small> : null
                  }
                  meta={
                    <>
                      <SavedPlanGraduationLabel
                        plan={plan}
                        warehouse={warehouse}
                        publicCompletion={
                          publicItems?.find((item) => item.id === `saved:${plan.id}`)
                            ?.graduationCompletion
                        }
                      />
                      {portfolio ? <small>{summary}</small> : discSummary ? <small>{discSummary}</small> : null}
                    </>
                  }
                />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export { TeamCompletionCandidates } from './TeamCompletionCandidates'

export function TeamConstraintResetPanel({
  accountId,
  activeCount,
  teamCount,
  blocked = false,
}: {
  accountId: string | null | undefined
  activeCount: number
  teamCount: number
  blocked?: boolean
}) {
  const [message, setMessage] = useState('')
  const restore = async () => {
    if (!accountId) return
    try {
      const preference = await getTeamPortfolioPreference(accountId)
      await restoreDefaultTeamRecommendation(accountId, preference)
      setMessage('已恢复默认推荐，请重新分析当前队伍。')
    } catch (error) {
      setMessage(playerErrorMessage(error, '恢复默认推荐失败。'))
    }
  }
  return (
    <section
      className={`f5v-box-analysis-stale${blocked ? ' f5v-box-constraint-blocked' : ''}`}
      role="status"
    >
      <div>
        <h2>{blocked ? '当前固定条件无法同时满足' : '当前存在固定条件'}</h2>
        {blocked ? (
          <p>当前固定条件无法同时满足，暂时没有可直接执行的完整队伍。</p>
        ) : (
          <p>
            {activeCount} 项固定成员、邦布、队伍或方案条件，队伍数量为 {teamCount}。
          </p>
        )}
      </div>
      <button type="button" onClick={restore}>
        恢复默认推荐
      </button>
      {message ? <p>{message}</p> : null}
    </section>
  )
}
