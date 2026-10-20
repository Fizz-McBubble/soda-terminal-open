import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { resolveCurrentPlanningScenario32 } from '../calculation/currentPlanningScenario32'
import { stableContentHash } from '../gameDataPacks/types'
import {
  teamAssignmentObjectivePolicy,
  type TeamAssignmentObjective,
} from '../optimizer/selectTeamObjectiveAssignment'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import { standardSubstatProbes } from '../calculation/standardSubstatProbe'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'
import type { StatKey } from '../domain/schemas'
import type { ReviewedFunctionalCapacity32 } from '../calculation/reviewedFunctionalCapacity32'
import {
  preservesTeamFunctionalConstraints32,
  sourceReviewedProtectedUtilityIndices32,
} from './teamFunctionalConstraints32'
import { isReviewedPreparedMemberDamageExclusion32 } from '../calculation/reviewedPreparedTeamBenchmark32'
import type { TeamJointBuildIntent } from './buildIntent'
import { createTargetTeamDeclaredEventObjective32 } from './targetTeamDeclaredEventObjective32'
import { targetTeamObjectiveConditionsIdentity } from './targetTeamPlanningContextInput'
import {
  createTargetTeamLuminizeAssignmentObjective32,
  frozenMiyabiLuminizeDirection32,
} from './targetTeamLuminizeAssignmentObjective32'

export type TargetTeamObjectiveContextInput = Parameters<
  typeof compileTargetTeamPlanningContext
>[0] & {
  buildIntent?: TeamJointBuildIntent
}
type ContextInput = TargetTeamObjectiveContextInput
export type TargetTeamObjectiveContextResolver = {
  identity: string
  resolve: (
    assignments: Parameters<TeamAssignmentObjective['evaluate']>[0],
  ) => TargetTeamObjectiveContextInput | null
}
export type TargetTeamObjectiveOptions = { contextResolver?: TargetTeamObjectiveContextResolver }

export function resolveTargetTeamObjectiveContext(
  input: Omit<ContextInput, 'fit' | 'modifierProjection'>,
  assignments: Parameters<TeamAssignmentObjective['evaluate']>[0],
  modifierProjection: ContextInput['modifierProjection'],
  options?: TargetTeamObjectiveOptions,
): ContextInput | null {
  const loadouts = assignments.map((row) => ({
    agentId: row.agentId,
    discIds: row.discs.map((choice) => choice.disc.id),
  }))
  const uniqueDiscCount = new Set(loadouts.flatMap((row) => row.discIds)).size
  const context = options?.contextResolver
    ? options.contextResolver.resolve(assignments)
    : {
        ...input,
        modifierProjection,
        fit: {
          memberIds: input.candidate.memberIds,
          loadouts,
          status: 'ready' as const,
          uniqueDiscCount,
          fingerprint: stableContentHash(loadouts),
        },
      }
  if (
    !context ||
    targetTeamObjectiveConditionsIdentity(context) !==
      targetTeamObjectiveConditionsIdentity(input) ||
    assignments.length !== 3 ||
    uniqueDiscCount !== 18 ||
    new Set(assignments.map((row) => row.agentId)).size !== 3 ||
    context.candidate.candidateId !== input.candidate.candidateId ||
    stableContentHash(context.candidate.memberIds) !==
      stableContentHash(input.candidate.memberIds) ||
    context.fit.status !== 'ready' ||
    context.fit.uniqueDiscCount !== 18 ||
    stableContentHash(context.fit.loadouts) !== stableContentHash(loadouts) ||
    assignments.some(
      (row) =>
        !input.candidate.memberIds.includes(row.agentId) ||
        row.discs.length !== 6 ||
        row.discs.some(
          ({ disc }) =>
            stableContentHash(disc) !==
            stableContentHash(context.warehouse.discs.find((item) => item.id === disc.id)),
        ),
    )
  )
    return null
  return context
}

export function createTargetTeamAssignmentObjective(
  input: Omit<ContextInput, 'fit' | 'modifierProjection'>,
  options?: TargetTeamObjectiveOptions,
): TeamAssignmentObjective {
  if (input.declaredEventGoal32) return createTargetTeamDeclaredEventObjective32(input, options)
  const luminizeDirection = frozenMiyabiLuminizeDirection32(input)
  if (luminizeDirection)
    return createTargetTeamLuminizeAssignmentObjective32(input, luminizeDirection, options)
  const scenario = resolveCurrentPlanningScenario32(input.scenarioSelection)
  const modifierProjection = projectTargetTeamEquipmentModifiers({
    baseline: scenario.baseline,
    memberIds: input.candidate.memberIds,
    parameters: input.parameters,
  })
  // Every consumer evaluates the real incumbent first. Utility constraints stay
  // anchored there rather than ratcheting after each accepted replacement.
  let baselineUtilityStats: Map<string, number[]> | undefined
  let baselineFunctionalCapacities: ReviewedFunctionalCapacity32[] | undefined
  let baselineContext: ContextInput | undefined
  let baselineDamage: number | undefined
  let hintProbeEvaluations = 0
  const rates = new Map<string, Map<StatKey, number | null>>()
  const hintValues = new Map<string, Map<string, number>>()
  const hasCompleteCoverage = (result: ReturnType<typeof compileTargetTeamPlanningContext>) =>
    result.status === 'supported' &&
    result.coverage.excludedEffects.every(
      (effect) =>
        effect.reason === 'static_condition_not_met' ||
        (result.includedScope === 'three_members' &&
          isReviewedPreparedMemberDamageExclusion32(effect)),
    )
  return {
    domain: 'game_legal_inventory',
    baselineDiscIdsByAgent: Object.fromEntries(
      input.candidate.memberIds.flatMap((agentId) => {
        const ids = input.warehouse.roster.agents.find(
          (agent) => agent.agentId === agentId,
        )?.equippedDiscIds
        return ids?.length === 6 ? [[agentId, ids]] : []
      }),
    ),
    fingerprint: stableContentHash({
      policy: teamAssignmentObjectivePolicy,
      contextResolverIdentity: options?.contextResolver?.identity ?? null,
      wEngineRuntimeDeclarations: input.wEngineRuntimeDeclarations ?? null,
      candidate: input.candidate,
      parameters: input.parameters,
      rosterHash: input.rosterHash,
      warehouseHash: input.warehouseHash,
      planningHash: input.planningHash,
      baseline: scenario.baseline,
      scenarioIdentity: scenario.identity,
      eventConditionDeclarations: input.eventConditionDeclarationsByAgentId ?? null,
    }),
    hintProbeEvaluations: () => hintProbeEvaluations,
    visitHint: (disc, agentId) => {
      if (!baselineContext || baselineDamage === undefined) return 0
      if (!rates.has(agentId)) {
        const memberRates = new Map<StatKey, number | null>()
        for (const probe of standardSubstatProbes()) {
          // Fixed direct events do not quantify anomaly settlement. Missing
          // marginals remain null; this ordering hint never prices a tradeoff.
          if (probe.stat === 'anomaly_proficiency') {
            memberRates.set(probe.stat, null)
            continue
          }
          const result = compileTargetTeamPlanningContext({
            ...baselineContext,
            statProbesByAgentId: { [agentId]: probe },
          })
          hintProbeEvaluations++
          memberRates.set(
            probe.stat,
            result.status === 'supported' && hasCompleteCoverage(result)
              ? (result.totalDamage - baselineDamage) / probe.value
              : null,
          )
        }
        rates.set(agentId, memberRates)
      }
      const cache = hintValues.get(agentId) ?? new Map<string, number>()
      hintValues.set(agentId, cache)
      if (!cache.has(disc.id)) {
        const main = resolveDriveDiscMainStatValue(disc)
        const lines = [
          ...disc.subStats,
          ...(main ? [{ stat: disc.mainStat, value: main.value }] : []),
        ]
        cache.set(
          disc.id,
          lines.reduce((sum, line) => {
            const rate = rates.get(agentId)!.get(line.stat)
            return rate == null || !Number.isFinite(rate) ? sum : sum + line.value * rate
          }, 0),
        )
      }
      return cache.get(disc.id)!
    },
    evaluate: (assignments) => {
      const context = resolveTargetTeamObjectiveContext(
        input,
        assignments,
        modifierProjection,
        options,
      )
      if (!context) return null
      const result = compileTargetTeamPlanningContext(context)
      if (result.status !== 'supported') return null
      // A matching gap list is not a dependency proof. The production goal is
      // numerical only when every relevant effect is consumed or proven inactive;
      // unobserved triggers, todo expressions and unknown recipient dependencies
      // retain the sourced fallback instead of being priced at zero.
      if (!hasCompleteCoverage(result)) return null
      if (result.memberFunctionalCapacities32.some((row) => row.status !== 'supported')) return null
      const functionalCapacities = result.memberFunctionalCapacities32.flatMap(
        (row) => row.capacities,
      )
      if (!baselineFunctionalCapacities) baselineFunctionalCapacities = functionalCapacities
      const utilityStats = new Map(
        result.memberUtilityStats.map((member) => [
          member.agentId,
          [member.impact, member.enerRegen, member.anomMas, member.anomProf],
        ]),
      )
      if (
        [...utilityStats.values()].some((values) =>
          values.some((value) => typeof value !== 'number' || !Number.isFinite(value)),
        )
      )
        return null
      if (!baselineUtilityStats) baselineUtilityStats = utilityStats
      // Compare the modeled event outcome before its raw input. Unmodeled
      // energy/anomaly cadence still cannot be traded for direct damage.
      if (
        !preservesTeamFunctionalConstraints32({
          baselineCapacities: baselineFunctionalCapacities,
          candidateCapacities: functionalCapacities,
          baselineUtility: baselineUtilityStats,
          candidateUtility: utilityStats,
          protectedUtilityIndicesByAgentId: new Map(
            [...utilityStats.keys()].map((agentId) => [
              agentId,
              sourceReviewedProtectedUtilityIndices32(agentId),
            ]),
          ),
        })
      )
        return null
      if (!baselineContext) {
        baselineContext = context
        baselineDamage = result.totalDamage
      }
      return result.totalDamage
    },
  }
}
