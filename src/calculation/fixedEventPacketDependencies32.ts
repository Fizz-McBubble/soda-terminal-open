import { sourceStunAppliesOutsideStun32 } from './sourceBoundStunApplication32'
import {
  currentAgentPlanningEffectBlueprints,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import {
  applicationForReceiver,
  getPlanningDamageEventSemantics,
  matchesEventScope,
  recipientIds,
} from './currentPlanningDamageModifiers'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  effectAttributeForReceiver,
  effectReceiverMetadata,
  requiredReferences,
} from './currentPlanningEffectExpressions'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import { knownInactivePlanningEffect32 } from './planningKnownInactiveEffects32'
import { bindReviewedAstraCoreAttack32 } from './reviewedAstraCoreAttack32'
import { resolveSourceBoundYuzuhaFlavorMatchAttribute32 } from './sourceBoundYuzuhaFlavorMatch32'
import type { FixedEventSupportInput32 } from './fixedEventSupportContribution32'

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/** Only source effects that can reach this declared damage packet establish
 * dependencies. Unrelated recovery/daze/shield domains stay outside the slice. */
export function fixedEventPacketDependencies32(input: FixedEventSupportInput32) {
  const contract = getCurrentAgentEventContract(input.subjectAgentId)!
  const subject = input.members.find((row) => row.agentId === input.subjectAgentId)!
  const blockers: string[] = []
  const events: Array<(typeof contract.eventContract.events)[number]> = []
  for (const usage of input.eventUsages) {
    const event = contract.eventContract.events.find((row) => row.eventId === usage.eventId)!
    const attribute = resolveSourceBoundYuzuhaFlavorMatchAttribute32({
      declaration: input.baselineReferencesByAgentId?.['agent-yuzuha']?.yuzuhaFlavorMatch32,
      baseAttribute: event.attribute ?? contract.identity.attribute,
      usage,
      eventUsages: input.eventUsages,
      member: subject,
      memberIds: input.memberIds,
      members: input.members,
      targetId: input.baseline.enemy.id,
      diagnosticBlockers: blockers,
    })
    if (attribute === null) return { status: 'unsupported' as const, blockers }
    events.push({ ...event, attribute })
  }
  const applications = new Set<string>([
    'flat_damage',
    'direct_damage_bonus',
    'buff_bonus',
    'vulnerability',
    'motion_value_multiplier',
    'damage_bonus',
    'defense_reduction',
    'defense_ignore',
    'resistance_reduction',
    'resistance_ignore',
    'penetration_ratio',
  ])
  if (input.baseline.enemy.stunMultiplier > 1) applications.add('stun_damage_bonus')
  const subjectFields = new Set<string>(['initial.pen', 'final.pen'])
  for (const event of events) {
    const semantics = getPlanningDamageEventSemantics(event)
    if (semantics?.scalingAttribute === 'attack') {
      applications.add('attack_percent').add('attack_flat')
      subjectFields.add('initial.atk').add('final.atk')
    }
    if (semantics?.scalingAttribute === 'defense') {
      applications.add('defense_percent').add('defense_flat')
      subjectFields.add('initial.def').add('final.def')
    }
    if (semantics?.family === 'direct') applications.add('crit_rate').add('crit_damage')
    if (semantics?.family === 'sharp')
      applications.add('sharp_damage_bonus').add('laceration_damage').add('crit_rate')
    if (semantics?.family === 'sheer') {
      applications.add('sheer_force').add('sheer_damage_bonus')
      subjectFields.add('initial.sheerForce').add('final.sheerForce')
    }
  }
  const affectsPacket = (entry: CurrentAgentPlanningEffectBlueprint) => {
    const provider = input.members.find((row) => row.agentId === entry.providerAgentId)
    if (
      !provider ||
      knownInactivePlanningEffect32(
        entry,
        provider,
        input.baselineReferencesByAgentId?.[provider.agentId] ?? {},
        input.memberIds,
      )
    )
      return false
    const metadata = effectReceiverMetadata(entry.numericExpression.expressionIr)
    const application = applicationForReceiver(metadata.receiverPath)
    const astra =
      entry.effectKey === 'agent-astra:core_atk'
        ? bindReviewedAstraCoreAttack32({
            memberIds: input.memberIds,
            references: input.baselineReferencesByAgentId?.[entry.providerAgentId],
          })
        : null
    // Dependency reachability is not a grant. A missing recipient remains a
    // possible dependency; a known recipient uses the exact numerical scope.
    const recipients = astra
      ? astra.status === 'supported'
        ? astra.recipientAgentIds
        : input.memberIds
      : recipientIds({ ...entry, memberIds: input.memberIds, receiverPath: metadata.receiverPath })
    return (
      (applications.has(application) ||
        (application === 'stun_damage_bonus' && sourceStunAppliesOutsideStun32(entry) !== false)) &&
      recipients.includes(input.subjectAgentId) &&
      events.some((event) =>
        matchesEventScope(
          {
            effectId: entry.effectId,
            applicationScope: entry.applicationScope,
            damageType: metadata.damageType,
            action: null,
            attribute: effectAttributeForReceiver(metadata.receiverPath),
          },
          event,
          event.attribute ?? contract.identity.attribute,
        ),
      )
    )
  }
  const fieldsByMember = new Map(input.memberIds.map((id) => [id, new Set<string>()]))
  fieldsByMember.set(input.subjectAgentId, subjectFields)
  for (const entry of currentAgentPlanningEffectBlueprints.filter(affectsPacket)) {
    const fields = fieldsByMember.get(entry.providerAgentId)
    for (const path of requiredReferences(entry.numericExpression.expressionIr))
      if (/^own\.(initial|final)\./.test(path)) fields?.add(path.slice(4))
  }
  // This reviewed source component is not the upstream placeholder expression.
  if (input.baselineReferencesByAgentId?.[input.subjectAgentId]?.inside_any_ether_veil !== false)
    fieldsByMember.get('agent-zhao')?.add('initial.hp')
  const equipmentExclusions = input.equipmentEffectExclusions.flatMap((exclusion) => {
    const row = record(exclusion)
    const fields = Array.isArray(row?.writeFields) ? row.writeFields : []
    const directFields = fields.filter((field) => {
      if (typeof field !== 'string') return false
      const receiver = `ownBuff.${field}`
      const attribute = effectAttributeForReceiver(receiver)
      // Classify the underlying stat while retaining its source attribute:
      // combat.crit_dmg_.ice is direct crit damage only for an ice packet.
      const baseReceiver = attribute ? receiver.slice(0, -attribute.length - 1) : receiver
      return (
        applications.has(applicationForReceiver(baseReceiver)) &&
        (!attribute || events.some((event) => event.attribute === attribute))
      )
    }) as string[]
    const affectedAgentIds = input.memberIds.filter(
      (id) =>
        functionalEquipmentGaps32(
          [exclusion],
          id,
          [...(fieldsByMember.get(id) ?? []), ...(id === input.subjectAgentId ? directFields : [])],
          events,
        ).length,
    )
    return affectedAgentIds.length
      ? [
          {
            providerAgentId:
              typeof row?.agentId === 'string'
                ? row.agentId
                : typeof row?.providerAgentId === 'string'
                  ? row.providerAgentId
                  : null,
            affectedAgentIds,
            exclusion,
          },
        ]
      : []
  })
  return { status: 'supported' as const, affectsPacket, equipmentExclusions }
}
