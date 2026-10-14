import {
  currentAgentPlanningEffectBlueprints,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { calculateCurrentPlanningEventDamage32 } from './currentPlanningEventDamage32'
import {
  applicationForReceiver,
  getPlanningDamageEventSemantics,
  matchesEventScope,
  recipientIds,
  type SourceBackedPlanningEffectBucket,
} from './currentPlanningDamageModifiers'
import { planningBaselineSchema, type PlanningBaseline } from './planningDpsContract'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { isReviewedTemplateMechanicEffect32 } from './reviewedTemplateMechanicEffects32'
import { isDamageFormula32Version } from './sharpDamageCore'
import {
  effectAttributeForReceiver,
  effectReceiverMetadata,
  requiredReferences,
} from './currentPlanningEffectExpressions'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import { knownInactivePlanningEffect32 } from './planningKnownInactiveEffects32'

export type FixedEventSupportInput32 = {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  subjectAgentId: string
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  equipmentModifierBuckets: readonly SourceBackedPlanningEffectBucket[]
  equipmentEffectExclusions: readonly unknown[]
}

// These providers have no implicit potential/team-action dispatch that could
// restore their effects after entries and buckets have been excluded.
const counterfactualProviders = new Set([
  'agent-sunna',
  'agent-zhao',
  'agent-astra',
  'agent-yuzuha',
  'agent-lucy',
  'agent-nicole',
])

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

function equipmentOwner(value: unknown) {
  const row = record(value)
  return typeof row?.agentId === 'string'
    ? row.agentId
    : typeof row?.providerAgentId === 'string'
      ? row.providerAgentId
      : null
}

/** Only source effects that can reach this declared damage packet establish
 * dependencies. Unrelated recovery/daze/shield domains stay outside the slice. */
function packetDependencies(input: FixedEventSupportInput32) {
  const contract = getCurrentAgentEventContract(input.subjectAgentId)!
  const events = input.eventUsages.map(
    (usage) => contract.eventContract.events.find((row) => row.eventId === usage.eventId)!,
  )
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
    return (
      applications.has(applicationForReceiver(metadata.receiverPath)) &&
      recipientIds({
        ...entry,
        memberIds: input.memberIds,
        receiverPath: metadata.receiverPath,
      }).includes(input.subjectAgentId) &&
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
    const directFields = fields.filter(
      (field) =>
        typeof field === 'string' && applications.has(applicationForReceiver(`ownBuff.${field}`)),
    ) as string[]
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
            providerAgentId: equipmentOwner(exclusion),
            affectedAgentIds,
            exclusion,
          },
        ]
      : []
  })
  return { affectsPacket, equipmentExclusions }
}

function invalid(input: FixedEventSupportInput32) {
  if (!Array.isArray(input.equipmentEffectExclusions)) return '固定事件需要明确装备来源的未消费项。'
  if (
    new Set(input.memberIds).size !== 3 ||
    input.members.length !== 3 ||
    new Set(input.members.map((row) => row.agentId)).size !== 3 ||
    input.memberIds.some((id) => !input.members.some((row) => row.agentId === id)) ||
    !input.memberIds.includes(input.subjectAgentId)
  )
    return '固定事件需要身份一致的合法三人及共同主输出。'
  if (
    !planningBaselineSchema.safeParse(input.baseline).success ||
    !isDamageFormula32Version(input.baseline.gameVersion)
  )
    return '固定事件需要明确的当前目标与比较条件。'
  if (
    !input.memberIds.every((id) =>
      currentAssetProjection.agents.some(
        (row) => row.stableId === id && row.releaseState === 'released',
      ),
    )
  )
    return '固定事件包含尚未采用的代理人身份。'
  const subject = input.members.find((row) => row.agentId === input.subjectAgentId)!
  if (
    !input.eventUsages.length ||
    input.eventUsages.some((usage) => {
      const event = resolveCurrentAgentEvent({
        stableId: subject.agentId,
        eventId: usage.eventId,
        skillLevel: usage.skillLevel,
      })
      const sourceEvent = getCurrentAgentEventContract(subject.agentId)?.eventContract.events.find(
        (row) => row.eventId === usage.eventId,
      )
      return (
        usage.ownerAgentId !== subject.agentId ||
        event.status !== 'supported' ||
        !Number.isInteger(usage.occurrenceCount) ||
        usage.occurrenceCount <= 0 ||
        !usage.evidenceRefs.length ||
        !sourceEvent ||
        subject.skillLevels[sourceEvent.skill] !== usage.skillLevel
      )
    })
  )
    return '固定事件缺少一致的来源动作、实际技能或明确次数。'
  if (
    input.members.some(
      (row) =>
        Object.values(row.initialStats).some(
          (value) => typeof value === 'number' && !Number.isFinite(value),
        ) ||
        Object.values(row.finalStats).some(
          (value) => typeof value === 'number' && !Number.isFinite(value),
        ),
    )
  )
    return '固定事件成员面板含无效数值。'
  if (
    Object.keys(input.baselineReferencesByAgentId ?? {}).some(
      (id) => !input.memberIds.includes(id),
    ) ||
    input.equipmentModifierBuckets.some(
      (bucket) =>
        !input.memberIds.includes(bucket.providerAgentId) ||
        bucket.recipientAgentIds.some((id) => !input.memberIds.includes(id)) ||
        !Number.isFinite(bucket.value),
    )
  )
    return '效果声明或装备效果不属于当前三人。'
  return null
}

/** A declared common packet, with the same actors retained during provider-off
 * evaluation. Deltas explain the settled value and are never added to it. */
export function projectFixedEventSupportContribution32(input: FixedEventSupportInput32) {
  const reason = invalid(input)
  if (reason) return { status: 'unsupported' as const, blockers: [reason] }
  const subject = input.members.find((row) => row.agentId === input.subjectAgentId)!
  const dependencies = packetDependencies(input)
  const relevant = currentAgentPlanningEffectBlueprints.filter(
    (entry) =>
      input.memberIds.includes(entry.providerAgentId) &&
      (entry.numericExpression.sourceStatus === 'upstream_expression_available' ||
        isReviewedTemplateMechanicEffect32(entry)),
  )
  const settle = (disabledProviderId?: string) => {
    const entries = relevant.filter((entry) => entry.providerAgentId !== disabledProviderId)
    const runtime = evaluateCurrentPlanningEffectEntries32(
      {
        memberIds: input.memberIds,
        members: input.members,
        baselineReferencesByAgentId: input.baselineReferencesByAgentId,
      },
      entries,
    )
    if (runtime.status === 'unsupported') return runtime
    const buckets = [
      ...planningRuntimeEffectBuckets32(runtime.results, input.memberIds),
      ...input.equipmentModifierBuckets,
    ].filter((bucket) => bucket.providerAgentId !== disabledProviderId)
    const blockers: string[] = []
    const consumedBuckets: SourceBackedPlanningEffectBucket[] = []
    const exclusions: Array<{
      effectKey: string
      reason: string
      fields: string[]
      sourceRefs: string[]
    }> = []
    const value = calculateCurrentPlanningEventDamage32({
      member: subject,
      buckets,
      eventUsages: input.eventUsages,
      baseline: input.baseline,
      diagnosticBlockers: blockers,
      eventEffectContext: {
        memberIds: input.memberIds,
        members: input.members,
        entries,
        baselineReferencesByAgentId: input.baselineReferencesByAgentId,
        consumedBuckets,
        exclusions,
        disabledSupportProviderIds: disabledProviderId ? [disabledProviderId] : [],
        equipmentEffectExclusions: input.equipmentEffectExclusions,
      },
    })
    if (value === null || !Number.isFinite(value) || value < 0)
      return {
        status: 'unsupported' as const,
        blockers: blockers.length ? blockers : ['来源固定事件未完成结算。'],
      }
    return {
      status: 'supported' as const,
      fixedEventValue: value,
      consumedBuckets,
      exclusions,
      effects: runtime.results,
    }
  }
  const on = settle()
  if (on.status === 'unsupported') return on
  const unknownEffects = on.effects.filter(
    (row) =>
      row.status === 'excluded_unknown' &&
      relevant.some(
        (entry) => entry.effectKey === row.effectKey && dependencies.affectsPacket(entry),
      ),
  )
  const packetExclusions = on.exclusions.filter(
    (row) => !row.fields.includes('outside_direct_event_formula'),
  )
  const contributions = input.memberIds
    .filter((id) => id !== subject.agentId)
    .map((providerAgentId) => {
      if (!counterfactualProviders.has(providerAgentId))
        return {
          providerAgentId,
          status: 'not_bound' as const,
          reason: '此提供者的派生效果排除尚未核验。',
          withoutSupportEventValue: null,
          supportDelta: null,
        }
      const off = settle(providerAgentId)
      if (off.status === 'unsupported')
        return {
          providerAgentId,
          status: 'unsupported' as const,
          reason: off.blockers.join('；'),
          withoutSupportEventValue: null,
          supportDelta: null,
        }
      const unresolved =
        packetExclusions.length > 0 ||
        unknownEffects.length > 0 ||
        dependencies.equipmentExclusions.length > 0 ||
        off.exclusions.some((row) => !row.fields.includes('outside_direct_event_formula'))
      return {
        providerAgentId,
        status: unresolved ? ('partial' as const) : ('supported' as const),
        withoutSupportEventValue: off.fixedEventValue,
        supportDelta: unresolved ? null : on.fixedEventValue - off.fixedEventValue,
        settledSliceDelta: on.fixedEventValue - off.fixedEventValue,
      }
    })
  const core = {
    status:
      packetExclusions.length || unknownEffects.length || dependencies.equipmentExclusions.length
        ? ('partial' as const)
        : ('supported' as const),
    subjectAgentId: subject.agentId,
    fixedEventValue: on.fixedEventValue,
    contributions,
    consumedBuckets: on.consumedBuckets,
    exclusions: on.exclusions,
    effects: on.effects,
    unknownEffects,
    equipmentEffectExclusions: input.equipmentEffectExclusions,
    relevantEquipmentExclusions: dependencies.equipmentExclusions,
    inputIdentity: stableContentHash(input),
    boundary: '仅比较声明动作包的已消费分量；未包括准备成本、完整资源循环、其他动作或整队DPS。',
  }
  return { ...core, identity: stableContentHash(core) }
}

/** Only one teammate changes; common members, packet, target and observed
 * conditions stay identical. This is distinct from one actor's gear comparison. */
export function compareFixedEventSupportContribution32(
  left: FixedEventSupportInput32,
  right: FixedEventSupportInput32,
) {
  const common = left.memberIds.filter((id) => right.memberIds.includes(id))
  const invariant = (input: FixedEventSupportInput32) => ({
    subject: input.subjectAgentId,
    events: input.eventUsages,
    baseline: input.baseline,
    members: input.members
      .filter((row) => common.includes(row.agentId))
      .sort((a, b) => a.agentId.localeCompare(b.agentId)),
    references: Object.fromEntries(
      common.sort().map((id) => [id, input.baselineReferencesByAgentId?.[id] ?? {}]),
    ),
    equipment: input.equipmentModifierBuckets
      .filter((row) => common.includes(row.providerAgentId))
      .map((row) => ({
        ...row,
        recipientAgentIds: row.recipientAgentIds.filter((id) => common.includes(id)),
      })),
    equipmentExclusions: input.equipmentEffectExclusions
      .filter((row) => {
        const owner = equipmentOwner(row)
        return !owner || common.includes(owner)
      })
      .map((row) => {
        const metadata = record(row)
        return metadata && Array.isArray(metadata.recipientAgentIds)
          ? {
              ...metadata,
              recipientAgentIds: metadata.recipientAgentIds.filter((id) =>
                common.includes(String(id)),
              ),
            }
          : row
      }),
  })
  if (
    common.length !== 2 ||
    !common.includes(left.subjectAgentId) ||
    stableContentHash(invariant(left)) !== stableContentHash(invariant(right))
  )
    return {
      status: 'unsupported' as const,
      blockers: ['换支援比较须保持共同主输出、另一成员、面板、事件及目标条件一致。'],
    }
  const leftResult = projectFixedEventSupportContribution32(left)
  const rightResult = projectFixedEventSupportContribution32(right)
  if (leftResult.status === 'unsupported' || rightResult.status === 'unsupported')
    return {
      status: 'unsupported' as const,
      blockers: [
        ...(leftResult.status === 'unsupported' ? leftResult.blockers : []),
        ...(rightResult.status === 'unsupported' ? rightResult.blockers : []),
      ],
    }
  return {
    status:
      leftResult.status === 'partial' || rightResult.status === 'partial'
        ? ('partial' as const)
        : ('supported' as const),
    left: leftResult,
    right: rightResult,
    fixedEventDelta: rightResult.fixedEventValue - leftResult.fixedEventValue,
    identity: stableContentHash({ left: leftResult.identity, right: rightResult.identity }),
    changes: {
      removed: left.memberIds.filter((id) => !common.includes(id)),
      added: right.memberIds.filter((id) => !common.includes(id)),
    },
    numericalStrengthAdjudication: false as const,
  }
}
