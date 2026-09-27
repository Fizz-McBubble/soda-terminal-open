import type { AccountPlanningDraft } from '../accounts/types'
import type { SavedTeamGraduationCompletion } from '../decision/savedTeamGraduationCompletion'

type SavedTeamExecution = NonNullable<AccountPlanningDraft['teamExecutionSnapshot']>
type SavedTeamPortfolio = NonNullable<AccountPlanningDraft['teamPortfolioSnapshot']>

export type SavedTeamDiscMemberCompletion = {
  agentId: string
  savedCount: number
  expectedCount: 6
}

export type SavedTeamDiscCompletion = {
  status: 'complete' | 'partial' | 'conflict' | 'unknown'
  savedCount: number
  expectedCount: number
  members: readonly SavedTeamDiscMemberCompletion[]
  source: 'execution' | 'portfolio' | 'candidate_warehouse' | 'saved_references' | 'none'
  reason: string
}

export type SavedTeamGraduationCardCompletion = SavedTeamGraduationCompletion & {
  discCompletion?: SavedTeamDiscCompletion | null
}

export type SavedTeamDiscPlan = Pick<
  AccountPlanningDraft,
  'teamExecutionSnapshot' | 'teamPortfolioSnapshot'
> &
  Partial<Pick<AccountPlanningDraft, 'warehouseRefs' | 'candidateWarehouse'>>

function validIds(ids: readonly string[] | null | undefined) {
  return (ids ?? []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
}

function uniqueIds(ids: readonly string[] | null | undefined) {
  return [...new Set(validIds(ids))]
}

function sameIdSet(left: readonly string[], right: readonly string[]) {
  const leftIds = uniqueIds(left)
  const rightIds = uniqueIds(right)
  return leftIds.length === rightIds.length && leftIds.every((id) => rightIds.includes(id))
}

function memberCompletion(execution: SavedTeamExecution): SavedTeamDiscMemberCompletion[] {
  const members = Array.isArray(execution.members) ? execution.members : []
  return members.map((member) => ({
    agentId: member.agentId,
    savedCount: uniqueIds(member.suggested?.discIds).length,
    expectedCount: 6,
  }))
}

function executionDiscIds(execution: SavedTeamExecution) {
  const physical = uniqueIds(execution.physicalDiscIds)
  if (physical.length) return physical
  const members = Array.isArray(execution.members) ? execution.members : []
  return uniqueIds(members.flatMap((member) => member.suggested?.discIds ?? []))
}

function completionFromIds(input: {
  ids: readonly string[]
  expectedCount: number
  members: readonly SavedTeamDiscMemberCompletion[]
  source: SavedTeamDiscCompletion['source']
  reasonWhenComplete: string
  reasonWhenPartial: string
  conflict?: boolean
}): SavedTeamDiscCompletion {
  const savedCount = uniqueIds(input.ids).length
  const conflict = input.conflict || savedCount > input.expectedCount
  return {
    status: conflict
      ? 'conflict'
      : savedCount === 0
        ? 'unknown'
        : savedCount === input.expectedCount
          ? 'complete'
          : 'partial',
    savedCount,
    expectedCount: input.expectedCount,
    members: input.members,
    source: input.source,
    reason: conflict
      ? '保存记录中的驱动盘来源不一致或超过预期数量，需要重新匹配。'
      : savedCount === 0
        ? '保存方案没有可核对的驱动盘引用。'
        : savedCount === input.expectedCount
          ? input.reasonWhenComplete
          : input.reasonWhenPartial,
  }
}

function executionCompletion(execution: SavedTeamExecution): SavedTeamDiscCompletion {
  const members = memberCompletion(execution)
  const executionMembers = Array.isArray(execution.members) ? execution.members : []
  const memberIds = uniqueIds(executionMembers.flatMap((member) => member.suggested?.discIds ?? []))
  const physicalIds = uniqueIds(execution.physicalDiscIds)
  const hasBothSources = physicalIds.length > 0 && memberIds.length > 0
  const sourcesConflict = hasBothSources && !sameIdSet(physicalIds, memberIds)
  const ids = physicalIds.length ? physicalIds : memberIds
  const hasCompleteMembers =
    executionMembers.length === 3 &&
    members.length === 3 &&
    members.every((member) => member.savedCount === member.expectedCount)
  return completionFromIds({
    ids,
    expectedCount: 18,
    members,
    source: 'execution',
    conflict: sourcesConflict,
    reasonWhenComplete: hasCompleteMembers
      ? '已保存方案记录了三名成员各 6 张不同驱动盘。'
      : '已保存方案记录了 18 张不同驱动盘，但缺少按成员的完整六盘分配。',
    reasonWhenPartial: '已保存方案只记录了部分三人队伍驱动盘。',
  })
}

function portfolioCompletion(portfolio: SavedTeamPortfolio): SavedTeamDiscCompletion {
  const executions = portfolio.executions
  const expectedCount =
    Number.isInteger(portfolio.requestedTeamCount) && portfolio.requestedTeamCount > 0
      ? portfolio.requestedTeamCount * 18
      : executions.length * 18
  const members = executions.flatMap(memberCompletion)
  const executionIds = uniqueIds(executions.flatMap(executionDiscIds))
  const recordedIds = uniqueIds(portfolio.uniquePhysicalDiscIds)
  const hasBothSources = executionIds.length > 0 && recordedIds.length > 0
  const requestedTeamCountIsKnown =
    Number.isInteger(portfolio.requestedTeamCount) && portfolio.requestedTeamCount > 0
  const sourcesConflict =
    (hasBothSources && !sameIdSet(executionIds, recordedIds)) ||
    (requestedTeamCountIsKnown && executions.length !== portfolio.requestedTeamCount)
  const ids = recordedIds.length ? recordedIds : executionIds
  const hasCompleteMembers =
    executions.length === (expectedCount > 0 ? expectedCount / 18 : 0) &&
    members.length === executions.length * 3 &&
    members.every((member) => member.savedCount === member.expectedCount)
  return completionFromIds({
    ids,
    expectedCount,
    members,
    source: 'portfolio',
    conflict: sourcesConflict,
    reasonWhenComplete: hasCompleteMembers
      ? `已保存方案记录了 ${executions.length} 队、每队 18 张不同驱动盘。`
      : `已保存方案记录了 ${expectedCount} 张不同驱动盘，但缺少按成员的完整六盘分配。`,
    reasonWhenPartial: `已保存方案只记录了部分多队驱动盘（${executions.length} 队）。`,
  })
}

function fallbackReferenceCompletion(plan: SavedTeamDiscPlan): SavedTeamDiscCompletion {
  const candidateIds = uniqueIds(
    plan.candidateWarehouse?.loadouts.flatMap((loadout) => loadout.discIds) ?? [],
  )
  const savedIds = uniqueIds(plan.warehouseRefs)
  const ids = savedIds.length ? savedIds : candidateIds
  const source = savedIds.length
    ? 'saved_references'
    : candidateIds.length
      ? 'candidate_warehouse'
      : 'none'
  const expectedCount = 18
  return completionFromIds({
    ids,
    expectedCount,
    members: [],
    source,
    reasonWhenComplete:
      source === 'saved_references'
        ? '已保存 18 张不同驱动盘引用，但没有按成员的六盘分配记录。'
        : '已保存候选记录了 18 张不同驱动盘，但没有按成员的六盘分配记录。',
    reasonWhenPartial: '已保存方案只记录了部分驱动盘引用。',
  })
}

/**
 * Read-only facts from the saved plan itself. This intentionally counts saved physical
 * references rather than candidate scores, team ratings, or the current warehouse contents.
 */
export function savedTeamDiscCompletion(plan: SavedTeamDiscPlan): SavedTeamDiscCompletion {
  if (plan.teamPortfolioSnapshot) return portfolioCompletion(plan.teamPortfolioSnapshot)
  if (plan.teamExecutionSnapshot) return executionCompletion(plan.teamExecutionSnapshot)
  return fallbackReferenceCompletion(plan)
}

export function attachSavedTeamDiscCompletion(
  completion: SavedTeamGraduationCompletion | null | undefined,
  discCompletion: SavedTeamDiscCompletion | null | undefined,
): SavedTeamGraduationCardCompletion | null {
  if (!completion && !discCompletion) return null
  return {
    ...(completion ?? {
      status: 'unknown' as const,
      score: null,
      members: [],
      meaning: 'quantitative_target_attainment' as const,
      reason: '当前没有可用的量化毕业面板目标。',
    }),
    discCompletion,
  }
}
