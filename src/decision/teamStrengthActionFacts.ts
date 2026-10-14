import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from '../calculation/currentAgentMechanicContracts'
import {
  isSourceRateEvent32,
  resolveSourceEventQuantity32,
} from '../calculation/sourceEventQuantity32'
import { getPlanningDamageEventSemantics } from '../calculation/currentPlanningDamageModifiers'

type ResolvedEvent = Extract<ReturnType<typeof resolveCurrentAgentEvent>, { status: 'supported' }>

export type TeamStrengthSourceAction = {
  actionId: string
  skill: string
  eventIds: string[]
  damageMultiplier: number
  dazeMultiplier: number
  anomalyBuildup: number
  formulaFamily: string | null
  scalingAttribute: string | null
  quantities: { eventId: string; unit: 'seconds' | 'coefficient_uses'; value: number }[]
}

/** Mixed/unknown packets cannot inherit the legacy ATK-only fallback. */
export function teamStrengthSourceActionSemantics(action: TeamStrengthSourceAction | null) {
  if (!action?.formulaFamily || !action.scalingAttribute) return null
  return getPlanningDamageEventSemantics({
    formulaFamily: action.formulaFamily,
    scalingAttribute: action.scalingAttribute,
  })
}

/** One declared source packet, not a rotation, damage result or efficiency.
 * All ordinary rows are used once. Rate rows require explicit total exposure;
 * an unobserved duration never becomes an implicit one-second hit. */
export function teamStrengthActionFacts(input: {
  agentId: string
  skillLevel?: number
  declaredRateSecondsByEventId?: Readonly<Record<string, number>>
}) {
  const contract = getCurrentAgentEventContract(input.agentId)
  if (!contract) return null
  const skillLevel = input.skillLevel ?? 11
  // Preserve the existing comparison's ordinary skill scope. Ultimate costs
  // and cadence are outside this source-action reference.
  const skills = new Set(['basic', 'dodge', 'assist', 'special', 'chain'])
  const packets = new Map<string, typeof contract.eventContract.events>()
  for (const event of contract.eventContract.events) {
    // Catalog Ultimates share the chain skill bucket. Do not introduce an
    // Ultimate-use policy merely because that bucket is in the ordinary scope.
    if (
      !skills.has(event.skill) ||
      /^Ultimate/.test(event.actionId) ||
      event.formulaProjection === 'raw_only'
    )
      continue
    const key = `${event.skill}:${event.actionId}`
    packets.set(key, [...(packets.get(key) ?? []), event])
  }
  const excludedActions: { actionId: string; blockers: string[] }[] = []
  const actions: TeamStrengthSourceAction[] = []
  for (const events of packets.values()) {
    const blockers: string[] = []
    const resolved: {
      event: ResolvedEvent
      quantity: TeamStrengthSourceAction['quantities'][number]
    }[] = []
    for (const source of events) {
      const event = resolveCurrentAgentEvent({
        stableId: input.agentId,
        eventId: source.eventId,
        skillLevel,
      })
      const rate = isSourceRateEvent32(input.agentId, source.eventId)
      const quantity = resolveSourceEventQuantity32({
        ownerAgentId: input.agentId,
        eventId: source.eventId,
        occurrenceCount: 1,
        ...(rate ? { durationSeconds: input.declaredRateSecondsByEventId?.[source.eventId] } : {}),
      })
      if (event.status !== 'supported') {
        blockers.push(`${source.eventId}: ${event.blockers.join('; ')}`)
        continue
      }
      if (quantity.status !== 'supported') {
        blockers.push(`${source.eventId}: ${quantity.reason}`)
        continue
      }
      if (
        ![event.damageMultiplier, event.dazeMultiplier, event.anomalyBuildup].every(
          (value) => Number.isFinite(value) && value >= 0,
        )
      ) {
        blockers.push(`${source.eventId}: nonfinite_or_negative_source_coefficient`)
        continue
      }
      resolved.push({
        event,
        quantity: { eventId: source.eventId, unit: quantity.unit, value: quantity.value },
      })
    }
    // A partial packet must not compete against a complete source action.
    if (blockers.length || resolved.length !== events.length) {
      excludedActions.push({ actionId: events[0]!.actionId, blockers })
      continue
    }
    const families = new Set(resolved.map(({ event }) => event.formulaFamily))
    const attributes = new Set(resolved.map(({ event }) => event.scalingAttribute))
    actions.push({
      actionId: events[0]!.actionId,
      skill: events[0]!.skill,
      eventIds: events.map((event) => event.eventId),
      damageMultiplier: resolved.reduce(
        (sum, { event, quantity }) => sum + event.damageMultiplier * quantity.value,
        0,
      ),
      dazeMultiplier: resolved.reduce(
        (sum, { event, quantity }) => sum + event.dazeMultiplier * quantity.value,
        0,
      ),
      anomalyBuildup: resolved.reduce(
        (sum, { event, quantity }) => sum + event.anomalyBuildup * quantity.value,
        0,
      ),
      formulaFamily: families.size === 1 ? [...families][0]! : null,
      scalingAttribute: attributes.size === 1 ? [...attributes][0]! : null,
      quantities: resolved.map(({ quantity }) => quantity),
    })
  }
  const pick = (
    metric: 'damageMultiplier' | 'dazeMultiplier' | 'anomalyBuildup',
    predicate: (action: TeamStrengthSourceAction) => boolean = () => true,
  ) =>
    [...actions]
      .filter(
        (action) =>
          // A declared rate exposure is not the same unit as one coefficient use.
          // Keep it available for diagnostics; do not rank it against hit packets.
          action.quantities.every((quantity) => quantity.unit === 'coefficient_uses') &&
          predicate(action) &&
          action[metric] > 0,
      )
      .sort(
        (left, right) =>
          right[metric] - left[metric] || left.actionId.localeCompare(right.actionId),
      )[0] ?? null
  const specialty = contract.identity.specialty
  const damageFamily =
    specialty === 'rupture'
      ? 'sheer_damage'
      : specialty === 'armorer'
        ? 'sharp_damage'
        : 'standard_direct_damage'
  const damageAttribute =
    specialty === 'rupture' ? 'sheerForce' : specialty === 'armorer' ? 'def' : 'atk'
  return {
    skillLevel,
    damage: pick(
      'damageMultiplier',
      (action) =>
        action.formulaFamily === damageFamily && action.scalingAttribute === damageAttribute,
    ),
    direct: pick(
      'damageMultiplier',
      (action) => teamStrengthSourceActionSemantics(action)?.family === 'direct',
    ),
    sheer: pick(
      'damageMultiplier',
      (action) => teamStrengthSourceActionSemantics(action)?.family === 'sheer',
    ),
    stun: pick('dazeMultiplier'),
    anomaly: pick('anomalyBuildup'),
    sharp: pick(
      'damageMultiplier',
      (action) => teamStrengthSourceActionSemantics(action)?.family === 'sharp',
    ),
    laceration: pick('damageMultiplier', (action) => action.formulaFamily === 'laceration_damage'),
    excludedActions,
    rateActions: actions.filter((action) =>
      action.quantities.some((quantity) => quantity.unit === 'seconds'),
    ),
    mixedDamageActions: actions
      .filter((action) => action.formulaFamily === null || action.scalingAttribute === null)
      .map((action) => action.actionId),
    boundary:
      'Independent source packets for damage, daze and buildup; no action speed, activation, resource feasibility, cadence or DPS is inferred.',
  }
}
