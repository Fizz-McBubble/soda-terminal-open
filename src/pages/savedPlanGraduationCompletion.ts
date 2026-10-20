import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import { getAgentName } from '../application/publicRosterNames'
import {
  createSavedTeamGraduationCompletion,
  type SavedTeamGraduationCompletion,
} from '../decision/savedTeamGraduationCompletion'
import type { TeamExecution } from '../decision/teamExecutionProjection'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'

function unknownCompletion(reason: string): SavedTeamGraduationCompletion {
  return {
    status: 'unknown',
    score: null,
    members: [],
    meaning: 'quantitative_target_attainment',
    reason,
  }
}

function savedExecutions(
  plan: Pick<AccountPlanningDraft, 'teamExecutionSnapshot' | 'teamPortfolioSnapshot'>,
) {
  if (plan.teamPortfolioSnapshot) {
    const executions = plan.teamPortfolioSnapshot.executions
    if (!Array.isArray(executions) || executions.length === 0)
      return {
        executions: [] as TeamExecution[],
        reason: '保存方案的多队执行快照缺少可复算的队伍记录。',
      }
    return { executions, reason: null }
  }
  if (plan.teamExecutionSnapshot) return { executions: [plan.teamExecutionSnapshot], reason: null }
  return {
    executions: [] as TeamExecution[],
    reason: '保存方案缺少队伍执行快照；无法按保存的音擎和六盘复算毕业面板。',
  }
}

export function savedPlanGraduationCompletion(
  plan: Pick<AccountPlanningDraft, 'teamExecutionSnapshot' | 'teamPortfolioSnapshot'> &
    Pick<Partial<AccountPlanningDraft>, 'solutionContext'>,
  warehouse?: Pick<CoreWarehouse, 'roster' | 'discs'>,
): SavedTeamGraduationCompletion {
  const saved = savedExecutions(plan)
  if (!saved.executions.length) return unknownCompletion(saved.reason!)
  if (!warehouse)
    return unknownCompletion('当前账户角色与驱动盘数据未提供，无法按保存快照复算毕业面板。')
  let results: SavedTeamGraduationCompletion[]
  let declarations
  try {
    declarations = normalizeReviewedEventConditionDeclarations32(
      plan.solutionContext?.eventConditionDeclarationsByAgentId,
      saved.executions.flatMap((execution) => execution.memberIds),
    )
    if (
      reviewedEventConditionDeclarationsIdentity32(declarations) !==
      plan.solutionContext?.eventConditionDeclarationsIdentity
    )
      return unknownCompletion('保存方案的事件条件身份已失效；请按当前条件重新比较，原方案仍保留。')
    if (declarations && plan.solutionContext?.gameVersion !== currentVersionProjection.gameVersion)
      return unknownCompletion('保存方案的事件条件版本已过期；请按当前版本重新比较，原方案仍保留。')
  } catch {
    return unknownCompletion('保存方案的事件条件无法核验；请按当前条件重新比较，原方案仍保留。')
  }
  try {
    results = saved.executions.map((execution) =>
      createSavedTeamGraduationCompletion({
        execution,
        roster: warehouse.roster,
        discs: warehouse.discs,
        scenarioSelection: plan.solutionContext?.scenarioSelection,
        eventConditionDeclarationsByAgentId: declarations,
      }),
    )
  } catch {
    return unknownCompletion('保存执行快照字段不完整；需要成员身份、计划音擎和六个可复算盘位。')
  }
  if (results.length === 1) return results[0]!
  const scored = results.every((result) => result.status === 'scored')
  const reference =
    results.every((result) => result.status !== 'unknown') &&
    results.some((result) => result.status === 'reference')
  const memberGaps = results
    .flatMap((result) => result.members)
    .filter(
      (
        member,
      ): member is Extract<(typeof results)[number]['members'][number], { status: 'unknown' }> =>
        member.status === 'unknown',
    )
    .map((member) => `${getAgentName(member.agentId)}: ${member.reason}`)
  return {
    ...(scored
      ? {
          status: 'scored' as const,
          score: Math.min(
            results.every((result) => result.score === 100) ? 100 : 99,
            Math.round(results.reduce((sum, result) => sum + result.score!, 0) / results.length),
          ),
        }
      : { status: reference ? ('reference' as const) : ('unknown' as const), score: null }),
    members: results.flatMap((result) => result.members),
    meaning: 'quantitative_target_attainment',
    reason: scored
      ? '按三名成员的毕业推荐计算。'
      : reference
        ? '包含已核来源的培养参考对照；来源参考不混入机制满档评分。'
        : `三名成员必须都有完整配装、可比面板和已自动对齐的目标条件。${memberGaps.length ? ` 未完成项：${memberGaps.join('；')}` : ''}`,
  }
}
