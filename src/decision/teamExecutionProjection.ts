import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountRoster } from '../assault/types'
import { currentBangbooDirectory } from '../assault/catalog'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { MultiTeamCoordination } from '../optimizer/multiTeamCoordinator'
import {
  hasPreparedTeamScenario32,
  hasUnresolvedAuthorityScenario,
  type TeamBuildExecutionIdentity,
} from './teamBuildExecutionIdentity'
import type { EffectiveTargetTeamEquipmentParameters } from './targetTeamEquipmentParameters'
import { defaultWEngineRefinement, resolveWEngine } from './wEngineResolver'
import { reviewedPreparedTeamConditions32 } from '../calculation/reviewedPreparedTeamBenchmark32'

export const teamExecutionContract = 'soda-team-execution/r1' as const

export type TeamExecutionScenario = {
  identity: string
  tags: string[]
}

export type TeamExecutionWEngine = {
  engineId: string
  /** Legacy executions may retain a physical copy id; new projections use scheme parameters. */
  copyId: string | null
  refinement: number
  /** Explicit scheme growth parameters; absent on legacy/default projections. */
  level?: number
  ascension?: number
  fact:
    | 'confirmed'
    | 'manual_initial_default_assumption'
    | 'scheme_default_recommendation'
    | 'source_default_parameter'
    | 'player_confirmed_parameter'
}

export type TeamExecutionAction =
  | { kind: 'keep_current_build'; agentId: string }
  | { kind: 'change_w_engine'; agentId: string; fromCopyId: string | null; toCopyId: string }
  | { kind: 'change_discs'; agentId: string; removeDiscIds: string[]; equipDiscIds: string[] }
  | { kind: 'borrow_w_engine'; agentId: string; copyId: string; fromAgentId: string }
  | { kind: 'borrow_discs'; agentId: string; discIds: string[]; fromAgentIds: string[] }
  | { kind: 'confirm_w_engine_fact'; agentId: string; engineId: string; reason: string }
  | {
      kind: 'missing_equipment'
      agentId: string
      equipment: 'w_engine' | 'drive_disc'
      reason: string
    }

export type TeamExecutionImpact = {
  kind: 'current_equipment' | 'active_plan' | 'saved_plan'
  equipment: 'w_engine' | 'drive_disc'
  assetIds: string[]
  agentId: string | null
  planId: string | null
  planName: string | null
}

export type TeamExecutionMember = {
  agentId: string
  current: { wEngineCopyId: string | null; discIds: string[] }
  suggested: { wEngine: TeamExecutionWEngine | null; discIds: string[] }
  actions: TeamExecutionAction[]
  impacts: TeamExecutionImpact[]
  status: 'ready' | 'needs_confirmation' | 'missing_equipment'
}

export type TeamExecution = {
  contract: typeof teamExecutionContract
  candidateId: string
  reusePolicy: 'cross_scenario_reuse' | 'simultaneous_lock'
  scenario: TeamExecutionScenario
  memberIds: [string, string, string]
  /** Player-selected battle placement; absent on legacy and uncustomized snapshots. */
  deploymentOrder?: [string, string, string]
  bangbooId: string | null
  authorComparisonMembership?: import('./reviewedAuthorComparisonMembership32').AuthorComparisonMembership32
  /** Exact selected/default star when the source calculation supplied one; omitted for legacy or unknown. */
  bangbooStar?: 1 | 2 | 3 | 4 | 5
  /** Absent only on legacy persisted projections. */
  wEngineBindingMode?: 'scheme_parameters' | 'account_fact_binding'
  members: TeamExecutionMember[]
  physicalDiscIds: string[]
  /** Legacy compatibility field; new projections never populate physical W-Engine copies. */
  confirmedWEngineCopyIds: string[]
  status: 'ready' | 'needs_confirmation' | 'missing_equipment'
  blockers: string[]
  sideEffect: 'read_only'
}

export type TeamExecutionPortfolio = {
  contract: typeof teamExecutionContract
  reusePolicy: 'simultaneous_lock'
  requestedTeamCount: number
  /** Absent only on legacy persisted projections. */
  wEngineBindingMode?: 'scheme_parameters' | 'account_fact_binding'
  executions: TeamExecution[]
  /** Legacy compatibility field; new projections never populate physical W-Engine copies. */
  uniqueConfirmedWEngineCopyIds: string[]
  uniquePhysicalDiscIds: string[]
  status: 'ready' | 'needs_confirmation' | 'missing_equipment'
  blockers: string[]
  sideEffect: 'read_only'
}

type ProjectionContext = {
  allocation: AccountBuildResult
  roster: AccountRoster
  drafts: readonly AccountPlanningDraft[]
  activePlanIds: Readonly<Record<string, string | null | undefined>>
}

type ProjectionInput = ProjectionContext & {
  candidates: readonly TeamBuildExecutionIdentity[]
}

function scenario(candidate: TeamBuildExecutionIdentity): TeamExecutionScenario {
  const tags = [...new Set(candidate.scenarioTags)].sort()
  return {
    identity: hasPreparedTeamScenario32(candidate)
      ? reviewedPreparedTeamConditions32.policyId
      : tags.length
        ? `scenario:${tags.join('+')}`
        : 'scenario:unresolved',
    tags,
  }
}

function recordedBangbooStar(value: number | null | undefined) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? (value as 1 | 2 | 3 | 4 | 5)
    : undefined
}

function schemeBangbooStar(candidate: TeamBuildExecutionIdentity) {
  const selection = candidate.bangbooSelection
  const selectedStar =
    selection &&
    (selection.status === 'selected' || selection.status === 'compatible_fallback') &&
    selection.bangbooId === candidate.bangbooId
      ? selection.bangbooStar
      : undefined
  const requiredStar = recordedBangbooStar(candidate.bangbooStar ?? selectedStar)
  if (requiredStar && requiredStar > 1) return requiredStar
  const bangboo = currentBangbooDirectory.find((item) => item.id === candidate.bangbooId)
  return bangboo ? recordedBangbooStar(defaultWEngineRefinement(bangboo.rarity)) : undefined
}

function setEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value))
}

function impactsForDiscs(
  agentId: string,
  discIds: string[],
  roster: AccountRoster,
  drafts: readonly AccountPlanningDraft[],
  activePlanIds: Readonly<Record<string, string | null | undefined>>,
) {
  const impacts: TeamExecutionImpact[] = []
  for (const owner of roster.agents) {
    if (owner.agentId === agentId) continue
    const borrowed = (owner.equippedDiscIds ?? []).filter((discId) => discIds.includes(discId))
    if (borrowed.length)
      impacts.push({
        kind: 'current_equipment',
        equipment: 'drive_disc',
        assetIds: borrowed,
        agentId: owner.agentId,
        planId: null,
        planName: null,
      })
  }
  for (const draft of drafts) {
    if (draft.savedRole === 'history') continue
    const borrowed = draft.warehouseRefs.filter((discId) => discIds.includes(discId))
    if (!borrowed.length) continue
    const active =
      draft.savedRole === 'current_reference' || Object.values(activePlanIds).includes(draft.id)
    impacts.push({
      kind: active ? 'active_plan' : 'saved_plan',
      equipment: 'drive_disc',
      assetIds: borrowed,
      agentId:
        draft.kind === 'agent' && draft.selection.agentIds.length === 1
          ? draft.selection.agentIds[0]!
          : null,
      planId: draft.id,
      planName:
        draft.kind === 'agent' && draft.savedRole === 'current_reference' ? '当前方案' : draft.name,
    })
  }
  return impacts
}

function resolveMemberWEngine(
  agentId: string,
  roster: AccountRoster,
  effectiveEquipmentParameters?: EffectiveTargetTeamEquipmentParameters,
  accountFactBinding = false,
) {
  const currentAgent = roster.agents.find((agent) => agent.agentId === agentId)
  const resolution = resolveWEngine({ agent: currentAgent, legacyWEngines: roster.wEngines })
  if (accountFactBinding) {
    const engine = resolution.current
    return {
      currentCopyId: currentAgent?.wEngineCopyId ?? null,
      suggested: engine
        ? {
            engineId: engine.engineId,
            copyId: currentAgent?.wEngineCopyId ?? null,
            refinement: engine.refinement,
            level: engine.level,
            ...(engine.ascension === undefined ? {} : { ascension: engine.ascension }),
            fact: 'confirmed' as const,
          }
        : null,
      actions: [] as TeamExecutionAction[],
      impacts: [] as TeamExecutionImpact[],
      status: 'ready' as const,
    }
  }
  const parameter = effectiveEquipmentParameters?.wEngines.find((item) => item.agentId === agentId)
  if (parameter)
    return {
      currentCopyId: currentAgent?.wEngineCopyId ?? null,
      suggested: {
        engineId: parameter.engineId,
        copyId: null,
        refinement: parameter.refinement,
        ...(parameter.level === undefined ? {} : { level: parameter.level }),
        ...(parameter.ascension === undefined ? {} : { ascension: parameter.ascension }),
        fact:
          effectiveEquipmentParameters?.source === 'player_confirmed'
            ? ('player_confirmed_parameter' as const)
            : ('source_default_parameter' as const),
      },
      actions: [] as TeamExecutionAction[],
      impacts: [] as TeamExecutionImpact[],
      status: 'ready' as const,
    }
  if (!resolution.recommendedPrimary)
    return {
      currentCopyId: currentAgent?.wEngineCopyId ?? null,
      suggested: null,
      actions: [] as TeamExecutionAction[],
      impacts: [] as TeamExecutionImpact[],
      status: 'ready' as const,
    }
  const suggested: TeamExecutionWEngine = {
    engineId: resolution.recommendedPrimary.engineId,
    copyId: null,
    refinement: resolution.recommendedPrimary.refinement,
    fact: 'scheme_default_recommendation',
  }
  return {
    currentCopyId: currentAgent?.wEngineCopyId ?? null,
    suggested,
    actions: [] as TeamExecutionAction[],
    impacts: [] as TeamExecutionImpact[],
    status: 'ready' as const,
  }
}

function projectOne(
  candidate: TeamBuildExecutionIdentity,
  input: ProjectionContext,
  reusePolicy: TeamExecution['reusePolicy'],
  sourceLoadouts = input.allocation.global,
  effectiveEquipmentParameters?: EffectiveTargetTeamEquipmentParameters,
): TeamExecution {
  const loadouts = new Map(sourceLoadouts.map((loadout) => [loadout.agentId, loadout]))
  const members = candidate.memberIds.map((agentId): TeamExecutionMember => {
    const currentAgent = input.roster.agents.find((agent) => agent.agentId === agentId)
    const currentDiscIds = [...(currentAgent?.equippedDiscIds ?? [])]
    const suggestedDiscIds = loadouts.get(agentId)?.discs.map((choice) => choice.disc.id) ?? []
    const wEngine = resolveMemberWEngine(
      agentId,
      input.roster,
      effectiveEquipmentParameters,
      Boolean(candidate.authorComparisonMembership && candidate.bangbooId === null),
    )
    const actions = [...wEngine.actions]
    const impacts = [
      ...wEngine.impacts,
      ...impactsForDiscs(
        agentId,
        suggestedDiscIds,
        input.roster,
        input.drafts,
        input.activePlanIds,
      ),
    ]
    if (suggestedDiscIds.length !== 6 || new Set(suggestedDiscIds).size !== 6)
      actions.push({
        kind: 'missing_equipment',
        agentId,
        equipment: 'drive_disc',
        reason: 'Account Decision 未闭合六张不同实体盘。',
      })
    else if (!setEqual(currentDiscIds, suggestedDiscIds)) {
      actions.push({
        kind: 'change_discs',
        agentId,
        removeDiscIds: currentDiscIds.filter((discId) => !suggestedDiscIds.includes(discId)),
        equipDiscIds: suggestedDiscIds.filter((discId) => !currentDiscIds.includes(discId)),
      })
      const borrowed = impacts.filter(
        (impact) => impact.kind === 'current_equipment' && impact.equipment === 'drive_disc',
      )
      if (borrowed.length)
        actions.push({
          kind: 'borrow_discs',
          agentId,
          discIds: [...new Set(borrowed.flatMap((impact) => impact.assetIds))],
          fromAgentIds: [...new Set(borrowed.flatMap((impact) => impact.agentId ?? []))],
        })
    }
    if (!actions.length) actions.push({ kind: 'keep_current_build', agentId })
    const status = actions.some((action) => action.kind === 'missing_equipment')
      ? 'missing_equipment'
      : actions.some((action) => action.kind === 'confirm_w_engine_fact')
        ? 'needs_confirmation'
        : 'ready'
    return {
      agentId,
      current: { wEngineCopyId: wEngine.currentCopyId, discIds: currentDiscIds },
      suggested: { wEngine: wEngine.suggested, discIds: suggestedDiscIds },
      actions,
      impacts,
      status,
    }
  })
  const blockers = [
    ...(candidate.scenarioTags.length ||
    hasPreparedTeamScenario32(candidate) ||
    hasUnresolvedAuthorityScenario(candidate)
      ? []
      : ['Team Engine 未提供 scenario identity。']),
    ...members.flatMap((member) =>
      member.actions
        .filter((action) => action.kind === 'missing_equipment')
        .map((action) => action.reason),
    ),
  ]
  const physicalDiscIds = members.flatMap((member) => member.suggested.discIds)
  if (physicalDiscIds.length !== 18 || new Set(physicalDiscIds).size !== 18)
    blockers.push('当前队伍方案还没有配齐 18 张不同驱动盘。')
  const status = blockers.length
    ? 'missing_equipment'
    : members.some((member) => member.status === 'needs_confirmation')
      ? 'needs_confirmation'
      : 'ready'
  return {
    contract: teamExecutionContract,
    candidateId: candidate.candidateId,
    reusePolicy,
    scenario: scenario(candidate),
    memberIds: [...candidate.memberIds],
    // Ordinary legacy pending-Bangboo plans keep their established representation.
    // Only the separately qualified author membership carries an explicit null identity.
    bangbooId: candidate.authorComparisonMembership
      ? candidate.bangbooId
      : (candidate.bangbooId ?? ''),
    ...(candidate.bangbooId === null && candidate.authorComparisonMembership
      ? { authorComparisonMembership: candidate.authorComparisonMembership }
      : {}),
    bangbooStar: recordedBangbooStar(
      effectiveEquipmentParameters?.bangbooStars ?? schemeBangbooStar(candidate),
    ),
    wEngineBindingMode:
      candidate.authorComparisonMembership && candidate.bangbooId === null
        ? 'account_fact_binding'
        : 'scheme_parameters',
    members,
    physicalDiscIds,
    confirmedWEngineCopyIds: [],
    status,
    blockers: [...new Set(blockers)],
    sideEffect: 'read_only',
  }
}

export function projectTeamExecutions(input: ProjectionInput) {
  return input.candidates.map((candidate) => projectOne(candidate, input, 'cross_scenario_reuse'))
}

/**
 * Projects the actions shown for one explicitly selected team from the same warehouse-fit result
 * that is displayed and saved. This prevents the account-wide allocation from becoming a second,
 * conflicting equipment authority on the target-team journey.
 */
export function projectTargetTeamExecution(
  input: ProjectionContext & {
    candidate: TeamBuildExecutionIdentity
    warehousePlan: CandidateWarehousePlan
    effectiveEquipmentParameters?: EffectiveTargetTeamEquipmentParameters
  },
) {
  return projectOne(
    input.candidate,
    input,
    'cross_scenario_reuse',
    input.warehousePlan.loadouts,
    input.effectiveEquipmentParameters,
  )
}

export function projectSimultaneousTeamExecutionPortfolio(
  input: ProjectionInput & {
    coordination: MultiTeamCoordination
    requestedTeamCount: number
    warehousePlan?: CandidateWarehousePlan
    equipmentParametersByCandidateId?: Readonly<
      Record<string, EffectiveTargetTeamEquipmentParameters>
    >
  },
): TeamExecutionPortfolio {
  const candidatesById = new Map(
    input.candidates.map((candidate) => [candidate.candidateId, candidate]),
  )
  const executions = input.coordination.teams.flatMap((team) => {
    const candidate = candidatesById.get(team.template.templateId)
    return candidate
      ? [
          projectOne(
            candidate,
            input,
            'simultaneous_lock',
            input.warehousePlan?.loadouts ?? input.allocation.global,
            input.equipmentParametersByCandidateId?.[candidate.candidateId],
          ),
        ]
      : []
  })
  const physicalDiscIds = executions.flatMap((execution) => execution.physicalDiscIds)
  const blockers = [
    ...input.coordination.gaps.map((gap) => gap.detail),
    ...executions.flatMap((execution) => execution.blockers),
  ]
  if (
    physicalDiscIds.length !== input.requestedTeamCount * 18 ||
    new Set(physicalDiscIds).size !== physicalDiscIds.length
  )
    blockers.push(`simultaneous-lock 未闭合 ${input.requestedTeamCount * 18} 张全局唯一实体盘。`)
  const status = blockers.length
    ? 'missing_equipment'
    : executions.some((execution) => execution.status === 'needs_confirmation')
      ? 'needs_confirmation'
      : 'ready'
  return {
    contract: teamExecutionContract,
    reusePolicy: 'simultaneous_lock',
    requestedTeamCount: input.requestedTeamCount,
    wEngineBindingMode: 'scheme_parameters',
    executions,
    uniqueConfirmedWEngineCopyIds: [],
    uniquePhysicalDiscIds: [...new Set(physicalDiscIds)],
    status,
    blockers: [...new Set(blockers)],
    sideEffect: 'read_only',
  }
}
