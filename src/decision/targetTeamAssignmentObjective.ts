import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
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
import { preservesTeamFunctionalConstraints32 } from './teamFunctionalConstraints32'
import { isReviewedPreparedMemberDamageExclusion32 } from '../calculation/reviewedPreparedTeamBenchmark32'

type ContextInput = Parameters<typeof compileTargetTeamPlanningContext>[0]

export function createTargetTeamAssignmentObjective(
  input: Omit<ContextInput, 'fit' | 'modifierProjection'>,
): TeamAssignmentObjective {
  const modifierProjection = projectTargetTeamEquipmentModifiers({
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
      candidate: input.candidate,
      parameters: input.parameters,
      rosterHash: input.rosterHash,
      warehouseHash: input.warehouseHash,
      planningHash: input.planningHash,
      baseline: currentNormalizedPlanningBaseline,
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
      const loadouts = assignments.map((loadout) => ({
        agentId: loadout.agentId,
        discIds: loadout.discs.map((choice) => choice.disc.id),
      }))
      const uniqueDiscCount = new Set(loadouts.flatMap((item) => item.discIds)).size
      const context: ContextInput = {
        ...input,
        modifierProjection,
        fit: {
          memberIds: input.candidate.memberIds,
          loadouts,
          status:
            loadouts.length === 3 &&
            loadouts.every((item) => item.discIds.length === 6) &&
            uniqueDiscCount === 18
              ? 'ready'
              : 'partial',
          uniqueDiscCount,
          fingerprint: stableContentHash(loadouts),
        },
      }
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
