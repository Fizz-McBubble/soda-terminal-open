import { projectCommonMemberEquipmentRows } from './commonMemberEquipmentProjection'
import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'
import { calculateCurrentPlanningEventDamage32 } from './currentPlanningEventDamage32'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import { planningBaselineSchema, type PlanningBaseline } from './planningDpsContract'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { isReviewedTemplateMechanicEffect32 } from './reviewedTemplateMechanicEffects32'
import { isDamageFormula32Version } from './sharpDamageCore'
import { fixedEventPacketDependencies32 } from './fixedEventPacketDependencies32'
import {
  bindReviewedAnomalyPartyState32,
  reviewedTargetEffectSnapshotSchema32,
  type ReviewedTargetEffectSnapshot32,
} from './reviewedAnomalyPartyState32'

export type FixedEventSupportInput32 = {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  subjectAgentId: string
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  /** Actual packet target/time, independently declared from provider preview metadata. */
  eventObservation?: ReviewedTargetEffectSnapshot32
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** Per-recipient, per-event evidence; never inferred from another actor. */
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
  equipmentModifierBuckets: readonly SourceBackedPlanningEffectBucket[]
  equipmentEffectExclusions: readonly unknown[]
}

// Counterfactuals preserve formation membership and disable the named source in
// entries, buckets and the event-final dependency graph, including Trigger M2.
const counterfactualProviders = new Set([
  'agent-sunna',
  'agent-zhao',
  'agent-astra',
  'agent-yuzuha',
  'agent-lucy',
  'agent-nicole',
  'agent-trigger',
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
  if (input.eventObservation !== undefined) {
    if (!reviewedTargetEffectSnapshotSchema32.safeParse(input.eventObservation).success)
      return 'fixed_event_observation_invalid32'
    if (input.eventObservation.targetId !== input.baseline.enemy.id)
      return 'fixed_event_observation_target_mismatch32'
  }
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
    Object.entries(input.potentialEvents ?? {}).some(
      ([key, observation]) =>
        !input.eventUsages.some(
          (usage) =>
            key === `${usage.ownerAgentId}:${usage.eventId}` &&
            observation.eventId === usage.eventId,
        ) ||
        !Array.isArray(observation.sourceRefs) ||
        observation.sourceRefs.length === 0 ||
        observation.sourceRefs.some((ref) => typeof ref !== 'string' || !ref.trim()),
    )
  )
    return 'fixed_event_potential_observation_mismatch32'
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
  let baselineReferencesByAgentId = input.baselineReferencesByAgentId
  if (input.eventObservation !== undefined) {
    const references: Record<string, Readonly<Record<string, unknown>>> = {
      ...baselineReferencesByAgentId,
    }
    for (const member of input.members) {
      const bound = bindReviewedAnomalyPartyState32({
        providerAgentId: member.agentId,
        references: references[member.agentId],
        snapshot: input.eventObservation,
      })
      if (bound.status !== 'supported') return bound
      references[member.agentId] = bound.references
    }
    baselineReferencesByAgentId = references
  }
  const subject = input.members.find((row) => row.agentId === input.subjectAgentId)!
  const dependencies = fixedEventPacketDependencies32({ ...input, baselineReferencesByAgentId })
  if (dependencies.status === 'unsupported') return dependencies
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
        baselineReferencesByAgentId,
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
      potentialEvents: input.potentialEvents,
      baseline: input.baseline,
      settlementAtSeconds: input.eventObservation?.atSeconds,
      diagnosticBlockers: blockers,
      eventEffectContext: {
        memberIds: input.memberIds,
        members: input.members,
        entries,
        baselineReferencesByAgentId,
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
    potentialEvents: input.potentialEvents ?? {},
    baseline: input.baseline,
    eventObservation: input.eventObservation ?? null,
    members: input.members
      .filter((row) => common.includes(row.agentId))
      .sort((a, b) => a.agentId.localeCompare(b.agentId)),
    references: Object.fromEntries(
      common.sort().map((id) => [id, input.baselineReferencesByAgentId?.[id] ?? {}]),
    ),
    equipment: projectCommonMemberEquipmentRows(
      input.equipmentModifierBuckets.filter((row) => common.includes(row.providerAgentId)),
      input.memberIds,
      common,
    ),
    equipmentExclusions: projectCommonMemberEquipmentRows(
      input.equipmentEffectExclusions.filter((row) => {
        const owner = equipmentOwner(row)
        return !owner || common.includes(owner)
      }),
      input.memberIds,
      common,
    ),
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
