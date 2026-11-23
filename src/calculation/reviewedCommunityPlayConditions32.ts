import {
  currentAgentPlanningEffectBlueprints,
  type CurrentAgentPlanningEffectBlueprint,
} from './currentAgentPlanningEffectBlueprint'
import {
  planningObservedReferences32,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectDomain'
import { effectReceiverMetadata, requiredReferences } from './currentPlanningEffectExpressions'
import {
  recipientIds,
  type SourceBackedPlanningEffectBucket,
} from './currentPlanningDamageModifiers'
import { evaluateCurrentPlanningEffectEntries32 } from './currentPlanningEffectRuntime'
import { planningRuntimeEffectBuckets32 } from './currentPlanningSelfEffects32'

type ObservedFlag = boolean | null | undefined
type References = Readonly<Record<string, Readonly<Record<string, unknown>>>>

export type ReviewedCommunityPlayConditions32 = {
  memberIds: readonly string[]
  baselineReferencesByAgentId?: References
  soukaku?: {
    flyTheFlag: ObservedFlag
    vortexConsumed: ObservedFlag
    recipientAgentId: string | null
  }
  seth?: { shieldActive: ObservedFlag; recipientAgentId: string | null }
  lucy?: { cheerOn: ObservedFlag }
}

export type ReviewedCommunityPlayBinding32 = {
  status: 'supported'
  memberIds: readonly string[]
  observationScope: 'explicit_state_and_recipient_no_duration_or_frequency'
  baselineReferencesByAgentId: Record<string, Record<string, unknown>>
  effectEntries: CurrentAgentPlanningEffectBlueprint[]
  bindings: Array<{
    effectKey: string
    providerAgentId: string
    status: 'active' | 'inactive' | 'unknown'
    recipientAgentIds: string[]
    missing: string[]
    observedFlags: Record<string, ObservedFlag>
    declaredRecipientAgentId: string | null
    expressionSha256: string
    sourceRefs: string[]
  }>
}

const definitions = [
  {
    providerAgentId: 'agent-soukaku',
    effectKey: 'agent-soukaku:core_atk',
    keys: ['flyTheFlag', 'vortexConsumed'],
  },
  {
    providerAgentId: 'agent-seth',
    effectKey: 'agent-seth:core_anomProf',
    keys: ['shield_active'],
  },
  { providerAgentId: 'agent-lucy', effectKey: 'agent-lucy:exSpecial_atk', keys: ['cheerOn'] },
] as const

/** Bind declared observations to existing source expressions. A shield flag is
 * only a shield/AP state observation: no shield amount, hand-off action,
 * uptime, resource supply or rotation is inferred here. */
export function bindReviewedCommunityPlayConditions32(
  input: ReviewedCommunityPlayConditions32,
): ReviewedCommunityPlayBinding32 | { status: 'unsupported'; blockers: string[] } {
  const { memberIds } = input
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3)
    return { status: 'unsupported', blockers: ['玩法条件需要唯一的精确三人成员。'] }
  if (
    Object.keys(input.baselineReferencesByAgentId ?? {}).some((id) => !memberIds.includes(id)) ||
    (input.soukaku && !memberIds.includes('agent-soukaku')) ||
    (input.seth && !memberIds.includes('agent-seth')) ||
    (input.lucy && !memberIds.includes('agent-lucy'))
  )
    return { status: 'unsupported', blockers: ['玩法条件提供者或原引用不属于当前三人。'] }
  const baselineReferencesByAgentId = Object.fromEntries(
    Object.entries(input.baselineReferencesByAgentId ?? {}).map(([id, refs]) => [id, { ...refs }]),
  )
  const selections = [
    {
      flags: {
        flyTheFlag: input.soukaku?.flyTheFlag,
        vortexConsumed: input.soukaku?.vortexConsumed,
      },
      recipient: input.soukaku?.recipientAgentId,
      team: false,
    },
    {
      flags: { shield_active: input.seth?.shieldActive },
      recipient: input.seth?.recipientAgentId,
      team: false,
    },
    { flags: { cheerOn: input.lucy?.cheerOn }, recipient: null, team: true },
  ]
  const effectEntries: CurrentAgentPlanningEffectBlueprint[] = []
  const bindings: ReviewedCommunityPlayBinding32['bindings'] = []
  for (const [index, definition] of definitions.entries()) {
    if (!memberIds.includes(definition.providerAgentId)) continue
    const selection = selections[index]!
    const flags: Record<string, ObservedFlag> = selection.flags
    if (Object.values(flags).some((flag) => flag != null && typeof flag !== 'boolean'))
      return { status: 'unsupported', blockers: ['玩法开关只能明确为开、关或未知。'] }
    const entry = currentAgentPlanningEffectBlueprints.find(
      (row) => row.effectKey === definition.effectKey,
    )
    if (
      !entry ||
      entry.numericExpression.sourceStatus !== 'upstream_expression_available' ||
      entry.numericExpression.todoBoundary !== null ||
      !definition.keys.every((key) =>
        requiredReferences(entry.numericExpression.expressionIr).includes(key),
      )
    )
      return { status: 'unsupported', blockers: [`既有玩法蓝图不再匹配：${definition.effectKey}`] }
    const refs = { ...baselineReferencesByAgentId[definition.providerAgentId] }
    // A newer unknown/off observation must not inherit an older active flag.
    for (const key of definition.keys) delete refs[key]
    baselineReferencesByAgentId[definition.providerAgentId] = {
      ...refs,
      ...planningObservedReferences32(flags),
    }
    const metadata = effectReceiverMetadata(entry.numericExpression.expressionIr)
    const allowed = recipientIds({
      targetKinds: entry.targetKinds,
      providerAgentId: definition.providerAgentId,
      memberIds,
      effectKey: entry.effectKey,
      receiverPath: metadata.receiverPath,
    })
    if (selection.recipient != null && !allowed.includes(selection.recipient))
      return { status: 'unsupported', blockers: ['玩法增益接受者必须属于既有蓝图的当前队伍范围。'] }
    const active = flags[definition.keys[0]]
    const missing: string[] =
      active === false ? [] : definition.keys.filter((key) => typeof flags[key] !== 'boolean')
    if (active !== false && !selection.team && !selection.recipient)
      missing.push('recipientAgentId')
    const status = active === false ? 'inactive' : missing.length ? 'unknown' : 'active'
    bindings.push({
      effectKey: definition.effectKey,
      providerAgentId: definition.providerAgentId,
      status,
      recipientAgentIds:
        status !== 'active' ? [] : selection.team ? allowed : [selection.recipient!],
      missing,
      observedFlags: { ...flags },
      declaredRecipientAgentId: selection.recipient ?? null,
      expressionSha256: entry.numericExpression.expressionSha256,
      sourceRefs: [...entry.sourceRefs],
    })
    effectEntries.push(entry)
  }
  return {
    status: 'supported',
    memberIds: [...memberIds],
    observationScope: 'explicit_state_and_recipient_no_duration_or_frequency',
    baselineReferencesByAgentId,
    effectEntries,
    bindings,
  }
}

/** Required after the existing expression/bucket parser: its generic `team`
 * metadata cannot identify a declared single hand-off recipient. Preserve all
 * source values; narrow only these three audited effects and keep unrelated
 * effects unchanged. Unknown/off bindings cannot leak an active bucket. */
export function bindReviewedCommunityPlayRecipients32(input: {
  binding: ReviewedCommunityPlayBinding32
  buckets: readonly SourceBackedPlanningEffectBucket[]
}): SourceBackedPlanningEffectBucket[] {
  const byKey = new Map(input.binding.bindings.map((binding) => [binding.effectKey, binding]))
  return input.buckets.flatMap((bucket) => {
    const binding = byKey.get(bucket.effectKey)
    if (!binding) return [bucket]
    if (binding.status !== 'active' || bucket.providerAgentId !== binding.providerAgentId) return []
    const recipients = bucket.recipientAgentIds.filter((id) =>
      binding.recipientAgentIds.includes(id),
    )
    return recipients.length ? [{ ...bucket, recipientAgentIds: recipients }] : []
  })
}

/** Public finite consumer for an explicit gameplay-state input and the real
 * equipped runtime members. The existing expression evaluator supplies every
 * value; the recipient adapter only narrows the resulting source buckets. */
export function evaluateReviewedCommunityPlayEffects32(
  input: ReviewedCommunityPlayConditions32 & { members: readonly PlanningEffectRuntimeMember[] },
) {
  if (
    input.members.length !== input.memberIds.length ||
    new Set(input.members.map((member) => member.agentId)).size !== input.members.length ||
    input.members.some((member) => !input.memberIds.includes(member.agentId))
  )
    return { status: 'unsupported' as const, blockers: ['玩法条件与实际装备成员身份不一致。'] }
  const binding = bindReviewedCommunityPlayConditions32(input)
  if (binding.status !== 'supported') return binding
  const runtime = evaluateCurrentPlanningEffectEntries32(
    {
      memberIds: input.memberIds,
      members: input.members,
      baselineReferencesByAgentId: binding.baselineReferencesByAgentId,
    },
    binding.effectEntries,
  )
  if (runtime.status !== 'supported') return runtime
  const buckets = bindReviewedCommunityPlayRecipients32({
    binding,
    buckets: planningRuntimeEffectBuckets32(runtime.results, input.memberIds),
  })
  return {
    status: 'supported' as const,
    binding,
    baselineReferencesByAgentId: binding.baselineReferencesByAgentId,
    effectResults: runtime.results,
    buckets,
  }
}
