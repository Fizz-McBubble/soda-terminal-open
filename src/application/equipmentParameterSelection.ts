import { targetTeamEquipmentParametersFingerprint } from './publicTargetTeamEquipmentFingerprint'
import type {
  TargetTeamEquipmentParameterSelection,
  TargetTeamWarehouseFitQueryResult,
} from './calculationQueryContract'

type EquipmentRecommendations = TargetTeamWarehouseFitQueryResult['equipmentRecommendations']

export function wEngineOptions(recommendation: EquipmentRecommendations['wEngines'][number]) {
  return [recommendation.recommendedPrimary, ...recommendation.recommendedAlternatives].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  )
}

/** Pure selection adapter shared by the equipment form and the private Query producer. */
export function equipmentParameterSelection({
  memberIds,
  recommendations,
  effectiveParameters,
}: {
  memberIds: readonly string[]
  recommendations: EquipmentRecommendations
  effectiveParameters?: TargetTeamEquipmentParameterSelection | null
}): TargetTeamEquipmentParameterSelection {
  const wEngines = memberIds.map((agentId) => {
    const recommendation = recommendations.wEngines.find((item) => item.agentId === agentId)
    const options = recommendation ? wEngineOptions(recommendation) : []
    const effective = effectiveParameters?.wEngines.find((item) => item.agentId === agentId)
    const selected = options.find((item) => item.engineId === effective?.engineId) ?? options[0]
    const recordedRefinement =
      recommendation?.current && selected && recommendation.current.engineId === selected.engineId
        ? recommendation.current.refinement
        : undefined
    return {
      agentId,
      engineId: selected?.engineId ?? '',
      ...(selected?.engineId === effective?.engineId
        ? {
            ...(effective?.level === undefined ? {} : { level: effective.level }),
            ...(effective?.ascension === undefined ? {} : { ascension: effective.ascension }),
          }
        : {}),
      refinement:
        selected?.engineId === effective?.engineId
          ? (effective?.refinement ?? recordedRefinement ?? selected?.refinement ?? 1)
          : (recordedRefinement ?? selected?.refinement ?? 1),
    }
  })
  const bangboo =
    recommendations.bangboo.options.find(
      (item) => item.bangbooId === effectiveParameters?.bangbooId,
    ) ??
    recommendations.bangboo.options.find(
      (item) => item.bangbooId === recommendations.bangboo.primaryBangbooId,
    ) ??
    recommendations.bangboo.options[0]
  const selection: TargetTeamEquipmentParameterSelection = {
    wEngines,
    ...(effectiveParameters?.potentialByAgentId === undefined
      ? {}
      : {
          potentialByAgentId: Object.fromEntries(
            Object.entries(effectiveParameters.potentialByAgentId).filter(([agentId]) =>
              memberIds.includes(agentId),
            ),
          ),
        }),
    ...(effectiveParameters?.koledaFixedEventConditions32 === undefined
      ? {}
      : { koledaFixedEventConditions32: effectiveParameters.koledaFixedEventConditions32 }),
    bangbooId: bangboo?.bangbooId ?? '',
    bangbooStars:
      bangboo?.bangbooId === effectiveParameters?.bangbooId
        ? (effectiveParameters?.bangbooStars ?? bangboo?.defaultStars ?? 1)
        : (bangboo?.defaultStars ?? 1),
  }
  if (
    effectiveParameters &&
    targetTeamEquipmentParametersFingerprint({
      ...selection,
      koledaFixedEventConditions32: undefined,
    }) !==
      targetTeamEquipmentParametersFingerprint({
        ...effectiveParameters,
        koledaFixedEventConditions32: undefined,
      })
  ) {
    delete selection.koledaFixedEventConditions32
  }
  return selection
}
