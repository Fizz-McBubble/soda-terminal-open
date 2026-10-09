import {
  currentAgentPlanningEffectBlueprints,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import {
  effectReceiverMetadata,
  effectAttributeForReceiver,
  requiredReferences,
} from './currentPlanningEffectExpressions'
import {
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'
import {
  applicationForReceiver,
  recipientIds,
  type SourceBackedPlanningEffectBucket,
} from './currentPlanningDamageModifiers'
import { knownInactivePlanningEffect32 } from './planningKnownInactiveEffects32'

type EffectResult = Extract<
  ReturnType<typeof evaluateCurrentPlanningEffectEntries32>,
  { status: 'supported' }
>['results'][number]
export function planningRuntimeEffectBuckets32(
  results: readonly EffectResult[],
  memberIds: readonly string[],
) {
  return results.flatMap((effect): SourceBackedPlanningEffectBucket[] => {
    if (effect.status !== 'supported' || !effect.active || typeof effect.value !== 'number')
      return []
    const recipients = recipientIds({
      targetKinds: effect.targetKinds,
      providerAgentId: effect.providerAgentId,
      memberIds,
      receiverPath: effect.receiverPath,
      effectKey: effect.effectKey,
      declaredRecipientAgentIds: effect.recipientAgentIds,
    })
    const values = effect.recipientValues.length
      ? effect.recipientValues.filter((row) => recipients.includes(row.agentId))
      : [{ agentId: null, value: effect.value }]
    return values.flatMap((recipient) =>
      typeof recipient.value !== 'number' || recipient.value === 0
        ? []
        : [
            {
              bucketId: `effect:${effect.effectKey}`,
              effectKey: effect.effectKey,
              effectId: effect.effectId,
              applicationScope: effect.applicationScope,
              providerAgentId: effect.providerAgentId,
              recipientAgentIds: recipient.agentId ? [recipient.agentId] : recipients,
              receiverPath: effect.receiverPath,
              damageType: effect.damageType,
              action: null,
              attribute: effectAttributeForReceiver(effect.receiverPath),
              value: recipient.value,
              application: applicationForReceiver(effect.receiverPath),
              sourceRefs: effect.sourceRefs,
            },
          ],
    )
  })
}

/** Single real actor, self receiver only; no fabricated teammates or additional-ability activation. */
export function compileCurrentPlanningSelfEffects32(input: {
  member: PlanningEffectRuntimeMember
  references?: Readonly<Record<string, unknown>>
}) {
  const entries: CurrentAgentPlanningEffectBlueprint[] = []
  const resolvedInactiveEffectKeys: string[] = []
  const exclusions: Array<{
    effectKey: string
    reason: string
    fields: string[]
    sourceRefs: string[]
  }> = []
  for (const entry of currentAgentPlanningEffectBlueprints.filter(
    (row) => row.providerAgentId === input.member.agentId,
  )) {
    const roxyPreparedEnemyEffect =
      input.member.agentId === 'agent-roxy' &&
      input.references?.roxyPreparedHeld32 === 'personal' &&
      ['agent-roxy:m1_resRed_', 'agent-roxy:m2_stun_'].includes(entry.effectKey)
    // Contact starts false but changes within the reviewed packet. Preserve the
    // effect for its existing per-event binder; static mindscape gates still reduce.
    const inactiveReferences = roxyPreparedEnemyEffect
      ? Object.fromEntries(
          Object.entries(input.references ?? {}).filter(
            ([key]) => !['kindlyHits', 'chillHits'].includes(key),
          ),
        )
      : input.references
    if (knownInactivePlanningEffect32(entry, input.member, inactiveReferences)) {
      resolvedInactiveEffectKeys.push(entry.effectKey)
      continue
    }
    const metadata = effectReceiverMetadata(entry.numericExpression.expressionIr)
    const preparedKoleda =
      input.member.agentId === 'agent-koleda' &&
      typeof input.references?.furnaceConsumptionBuffActive32 === 'boolean' &&
      Number.isInteger(input.references?.furnaceConsumedStacks32)
    const koledaSelfReceivingTeamBuff =
      preparedKoleda &&
      [
        'agent-koleda:basic_common_dmg_',
        'agent-koleda:potential_crit_dmg_',
        'agent-koleda:potential_laceration_dmg_',
      ].includes(entry.effectKey)
    if (metadata.receiverPath?.includes('.initial.')) continue
    if (
      (!metadata.receiverPath?.startsWith('ownBuff.') &&
        !koledaSelfReceivingTeamBuff &&
        !roxyPreparedEnemyEffect) ||
      entry.numericExpression.sourceStatus !== 'upstream_expression_available'
    ) {
      exclusions.push({
        effectKey: entry.effectKey,
        reason: '个人固定事件未建立此队伍、敌方或声明式效果的来源上下文。',
        fields: ['recipient_context', entry.numericExpression.sourceStatus],
        sourceRefs: entry.sourceRefs,
      })
      continue
    }
    const extracted = extractUpstreamEffectValueIr(entry.numericExpression.expressionIr)
    if (extracted.status !== 'supported') return extracted
    // This successful extraction is a typed source IR subtree, not its runtime value.
    const refs = requiredReferences(extracted.value as UpstreamExpressionIR)
    const unavailable = refs.filter(
      (ref) =>
        ref.startsWith('team.') ||
        (ref.startsWith('target.') && !koledaSelfReceivingTeamBuff) ||
        (!/^(dm\.|char\.|own\.(initial|final)\.)/.test(ref) &&
          !(koledaSelfReceivingTeamBuff && ref.startsWith('target.')) &&
          !(
            preparedKoleda &&
            ref === 'furnaceFire' &&
            [
              'agent-koleda:basic_dmg_',
              'agent-koleda:basic_dazeInc_',
              'agent-koleda:basic_common_dmg_',
            ].includes(entry.effectKey)
          ) &&
          !Object.hasOwn(input.references ?? {}, ref)),
    )
    if (entry.numericExpression.operators.includes('abilityCheck'))
      unavailable.push('team_activation')
    if (unavailable.length) {
      exclusions.push({
        effectKey: entry.effectKey,
        reason: '单主体缺少队伍或已观测条件；未推断触发。',
        fields: [...unavailable],
        sourceRefs: entry.sourceRefs,
      })
      continue
    }
    // Formula receiver is calculation targeting; references to team counts are not recipients.
    entries.push({ ...entry, targetKinds: ['self'] })
  }
  const result = evaluateCurrentPlanningEffectEntries32(
    {
      memberIds: [input.member.agentId],
      members: [input.member],
      baselineReferencesByAgentId: { [input.member.agentId]: input.references ?? {} },
    },
    entries,
  )
  return result.status !== 'supported'
    ? result
    : {
        ...result,
        entries,
        resolvedInactiveEffectKeys,
        exclusions,
        buckets: planningRuntimeEffectBuckets32(result.results, [input.member.agentId]),
      }
}
