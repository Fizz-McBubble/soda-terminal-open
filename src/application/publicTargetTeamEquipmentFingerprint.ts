import {
  koledaFixedEventConditionsInputSchema32,
  type KoledaFixedEventConditionsInput32,
} from './publicKoledaFixedEventConditions32'
import { contentHash } from './contentHash'
import {
  resourceTimelineDeclarationSchema32,
  type ResourceTimelineDeclaration32,
} from '../calculation/resourceTimelineDeclarationContract32'
import {
  luminizeEquipmentComparisonOptionsSchema32,
  type LuminizeEquipmentComparisonOptions32,
} from './publicLuminizeComparison32'

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
  luminizeComparison32?: LuminizeEquipmentComparisonOptions32
  resourceTimelineDeclaration32?: ResourceTimelineDeclaration32
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
  const luminize =
    parameters.luminizeComparison32 === undefined
      ? undefined
      : luminizeEquipmentComparisonOptionsSchema32.parse(parameters.luminizeComparison32)
  const resourceTimeline =
    parameters.resourceTimelineDeclaration32 === undefined
      ? undefined
      : resourceTimelineDeclarationSchema32.parse(parameters.resourceTimelineDeclaration32)
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
    ...(luminize === undefined ? {} : { luminizeComparison32: luminize }),
    ...(resourceTimeline === undefined ? {} : { resourceTimelineDeclaration32: resourceTimeline }),
    bangbooId: parameters.bangbooId,
    bangbooStars: parameters.bangbooStars,
  }
}

export function targetTeamEquipmentParametersFingerprint(
  parameters: TargetTeamEquipmentDisplayParameters,
) {
  return contentHash(normalizeTargetTeamEquipmentParameters(parameters))
}
