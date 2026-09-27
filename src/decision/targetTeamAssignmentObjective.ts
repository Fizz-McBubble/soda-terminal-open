import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { stableContentHash } from '../gameDataPacks/types'
import {
  teamAssignmentObjectivePolicy,
  type TeamAssignmentObjective,
} from '../optimizer/selectTeamObjectiveAssignment'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import { driveDiscEffectProtectionOwner } from '../calculation/currentDriveDiscPlanningEffects'

type ContextInput = Parameters<typeof compileTargetTeamPlanningContext>[0]

export function createTargetTeamAssignmentObjective(
  input: Omit<ContextInput, 'fit' | 'modifierProjection'>,
): TeamAssignmentObjective {
  const modifierProjection = projectTargetTeamEquipmentModifiers({
    memberIds: input.candidate.memberIds,
    parameters: input.parameters,
  })
  // The selector evaluates the original assignment first. A fixed direct-damage
  // model cannot justify dropping an existing unmodelled buff or daze effect.
  let baselineExcludedEffects: Set<string> | undefined
  let baselineUtilityStats: Map<string, number[]> | undefined
  return {
    fingerprint: stableContentHash({
      policy: teamAssignmentObjectivePolicy,
      candidate: input.candidate,
      parameters: input.parameters,
      rosterHash: input.rosterHash,
      warehouseHash: input.warehouseHash,
      planningHash: input.planningHash,
      baseline: currentNormalizedPlanningBaseline,
    }),
    evaluate: (assignments) => {
      const loadouts = assignments.map((loadout) => ({
        agentId: loadout.agentId,
        discIds: loadout.discs.map((choice) => choice.disc.id),
      }))
      const uniqueDiscCount = new Set(loadouts.flatMap((item) => item.discIds)).size
      const result = compileTargetTeamPlanningContext({
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
      })
      if (result.status !== 'supported') return null
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
      // These are comparison constraints, not new scoring weights. Until the
      // event schedule models their benefit, direct damage cannot price a loss.
      if (
        [...baselineUtilityStats].some(([agentId, baseline]) => {
          const current = utilityStats.get(agentId)
          return !current || baseline.some((value, index) => current[index]! + 1e-9 < value)
        })
      )
        return null
      const excludedEffects = new Set(
        result.discEffects.exclusions
          .filter((item) => item.reason !== 'static_condition_not_met')
          .map((item) =>
            stableContentHash({
              agentId: driveDiscEffectProtectionOwner(item),
              setId: item.setId,
              reason: item.reason,
              fields: item.fields,
            }),
          ),
      )
      if (!baselineExcludedEffects) baselineExcludedEffects = excludedEffects
      if ([...baselineExcludedEffects].some((effect) => !excludedEffects.has(effect))) return null
      return result.totalDamage
    },
  }
}
