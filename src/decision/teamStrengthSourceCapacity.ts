import { type SourceBackedPlanningEffectBucket } from '../calculation/currentPlanningDamageModifiers'
import type { StandardTeamReferenceSelectionBundle } from './standardTeamReferenceSelection'
import { stableContentHash } from '../gameDataPacks/types'
import { projectTeamAnomalyCapacityCoordinates } from './teamStrengthAnomalyCapacityCoordinates'
import {
  recipientCompatible,
  type SupportRecipientContext,
} from './teamStrengthSupportCapabilities'
import type { Member } from './teamStrengthMemberFacts'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { bindReviewedSupportEventDamage32 } from '../calculation/reviewedSupportEventDamage32'
import { evaluateReviewedSupportTargetCapacity32 } from '../calculation/reviewedSupportTargetCapacity32'
import { createTeamStrengthCapacityContext } from './teamStrengthSourceCapacityActions'
import { projectTeamStrengthSourceEffects } from './teamStrengthSourceCapacityEffects'
import { projectTeamStrengthTypedAnomalyCapacity } from './teamStrengthTypedAnomalyCapacity'
import {
  teamStrengthSourceCapacityIdentity,
  sourceCapacityEventPacketIdentity,
  type TeamStrengthSourceCapacity,
} from './teamStrengthSourceCapacityPolicy'
export {
  teamStrengthSourceCapacityPolicy,
  teamStrengthSourceCapacityIdentity,
  resolveTeamStrengthRecipientContext,
  type TeamStrengthSourceCapacity,
} from './teamStrengthSourceCapacityPolicy'
export function projectTeamStrengthSourceCapacity(
  members: readonly Member[],
  abilityById: ReadonlyMap<string, boolean>,
  conditions: TeamStrengthReferenceConditions,
  recipientContext: SupportRecipientContext,
  standardTeamReferenceSelection?: StandardTeamReferenceSelectionBundle,
): TeamStrengthSourceCapacity & {
  standardReferenceIdentity?: string | null
  standardReferenceStatus?: 'ready' | 'unsupported'
} {
  const context = createTeamStrengthCapacityContext(
    members,
    conditions,
    standardTeamReferenceSelection,
  )
  if (context.status === 'unsupported')
    return {
      identity: stableContentHash({
        policy: teamStrengthSourceCapacityIdentity,
        standard: standardTeamReferenceSelection?.selection.identity,
        gaps: context.gaps,
      }),
      standardReferenceIdentity: null,
      standardReferenceStatus: 'unsupported',
      actions: members.map((row) => ({
        agentId: row.agentId,
        value: null,
        eventIds: [],
        family: null,
        eventPacketIdentity: null,
      })),
      effects: [],
      contacts: [],
      gaps: context.gaps,
      anomalyProficiencyGain: 0,
      anomalyMasteryGain: 0,
      anomalyCoordinates: projectTeamAnomalyCapacityCoordinates([]).coordinates,
      stunCapacity: 0,
    }
  const { ids, runtime, contactRuntime, usages, value, contactValue, gaps } = context
  const actions = members.map((member) => ({
    agentId: member.agentId,
    value: value(member.agentId, []),
    eventIds: usages.get(member.agentId)!.map((u) => u.eventId),
    family: member.actionFacts.damage?.formulaFamily ?? null,
    eventPacketIdentity: sourceCapacityEventPacketIdentity(usages.get(member.agentId)!),
  }))
  const { effects, bucketRows } = projectTeamStrengthSourceEffects(
    context,
    abilityById,
    recipientContext,
  )
  effects.push(...projectTeamStrengthTypedAnomalyCapacity(context))
  // Zhao's independently reviewed HP step contribution supersedes a generic
  // source slot. Consume the same recipient-bound producer as fixed contacts.
  for (const target of members.filter((m) => m.agentId !== 'agent-zhao')) {
    if (!ids.includes('agent-zhao')) break
    const eventId = usages.get(target.agentId)?.[0]?.eventId
    if (!eventId) continue
    const produced = bindReviewedSupportEventDamage32({
      members: [...contactRuntime.values()],
      recipientAgentId: target.agentId,
      eventId,
      baselineReferencesByAgentId: {
        'agent-zhao': conditions.supportReferencesByAgentId?.['agent-zhao'] ?? {},
        [target.agentId]: {
          inside_any_ether_veil: true,
          ...conditions.supportReferencesByAgentId?.[target.agentId],
        },
      },
      equipmentEffectExclusions: [],
    })
    for (const bucket of produced.buckets) {
      const before = contactValue(target.agentId, [])
      const after = contactValue(target.agentId, [bucket])
      effects.push({
        providerAgentId: bucket.providerAgentId,
        recipientAgentId: target.agentId,
        effectKey: bucket.effectKey,
        application: bucket.application,
        value: bucket.value,
        relativeGain:
          before !== null && before > 0 && after !== null ? Math.max(0, after / before - 1) : null,
        sourceRefs: bucket.sourceRefs,
        conditions: { inside_any_ether_veil: true },
        channel: 'damage',
      })
      bucketRows.push({
        providerAgentId: bucket.providerAgentId,
        recipientAgentId: target.agentId,
        bucket,
        conditions: { inside_any_ether_veil: true },
      })
    }
    for (const excluded of produced.exclusions)
      gaps.push({
        providerAgentId: 'agent-zhao',
        effectKey: excluded.effectKey,
        fields: excluded.fields,
        sourceRefs: excluded.sourceRefs,
      })
  }
  const remielle = contactRuntime.get('agent-remielle')
  if (remielle) {
    const declared = {
      battlefield_entered: true,
      ...conditions.supportReferencesByAgentId?.['agent-remielle'],
    }
    const producer = evaluateReviewedSupportTargetCapacity32({
      member: remielle,
      members: [...contactRuntime.values()],
      equipmentExclusions: [],
      baselineReferencesByAgentId: { 'agent-remielle': declared },
    })
    const capacity = producer.capacities.find(
      (row) => row.key === 'agent-remielle:entry_team_attack',
    )
    if (capacity?.value !== null && typeof capacity?.value === 'number') {
      for (const target of members.filter(
        (member) =>
          member.agentId !== remielle.agentId &&
          recipientCompatible(member, 'attack', { path: 'teamBuff.combat.atk', damageType: null }),
      )) {
        const bucket: SourceBackedPlanningEffectBucket = {
          bucketId: capacity.key,
          effectKey: capacity.key,
          effectId: 'entry_team_attack',
          providerAgentId: remielle.agentId,
          recipientAgentIds: [target.agentId],
          receiverPath: 'teamBuff.combat.atk',
          applicationScope: 'generic',
          damageType: null,
          action: null,
          attribute: null,
          application: 'attack_flat',
          value: capacity.value,
          sourceRefs: [...capacity.sourceRefs],
        }
        const before = contactValue(target.agentId, [])
        const after = contactValue(target.agentId, [bucket])
        effects.push({
          providerAgentId: remielle.agentId,
          recipientAgentId: target.agentId,
          effectKey: capacity.key,
          application: 'attack_flat',
          value: capacity.value,
          relativeGain:
            before !== null && before > 0 && after !== null
              ? Math.max(0, after / before - 1)
              : null,
          sourceRefs: [...capacity.sourceRefs],
          conditions: declared,
          channel: 'attack',
        })
        bucketRows.push({
          providerAgentId: remielle.agentId,
          recipientAgentId: target.agentId,
          bucket,
          conditions: declared,
        })
      }
    } else if (capacity)
      gaps.push({
        providerAgentId: remielle.agentId,
        effectKey: capacity.key,
        fields: producer.blockers,
        sourceRefs: [...capacity.sourceRefs],
      })
  }
  // An effect whose requirements are a subset of another state's requirements
  // is co-active in that state (e.g. Soukaku's ice grant under vortexConsumed).
  // Distinct, undeclared states stay separate. Explicitly validated observations
  // may join them; an independently maximized condition may not.
  const groups = new Map<string, typeof bucketRows>()
  for (const row of bucketRows.filter((row) => row.providerAgentId !== row.recipientAgentId)) {
    const packet = context.contactUsages(
      row.recipientAgentId,
      row.bucket.damageType === 'aftershock' ? 'aftershock' : undefined,
    )
    const key = stableContentHash([
      row.providerAgentId,
      row.recipientAgentId,
      sourceCapacityEventPacketIdentity(packet),
    ])
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const containsState = (
    state: Readonly<Record<string, unknown>>,
    subset: Readonly<Record<string, unknown>>,
  ) =>
    Object.entries(subset).every(
      ([key, value]) =>
        Object.hasOwn(state, key) && stableContentHash(state[key]) === stableContentHash(value),
    )
  const contactStates = [...groups.values()].flatMap((rows) => {
    const explicit = conditions.supportReferencesByAgentId?.[rows[0]!.providerAgentId] ?? {}
    // Only states actually validated by a source effect can enter the union.
    const observed = Object.fromEntries(
      rows.flatMap((row) =>
        Object.entries(row.conditions).filter(
          ([key, value]) =>
            Object.hasOwn(explicit, key) &&
            stableContentHash(explicit[key]) === stableContentHash(value),
        ),
      ),
    )
    const states = [
      ...new Map(
        rows.map((row) => {
          const state = { ...observed, ...row.conditions }
          return [stableContentHash(state), state] as const
        }),
      ).values(),
    ]
    return states
      .filter(
        (state) =>
          !states.some(
            (other) =>
              other !== state &&
              Object.keys(other).length > Object.keys(state).length &&
              containsState(other, state),
          ),
      )
      .map((state) => ({ state, rows: rows.filter((row) => containsState(state, row.conditions)) }))
  })
  const contacts = contactStates.map(({ rows, state }) => {
    const first = rows[0]!
    const packet = context.contactUsages(
      first.recipientAgentId,
      rows.some((row) => row.bucket.damageType === 'aftershock') ? 'aftershock' : undefined,
    )
    const before = contactValue(first.recipientAgentId, [], packet)
    const after = contactValue(
      first.recipientAgentId,
      rows.map((row) => row.bucket),
      packet,
      {
        ...conditions.supportReferencesByAgentId,
        [first.providerAgentId]: {
          ...conditions.supportReferencesByAgentId?.[first.providerAgentId],
          ...state,
        },
      },
    )
    return {
      providerAgentId: first.providerAgentId,
      recipientAgentId: first.recipientAgentId,
      eventPacketIdentity: sourceCapacityEventPacketIdentity(packet),
      effectKeys: rows.map((row) => row.bucket.effectKey),
      relativeGain:
        before !== null && before > 0 && after !== null ? Math.max(0, after / before - 1) : null,
      conditions: state,
    }
  })
  const anomalyGain = (
    application: 'anomaly_proficiency_flat' | 'anomaly_mastery_flat',
    stat: 'anomProf' | 'anomMas',
  ) =>
    Math.max(
      0,
      ...effects
        .filter((e) => e.application === application)
        .map((e) => e.value / runtime.get(e.recipientAgentId)!.initialStats[stat]),
    )
  const anomaly = projectTeamAnomalyCapacityCoordinates(effects)
  gaps.push(
    ...anomaly.gaps.map(({ effect, reason }) => ({
      providerAgentId: effect.providerAgentId,
      effectKey: effect.effectKey,
      fields: [reason],
      sourceRefs: effect.sourceRefs,
    })),
  )
  return {
    identity: standardTeamReferenceSelection
      ? stableContentHash({
          policy: teamStrengthSourceCapacityIdentity,
          standard: context.standardReferenceIdentity,
        })
      : teamStrengthSourceCapacityIdentity,
    ...(standardTeamReferenceSelection
      ? {
          standardReferenceIdentity: context.standardReferenceIdentity,
          standardReferenceStatus: 'ready' as const,
        }
      : {}),
    actions,
    effects,
    contacts,
    gaps,
    anomalyProficiencyGain: anomalyGain('anomaly_proficiency_flat', 'anomProf'),
    anomalyMasteryGain: anomalyGain('anomaly_mastery_flat', 'anomMas'),
    anomalyCoordinates: anomaly.coordinates,
    stunCapacity: Math.max(
      0,
      ...effects.filter((e) => e.application === 'stun_damage_bonus').map((e) => e.value),
    ),
  }
}
