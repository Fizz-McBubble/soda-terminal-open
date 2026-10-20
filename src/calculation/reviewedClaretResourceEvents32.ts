import data from '../gameDataPacks/data/reviewed-claret-action-resources32.json'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'

export const reviewedClaretResourceIdentity32 = Object.freeze({
  contract: data.contract,
  source: data.source,
  rawToDisplayedPointDivisors: data.rawToDisplayedPointDivisors,
  resourceRules: data.resourceRules,
  contentHash: stableContentHash(data),
  boundary: data.boundary,
})

/** Gachabase raw Gash and Sharpness are different units. The rendered release
 * table was independently checked: 3151 -> 31.51 Gash; 9460 -> 0.946 Sharpness.
 * A source-row occurrence is not a physical-hit or time-series inference. */
export function summarizeReviewedClaretResourceProduction32(usages: readonly PlanningEventUsage[]) {
  const current = getCurrentAgentEventContract('agent-claret')
  const blockers: string[] = []
  let gash = 0
  let sharpness = 0
  const coefficient = (
    operator: { kind: string; base?: number; value?: number; growthPerLevel?: number },
    growth = false,
  ) =>
    operator.kind === 'linear_skill_level'
      ? growth
        ? operator.growthPerLevel
        : operator.base
      : operator.kind === 'constant'
        ? growth
          ? 0
          : operator.value
        : null
  const events = usages.map((usage) => {
    const row = data.events.find((entry) => entry.eventId === usage.eventId)
    const counterpart = current?.eventContract.events.find(
      (entry) => entry.eventId === usage.eventId,
    )
    const operators = counterpart?.operators
    const signature = operators
      ? [
          coefficient(operators.damageMultiplier),
          coefficient(operators.damageMultiplier, true),
          coefficient(operators.dazeMultiplier),
          coefficient(operators.dazeMultiplier, true),
          coefficient(operators.anomalyBuildup),
        ]
      : null
    if (
      usage.ownerAgentId !== 'agent-claret' ||
      !Number.isInteger(usage.occurrenceCount) ||
      usage.occurrenceCount <= 0 ||
      !row ||
      !counterpart ||
      row.sharpnessGrowthRaw !== 0 ||
      current?.source.commit !== data.source.pairedUpstreamCommit ||
      current?.source.statsSha256 !== data.source.pairedUpstreamStatsSha256 ||
      stableContentHash(signature) !== stableContentHash(row.sourceSignature)
    ) {
      blockers.push(`claret_resource_source_or_quantity_unresolved:${usage.eventId}`)
      return { eventId: usage.eventId, baseGash: null, baseSharpness: null }
    }
    const producedGash =
      (row.gashBuildupRaw / data.rawToDisplayedPointDivisors.gash) * usage.occurrenceCount
    const producedSharpness =
      (row.sharpnessGainRaw / data.rawToDisplayedPointDivisors.sharpness) * usage.occurrenceCount
    gash += producedGash
    sharpness += producedSharpness
    return {
      eventId: row.eventId,
      rawId: row.rawId,
      baseGash: producedGash,
      baseSharpness: producedSharpness,
    }
  })
  if (!usages.length) blockers.push('claret_resource_action_declaration_missing')
  if (![gash, sharpness].every(Number.isFinite)) blockers.push('claret_resource_nonfinite_total')
  return {
    status: blockers.length ? ('unknown' as const) : ('source_action_base_production' as const),
    events,
    baseGash: blockers.length ? null : gash,
    baseSharpness: blockers.length ? null : sharpness,
    gashUnit: 'release_displayed_base_gash_buildup' as const,
    sharpnessUnit: 'release_displayed_base_sharpness_points' as const,
    // Keep the beta-era Training Mode observation visible for evidence work,
    // but do not expose it as a usable threshold until release provenance and
    // runtime-to-extracted-unit conversion are established.
    gashThreshold: data.resourceRules.gash.buildupPerStack,
    gashThresholdEvidenceStatus: data.resourceRules.gash.perStackThresholdStatus,
    observedGashThreshold: data.resourceRules.gash.observedBuildupPerStack,
    gashThresholdStatus: data.resourceRules.gash.buildupStatus,
    gashThresholdUnit: 'unmapped_observation_units' as const,
    counterAssistDirectGrantStacks: data.resourceRules.gash.counterAssistDirectGrantStacks,
    bloodAxeBuildupRatioBonus: data.resourceRules.gash.bloodAxeBuildupRatioBonus,
    maimConsumptionPerQualifyingHit: data.resourceRules.gash.maimConsumptionPerQualifyingHit,
    gashDurationAndDecayStatus: data.resourceRules.gash.durationAndDecayStatus,
    sharpnessCapacity: data.resourceRules.sharpness.capacity,
    knownResourceRules: data.resourceRules,
    // Mechanism grants are separate from hit rows: an Ultimate miss still
    // grants 10 on activation, so occurrenceCount cannot silently stand for it.
    activationGrantsRequireExplicitEvents: true as const,
    completeResourceCycle: false as const,
    formalCycleReady: false as const,
    blockers,
    sourceIdentity: reviewedClaretResourceIdentity32,
  }
}
