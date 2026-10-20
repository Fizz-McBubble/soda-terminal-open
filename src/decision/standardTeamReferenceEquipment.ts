import { createEmptyRoster, currentAgentDirectory } from '../assault/catalog'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import type { DriveDisc, StatKey } from '../domain/schemas'
import {
  selectStandardTeamReferenceEquipment,
  standardTeamReferenceEquipmentPolicy,
  type StandardTeamReferenceMember,
  type StandardTeamReferenceSelection,
} from '../calculation/standardTeamReferenceEquipment'
import { createStandardReferenceDiscSeed } from '../calculation/standardReferenceDiscAllocation'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { candidateSetPlansForConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { evaluateCandidateSetPlanEligibility } from '../gameDataPacks/candidateSetPlanEligibility'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import { resolveBuildIntentWEngineIds } from '../gameDataPacks/buildIntentWEngineIdentity'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { compileTeamBuildIntent } from './buildIntent'
import {
  targetTeamBuildDirectionConditions,
  targetTeamSelectedDirectionConditions,
} from '../application/targetTeamEffectivePotentialConditions'
import {
  createTeamStrengthEquippedReferenceMember,
  localStandardReferenceBuildPolicy,
} from './teamStrengthReferenceBuild'
import {
  resolveTeamStrengthReferenceMindscape,
  resolveTeamStrengthReferencePotential,
} from './teamStrengthReferenceState'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { resolveSkillInvestmentMindscapeBonus } from './skillInvestmentProjection'
import {
  createTargetTeamAssignmentObjective,
  type TargetTeamObjectiveContextInput,
} from './targetTeamAssignmentObjective'
import { frozenMiyabiLuminizeDirection32 } from './targetTeamLuminizeAssignmentObjective32'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import {
  resolveTargetTeamWEngineRuntime,
  targetTeamWEngineRuntimeSource,
  type TargetTeamWEngineRuntimeDeclaration,
} from './targetTeamPlanningContextInput'
import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import type { DeclaredEventGoal32 } from './targetTeamDeclaredEventObjective32'

type ObjectiveInput = Omit<TargetTeamObjectiveContextInput, 'fit' | 'modifierProjection'>
export type StandardTeamReferencePreparationInput = {
  input: ObjectiveInput
  referenceConditions?: TeamStrengthReferenceConditions
  /** Explicit per-option states, bound to locked formula/data sources. Missing is unknown. */
  wEngineRuntimeDeclarationsByAgentId?: Readonly<
    Record<string, Readonly<Record<string, TargetTeamWEngineRuntimeDeclaration>>>
  >
}
export const targetTeamStandardReferenceEquipmentPolicy = {
  id: 'target-team-standard-18-facts-common-baseline-native-objective/v1',
  search: standardTeamReferenceEquipmentPolicy,
  cultivation: localStandardReferenceBuildPolicy,
  baseline: 'immutable-complete-standard-seed',
  fallback54: false,
  referenceTimestamp: '2026-10-19T00:00:00.000Z',
  referenceTimestampMeaning: 'fixed-local-standard-protocol-not-account-observation',
} as const

export type PreparedTargetTeamStandardReferenceEquipment = {
  status: 'supported'
  identity: string
  members: StandardTeamReferenceMember[]
  referenceInput: TargetTeamObjectiveContextInput
  branchPlans: Record<string, CandidateSetPlan>
  referenceConditions?: TeamStrengthReferenceConditions
  runtimeDeclarationsByAgentId: StandardTeamReferencePreparationInput['wEngineRuntimeDeclarationsByAgentId']
}

function setChoices(plan: CandidateSetPlan): string[][] {
  if (plan.pattern === '4+2')
    return plan.primarySetIds.flatMap((primary) =>
      plan.secondarySetIds
        .filter((secondary) => secondary !== primary)
        .map((secondary) => [primary, primary, primary, primary, secondary, secondary]),
    )
  const ids = [...new Set(plan.primarySetIds)]
  return ids.flatMap((a, i) =>
    ids
      .slice(i + 1)
      .flatMap((b, offset) => ids.slice(i + offset + 2).map((c) => [a, a, b, b, c, c])),
  )
}

export function materializeStandardTeamReferenceSelection(
  prepared: Omit<PreparedTargetTeamStandardReferenceEquipment, 'referenceInput'> & {
    referenceInput: ObjectiveInput
  },
  selections: readonly StandardTeamReferenceSelection[],
): TargetTeamObjectiveContextInput | null {
  const input = prepared.referenceInput
  if (selections.length !== 3 || new Set(selections.map((row) => row.agentId)).size !== 3)
    return null
  const runtimeDeclarations = selections.flatMap((row) => {
    const declaration = prepared.runtimeDeclarationsByAgentId?.[row.agentId]?.[row.engineId]
    return declaration ? [declaration] : []
  })
  const parameters = {
    ...input.parameters,
    wEngines: selections.map((row) => ({
      agentId: row.agentId,
      engineId: row.engineId,
      refinement: row.refinement,
      level: 60,
      ascension: 5,
    })),
  }
  const runtime = resolveTargetTeamWEngineRuntime({
    memberIds: input.candidate.memberIds,
    parameters,
    declarations: runtimeDeclarations,
  })
  if (runtime.status !== 'supported') return null
  for (const row of selections) {
    const member = prepared.members.find((member) => member.agentId === row.agentId)
    const branch = member?.branches.find((branch) => branch.identity === row.branchIdentity)
    if (
      !member ||
      member.referenceStateIdentity !== row.referenceStateIdentity ||
      !branch ||
      row.discs.some(
        (disc) =>
          !branch.discs.some(
            (template) =>
              template.slot === disc.slot &&
              template.mainStat === disc.mainStat &&
              template.setId === disc.setId,
          ),
      ) ||
      !member.engines.some(
        (engine) =>
          engine.engineId === row.engineId &&
          engine.refinement === row.refinement &&
          engine.sourceIdentity === row.sourceIdentity,
      )
    )
      return null
    const build = createTeamStrengthEquippedReferenceMember({
      agentId: row.agentId,
      memberIds: input.candidate.memberIds,
      referenceConditions: prepared.referenceConditions,
      standardEquipmentSelection: {
        engineId: row.engineId,
        refinement: row.refinement,
        discs: row.discs,
        objectiveIdentity: prepared.identity,
        identity: stableContentHash(row),
      },
    })
    if (build.status !== 'ready') return null
  }
  const discs = selections.flatMap((row) => row.discs)
  if (new Set(discs.map((disc) => disc.id)).size !== 18) return null
  const selectedIds = new Set(discs.map((disc) => disc.id))
  const roster = {
    ...input.warehouse.roster,
    agents: input.warehouse.roster.agents.map((agent) => {
      const selection = selections.find((row) => row.agentId === agent.agentId)
      return selection
        ? {
            ...agent,
            equippedDiscIds: selection.discs.map((disc) => disc.id),
            wEngineDetails: {
              id: selection.engineId,
              name: null,
              level: 60,
              ascension: 5,
              refinement: selection.refinement,
            },
          }
        : agent
    }),
  }
  const warehouse = {
    ...input.warehouse,
    roster,
    discs: [
      ...input.warehouse.discs.filter((disc) => !selectedIds.has(disc.id)),
      ...structuredClone(discs),
    ],
  }
  const loadouts = selections.map((row) => ({
    agentId: row.agentId,
    discIds: row.discs.map((disc) => disc.id),
  }))
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  return {
    ...input,
    warehouse,
    parameters,
    wEngineRuntimeDeclarations: runtimeDeclarations,
    rosterHash: stableContentHash(roster),
    warehouseHash: stableContentHash(warehouse.discs),
    modifierProjection: projectTargetTeamEquipmentModifiers({
      baseline: scenario.baseline,
      memberIds: input.candidate.memberIds,
      parameters,
      runtimeByAgentId: runtime.runtimeByAgentId,
    }),
    fit: {
      status: 'ready',
      memberIds: input.candidate.memberIds,
      loadouts,
      uniqueDiscCount: 18,
      fingerprint: stableContentHash({ loadouts, discs }),
    },
  }
}

/** Pure preparation permits the real consumer to issue a separate standard goal.
 * The deterministic seed defines a comparison baseline; it is not a best choice. */
export function prepareTargetTeamStandardReferenceEquipment(
  request: StandardTeamReferencePreparationInput,
): PreparedTargetTeamStandardReferenceEquipment | { status: 'unsupported'; reason: string } {
  try {
    const original = request.input
    const ids = original.candidate.memberIds
    if (ids.length !== 3 || new Set(ids).size !== 3) throw new Error('标准团队需要三名不同成员。')
    const selectedDirections = targetTeamSelectedDirectionConditions({
      memberIds: ids,
      roster: original.warehouse.roster,
    })
    const roster = createEmptyRoster(targetTeamStandardReferenceEquipmentPolicy.referenceTimestamp)
    roster.agents = roster.agents.filter((row) => ids.includes(row.agentId))
    const potentialByAgentId = Object.fromEntries(
      ids
        .filter(supportsPotentialImage)
        .map((id) => [id, resolveTeamStrengthReferencePotential(id, request.referenceConditions)]),
    )
    for (const id of ids) {
      const row = roster.agents.find((row) => row.agentId === id)
      const agent = currentAgentDirectory.find((row) => row.id === id)
      if (
        !row ||
        !agent ||
        !['S', 'A'].includes(agent.rarity ?? '') ||
        agent.releaseState !== 'released'
      )
        throw new Error(`缺少已发布标准成员身份：${id}`)
      const mindscape = resolveTeamStrengthReferenceMindscape(id)
      const skill = 11 + (resolveSkillInvestmentMindscapeBonus(mindscape) ?? 0)
      Object.assign(row, {
        owned: true,
        level: 60,
        ascension: 5,
        mindscape,
        potentialImage: potentialByAgentId[id] ?? 0,
        skillLevels: {
          basic: skill,
          dodge: skill,
          assist: skill,
          special: skill,
          chain: skill,
          core: 7,
        },
        observedFacts: undefined,
        lockedFields: selectedDirections[id] ? [`buildBranch:${id}:${selectedDirections[id]}`] : [],
      })
    }
    const conditions = targetTeamBuildDirectionConditions({
      memberIds: ids,
      roster,
      potentialByAgentId,
    })
    const buildIntent = compileTeamBuildIntent({
      candidateId: original.candidate.candidateId,
      memberIds: ids,
      bangbooId: original.parameters.bangbooId,
      scenarioTags: original.candidate.scenarioTags,
      ...conditions,
    })
    const input: ObjectiveInput = {
      candidate: structuredClone(original.candidate),
      warehouse: { accountId: 'standard-team-reference32', account: null, roster, discs: [] },
      parameters: {
        bangbooId: original.parameters.bangbooId,
        bangbooStars: original.parameters.bangbooStars,
        wEngines: [],
        potentialByAgentId,
        ...(original.parameters.luminizeComparison32
          ? { luminizeComparison32: structuredClone(original.parameters.luminizeComparison32) }
          : {}),
      },
      scenarioSelection: original.scenarioSelection && structuredClone(original.scenarioSelection),
      eventConditionDeclarationsByAgentId:
        original.eventConditionDeclarationsByAgentId &&
        structuredClone(original.eventConditionDeclarationsByAgentId),
      rosterHash: stableContentHash(roster),
      warehouseHash: stableContentHash([]),
      planningHash: stableContentHash({
        policy: targetTeamStandardReferenceEquipmentPolicy,
        candidate: original.candidate,
        selectedDirections,
        scenario: original.scenarioSelection ?? null,
      }),
      capturedAt: targetTeamStandardReferenceEquipmentPolicy.referenceTimestamp,
      buildIntent,
    }
    const identity = stableContentHash({
      policy: targetTeamStandardReferenceEquipmentPolicy,
      input,
      conditions: request.referenceConditions,
      runtime: request.wEngineRuntimeDeclarationsByAgentId ?? null,
    })
    const branchPlans: Record<string, CandidateSetPlan> = {}
    const members = ids.map((agentId): StandardTeamReferenceMember => {
      const constraint = buildIntent.recommendations.find(
        (row) => row.agentId === agentId,
      )?.constraint
      if (!constraint || constraint.status !== 'candidate')
        throw new Error(`缺少当前标准构筑约束：${agentId}`)
      const branches: StandardTeamReferenceMember['branches'][number][] = []
      for (const plan of candidateSetPlansForConstraint(constraint))
        for (const sets of setChoices(plan))
          for (const main4 of constraint.mainStats['4'] ?? [])
            for (const main5 of constraint.mainStats['5'] ?? [])
              for (const main6 of constraint.mainStats['6'] ?? []) {
                const mains: StatKey[] = ['hp_flat', 'atk_flat', 'def_flat', main4, main5, main6]
                const branchIdentity = stableContentHash({
                  constraint: constraint.contentHash,
                  plan,
                  sets,
                  mains,
                })
                const seed = createStandardReferenceDiscSeed(
                  mains.map(
                    (mainStat, index): DriveDisc => ({
                      id: `standard-team:${identity}:${agentId}:${index + 1}`,
                      slot: (index + 1) as DriveDisc['slot'],
                      setId: sets[index]!,
                      mainStat,
                      level: 15,
                      rarity: 'S',
                      subStats: [],
                      locked: false,
                      favorite: false,
                      tags: [],
                      createdAt: targetTeamStandardReferenceEquipmentPolicy.referenceTimestamp,
                      updatedAt: targetTeamStandardReferenceEquipmentPolicy.referenceTimestamp,
                      dataVersion: '3.2',
                    }),
                  ),
                )
                if (
                  seed.status !== 'supported' ||
                  branches.some((row) => row.identity === branchIdentity)
                )
                  continue
                branches.push({ identity: branchIdentity, discs: seed.discs })
                branchPlans[branchIdentity] =
                  plan.pattern === '4+2'
                    ? { ...plan, primarySetIds: [sets[0]!], secondarySetIds: [sets[4]!] }
                    : plan
              }
      const directions = constraint.wEngineDirections.map(
        (direction) =>
          direction.match(/^(wengine-\d+)(?=$|[（(])/u)?.[1] ??
          direction.match(/^[^（）()：:]*[（(](wengine-\d+)[)）]/u)?.[1] ??
          direction,
      )
      const specialty = currentAgentDirectory.find((row) => row.id === agentId)?.specialty
      const engines = resolveBuildIntentWEngineIds(agentId, directions).flatMap((engineId) => {
        const engine = getCurrentWEngineStaticData(engineId)
        const source = targetTeamWEngineRuntimeSource(engineId)
        return engine && source && engine.specialty === specialty
          ? [
              {
                engineId,
                refinement: engine.rarity === 'S' ? 1 : 5,
                sourceIdentity: stableContentHash({
                  source,
                  runtime:
                    request.wEngineRuntimeDeclarationsByAgentId?.[agentId]?.[engineId] ?? null,
                  constraint: constraint.contentHash,
                }),
              },
            ]
          : []
      })
      if (!branches.length || !engines.length)
        throw new Error(`缺少合法标准主词/套装/音擎候选：${agentId}`)
      return {
        agentId,
        referenceStateIdentity: stableContentHash({
          policy: localStandardReferenceBuildPolicy,
          cultivation: (() => {
            const row = roster.agents.find((row) => row.agentId === agentId)!
            return {
              agentId,
              level: row.level,
              ascension: row.ascension,
              mindscape: row.mindscape,
              skillLevels: row.skillLevels,
              selectedDirectionId: selectedDirections[agentId] ?? null,
            }
          })(),
          potential: potentialByAgentId[agentId],
        }),
        branches,
        engines,
      }
    })
    const partial = {
      status: 'supported' as const,
      identity,
      members,
      referenceInput: input,
      branchPlans,
      referenceConditions: request.referenceConditions,
      runtimeDeclarationsByAgentId: request.wEngineRuntimeDeclarationsByAgentId,
    }
    const seed = members.map((member) => ({
      agentId: member.agentId,
      referenceStateIdentity: member.referenceStateIdentity,
      branchIdentity: member.branches[0]!.identity,
      discs: [...member.branches[0]!.discs],
      ...member.engines[0]!,
    }))
    const referenceInput = materializeStandardTeamReferenceSelection(partial, seed)
    if (!referenceInput) throw new Error('完整标准18盘基准无法构造。')
    return { ...partial, referenceInput }
  } catch (error) {
    return { status: 'unsupported', reason: error instanceof Error ? error.message : String(error) }
  }
}

/** One native objective closure owns a common immutable baseline for every
 * complete candidate. No character score or historical 54-roll fallback. */
export function createStandardTeamReferenceEvaluator(request: {
  prepared: PreparedTargetTeamStandardReferenceEquipment
  declaredEventGoal32?: DeclaredEventGoal32
  maxEvaluations?: number
}) {
  const prepared = structuredClone(request.prepared)
  if (request.declaredEventGoal32)
    prepared.referenceInput.declaredEventGoal32 = structuredClone(request.declaredEventGoal32)
  const input = prepared.referenceInput
  if (!input.declaredEventGoal32 && !frozenMiyabiLuminizeDirection32(input))
    return {
      status: 'unsupported' as const,
      reason: '标准团队缺少合法逐次事件声明或精确有限辉映目标。',
    }
  let currentContext: TargetTeamObjectiveContextInput | null = null
  const objective = createTargetTeamAssignmentObjective(input, {
    contextResolver: { identity: prepared.identity, resolve: () => currentContext },
  })
  const evaluate = (selections: readonly StandardTeamReferenceSelection[]) => {
    const setCountsByAgentId = Object.fromEntries(
      selections.map((row) => [
        row.agentId,
        row.discs.reduce<Record<string, number>>((counts, disc) => {
          counts[disc.setId] = (counts[disc.setId] ?? 0) + 1
          return counts
        }, {}),
      ]),
    )
    if (
      selections.some((row) => {
        const plan = prepared.branchPlans[row.branchIdentity]
        if (!plan) return true
        const eligibility = evaluateCandidateSetPlanEligibility(row.agentId, plan, {
          memberIds: input.candidate.memberIds,
          selectedLoadouts: { basis: 'final-candidate', setCountsByAgentId },
        })
        return !['eligible', 'unrestricted'].includes(eligibility.status)
      })
    )
      return null
    currentContext = materializeStandardTeamReferenceSelection(prepared, selections)
    if (!currentContext) return null
    const assignments = selections.map((row) => ({
      agentId: row.agentId,
      discs: row.discs.map((disc) => ({ disc })),
    })) as AccountLoadout[]
    const value = objective.evaluate(assignments)
    if (value === null || !Number.isFinite(value)) return null
    const declaredCoverage = (
      objective as typeof objective & { lastEvaluationCoverageIdentity?: () => string | null }
    ).lastEvaluationCoverageIdentity?.()
    if (input.declaredEventGoal32)
      return declaredCoverage ? { value, coverageIdentity: declaredCoverage } : null
    const direct = compileTargetTeamPlanningContext(currentContext)
    if (
      direct.status !== 'supported' ||
      direct.memberFunctionalCapacities32.some((row) => row.status !== 'supported')
    )
      return null
    return {
      value,
      coverageIdentity: stableContentHash({
        scope: 'finite_luminize_static_preparation',
        goal: input.buildIntent?.fingerprint,
        scenario: input.scenarioSelection ?? null,
        exclusions: direct.coverage.excludedEffects,
        functional: direct.memberFunctionalCapacities32.map((row) => ({
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
      }),
    }
  }
  return {
    status: 'supported' as const,
    evaluate,
    objectiveIdentity: stableContentHash({
      policy: targetTeamStandardReferenceEquipmentPolicy,
      prepared: prepared.identity,
      objective: objective.fingerprint,
      goal: input.declaredEventGoal32 ?? null,
    }),
  }
}

export function selectTargetTeamStandardReferenceEquipment(request: {
  prepared: PreparedTargetTeamStandardReferenceEquipment
  declaredEventGoal32?: DeclaredEventGoal32
  maxEvaluations?: number
}) {
  const evaluator = createStandardTeamReferenceEvaluator(request)
  if (evaluator.status !== 'supported') return evaluator
  return selectStandardTeamReferenceEquipment({
    members: request.prepared.members,
    objectiveIdentity: evaluator.objectiveIdentity,
    evaluate: evaluator.evaluate,
    maxEvaluations: request.maxEvaluations,
    initialReference: standardTeamReferenceSeedSelection(request.prepared),
  })
}

export function standardTeamReferenceSeedSelection(
  prepared: PreparedTargetTeamStandardReferenceEquipment,
): StandardTeamReferenceSelection[] {
  const input = prepared.referenceInput
  return prepared.members.map((member) => {
    const fit = input.fit.loadouts.find((row) => row.agentId === member.agentId)!
    const discs = fit.discIds.map((id) => input.warehouse.discs.find((disc) => disc.id === id)!)
    const branch = member.branches.find((branch) =>
      branch.discs.every((disc) =>
        discs.some(
          (row) =>
            row?.slot === disc.slot && row.mainStat === disc.mainStat && row.setId === disc.setId,
        ),
      ),
    )!
    const parameter = input.parameters.wEngines.find((row) => row.agentId === member.agentId)!
    const engine = member.engines.find(
      (row) => row.engineId === parameter.engineId && row.refinement === parameter.refinement,
    )!
    return {
      agentId: member.agentId,
      referenceStateIdentity: member.referenceStateIdentity,
      branchIdentity: branch.identity,
      discs,
      ...engine,
    }
  })
}
