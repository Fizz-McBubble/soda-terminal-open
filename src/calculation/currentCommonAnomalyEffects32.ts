import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  evaluateUpstreamExpressionIr,
  createPlanningExpressionDomainRuntime,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import { commonAnomalyEffectIdentity32 } from './currentPlanningEffectResolutionIdentity32'
export { commonAnomalyEffectIdentity32 } from './currentPlanningEffectResolutionIdentity32'
export type CommonAnomalyEventObservation32 = {
  eventId: string
  windswept: boolean
  sourceRefs: readonly string[]
}
const windsweptExpression: UpstreamExpressionIR = {
  kind: 'call',
  operator: 'cmpGE',
  arguments: [
    { kind: 'reference', path: 'team.common.count.wind' },
    { kind: 'literal', value: 1 },
    {
      kind: 'call',
      operator: 'ifOn',
      receiver: { kind: 'reference', path: 'windswept' },
      arguments: [
        { kind: 'call', operator: 'percent', arguments: [{ kind: 'literal', value: 0.1 }] },
      ],
    },
  ],
}

/** One named event observation, no implied timeline, buildup or ownership. */
export function compileCommonAnomalyEventEffects32(input: {
  eventId: string
  memberIds: readonly string[]
  observations?: readonly CommonAnomalyEventObservation32[]
}) {
  const observations = input.observations ?? []
  if (
    observations.some(
      (row) =>
        row.eventId !== input.eventId ||
        typeof row.windswept !== 'boolean' ||
        !row.sourceRefs.length ||
        row.sourceRefs.some((ref) => !ref.trim()),
    )
  )
    return {
      status: 'unsupported' as const,
      blockers: ['Windswept需同一事件、明确状态及来源观察。'],
    }
  if (new Set(observations.map((row) => row.windswept)).size > 1)
    return { status: 'unsupported' as const, blockers: ['同事件Windswept观察冲突。'] }
  if (!observations.length)
    return {
      status: 'supported' as const,
      buckets: [] as SourceBackedPlanningEffectBucket[],
      observation: null,
    }
  const contracts = input.memberIds.map((id) => getCurrentAgentEventContract(id))
  if (
    contracts.some(
      (contract) => !contract || contract.source.commit !== commonAnomalyEffectIdentity32.commit,
    )
  )
    return { status: 'unsupported' as const, blockers: ['Windswept成员来源身份缺失。'] }
  const identities = contracts.map((contract) => contract!.identity)
  const result = evaluateUpstreamExpressionIr(
    windsweptExpression,
    createPlanningExpressionDomainRuntime({
      references: {
        'team.common.count.wind': identities.filter((identity) => identity?.attribute === 'wind')
          .length,
        windswept: observations[0]!.windswept,
      },
    }),
  )
  if (result.status !== 'supported') return result
  if (typeof result.value !== 'number' || !Number.isFinite(result.value))
    return { status: 'unsupported' as const, blockers: ['Windswept来源表达式数值无效。'] }
  const sourceRefs = [
    ...new Set([
      `${commonAnomalyEffectIdentity32.path}#${commonAnomalyEffectIdentity32.sha256}`,
      ...observations.flatMap((row) => row.sourceRefs),
    ]),
  ]
  const buckets: SourceBackedPlanningEffectBucket[] =
    result.value === 0
      ? []
      : [
          {
            bucketId: 'common:anomaly:windswept_direct_dmg_',
            effectKey: 'common:anomaly:windswept_direct_dmg_',
            providerAgentId: 'common:anomaly',
            recipientAgentIds: [...input.memberIds],
            receiverPath: 'teamBuff.combat.direct_dmg_',
            damageType: null,
            action: null,
            attribute: null,
            value: result.value,
            application: 'direct_damage_bonus',
            sourceRefs,
          },
        ]
  return { status: 'supported' as const, buckets, observation: observations[0]!.windswept }
}
