import type { CoreWarehouse } from '../accounts/coreFlow'
import { contentHash } from '../evaluation/contentHash'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { candidateTeamSetScore } from '../optimizer/candidateTeamSetScore'
import type { TeamAssignmentObjective } from '../optimizer/selectTeamObjectiveAssignment'
import type { BangbooSelection } from '../teamEngine/contracts'
import type { TeamJointBuildIntent } from './buildIntent'
import { projectTeamEquipmentRecommendations } from './teamEquipmentRecommendations'
import { isAdmittedBoxTeam } from './admittedTeamBangbooOptions'
import { teamDiscCompletion } from '../domain/teamDiscCompletion'

export type TargetTeamWarehouseFitSourceResult = {
  plan: CandidateWarehousePlan
  branchSearch: {
    attempts: number
    budget: number
    completePlansCompared?: number
    searchComplete?: boolean
  } & (
    | {
        status: 'preferred' | 'reviewed_play' | 'conflict_fallback' | 'source_preferred_partial' | 'not_needed'
        preferredMemberCount: number
      }
    | {
        status: 'dynamic_objective' | 'completion_fallback' | 'budget_fallback'
        preferredMemberCount: null
      }
  )
}

/** Shared projection for a searched plan or a separately validated saved assignment. */
export function projectTargetTeamWarehouseFit(
  input: {
    warehouse: CoreWarehouse
    buildIntent: TeamJointBuildIntent
    bangbooSelection: BangbooSelection
    teamAssignmentObjective?: TeamAssignmentObjective
  },
  { plan, branchSearch }: TargetTeamWarehouseFitSourceResult,
) {
  const { buildIntent } = input
  const memberIds = buildIntent.agentIds
  const equipmentRecommendations = projectTeamEquipmentRecommendations({
    includeReviewedSourceOptions: isAdmittedBoxTeam(memberIds),
    memberIds,
    bangbooSelection: input.bangbooSelection,
    roster: input.warehouse.roster,
  })
  const loadouts = plan.loadouts.map((loadout) => ({
    agentId: loadout.agentId,
    discIds: loadout.discs.map((choice) => choice.disc.id),
  }))
  const discIds = loadouts.flatMap((loadout) => loadout.discIds)
  const completion = teamDiscCompletion(memberIds, loadouts, input.warehouse.discs)
  const namedDiscGaps = memberIds.flatMap((agentId) => {
    const assigned = completion.counts.get(agentId) ?? 0
    return assigned === 6 ? [] : [`成员“${agentId}”当前只形成 ${assigned}/6 张可验证实体驱动盘。`]
  })
  const status = completion.complete
    ? ('ready' as const)
    : discIds.length > 0
      ? ('partial' as const)
      : ('unavailable' as const)
  const result = {
    contract: 'soda-target-team-warehouse-fit/v2' as const,
    candidateId: buildIntent.exactTeam.candidateId,
    memberIds,
    buildIntent,
    ...(input.teamAssignmentObjective
      ? { assignmentObjectiveFingerprint: input.teamAssignmentObjective.fingerprint }
      : {}),
    status,
    solverMethod: 'bounded_heuristic' as const,
    exactWithinModel: false as const,
    discCount: discIds.length,
    uniqueDiscCount: new Set(discIds).size,
    totalScore: candidateTeamSetScore(plan.loadouts),
    gaps: [
      ...namedDiscGaps,
      ...plan.gaps,
      ...(branchSearch.status === 'conflict_fallback'
        ? [
            `为避免共用驱动盘，已调整 ${memberIds.length - branchSearch.preferredMemberCount} 名代理人的套装搭配。`,
          ]
        : []),
    ],
    warehousePlan: plan,
    sourceBranchSearch: branchSearch,
    loadouts,
    equipmentRecommendations,
    sideEffect: 'read_only' as const,
    boundary: `${plan.boundary} 仅代理人与驱动盘绑定真实账号状态；音擎与邦布为默认候选推荐，不作为实体库存或完成度门槛。仅在用户显式选择目标队伍后执行，列表、评级与短名单查询不得预加载本求解。`,
  }
  return { ...result, fingerprint: contentHash(result) }
}
