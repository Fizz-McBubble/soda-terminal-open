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
  sourceSequence?: {
    mode: 'minimum_declared_sequence'
    condition: string
    boundary: string
  }
  sourceBranch?: 'light_defensive' | 'heavy_defensive' | 'chain_defensive'
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
 * Ordinary sequential rows are used once; defensive alternatives compete separately.
 * Rate rows require explicit total exposure;
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
    if (!skills.has(event.skill) || /^Ultimate/.test(event.actionId)) continue
    const key = `${event.skill}:${event.actionId}`
    packets.set(key, [...(packets.get(key) ?? []), event])
  }
  const excludedActions: { actionId: string; blockers: string[] }[] = []
  const actions: TeamStrengthSourceAction[] = []
  for (const packet of packets.values()) {
    // Same locked Qingyi localization, basic.BasicAttackPenultimate params
    // 0/1 = 1st-Hit / 1st-Hit (ALT), 4/5 = 4th-Hit / 4th-Hit (Enhanced)
    // (lines 14-20), with an explicit enhanced-finisher condition at line 11.
    // The catalog does not encode their combination/availability. Preserve
    // the other complete actions, but do not promote this known mixed packet
    // after removing the formerly inflated defensive-assist competitor.
    if (contract.upstreamKey === 'Qingyi' && packet[0]!.actionId === 'BasicAttackPenultimate') {
      excludedActions.push({
        actionId: packet[0]!.actionId,
        blockers: ['unseparated_source_alternatives: first_hit_alt_and_fourth_hit_enhanced'],
      })
      continue
    }
    const defensive = packet.some(
      (event) => event.damageType === 'defensiveAssist' || /^DefensiveAssist/.test(event.actionId),
    )
    // At this source commit, the three defensive-assist parameters are Light,
    // Heavy, Chain (e.g. char_Roxy_gen.json assist params, lines 178-181;
    // Claret 207-210; Qingyi 158-161). Catalog damageType/hitIndex preserve
    // that identity, not three sequential parries. Reviewed across the roster.
    // Manato has an additional damage row: without branch attachment metadata
    // this mixed layout must not be summed or guessed. Future source revisions
    // likewise need review until the catalog carries explicit branch metadata.
    if (
      defensive &&
      (contract.source.commit !== '3456cd0f6f5bea10e168074502460dac2fcd6df4' ||
        packet.length !== 3 ||
        new Set(packet.map((event) => event.hitIndex)).size !== 3 ||
        packet.some(
          (event) =>
            event.skill !== 'assist' ||
            event.damageType !== 'defensiveAssist' ||
            ![0, 1, 2].includes(event.hitIndex) ||
            event.formulaProjection === 'raw_only',
        ))
    ) {
      excludedActions.push({
        actionId: packet[0]!.actionId,
        blockers: [
          'unreviewed_defensive_assist_branch_layout: ' + packet.map((e) => e.eventId).join(', '),
        ],
      })
      continue
    }
    const events = packet.filter((event) => event.formulaProjection !== 'raw_only')
    if (!events.length) continue
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
    if (
      defensive &&
      resolved.some(
        ({ event, quantity }) =>
          event.damageMultiplier !== 0 ||
          event.anomalyBuildup !== 0 ||
          quantity.unit !== 'coefficient_uses',
      )
    ) {
      excludedActions.push({
        actionId: events[0]!.actionId,
        blockers: ['unreviewed_defensive_assist_mixed_channels'],
      })
      continue
    }
    const branches = defensive ? resolved.map((row) => [row]) : [resolved]
    for (const branch of branches) {
      const families = new Set(branch.map(({ event }) => event.formulaFamily))
      const attributes = new Set(branch.map(({ event }) => event.scalingAttribute))
      actions.push({
        actionId: events[0]!.actionId,
        ...(defensive
          ? {
              sourceBranch: (['light_defensive', 'heavy_defensive', 'chain_defensive'] as const)[
                events.find((source) => source.eventId === branch[0]!.event.eventId)!.hitIndex
              ]!,
            }
          : {}),
        skill: events[0]!.skill,
        eventIds: branch.map(({ event }) => event.eventId),
        damageMultiplier: branch.reduce(
          (sum, { event, quantity }) => sum + event.damageMultiplier * quantity.value,
          0,
        ),
        dazeMultiplier: branch.reduce(
          (sum, { event, quantity }) => sum + event.dazeMultiplier * quantity.value,
          0,
        ),
        anomalyBuildup: branch.reduce(
          (sum, { event, quantity }) => sum + event.anomalyBuildup * quantity.value,
          0,
        ),
        formulaFamily: families.size === 1 ? [...families][0]! : null,
        scalingAttribute: attributes.size === 1 ? [...attributes][0]! : null,
        quantities: branch.map(({ quantity }) => quantity),
      })
    }
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
  const piperExSequence = () => {
    if (
      input.agentId !== 'agent-piper' ||
      contract.source.commit !== '3456cd0f6f5bea10e168074502460dac2fcd6df4' ||
      contract.source.formulaSha256 !==
        '71601E28CB2202D7B95B9486C79B761AC0EA299605598896645B595FF50AFAC2'
    )
      return undefined
    const spin = actions.find((action) => action.actionId === 'EXSpecialAttackEngineSpin')
    const finisher = actions.find((action) => action.actionId === 'EXSpecialAttackReallyHeavy')
    if (!spin || !finisher) {
      excludedActions.push({
        actionId: 'EXSpecialAttackEngineSpin_then_EXSpecialAttackReallyHeavy',
        blockers: ['piper_ex_sequence_requires_both_locked_source_actions'],
      })
      return null
    }
    if (
      spin.skill !== 'special' ||
      finisher.skill !== 'special' ||
      spin.formulaFamily !== finisher.formulaFamily ||
      spin.scalingAttribute !== finisher.scalingAttribute ||
      ![...spin.quantities, ...finisher.quantities].every(
        (quantity) => quantity.unit === 'coefficient_uses' && quantity.value === 1,
      )
    ) {
      excludedActions.push({
        actionId: 'EXSpecialAttackEngineSpin_then_EXSpecialAttackReallyHeavy',
        blockers: ['piper_ex_sequence_source_packet_contract_changed'],
      })
      return null
    }
    return {
      actionId: 'EXSpecialAttackEngineSpin_then_EXSpecialAttackReallyHeavy',
      sourceSequence: {
        mode: 'minimum_declared_sequence' as const,
        condition:
          'EX Engine Spin requires a fully charged Tire Spin; Really Heavy follows when released or when the source duration or energy limit is reached.',
        boundary:
          'One declared Engine Spin hit plus its required finisher. Does not estimate the up-to-3-second repeated-spin count or total rotation.',
      },
      skill: 'special',
      eventIds: [...spin.eventIds, ...finisher.eventIds],
      damageMultiplier: spin.damageMultiplier + finisher.damageMultiplier,
      dazeMultiplier: spin.dazeMultiplier + finisher.dazeMultiplier,
      anomalyBuildup: spin.anomalyBuildup + finisher.anomalyBuildup,
      formulaFamily: spin.formulaFamily,
      scalingAttribute: spin.scalingAttribute,
      quantities: [...spin.quantities, ...finisher.quantities],
    } satisfies TeamStrengthSourceAction
  }
  const pipersMinimumEx = piperExSequence()
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
    sourceActions: actions,
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
    anomaly: pipersMinimumEx === undefined ? pick('anomalyBuildup') : pipersMinimumEx,
    sharp: pick(
      'damageMultiplier',
      (action) => teamStrengthSourceActionSemantics(action)?.family === 'sharp',
    ),
    laceration: pick('damageMultiplier', (action) => action.formulaFamily === 'laceration_damage'),
    excludedActions,
    alternativeActions: actions.filter((action) => action.sourceBranch !== undefined),
    rateActions: actions.filter((action) =>
      action.quantities.some((quantity) => quantity.unit === 'seconds'),
    ),
    mixedDamageActions: actions
      .filter((action) => action.formulaFamily === null || action.scalingAttribute === null)
      .map((action) => action.actionId),
    boundary:
      'Independent source packets for damage, daze and buildup; defensive alternatives compete separately. No enemy attack branch availability, action speed, activation, resource feasibility, cadence or DPS is inferred.',
  }
}
