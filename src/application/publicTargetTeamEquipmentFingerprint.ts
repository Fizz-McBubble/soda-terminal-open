import { contentHash } from './contentHash'

export type TargetTeamEquipmentDisplayParameters = {
  wEngines: Array<{ agentId: string; engineId: string; refinement: number }>
  bangbooId: string
  bangbooStars: number
}

/** Stable identity for a player-confirmed equipment selection. */
export function normalizeTargetTeamEquipmentParameters<
  T extends TargetTeamEquipmentDisplayParameters,
>(parameters: T): TargetTeamEquipmentDisplayParameters {
  return {
    wEngines: parameters.wEngines
      .map((item) => ({
        agentId: item.agentId,
        engineId: item.engineId,
        refinement: item.refinement,
      }))
      .sort((left, right) => left.agentId.localeCompare(right.agentId)),
    bangbooId: parameters.bangbooId,
    bangbooStars: parameters.bangbooStars,
  }
}

export function targetTeamEquipmentParametersFingerprint(
  parameters: TargetTeamEquipmentDisplayParameters,
) {
  return contentHash(normalizeTargetTeamEquipmentParameters(parameters))
}
