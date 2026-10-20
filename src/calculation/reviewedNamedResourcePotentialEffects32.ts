import type { ReviewedNamedResourceProductionContract32 } from './declaredResourceTimeline32'

export type ReviewedNamedResourcePotentialEffectOutput32 = {
  effectKey: string
  eventKey: string
  amount: number | null
  unit: string
  durationSeconds?: number
  status: 'known' | 'condition_unknown' | 'not_applied'
  consumedStacks: number | null
  sourceRef: string
}

/** Formula-gated effects remain separate from the base stack transitions. In
 * particular, a Furnace Fire inventory or a consumed-stack count is not a
 * substitute for the awakened-potential eligibility input. */
export function compileReviewedNamedResourcePotentialEffects32(input: {
  contract: ReviewedNamedResourceProductionContract32
  eventKey: string
  conditions: Readonly<Record<string, boolean>>
  consumedStacks: number | null
}): ReviewedNamedResourcePotentialEffectOutput32[] {
  const { contract, eventKey, conditions, consumedStacks } = input
  return (contract.potentialEffects ?? [])
    .filter((effect) => effect.eventKey === eventKey)
    .map((effect) => {
      const eligible = conditions[effect.conditionKey]
      const consumesRequiredStack = effect.requiresConsumption
      const consumptionUnknown =
        eligible === true && consumesRequiredStack && consumedStacks === null
      const insufficientConsumption =
        eligible === true && consumesRequiredStack && consumedStacks !== null && consumedStacks <= 0
      const status =
        eligible === false || insufficientConsumption
          ? ('not_applied' as const)
          : eligible === undefined || consumptionUnknown
            ? ('condition_unknown' as const)
            : ('known' as const)
      const amount =
        status === 'known'
          ? effect.amount * (effect.scaleByConsumedStacks ? consumedStacks! : 1)
          : status === 'not_applied'
            ? 0
            : null
      const formulaRef = contract.formulaSource
        ? `upstream:${contract.formulaSource.commit}:${contract.formulaSource.path}:${contract.formulaSource.sha256}`
        : 'upstream:formula-source-unavailable'
      return {
        effectKey: effect.effectKey,
        eventKey,
        amount,
        unit: effect.unit,
        ...(effect.durationSeconds === undefined
          ? {}
          : { durationSeconds: effect.durationSeconds }),
        status,
        consumedStacks,
        sourceRef: `${formulaRef}#${effect.locator}`,
      }
    })
}
