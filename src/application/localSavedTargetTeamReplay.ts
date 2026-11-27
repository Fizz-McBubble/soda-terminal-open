import { buildExactTeamVariantKey } from '../accounts/planningSolutionContext'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import {
  captureTeamCultivation,
  savedTeamCultivationRoster,
} from '../decision/savedTeamCultivation'
import { optimizerOptionsFromBuildIntent } from '../decision/buildIntent'
import {
  calculateTargetTeamWarehouseFit,
  projectTargetTeamWarehouseFit,
} from '../decision/targetTeamWarehouseFit'
import { getCandidateWarehouseProfiles } from '../optimizer/candidateWarehouseSolver'
import {
  compileDynamicCandidateLoadout,
  dynamicLegalInventory,
} from '../optimizer/teamDynamicDomain'
import { selectedSourceCondition } from '../optimizer/candidateWarehouseSourceConditions'
import { candidateLoadoutMatchesSetPlan } from '../optimizer/candidateWarehouseAlternativeRanking'
import {
  compareReviewedPlayerTeamDiscs,
  requireSavedReviewedTeamDiscAlternative,
} from '../decision/reviewedPlayerTeamDiscFit'
import {
  resolveSavedPlanScenarioSelection,
  savedTeamDiscAssignments,
} from '../pages/savedPlanIdentity'
import type {
  AccountDecisionRun,
  TargetTeamWarehouseFitQuery,
  TargetTeamWarehouseFitQueryResult,
} from './calculationQueryContract'
import { contentHash } from './contentHash'
import { projectPrivateSavedTeamReplay } from './privateSavedTeamReplayProjection'
import { projectPrivateSavedTeamSolutionComponents } from './privateSavedTeamSolutionComponentsProjection'
import {
  canRecalculateSavedTeamPlan,
  inspectSavedTeamPlanSnapshotFreshness,
} from './publicSavedPlanFreshness'
import {
  buildSavedTeamPlanSolutionFingerprintFromComponents,
  localPrivateNonPlanningComponents,
} from './publicSavedTeamSolutionFingerprint'
import { targetTeamEquipmentParametersFingerprint } from './publicTargetTeamEquipmentFingerprint'

/** All assignment and condition facts come from this run's captured saved plan. */
export function prepareSavedTargetTeamReplay(
  query: TargetTeamWarehouseFitQuery,
  run: AccountDecisionRun,
) {
  const request = query.savedPlanReplay
  if (!request) return undefined
  if (request.sourcePolicy !== undefined && request.sourcePolicy !== 'current_sources')
    throw new Error('不支持的保存方案重算方式。')
  const accountId = run.input.warehouse.accountId
  const plan = run.input.drafts.find((row) => row.id === request.planId)
  if (
    !accountId ||
    request.accountId !== accountId ||
    request.inputFingerprint !== run.snapshot.fingerprint.inputHash ||
    !plan ||
    plan.accountId !== accountId ||
    plan.state !== 'saved' ||
    query.playerBangbooSelection ||
    query.declaredEventComparison32 ||
    query.standardReferenceFitFingerprint32 !== undefined
  )
    throw new Error('保存方案与当前账户或分析不一致，请重新读取方案。')
  const replay = projectPrivateSavedTeamReplay(run, plan.id, request.planHash)
  const referencedIds = new Set(resolvePlanningDiscReferences(plan).referenceIds)
  if (run.input.warehouse.discs.some((disc) => referencedIds.has(disc.id) && disc.rarity !== 'S'))
    throw new Error(
      '原方案包含非 S 级或品质未确认的驱动盘；历史方案仍保留，请重新匹配 S 级驱动盘。',
    )
  const match = replay.match
  const assignments = savedTeamDiscAssignments(plan)
  if (!match || !assignments || match.buildIntent.exactTeam.candidateId !== query.candidateId)
    throw new Error('保存方案的当前条件或十八盘分配不可验证；原方案仍保留。')
  const parameters = match.effectiveEquipmentParameters
  const parameterFingerprint = parameters
    ? targetTeamEquipmentParametersFingerprint(parameters)
    : match.accountFactBinding!.fingerprint
  if (
    query.equipmentParameters &&
    (!parameters ||
      targetTeamEquipmentParametersFingerprint(query.equipmentParameters) !== parameterFingerprint)
  )
    throw new Error('保存方案的装备参数已变化，不能将新参数评分作为原方案回放。')
  const components = projectPrivateSavedTeamSolutionComponents(run, run.input)
  const currentSavedFingerprint = buildSavedTeamPlanSolutionFingerprintFromComponents({
    decisionInput: run.input,
    planId: plan.id,
    buildIntentFingerprint: contentHash([
      match.buildIntent.fingerprint,
      buildExactTeamVariantKey({
        memberIds: plan.selection.agentIds,
        bangbooId: plan.selection.bangbooId,
        scenario: plan.selection.scenario,
      }),
      parameterFingerprint,
    ]),
    nonPlanningComponents: localPrivateNonPlanningComponents(
      components.nonPlanningComponents,
      run.input,
    ),
  })
  const freshness = inspectSavedTeamPlanSnapshotFreshness(
    plan,
    run.snapshot.fingerprint.inputHash,
    contentHash([run.snapshot.fingerprint.inputHash, match.buildIntent.fingerprint]),
    currentSavedFingerprint,
  )
  const capturedCultivation = savedTeamCultivationRoster(
    plan.teamExecutionSnapshot,
    run.input.warehouse.roster,
    true,
  )
  if (!capturedCultivation && freshness.stale)
    throw new Error(
      '保存方案缺少完整原培养快照，无法核对原条件；历史方案仍保留，可按当前培养另行比较。',
    )
  if (
    capturedCultivation &&
    plan.teamExecutionSnapshot!.members.some((member) => {
      const current = captureTeamCultivation(
        run.input.warehouse.roster.agents.find((agent) => agent.agentId === member.agentId),
      )
      if (current && !member.cultivation?.projectionVersion) delete current.projectionVersion
      return contentHash(member.cultivation) !== contentHash(current)
    })
  )
    throw new Error('保存方案的原培养条件已变化；历史快照仍保留，请按当前培养另行比较。')
  if (
    freshness.stale &&
    !(request.sourcePolicy === 'current_sources' && canRecalculateSavedTeamPlan(freshness))
  )
    throw new Error('保存方案的账户、资料或计算条件已过期；请明确重新分析，原方案仍保留。')
  if (
    query.scenarioSelection !== undefined &&
    contentHash(resolveSavedPlanScenarioSelection(query.scenarioSelection)) !==
      contentHash(resolveSavedPlanScenarioSelection(plan.solutionContext?.scenarioSelection))
  )
    throw new Error('保存方案的比较场景已变化，不能作为原方案评分。')
  // Caller options may be absent, but never replace persisted conditions.
  for (const key of ['eventConditionDeclarationsByAgentId', 'standardReference32'] as const) {
    const saved =
      key === 'standardReference32'
        ? plan.solutionContext?.standardReferenceRequest32
        : plan.solutionContext?.[key]
    if (query[key] !== undefined && contentHash(query[key]) !== contentHash(saved))
      throw new Error('保存方案的比较条件已变化，不能作为原方案评分。')
  }
  return {
    plan,
    match,
    assignments,
    receipt: { ...request },
    warehouse: capturedCultivation
      ? { ...run.input.warehouse, roster: capturedCultivation }
      : run.input.warehouse,
  }
}

/** Adopt persisted conditions only after captured identity and condition checks succeed. */
export function prepareLocalTargetTeamFitRequest(
  query: TargetTeamWarehouseFitQuery,
  run: AccountDecisionRun,
) {
  const replay = prepareSavedTargetTeamReplay(query, run)
  return {
    replay,
    query: replay
      ? {
          ...query,
          equipmentParameters: replay.match.effectiveEquipmentParameters,
          scenarioSelection: replay.plan.solutionContext?.scenarioSelection,
          eventConditionDeclarationsByAgentId:
            replay.plan.solutionContext?.eventConditionDeclarationsByAgentId,
          standardReference32: replay.plan.solutionContext?.standardReferenceRequest32,
        }
      : query,
  }
}

/** Keep searched and persisted-assignment scoring behind one explicit dispatch boundary. */
export function calculateLocalTargetTeamFit(
  input: Parameters<typeof projectTargetTeamWarehouseFit>[0],
  replay: ReturnType<typeof prepareSavedTargetTeamReplay>,
) {
  return replay
    ? calculateSavedTargetTeamWarehouseFit(input, replay)
    : compareReviewedPlayerTeamDiscs(input, calculateTargetTeamWarehouseFit(input))
}

/** Bind verified replay results; cache only searches used by subsequent comparisons. */
export function completeLocalTargetTeamFit(
  teamFits: Map<string, Map<string, TargetTeamWarehouseFitQueryResult>>,
  runId: string,
  result: TargetTeamWarehouseFitQueryResult,
  replay: ReturnType<typeof prepareSavedTargetTeamReplay>,
) {
  if (replay) {
    result.savedPlanReplay = { ...replay.receipt }
    return
  }
  const cached = teamFits.get(runId) ?? new Map()
  cached.set(result.candidateId, result)
  teamFits.set(runId, cached)
}

/** Rescore exactly six recorded discs per member. This path never searches the warehouse. */
export function calculateSavedTargetTeamWarehouseFit(
  input: Parameters<typeof projectTargetTeamWarehouseFit>[0],
  replay: NonNullable<ReturnType<typeof prepareSavedTargetTeamReplay>>,
) {
  if (input.buildIntent.fingerprint !== replay.match.buildIntent.fingerprint)
    throw new Error('保存方案的有效构筑条件已变化，请重新分析。')
  const { buildIntent, warehouse } = input
  const options = optimizerOptionsFromBuildIntent(buildIntent)
  const legalDiscs = new Map(dynamicLegalInventory(warehouse.discs).map((disc) => [disc.id, disc]))
  const reviewed = new Map(
    (replay.plan.candidateWarehouse?.loadouts ?? []).flatMap(
      ({ agentId, reviewedDiscAlternative }) =>
        reviewedDiscAlternative
          ? [
              [
                agentId,
                requireSavedReviewedTeamDiscAlternative(
                  buildIntent,
                  agentId,
                  reviewedDiscAlternative,
                ),
              ] as const,
            ]
          : [],
    ),
  )
  const recommendations = buildIntent.recommendations.map(
    (row) => reviewed.get(row.agentId)?.recommendation ?? row,
  )
  const profiles = getCandidateWarehouseProfiles(
    buildIntent.agentIds,
    [...new Set(warehouse.discs.map((disc) => disc.setId))],
    recommendations,
  )
  const loadouts = replay.assignments.map(({ agentId, discIds }) => {
    const profile = profiles.find((row) => row.agentId === agentId)
    const selection = discIds.flatMap((id) => {
      const disc = legalDiscs.get(id)
      return disc ? [disc] : []
    })
    if (!profile) throw new Error(`成员“${agentId}”尚不支持原方案盘面评分；不能改用其他配装。`)
    if (
      selection.length !== 6 ||
      selection.some((disc) => options.excludedDiscIds?.includes(disc.id)) ||
      (options.fixedDiscByAgent?.[agentId] && !discIds.includes(options.fixedDiscByAgent[agentId]!))
    )
      throw new Error(`成员“${agentId}”的保存驱动盘缺失、不合法或与当前约束冲突。`)
    const loadout = compileDynamicCandidateLoadout(
      selection.toSorted((left, right) => left.slot - right.slot),
      profile,
      options.panelInputsByAgent?.[agentId],
      options.effectiveCritObjectivesByAgent?.[agentId],
    )
    if (!loadout) throw new Error(`成员“${agentId}”的保存六盘不能评分；原分配仍保留。`)
    const alternative = reviewed.get(agentId)
    if (alternative) {
      if (!candidateLoadoutMatchesSetPlan(loadout, alternative.plan))
        throw new Error('保存方案的驱动盘与已记录的备选套装不符；原方案仍保留。')
      loadout.reviewedDiscAlternative = { ...alternative.binding }
    }
    return loadout
  })
  for (const loadout of loadouts) {
    const condition = selectedSourceCondition(
      loadout,
      loadouts,
      buildIntent.agentIds,
      recommendations.find((row) => row.agentId === loadout.agentId)?.constraint ?? null,
    )
    if (condition?.status === 'condition-not-met' || condition?.status === 'condition-unknown') {
      loadout.degraded = true
      loadout.degradeReasons.push(condition.reason)
    }
  }
  return projectTargetTeamWarehouseFit(input, {
    plan: {
      scope: 'team',
      agentIds: [...buildIntent.agentIds],
      loadouts,
      totalScore: loadouts.reduce((sum, row) => sum + row.totalScore, 0),
      alternatives: [],
      gaps: [...new Set(loadouts.flatMap((row) => row.degradeReasons))],
      boundary: '仅按当前资料重新评分已保存的十八张实体盘；未重新优化、替换驱动盘或写入账户。',
    },
    branchSearch: { status: 'not_needed', attempts: 0, budget: 0, preferredMemberCount: 0 },
  })
}
