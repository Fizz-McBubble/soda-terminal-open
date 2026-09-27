import { ChevronRight } from 'lucide-react'
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
import { VisualEntityImage } from '../components/VisualEntityImage'
import type { TeamLoadoutCompletionCandidate } from './teamLoadoutCompletionCandidates'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { orderTeamMembersForDisplay } from '../application/teamMemberDisplayOrder'

type SavedTeamPlanSummary = Pick<
  AccountPlanningDraft,
  'id' | 'name' | 'selection' | 'teamPortfolioSnapshot' | 'teamExecutionSnapshot'
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
      <div role="list" aria-label="已保存方案">
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
                .map((execution) => playerFacingBangbooLabel(execution.bangbooId))
                .join(' · ')
            : null
          const summary = portfolio
            ? `${portfolio.requestedTeamCount} 队 · ${memberNames} · ${bangbooSummary} · ${portfolio.uniquePhysicalDiscIds.length}/${portfolio.requestedTeamCount * 18} 张驱动盘`
            : memberNames || '成员记录待补齐'
          const rating = currentSavedTeamRatingLabel({
            plan: plan as AccountPlanningDraft,
            publicItem: publicItems?.find((item) => item.id === `saved:${plan.id}`),
          })
          return (
            <div key={plan.id} role="listitem">
              <button
                type="button"
                aria-label={`${savedPlanDisplayName(plan)}，${summary}，打开已保存方案`}
                onClick={() => onOpen(plan.id)}
              >
                <span className="f5v-box-analysis-entry__saved-plan-portraits" aria-hidden="true">
                  {agentIds.map((agentId) => (
                    <VisualEntityImage
                      className="f5v-box-analysis-entry__saved-plan-portrait"
                      compactFallback
                      entityType="agent"
                      entityId={agentId}
                      key={agentId}
                      name={getAgentName(agentId)}
                      slotId="agent.square-avatar"
                      consumer="box.team-overview"
                    />
                  ))}
                </span>
                <span>
                  <strong>{savedPlanDisplayName(plan)}</strong>
                  <small>
                    {rating ? `${rating} · ` : null}
                    <SavedPlanGraduationLabel
                      plan={plan}
                      warehouse={warehouse}
                      publicCompletion={
                        publicItems?.find((item) => item.id === `saved:${plan.id}`)
                          ?.graduationCompletion
                      }
                    />
                  </small>
                  <small>{summary}</small>
                </span>
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function TeamCompletionCandidates({
  candidates,
}: {
  candidates: readonly TeamLoadoutCompletionCandidate[]
}) {
  if (!candidates.length) return null

  return (
    <section className="f5v-box-team-completion" aria-labelledby="f5v-box-team-completion-title">
      <header>
        <h3 id="f5v-box-team-completion-title">补强建议</h3>
        <p>补齐一位角色，解锁新的强势搭配</p>
      </header>
      <ul>
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            data-failure-code={candidate.failureCode}
            data-source-ids={candidate.sourceIds.join(',')}
          >
            <div className="f5v-box-team-completion__identities" aria-hidden="true">
              {[...candidate.ownedAgentIds, ...candidate.missingAgentIds].map((agentId) => (
                <VisualEntityImage
                  key={agentId}
                  className={`f5v-box-team-completion__team-portrait${candidate.missingAgentIds.includes(agentId) ? ' is-missing' : ''}`}
                  entityType="agent"
                  entityId={agentId}
                  name={getAgentName(agentId)}
                  slotId="agent.square-avatar"
                  consumer="box.team-overview"
                />
              ))}
            </div>
            <div className="f5v-box-team-completion__copy">
              <strong className="f5v-box-team-completion__candidate-label">
                {candidate.label}
              </strong>
              <CompletionMemberRow label="已有" agentIds={candidate.ownedAgentIds} tone="owned" />
              <CompletionMemberRow
                label="还缺"
                note={
                  candidate.missingRole !== 'core' && candidate.missingAgentIds.length > 1
                    ? '任选一位'
                    : undefined
                }
                agentIds={candidate.missingAgentIds}
                tone="missing"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CompletionMemberRow({
  label,
  note,
  agentIds,
  tone,
}: {
  label: string
  note?: string
  agentIds: readonly string[]
  tone: 'owned' | 'missing'
}) {
  return (
    <div className={`f5v-box-team-completion__member-row is-${tone}`}>
      <span className="f5v-box-team-completion__member-label">
        {label}
        {note ? <small>{note}</small> : null}
      </span>
      <span className="f5v-box-team-completion__member-identities">
        {agentIds.map((agentId) => (
          <span className="f5v-box-team-completion__member-identity" key={agentId}>
            <span>{getAgentName(agentId)}</span>
          </span>
        ))}
      </span>
    </div>
  )
}

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
      setMessage('已恢复默认推荐；培养优先、已保存方案与账户资产均保留。请重新分析当前队伍。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '恢复默认推荐失败。')
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
