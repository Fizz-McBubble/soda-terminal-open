import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { effectReceiverMetadata } from '../calculation/currentPlanningEffectExpressions'
import { applicationForReceiver } from '../calculation/currentPlanningDamageModifiers'
import { sourcePlanningAftershock32 } from '../calculation/currentPotentialEventActions32'
import { resolveCurrentPlanningEventEffects32 } from '../calculation/currentPlanningEventEffectResolution32'
import type { TeamStrengthCapacityContext } from './teamStrengthSourceCapacityActions'
import type {
  CapacityEffect,
  TeamStrengthCapacityBucketRow,
} from './teamStrengthSourceCapacityPolicy'
export type DeferredTeamStrengthSourceEffect = {
  entry: (typeof currentAgentPlanningEffectBlueprints)[number]
  recipientAgentId: string
  conditions: Record<string, unknown>
  sourceRefs: string[]
  channel: string
}
export function settleDeferredTeamStrengthSourceEffects(
  context: TeamStrengthCapacityContext,
  deferred: readonly DeferredTeamStrengthSourceEffect[],
  effects: CapacityEffect[],
  bucketRows: TeamStrengthCapacityBucketRow[],
) {
  const { members, conditions, ids, runtime, contactRuntime, contactValue, gaps } = context

  // Consume the same event graph as production after the source-bound stat
  // grants have been produced. No second combat/final or Sheer Force formula.
  for (const row of deferred) {
    const providerId = row.entry.providerAgentId
    const producerReferences: Record<string, Record<string, unknown>> = Object.fromEntries(
      Object.entries(conditions.supportReferencesByAgentId ?? {}).map(([id, refs]) => [
        id,
        { ...refs },
      ]),
    )
    for (const grant of bucketRows.filter((grant) => grant.recipientAgentId === providerId))
      producerReferences[grant.providerAgentId] = {
        ...producerReferences[grant.providerAgentId],
        ...grant.conditions,
      }
    producerReferences[providerId] = { ...producerReferences[providerId], ...row.conditions }
    const incoming = bucketRows
      .filter(
        (grant) =>
          grant.recipientAgentId === providerId &&
          (providerId === 'agent-norma'
            ? grant.bucket.application === 'sheer_force'
            : grant.bucket.application === 'crit_damage'),
      )
      .map((grant) => ({ ...grant.bucket, recipientAgentIds: [grant.recipientAgentId] }))
    const target = members.find((member) => member.agentId === row.recipientAgentId)!
    const metadata = effectReceiverMetadata(row.entry.numericExpression.expressionIr)
    const packet = context.contactUsages(target.agentId, metadata.damageType ?? undefined)
    const eventIds = packet.map((usage) => usage.eventId)
    let produced = false
    for (const eventId of eventIds) {
      const contract = getCurrentAgentEventContract(target.agentId)!
      const event = contract.eventContract.events.find((event) => event.eventId === eventId)!
      const aftershock = sourcePlanningAftershock32({
        agentId: target.agentId,
        eventId,
        memberIds: ids,
        potential: runtime.get(target.agentId)!.potential,
      })
      const settled = resolveCurrentPlanningEventEffects32({
        memberIds: ids,
        members: [...contactRuntime.values()],
        ownerAgentId: target.agentId,
        event: {
          ...event,
          damageTypes: [event.damageType, ...(aftershock === true ? ['aftershock'] : [])],
        },
        attribute: event.attribute ?? contract.identity.attribute,
        buckets: incoming,
        entries: [row.entry],
        baselineReferencesByAgentId: producerReferences,
      })
      if (settled.status !== 'supported') {
        gaps.push({
          providerAgentId: providerId,
          effectKey: row.entry.effectKey,
          fields: settled.blockers,
          sourceRefs: row.sourceRefs,
        })
        break
      }
      const bucket = settled.buckets.find(
        (bucket) =>
          bucket.effectKey === row.entry.effectKey &&
          bucket.recipientAgentIds.includes(target.agentId),
      )
      if (
        !bucket &&
        settled.producerReceipts.some(
          (receipt) =>
            receipt.effectKey === row.entry.effectKey &&
            receipt.recipientAgentId === target.agentId &&
            receipt.status === 'known_zero' &&
            receipt.value === 0,
        )
      ) {
        // Only a real source evaluation receipt proves zero. Execution order
        // and an empty bucket list do not prove upstream coverage.
        effects.push({
          providerAgentId: providerId,
          recipientAgentId: target.agentId,
          effectKey: row.entry.effectKey,
          application: applicationForReceiver(metadata.receiverPath),
          receiverPath: metadata.receiverPath,
          damageType: metadata.damageType,
          value: 0,
          relativeGain: 0,
          sourceRefs: row.sourceRefs,
          conditions: row.conditions,
          channel: row.channel,
        })
        produced = true
        break
      }
      if (!bucket) continue
      const scoped = { ...bucket, recipientAgentIds: [target.agentId] }
      const before = contactValue(target.agentId, [], packet)
      const after = contactValue(target.agentId, [scoped], packet)
      effects.push({
        providerAgentId: providerId,
        recipientAgentId: target.agentId,
        effectKey: row.entry.effectKey,
        application: bucket.application,
        receiverPath: metadata.receiverPath,
        damageType: metadata.damageType,
        value: bucket.value,
        relativeGain:
          before !== null && before > 0 && after !== null ? Math.max(0, after / before - 1) : null,
        sourceRefs: [...row.sourceRefs, ...bucket.sourceRefs],
        conditions: row.conditions,
        channel: row.channel,
      })
      bucketRows.push({
        providerAgentId: providerId,
        recipientAgentId: target.agentId,
        bucket: scoped,
        conditions: row.conditions,
      })
      produced = true
      break
    }
    if (!produced && !gaps.some((gap) => gap.effectKey === row.entry.effectKey))
      gaps.push({
        providerAgentId: providerId,
        effectKey: row.entry.effectKey,
        fields: ['source_effect_not_applicable_to_counted_contact'],
        sourceRefs: row.sourceRefs,
      })
  }
}
