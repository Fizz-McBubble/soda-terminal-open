import type { AccountPlanningDraft } from '../accounts/types'
import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { developmentCandidateEventObjective32 } from '../decision/developmentCandidateEventObjective32'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import {
  normalizeReviewedEventConditionDeclarations32,
  reviewedEventConditionDeclarationsIdentity32,
} from '../calculation/reviewedEventConditionDeclarations32'
import {
  candidatePanelInputForAgent,
  candidatePanelInputForSchemeAgent,
} from '../optimizer/optimizeAccountBuildsPanelInput'
import type { CandidatePanelInput } from '../optimizer/candidatePanelObjective'
import {
  compareCandidateEffectiveCritObjective,
  projectCandidateEffectiveCritObjective,
  type CandidateEffectiveCritObjective,
} from '../optimizer/candidateEffectiveCritObjective'
import { resolveSuggestedWEngineParameters } from '../pages/teamExecutionAttributePanel'
import type { WarehouseDemandContext } from './warehouseDemandContexts'
import { hasReliableWarehouseDiscRecord } from './warehouseDiscQuality'
import { isConstraintCompatible } from './discEnhancementPotential'
import { allowedSetCountPatterns } from '../optimizer/optimizerSetPatterns'
import { warehouseSavedTeamImprovements } from './warehouseSavedTeamObjective'

export type WarehouseCompleteBuildObjective = {
  basis: 'saved_scheme' | 'equipped'
  discIds: string[]
  panelInput: CandidatePanelInput
  eventObjective: CandidateEffectiveCritObjective
  sourceIdentity: string
}

export type WarehouseFiniteLuminizeCoverage = {
  luminizeStatus: 'supported'
  sourceIdentityHash: string
  protocolHash: string
  directStatus: 'supported'
  directCoverage: 'partial' | 'complete'
  directExclusionsHash: string
  directExclusions: Array<{
    effectKey: string
    reason: string
    fields: string[]
    sourceRefs: string[]
  }>
  functionalStatus: 'supported'
}

type WarehouseCompleteBuildImprovementBase = {
  agentId: string
  basis: WarehouseCompleteBuildObjective['basis']
  sourceIdentity: string
  referenceDiscIds: string[]
  replacedDiscId: string
  replacementDiscId: string
  objectiveHash: string
  comparisonCoverageHash: string
}
export type WarehouseCompleteBuildImprovement = WarehouseCompleteBuildImprovementBase &
  (
    | { objectiveScope: 'source_effective_crit_event' }
    | {
        objectiveScope: 'finite_luminize_static_preparation'
        teamCoverage: WarehouseFiniteLuminizeCoverage
      }
  )

function exactSix(discs: readonly DriveDisc[], ids: readonly string[]) {
  if (ids.length !== 6 || new Set(ids).size !== 6) return undefined
  const selected = ids.map((id) => discs.filter((disc) => disc.id === id))
  if (selected.some((matches) => matches.length !== 1)) return undefined
  const six = selected.map((matches) => matches[0]!)
  return new Set(six.map((disc) => disc.slot)).size === 6 &&
    six.every(hasReliableWarehouseDiscRecord)
    ? six.sort((a, b) => a.slot - b.slot)
    : undefined
}

/** No warehouse representatives or current engine may stand in for a saved scheme. */
export function prepareWarehouseCompleteBuildObjective(input: {
  agent: RosterAgent
  discs: readonly DriveDisc[]
  discIds: readonly string[]
  basis: WarehouseCompleteBuildObjective['basis']
  draft?: AccountPlanningDraft
}): WarehouseCompleteBuildObjective | undefined {
  const six = exactSix(input.discs, input.discIds)
  if (!six) return undefined
  try {
    let panelInput: CandidatePanelInput | undefined
    let declarations
    const context = input.draft?.solutionContext
    if (input.basis === 'saved_scheme') {
      const draft = input.draft
      if (!draft || (context && context.gameVersion !== currentVersionProjection.gameVersion))
        return undefined
      if (
        context?.scenarioIdentity !== undefined &&
        context.scenarioIdentity !==
          resolveCurrentPlanningScenario32(context.scenarioSelection).identity
      )
        return undefined
      declarations = normalizeReviewedEventConditionDeclarations32(
        context?.eventConditionDeclarationsByAgentId,
        draft.selection.agentIds,
      )
      if (
        reviewedEventConditionDeclarationsIdentity32(declarations) !==
        context?.eventConditionDeclarationsIdentity
      )
        return undefined
      // A hypothetical future potential is not the account's actual progression.
      const declaredPotential =
        draft.teamEquipmentParameters?.potentialByAgentId?.[input.agent.agentId] ??
        (draft.selection.agentIds.length === 1
          ? context?.comparisonParameters?.potential
          : undefined)
      if (declaredPotential !== undefined && declaredPotential !== input.agent.potentialImage)
        return undefined
      const executions =
        draft.teamPortfolioSnapshot?.executions ??
        (draft.teamExecutionSnapshot ? [draft.teamExecutionSnapshot] : [])
      const selectedEngine = executions
        .flatMap((team) => team.members)
        .find((member) => member.agentId === input.agent.agentId)?.suggested.wEngine
      const parameterEngine = draft.teamEquipmentParameters?.wEngines.find(
        (engine) => engine.agentId === input.agent.agentId,
      )
      const personalEngine =
        draft.selection.agentIds.length === 1 ? context?.comparisonParameters?.wEngine : undefined
      const engines = [
        selectedEngine,
        ...[parameterEngine, personalEngine].flatMap((engine) =>
          engine
            ? [
                {
                  ...engine,
                  copyId: null,
                  fact: 'player_confirmed_parameter' as const,
                },
              ]
            : [],
        ),
      ].flatMap((engine) => (engine ? [resolveSuggestedWEngineParameters(engine, null)!] : []))
      if (!engines.length) return undefined
      const inputs = engines.map((engine) => candidatePanelInputForSchemeAgent(input.agent, engine))
      if (
        inputs.some((value) => !value) ||
        inputs.some((value) => JSON.stringify(value) !== JSON.stringify(inputs[0]))
      )
        return undefined
      panelInput = inputs[0]
    } else panelInput = candidatePanelInputForAgent(input.agent)
    if (!panelInput) return undefined
    const eventObjective = developmentCandidateEventObjective32({
      agent: input.agent,
      panelInput,
      scenarioSelection: context?.scenarioSelection,
      eventConditionDeclaration: declarations?.[input.agent.agentId],
    })
    if (!eventObjective) return undefined
    const discIds = six.map((disc) => disc.id)
    return {
      basis: input.basis,
      discIds,
      panelInput,
      eventObjective,
      sourceIdentity: stableContentHash({
        basis: input.basis,
        draftId: input.draft?.id,
        agent: input.agent,
        six,
        panelInput,
        eventObjective,
        declarationIdentity: context?.eventConditionDeclarationsIdentity,
      }),
    }
  } catch {
    // Malformed/stale saved declarations retain ordinary static uses and protection.
    return undefined
  }
}

/** One actual five-disc anchor plus one same-class replacement. Positive uses
 * only: no ranking, removal, enhancement ceiling or absolute quality authority. */
export function warehouseCompleteBuildImprovements(
  discs: readonly DriveDisc[],
  context: WarehouseDemandContext,
  cache: Map<string, readonly WarehouseCompleteBuildImprovement[]>,
): readonly WarehouseCompleteBuildImprovement[] {
  if (context.completeTeamBuild && context.eligibility === 'eligible')
    return warehouseSavedTeamImprovements(discs, context.completeTeamBuild, cache).filter(
      (row) => row.agentId === context.agentId,
    )
  const build = context.completeBuild
  if (!build || context.eligibility !== 'eligible' || context.constraint.buildObjective) return []
  const six = exactSix(discs, build.discIds)
  if (!six || six.some((disc) => !isConstraintCompatible(disc, context.constraint))) return []
  const counts: Record<string, number> = {}
  for (const disc of six) counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
  const validPattern = allowedSetCountPatterns({
    setPlans: [
      {
        pattern: context.setPlan.pattern,
        primarySets: context.setPlan.primarySetIds,
        secondarySets: context.setPlan.secondarySetIds,
      },
    ],
  }).some(
    (pattern) =>
      Object.keys(pattern).length === Object.keys(counts).length &&
      Object.entries(pattern).every(([set, count]) => counts[set] === count),
  )
  if (!validPattern) return []
  const cacheKey = stableContentHash({
    six,
    panelInput: build.panelInput,
    eventObjective: build.eventObjective,
  })
  const previous = cache.get(cacheKey)
  if (previous)
    return previous.map((row) => ({
      ...row,
      basis: build.basis,
      sourceIdentity: build.sourceIdentity,
    }))
  const baseline = projectCandidateEffectiveCritObjective(
    build.eventObjective,
    build.panelInput,
    six,
  )
  if (baseline.status !== 'applied') {
    cache.set(cacheKey, [])
    return []
  }
  const improvements: WarehouseCompleteBuildImprovement[] = []
  const idCounts = new Map<string, number>()
  for (const disc of discs) idCounts.set(disc.id, (idCounts.get(disc.id) ?? 0) + 1)
  for (const replacement of discs) {
    if (
      idCounts.get(replacement.id) !== 1 ||
      build.discIds.includes(replacement.id) ||
      !hasReliableWarehouseDiscRecord(replacement)
    )
      continue
    const replaced = six.find(
      (disc) =>
        disc.slot === replacement.slot &&
        disc.setId === replacement.setId &&
        disc.mainStat === replacement.mainStat,
    )
    if (!replaced) continue
    const candidate = projectCandidateEffectiveCritObjective(
      build.eventObjective,
      build.panelInput,
      six.map((disc) => (disc.id === replaced.id ? replacement : disc)),
    )
    if (
      candidate.status !== 'applied' ||
      candidate.objectiveHash !== baseline.objectiveHash ||
      candidate.comparisonCoverageHash !== baseline.comparisonCoverageHash ||
      compareCandidateEffectiveCritObjective(baseline, candidate) <= 0
    )
      continue
    improvements.push({
      objectiveScope: 'source_effective_crit_event',
      agentId: context.agentId,
      basis: build.basis,
      sourceIdentity: build.sourceIdentity,
      referenceDiscIds: [...build.discIds],
      replacedDiscId: replaced.id,
      replacementDiscId: replacement.id,
      objectiveHash: candidate.objectiveHash,
      comparisonCoverageHash: candidate.comparisonCoverageHash,
    })
  }
  cache.set(cacheKey, improvements)
  return improvements
}
