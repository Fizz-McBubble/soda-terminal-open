import {
  koledaFixedEventConditionsInputSchema32,
  type KoledaFixedEventConditionsInput32,
} from './publicKoledaFixedEventConditions32'
import { contentHash } from './contentHash'

export type TargetTeamEquipmentDisplayParameters = {
  wEngines: Array<{
    agentId: string
    engineId: string
    refinement: number
    level?: number
    ascension?: number
  }>
  potentialByAgentId?: Record<string, number>
  koledaFixedEventConditions32?: KoledaFixedEventConditionsInput32
  bangbooId: string
  bangbooStars: number
}

/** Stable identity for a player-confirmed equipment selection. */
export function normalizeTargetTeamEquipmentParameters<
  T extends TargetTeamEquipmentDisplayParameters,
>(parameters: T): TargetTeamEquipmentDisplayParameters {
  const conditions =
    parameters.koledaFixedEventConditions32 === undefined
      ? undefined
      : koledaFixedEventConditionsInputSchema32.parse(parameters.koledaFixedEventConditions32)
  return {
    wEngines: parameters.wEngines
      .map((item) => ({
        agentId: item.agentId,
        engineId: item.engineId,
        refinement: item.refinement,
        ...(item.level === undefined ? {} : { level: item.level }),
        ...(item.ascension === undefined ? {} : { ascension: item.ascension }),
      }))
      .sort((left, right) => left.agentId.localeCompare(right.agentId)),
    ...(parameters.potentialByAgentId === undefined
      ? {}
      : {
          potentialByAgentId: Object.fromEntries(
            Object.entries(parameters.potentialByAgentId).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          ),
        }),
    ...(conditions === undefined
      ? {}
      : {
          koledaFixedEventConditions32: {
            contract: conditions.contract,
            sourceFingerprint: conditions.sourceFingerprint,
            confirmedUniformConditions: conditions.confirmedUniformConditions,
            furnaceConsumptionBuffActive32: conditions.furnaceConsumptionBuffActive32,
            ...(conditions.furnaceConsumedStacks32 === undefined
              ? {}
              : {
                  furnaceConsumedStacks32: conditions.furnaceConsumedStacks32,
                }),
          },
        }),
    bangbooId: parameters.bangbooId,
    bangbooStars: parameters.bangbooStars,
  }
}

export function targetTeamEquipmentParametersFingerprint(
  parameters: TargetTeamEquipmentDisplayParameters,
) {
  return contentHash(normalizeTargetTeamEquipmentParameters(parameters))
}
