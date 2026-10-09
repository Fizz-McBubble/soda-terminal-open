import { stableContentHash } from '../gameDataPacks/types'
import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { resolveCurrentAgentEvent } from './currentAgentMechanicContracts'
import { effectReceiverMetadata } from './currentPlanningEffectExpressions'
import { matchesFunctionalEffectScope32 } from './functionalPlanningEffectScope32'
import { applicationForReceiver, recipientIds } from './currentPlanningDamageModifiers'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { resolveCurrentPlanningEventEffects32 } from './currentPlanningEventEffectResolution32'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import { resolveSourceEventQuantity32 } from './sourceEventQuantity32'
import type {
  evaluateReviewedFunctionalCapacity32,
  ReviewedFunctionalCapacity32,
} from './reviewedFunctionalCapacity32'

const applications = new Set(['impact_flat', 'impact_percent', 'daze_increase', 'daze_reduction'])
export const sourceDazeIdentity32 = {
  revision: 'source-events-attacker-daze-r1',
  path: 'libs/zzz/formula/src/data/common/daze.ts',
  sha256: 'F913FD26980DB39055F3E1FD0E42B0CC887C86068B3536415927046A65397752',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
} as const

/** Source event quantity × final impact × (1 + daze increase − reduction).
 * Enemy factors are held outside this same-enemy comparison; no stun time or
 * threshold is inferred. Unknown functional operands keep the capacity null. */
export function evaluateSourceDazeCapacity32(
  input: Parameters<typeof evaluateReviewedFunctionalCapacity32>[0],
) {
  const member = input.member,
    agentId = member.agentId
  const members = input.members ?? [member]
  const memberIds = members.map((row) => row.agentId)
  const events = (input.eventUsages ?? []).filter((row) => row.ownerAgentId === agentId)
  if (!events.length && agentId !== 'agent-dialyn')
    return {
      status: 'supported' as const,
      capacities: [] as ReviewedFunctionalCapacity32[],
      blockers: [] as string[],
    }
  const entries = currentAgentPlanningEffectBlueprints.filter((entry) => {
    if (!memberIds.includes(entry.providerAgentId)) return false
    const meta = effectReceiverMetadata(entry.numericExpression.expressionIr)
    return (
      applications.has(applicationForReceiver(meta.receiverPath)) &&
      recipientIds({
        providerAgentId: entry.providerAgentId,
        targetKinds: entry.targetKinds,
        memberIds,
        receiverPath: meta.receiverPath,
        effectKey: entry.effectKey,
      }).includes(agentId)
    )
  })
  const gaps = functionalEquipmentGaps32(
    input.equipmentExclusions,
    agentId,
    [
      'initial.impact',
      'combat.impact',
      'combat.impact_',
      'combat.dazeInc_',
      'combat.dazeRed_',
      ...(agentId === 'agent-dialyn' ? ['initial.crit_', 'combat.crit_'] : []),
    ],
    events.map((row) => ({
      actionId: row.eventId.split('.')[1]!,
      skill: row.eventId.split('.')[0]!,
    })),
  )
  if (!events.length) gaps.push('functional_declared_daze_events_missing')
  if (
    stableContentHash(members.find((row) => row.agentId === agentId) ?? null) !==
    stableContentHash(member)
  )
    gaps.push('functional_member_snapshot_mismatch')
  const runtime = evaluateCurrentPlanningEffectEntries32(
    { memberIds, members, baselineReferencesByAgentId: input.baselineReferencesByAgentId },
    [...entries],
  )
  if (runtime.status !== 'supported') gaps.push(...runtime.blockers)
  const baseBuckets =
    runtime.status === 'supported' ? planningRuntimeEffectBuckets32(runtime.results, memberIds) : []
  const sourceRefs = [
    `${sourceDazeIdentity32.path}#${sourceDazeIdentity32.sha256}`,
    `source-commit:${sourceDazeIdentity32.commit}`,
  ]
  const included = new Set<string>()
  let total = 0
  for (const usage of events) {
    const quantity = resolveSourceEventQuantity32(usage)
    const event = resolveCurrentAgentEvent({
      stableId: agentId,
      eventId: usage.eventId,
      skillLevel: usage.skillLevel,
    })
    if (quantity.status !== 'supported' || event.status !== 'supported') {
      gaps.push(
        ...(quantity.status !== 'supported' ? [quantity.reason] : []),
        ...(event.status !== 'supported' ? event.blockers : []),
      )
      continue
    }
    const scope = {
      eventId: event.eventId,
      actionId: usage.eventId.split('.')[1]!,
      skill: usage.eventId.split('.')[0]!,
      damageType: event.damageType,
      eventModifierRefs: event.eventModifierRefs,
    }
    if (runtime.status === 'supported')
      for (const row of runtime.results) {
        if (row.status !== 'excluded_unknown') continue
        const entry = entries.find((entry) => entry.effectKey === row.effectKey)
        if (!entry) continue
        if (matchesFunctionalEffectScope32(entry, scope, event.attribute))
          gaps.push(`functional_condition_unobserved:${row.effectKey}`)
      }
    const resolved = resolveCurrentPlanningEventEffects32({
      memberIds,
      members,
      ownerAgentId: agentId,
      event: scope,
      attribute: event.attribute,
      entries,
      buckets: [...baseBuckets, ...(input.equipmentModifierBuckets ?? [])],
      baselineReferencesByAgentId: input.baselineReferencesByAgentId,
    })
    if (resolved.status !== 'supported') {
      gaps.push(...resolved.blockers)
      continue
    }
    const impact = resolved.finalStats[agentId]?.impact
    const modifiers = resolved.buckets.filter(
      (row) => row.recipientAgentIds.includes(agentId) && applications.has(row.application),
    )
    const multiplier =
      1 +
      modifiers.reduce(
        (sum, row) =>
          sum +
          (row.application === 'daze_increase'
            ? row.value
            : row.application === 'daze_reduction'
              ? -row.value
              : 0),
        0,
      )
    if (
      typeof impact !== 'number' ||
      !Number.isFinite(impact) ||
      impact < 0 ||
      !Number.isFinite(multiplier) ||
      multiplier < 0 ||
      !Number.isFinite(event.dazeMultiplier) ||
      event.dazeMultiplier < 0
    ) {
      gaps.push('functional_source_daze_basis_invalid')
      continue
    }
    total += impact * event.dazeMultiplier * quantity.value * multiplier
    for (const row of modifiers) {
      included.add(row.effectKey)
      sourceRefs.push(...row.sourceRefs)
    }
    sourceRefs.push(`${event.source.statsPath}#${event.source.statsSha256}`)
  }
  const capacity: ReviewedFunctionalCapacity32 = {
    key: `${agentId}:source_daze_basis`,
    kind: 'source_daze_basis',
    value: gaps.length || !Number.isFinite(total) ? null : total,
    contextKey: stableContentHash({
      actor: {
        agentId,
        level: member.level,
        coreLevel: member.coreLevel,
        mindscape: member.mindscape,
        potential: member.potential,
      },
      events,
      references: input.baselineReferencesByAgentId ?? null,
      identity: sourceDazeIdentity32,
    }),
    sourceRefs: [...new Set(sourceRefs)],
    included: [
      'declared_source_event_coefficients_and_quantities',
      'event_final_impact_with_initial_CR_conversion_once',
      'attacker_daze_increase_and_reduction_factor',
      ...included,
    ],
    excluded: [
      ...new Set(gaps),
      'enemy_daze_resistance_and_taken_factors',
      'enemy_current_daze_threshold_and_stun_timeline',
      'daze_to_damage_conversion',
    ],
  }
  return { status: 'supported' as const, capacities: [capacity], blockers: [...new Set(gaps)] }
}
