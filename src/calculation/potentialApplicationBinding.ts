import { resolvePotentialImage } from '../assault/agentCapabilities'
import {
  getReviewedPotentialDefinition,
  reviewedPotentialDefinitions,
  type PotentialEffectTargetKind,
  type PotentialEffectValueKind,
  type PotentialFormulaBinding,
  type PotentialValueSemantics,
} from '../gameDataPacks/reviewedPotentialDefinitions'

/** The two initial-stat domains currently named by reviewed potential conversions. */
export type PotentialBindingInitialStats = {
  /** Penetration ratio in fraction domain: 0.24 means 24%. */
  pen_: number
  /** Initial Energy Regen in points per second. */
  enerRegen: number
}

/**
 * A conversion must identify where its initial stat came from. Fixtures and
 * declared planning defaults are useful for tests, but cannot activate a
 * source condition that calls for a real initial stat.
 */
export type PotentialInitialStatsProvenance =
  | 'account_observation'
  | 'calculation_context'
  | 'planning_baseline'
  | 'synthetic_fixture'

export type PotentialApplicationMember = {
  agentId: string
  potential?: number | null
  initialStats: PotentialBindingInitialStats
  provenance: PotentialInitialStatsProvenance
}

/**
 * Event evidence is deliberately already-normalized by a caller. This module
 * validates it against the source catalog; it does not infer a game state
 * from an action name, event schedule, or guide relationship.
 */
export type PotentialApplicationEvent = {
  eventId: string
  actionFamilies: readonly string[]
  providerStateKeys: readonly string[]
  targetStateKeys: readonly string[]
  /** Stack observations are required for source effects with fixed stack caps. */
  providerStateStacks?: Readonly<Record<string, number>>
  sourceRefs: readonly string[]
}

export type PotentialApplicationBindingInput = {
  member: PotentialApplicationMember
  event: PotentialApplicationEvent
}

export type PotentialApplicationStatus = 'applied' | 'excluded'

/**
 * Consumer-ready source semantics for one event. This is intentionally not a
 * direct-damage result: `bucket`, event scope, and status let each supported
 * consumer choose its own formula family without relabelling the effect.
 */
export type PotentialApplicationBinding = {
  effectKey: string
  providerAgentId: string
  effectId: string
  targetKind: PotentialEffectTargetKind
  bucket: PotentialFormulaBinding['bucket']
  value: number
  valueKind: PotentialEffectValueKind
  unit: string
  valueSemantics: PotentialValueSemantics
  sourceRefs: readonly string[]
  eligibleEventIds: readonly string[]
  status: PotentialApplicationStatus
  reason: string
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function sourceRefsForDefinition(
  definition: NonNullable<ReturnType<typeof getReviewedPotentialDefinition>>,
) {
  return [
    `${definition.source.url}#sourceVersion=${definition.source.sourceVersion}`,
    `sha256:${definition.source.contentHash}`,
    `upstream-sha256:${definition.source.upstreamRawSha256}`,
    ...(definition.source.supplementarySources ?? []).flatMap((source) => [
      `${source.url}#sourceVersion=${source.sourceVersion}`,
      `sha256:${source.contentHash}`,
    ]),
  ]
}

function hasAll(required: readonly string[], actual: readonly string[]) {
  return required.every((key) => actual.includes(key))
}

function actionMatches(input: {
  requiredActionFamilies: readonly string[]
  eventActionFamilies: readonly string[]
}) {
  const { requiredActionFamilies, eventActionFamilies } = input
  if (requiredActionFamilies.length === 0) return true
  // "all attacks" is a source scope, not a synthetic action family that an
  // event producer has to emit. It still requires an evidenced attack family;
  // an arbitrary event id alone cannot stand in for an attack.
  if (requiredActionFamilies.includes('all_attacks')) return eventActionFamilies.length > 0
  return requiredActionFamilies.some((family) => eventActionFamilies.includes(family))
}

function trustedInitialStats(provenance: PotentialInitialStatsProvenance) {
  return provenance === 'account_observation' || provenance === 'calculation_context'
}

function conversionInput(input: {
  conversion: NonNullable<
    ReturnType<typeof getReviewedPotentialDefinition>
  >['effects'][number]['conversion']
  initialStats: PotentialBindingInitialStats
}) {
  if (!input.conversion) return null
  return input.conversion.inputStat === 'penetration_ratio_fraction'
    ? input.initialStats.pen_
    : input.initialStats.enerRegen
}

function valueForEffect(input: {
  potential: number
  effect: NonNullable<ReturnType<typeof getReviewedPotentialDefinition>>['effects'][number]
  initialStats: PotentialBindingInitialStats
}) {
  const base = input.effect.valueByLevel[input.potential]
  if (!input.effect.conversion) return base
  const conversion = input.effect.conversion
  const stat = conversionInput({ conversion, initialStats: input.initialStats })
  if (stat === null || !Number.isFinite(stat)) return null
  const threshold = conversion.threshold ?? 0
  const step = conversion.step
  if (step === null || step <= 0) return null
  const value = base * Math.max(0, stat - threshold) * (1 / step)
  return conversion.cap === null ? value : Math.min(value, conversion.cap)
}

function excluded(
  input: Omit<PotentialApplicationBinding, 'status' | 'eligibleEventIds' | 'value'>,
) {
  return { ...input, value: 0, eligibleEventIds: [], status: 'excluded' as const }
}

/**
 * Binds every reviewed potential effect for one member to one already-evidenced
 * event. It is fail-closed: absent action/state/target-state proof leaves the
 * numeric source fact visible but unapplied.
 */
export function bindReviewedPotentialApplications(
  input: PotentialApplicationBindingInput,
): readonly PotentialApplicationBinding[] {
  const definition = getReviewedPotentialDefinition(input.member.agentId)
  if (!definition) return []

  const resolvedPotential = resolvePotentialImage(input.member.agentId, input.member.potential) ?? 0
  const potential =
    Number.isInteger(resolvedPotential) && resolvedPotential >= 0 && resolvedPotential <= 6
      ? resolvedPotential
      : null
  const sourceRefs = sourceRefsForDefinition(definition)
  const boundSourceRefs = unique([...sourceRefs, ...input.event.sourceRefs])

  return definition.effects.map((effect) => {
    const common = {
      effectKey: `${definition.agentId}:${effect.effectId}`,
      providerAgentId: definition.agentId,
      effectId: effect.effectId,
      targetKind: effect.targetKind,
      bucket: effect.formulaBinding.bucket,
      valueKind: effect.valueKind,
      unit: effect.unit,
      valueSemantics: effect.valueSemantics,
      sourceRefs: boundSourceRefs,
    }
    if (potential === null)
      return excluded({
        ...common,
        reason: 'Potential image must be an integer in the source 0..6 domain.',
      })
    if (input.event.eventId.trim().length === 0)
      return excluded({ ...common, reason: 'Missing eventId; no event scope may be inferred.' })
    if (input.event.sourceRefs.length === 0)
      return excluded({ ...common, reason: 'Missing source-backed event evidence.' })
    if (potential === 0)
      return excluded({
        ...common,
        reason: 'Potential image is level 0; this source effect is disabled.',
      })

    const base = effect.valueByLevel[potential]
    if (base === 0)
      return excluded({
        ...common,
        reason: `Potential image ${potential} has no value for this effect.`,
      })
    if (
      effect.formulaBinding.bucket === 'unresolved_damage_bucket' ||
      effect.formulaBinding.compilationDisposition === 'unresolved_formula_bucket'
    )
      return excluded({
        ...common,
        reason:
          effect.formulaBinding.unresolvedFormulaReason ??
          'Source formula bucket remains unresolved.',
      })

    if (!hasAll(effect.formulaBinding.requiredStates, input.event.providerStateKeys))
      return excluded({ ...common, reason: 'Missing required provider state evidence.' })
    if (!hasAll(effect.formulaBinding.requiredTargetStates, input.event.targetStateKeys))
      return excluded({ ...common, reason: 'Missing required target-state evidence.' })
    if (
      !actionMatches({
        requiredActionFamilies: effect.formulaBinding.requiredActionFamilies,
        eventActionFamilies: input.event.actionFamilies,
      })
    )
      return excluded({
        ...common,
        reason: 'Event action family is outside the source effect scope.',
      })

    if (effect.formulaBinding.multiplier.kind === 'at_fixed_stack_count') {
      const requiredStackCount = effect.formulaBinding.multiplier.fixedStackCount
      const hasFixedStacks =
        typeof requiredStackCount === 'number' &&
        effect.formulaBinding.requiredStates.every(
          (state) => input.event.providerStateStacks?.[state] === requiredStackCount,
        )
      if (!hasFixedStacks)
        return excluded({
          ...common,
          reason: 'Missing source-required fixed stack-count evidence.',
        })
    }

    if (effect.conversion) {
      const stat = conversionInput({
        conversion: effect.conversion,
        initialStats: input.member.initialStats,
      })
      if (stat === null || !Number.isFinite(stat))
        return excluded({ ...common, reason: 'Missing finite initial-stat input for conversion.' })
      if (!trustedInitialStats(input.member.provenance))
        return excluded({
          ...common,
          reason: 'Initial-stat conversion lacks account or CalculationContext provenance.',
        })
      if (effect.conversion.threshold !== null && stat < effect.conversion.threshold)
        return excluded({
          ...common,
          reason: 'Initial stat does not reach the source conversion threshold.',
        })
    }

    const value = valueForEffect({ potential, effect, initialStats: input.member.initialStats })
    if (value === null || !Number.isFinite(value))
      return excluded({
        ...common,
        reason: 'Source conversion cannot be resolved from this input domain.',
      })
    return {
      ...common,
      value,
      eligibleEventIds: [input.event.eventId],
      status: 'applied' as const,
      reason: 'Source potential level, event scope, and all required evidence are satisfied.',
    }
  })
}

/** Helps consumers audit an event bundle without inferring unrepresented effects. */
export function potentialApplicationBindingEffectCount() {
  return unique(
    reviewedPotentialDefinitions.flatMap((definition) =>
      definition.effects.map((effect) => `${definition.agentId}:${effect.effectId}`),
    ),
  ).length
}
