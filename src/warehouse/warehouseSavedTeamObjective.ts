import type { AccountPlanningDraft } from '../accounts/types'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { assertCurrentPlanningResourceTimeline32 } from '../accounts/resourceTimelinePlanPersistence32'
import { readPlanningResourceTimeline32 } from '../accounts/resourceTimelineSavedContract32'
import type { AccountRoster } from '../assault/types'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { buildIntentFingerprintMatches } from '../application/publicBuildIntentFingerprint'
import { inspectSavedLuminizeReplay32 } from '../application/savedLuminizeReplay32'
import { targetTeamEquipmentParametersFingerprint } from '../application/publicTargetTeamEquipmentFingerprint'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { luminizeEquipmentPreparationProtocol32 } from '../application/publicLuminizeComparison32'
import { currentBuildIntentRecommendationState } from '../decision/buildIntent'
import type { currentSavedTeamBuildIntent } from '../decision/savedTeamBuildIntent'
import { createTargetTeamAssignmentObjective } from '../decision/targetTeamAssignmentObjective'
import { frozenMiyabiLuminizeDirection32 } from '../decision/targetTeamLuminizeAssignmentObjective32'
import { compileTargetTeamPlanningContext } from '../decision/targetTeamPlanningContext'
import { compileTargetTeamPlanningMembers } from '../decision/targetTeamPlanningMembers'
import { projectAccountLuminizeEquipmentSnapshot32 } from '../decision/accountLuminizeEquipmentSnapshot32'
import type { TargetTeamPlanningContextInput } from '../decision/targetTeamPlanningContextInput'
import type { DriveDisc } from '../domain/schemas'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import { candidateDiscFactKey } from '../optimizer/candidateSearchFacts'
import { candidatePanelInputForSchemeAgent } from '../optimizer/optimizeAccountBuildsPanelInput'
import { resolveSuggestedWEngineParameters } from '../pages/teamExecutionAttributePanel'
import type {
  WarehouseCompleteBuildImprovement,
  WarehouseFiniteLuminizeCoverage,
} from './warehouseCompleteBuildObjective'
import { hasReliableWarehouseDiscRecord } from './warehouseDiscQuality'

export type WarehouseSavedTeamBuildIntents = Readonly<
  Record<
    string,
    Pick<
      NonNullable<ReturnType<typeof currentSavedTeamBuildIntent>>,
      'buildIntent' | 'effectiveEquipmentParameters'
    >
  >
>

export type WarehouseSavedTeamObjective = {
  accountId: string
  roster: AccountRoster
  resolved: WarehouseSavedTeamBuildIntents[string] & {
    effectiveEquipmentParameters: NonNullable<
      WarehouseSavedTeamBuildIntents[string]['effectiveEquipmentParameters']
    >
  }
  loadouts: Array<{ agentId: string; discIds: string[] }>
  scenarioSelection: TargetTeamPlanningContextInput['scenarioSelection']
  eventConditionDeclarationsByAgentId: TargetTeamPlanningContextInput['eventConditionDeclarationsByAgentId']
  resourceTimelineDeclaration32: TargetTeamPlanningContextInput['resourceTimelineDeclaration32']
  capturedAt: string
  sourceIdentity: string
}

function exactAssignment(
  discs: readonly DriveDisc[],
  loadouts: WarehouseSavedTeamObjective['loadouts'],
) {
  const ids = loadouts.flatMap((row) => row.discIds)
  if (
    loadouts.length !== 3 ||
    new Set(loadouts.map((row) => row.agentId)).size !== 3 ||
    ids.length !== 18 ||
    new Set(ids).size !== 18
  )
    return undefined
  const selected = loadouts.map((row) =>
    row.discIds.map((id) => discs.filter((disc) => disc.id === id)),
  )
  if (selected.some((rows) => rows.some((matches) => matches.length !== 1))) return undefined
  const physical = selected.map((rows) => rows.map((matches) => matches[0]!))
  return physical.every(
    (six) =>
      new Set(six.map((disc) => disc.slot)).size === 6 && six.every(hasReliableWarehouseDiscRecord),
  )
    ? physical
    : undefined
}

/** The decision service supplies only the current authority-resolved intent.
 * Saved declarations and physical references still need their own integrity checks. */
export function prepareWarehouseSavedTeamObjective(input: {
  accountId?: string
  roster: AccountRoster
  discs: readonly DriveDisc[]
  draft: AccountPlanningDraft
  resolved: WarehouseSavedTeamBuildIntents[string] | undefined
  discIdsByAgentId: Record<string, string[]>
}): WarehouseSavedTeamObjective | undefined {
  try {
    const { draft, resolved } = input
    const context = draft.solutionContext
    const parameters = resolved?.effectiveEquipmentParameters
    const intent = resolved?.buildIntent
    const luminize = inspectSavedLuminizeReplay32(draft)
    if (luminize.status === 'invalid' || luminize.status === 'stale') return undefined
    if (
      !input.accountId ||
      draft.accountId !== input.accountId ||
      draft.state !== 'saved' ||
      draft.kind !== 'team' ||
      draft.teamPortfolioSnapshot ||
      !context ||
      context.contract !== 'soda-solution-context/v1' ||
      context.scope !== 'team_joint' ||
      context.resourcePolicy !== 'within_team_exclusive' ||
      context.gameVersion !== currentVersionProjection.gameVersion ||
      !intent ||
      !parameters ||
      !draft.teamEquipmentParameters ||
      !buildIntentFingerprintMatches(intent) ||
      currentBuildIntentRecommendationState(intent).status !== 'current' ||
      context.sourceCandidateId !== intent.exactTeam.candidateId ||
      draft.selection.agentIds.length !== 3 ||
      new Set(draft.selection.agentIds).size !== 3 ||
      intent.agentIds.some((id) => !draft.selection.agentIds.includes(id)) ||
      draft.selection.bangbooId !== intent.exactTeam.bangbooId ||
      parameters.bangbooId !== draft.selection.bangbooId ||
      targetTeamEquipmentParametersFingerprint(parameters) !==
        targetTeamEquipmentParametersFingerprint(draft.teamEquipmentParameters)
    )
      return undefined
    const scenario = resolveCurrentPlanningScenario32(context.scenarioSelection)
    if (context.scenarioIdentity !== undefined && context.scenarioIdentity !== scenario.identity)
      return undefined
    const declarations = normalizeReviewedEventConditionDeclarations32(
      context.eventConditionDeclarationsByAgentId,
      intent.agentIds,
    )
    if (
      reviewedEventConditionDeclarationsIdentity32(declarations) !==
      context.eventConditionDeclarationsIdentity
    )
      return undefined
    assertCurrentPlanningResourceTimeline32(draft)
    const resourceTimeline = readPlanningResourceTimeline32(draft)
    const loadouts = intent.agentIds.map((agentId) => ({
      agentId,
      discIds: [...(input.discIdsByAgentId[agentId] ?? [])],
    }))
    const refs = resolvePlanningDiscReferences(draft)
    const ids = loadouts.flatMap((row) => row.discIds)
    if (
      !refs.consistent ||
      refs.referenceIds.length !== 18 ||
      refs.referenceIds.some((id) => !ids.includes(id)) ||
      !exactAssignment(input.discs, loadouts)
    )
      return undefined
    for (const agentId of intent.agentIds) {
      const agent = input.roster.agents.find((row) => row.agentId === agentId && row.owned)
      const engines = parameters.wEngines.filter((row) => row.agentId === agentId)
      if (
        !agent ||
        engines.length !== 1 ||
        (supportsPotentialImage(agentId) && !Number.isInteger(agent.potentialImage)) ||
        (parameters.potentialByAgentId?.[agentId] !== undefined &&
          parameters.potentialByAgentId[agentId] !== agent.potentialImage)
      )
        return undefined
      const stored = draft.teamExecutionSnapshot?.members.find((row) => row.agentId === agentId)
        ?.suggested.wEngine
      if (draft.teamExecutionSnapshot && !stored) return undefined
      if (stored) {
        const declared = candidatePanelInputForSchemeAgent(agent, engines[0]!)
        const storedParameters = resolveSuggestedWEngineParameters(stored, null)
        const saved = storedParameters
          ? candidatePanelInputForSchemeAgent(agent, storedParameters)
          : undefined
        if (!declared || !saved || stableContentHash(declared) !== stableContentHash(saved))
          return undefined
      }
    }
    const prepared: WarehouseSavedTeamObjective = {
      accountId: input.accountId,
      roster: {
        ...input.roster,
        agents: input.roster.agents.filter((row) => intent.agentIds.includes(row.agentId)),
      },
      resolved: { buildIntent: intent, effectiveEquipmentParameters: parameters },
      loadouts,
      scenarioSelection: context.scenarioSelection,
      eventConditionDeclarationsByAgentId: declarations,
      resourceTimelineDeclaration32: resourceTimeline,
      capturedAt: draft.updatedAt,
      sourceIdentity: stableContentHash({
        draft,
        intent,
        parameters,
        roster: input.roster.agents.filter((row) => intent.agentIds.includes(row.agentId)),
        loadouts,
      }),
    }
    return frozenMiyabiLuminizeDirection32(objectiveInput(prepared, input.discs))
      ? prepared
      : undefined
  } catch {
    return undefined
  }
}

function objectiveInput(build: WarehouseSavedTeamObjective, discs: readonly DriveDisc[]) {
  const intent = build.resolved.buildIntent
  return {
    warehouse: {
      accountId: build.accountId,
      account: null,
      roster: build.roster,
      discs: [...discs],
    },
    candidate: {
      candidateId: intent.exactTeam.candidateId,
      memberIds: intent.agentIds,
      bangbooId: intent.exactTeam.bangbooId,
      scenarioTags: intent.exactTeam.scenarioTags,
    },
    buildIntent: intent,
    parameters: build.resolved.effectiveEquipmentParameters,
    rosterHash: stableContentHash(build.roster),
    warehouseHash: stableContentHash(discs),
    planningHash: build.sourceIdentity,
    capturedAt: build.capturedAt,
    scenarioSelection: build.scenarioSelection,
    eventConditionDeclarationsByAgentId: build.eventConditionDeclarationsByAgentId,
    resourceTimelineDeclaration32: build.resourceTimelineDeclaration32,
  }
}

/** Coverage metadata only. Damage is evaluated exclusively by the shared objective. */
function directCoverage(
  input: ReturnType<typeof objectiveInput>,
  loadouts: WarehouseSavedTeamObjective['loadouts'],
) {
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const context = {
    ...input,
    fit: {
      status: 'ready' as const,
      memberIds: input.candidate.memberIds,
      loadouts,
      uniqueDiscCount: 18,
      fingerprint: stableContentHash(loadouts),
    },
    modifierProjection: projectTargetTeamEquipmentModifiers({
      baseline: scenario.baseline,
      memberIds: input.candidate.memberIds,
      parameters: input.parameters,
    }),
  }
  const members = compileTargetTeamPlanningMembers(context)
  if (members.blockers.length || members.effectRuntimeMembers.length !== 3) return undefined
  const protocol = input.parameters.luminizeComparison32 ?? luminizeEquipmentPreparationProtocol32
  const snapshot = projectAccountLuminizeEquipmentSnapshot32({
    members: members.effectRuntimeMembers,
    memberIds: input.candidate.memberIds,
    options: protocol,
    baseline: scenario.baseline,
    assetBindingFingerprint: stableContentHash(members.assets),
    sourceRefs: [scenario.identity],
  })
  if (snapshot.status !== 'supported' || !snapshot.snapshot) return undefined
  const direct = compileTargetTeamPlanningContext(context)
  if (
    direct.status !== 'supported' ||
    direct.memberFunctionalCapacities32.some((row) => row.status !== 'supported')
  )
    return undefined
  const exclusions = direct.coverage.excludedEffects
    .map((row) => ({
      effectKey: row.effectKey,
      reason: row.reason,
      fields: [...row.fields].sort(),
      sourceRefs: [...row.sourceRefs].sort(),
    }))
    .sort((left, right) => stableContentHash(left).localeCompare(stableContentHash(right)))
  const details: WarehouseFiniteLuminizeCoverage = {
    luminizeStatus: 'supported',
    sourceIdentityHash: snapshot.snapshot.declaration.sourceIdentityHash,
    protocolHash: stableContentHash({ protocol, baseline: scenario.identity }),
    directStatus: direct.status,
    directCoverage: exclusions.length ? 'partial' : 'complete',
    directExclusionsHash: stableContentHash(exclusions),
    directExclusions: exclusions,
    functionalStatus: 'supported',
  }
  return {
    details,
    hash: stableContentHash({
      scope: 'declared_luminize_static_volley32',
      scenario: scenario.identity,
      includedScope: direct.includedScope,
      includedEffectKeys: [...direct.coverage.includedEffectKeys].sort(),
      details,
      functional: direct.memberFunctionalCapacities32.map((row, index) => ({
        agentId: input.candidate.memberIds[index],
        status: row.status,
        capacities: row.capacities.map(
          ({ key, kind, contextKey, sourceRefs, included, excluded }) => ({
            key,
            kind,
            contextKey,
            sourceRefs,
            included,
            excluded,
          }),
        ),
      })),
      interactionOperatorCoverage: direct.interactionOperatorCoverage,
    }),
  }
}

function assignments(
  loadouts: WarehouseSavedTeamObjective['loadouts'],
  physical: DriveDisc[][],
): AccountLoadout[] {
  // The objective reads concrete physical choices only. No static score is
  // fabricated or used to accept a replacement.
  return loadouts.map((row, index) => ({
    agentId: row.agentId,
    discs: physical[index]!.map((disc) => ({ disc })),
  })) as AccountLoadout[]
}

export function warehouseSavedTeamImprovements(
  discs: readonly DriveDisc[],
  build: WarehouseSavedTeamObjective,
  cache: Map<string, readonly WarehouseCompleteBuildImprovement[]>,
): readonly WarehouseCompleteBuildImprovement[] {
  const key = stableContentHash({ source: build.sourceIdentity, discs })
  const cached = cache.get(key)
  if (cached) return cached
  const physical = exactAssignment(discs, build.loadouts)
  if (!physical) return []
  const input = objectiveInput(build, discs)
  if (!frozenMiyabiLuminizeDirection32(input)) return []
  const objective = createTargetTeamAssignmentObjective(input)
  const baseline = objective.evaluate(assignments(build.loadouts, physical))
  const coverage = directCoverage(input, build.loadouts)
  if (baseline === null || !Number.isFinite(baseline) || !coverage) {
    cache.set(key, [])
    return []
  }
  const ids = new Set(build.loadouts.flatMap((row) => row.discIds))
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.id, (counts.get(disc.id) ?? 0) + 1)
  // This cache belongs to this exact factory/baseline invocation. Entity IDs
  // still pass the physical checks below; only repeated numeric evaluation and
  // its coverage metadata are shared by equivalent complete disc facts.
  const evaluatedFacts = new Map<
    string,
    {
      value: number | null
      coverage: ReturnType<typeof directCoverage>
    }
  >()
  const improvements: WarehouseCompleteBuildImprovement[] = []
  physical.forEach((six, memberIndex) => {
    for (const replacement of discs) {
      if (
        ids.has(replacement.id) ||
        counts.get(replacement.id) !== 1 ||
        !hasReliableWarehouseDiscRecord(replacement)
      )
        continue
      const original = six.find(
        (row) =>
          row.slot === replacement.slot &&
          row.setId === replacement.setId &&
          row.mainStat === replacement.mainStat,
      )
      if (!original) continue
      const factKey = JSON.stringify([
        objective.fingerprint,
        build.sourceIdentity,
        build.loadouts[memberIndex]!.agentId,
        candidateDiscFactKey(original),
        candidateDiscFactKey(replacement),
      ])
      let evaluated = evaluatedFacts.get(factKey)
      if (!evaluated) {
        const candidatePhysical = physical.map((rows, index) =>
          index === memberIndex
            ? rows.map((row) => (row.id === original.id ? replacement : row))
            : rows,
        )
        const value = objective.evaluate(assignments(build.loadouts, candidatePhysical))
        const loadouts = build.loadouts.map((row, index) =>
          index === memberIndex
            ? {
                ...row,
                discIds: row.discIds.map((id) => (id === original.id ? replacement.id : id)),
              }
            : row,
        )
        evaluated = {
          value,
          coverage:
            value !== null && Number.isFinite(value) && value > baseline
              ? directCoverage(input, loadouts)
              : undefined,
        }
        evaluatedFacts.set(factKey, evaluated)
      }
      if (
        evaluated.value === null ||
        !Number.isFinite(evaluated.value) ||
        evaluated.value <= baseline ||
        evaluated.coverage?.hash !== coverage.hash
      )
        continue
      improvements.push({
        agentId: build.loadouts[memberIndex]!.agentId,
        basis: 'saved_scheme',
        sourceIdentity: build.sourceIdentity,
        referenceDiscIds: [...ids],
        replacedDiscId: original.id,
        replacementDiscId: replacement.id,
        objectiveHash: objective.fingerprint,
        comparisonCoverageHash: coverage.hash,
        objectiveScope: 'finite_luminize_static_preparation',
        teamCoverage: coverage.details,
      })
    }
  })
  cache.set(key, improvements)
  return improvements
}
