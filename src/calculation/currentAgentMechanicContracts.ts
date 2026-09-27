import agentMechanicCatalog from '../gameDataPacks/generated/current-agent-mechanic-catalog.v1.json'
import { agentCatalog } from '../assault/catalogData'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'
import { resolveSourceBoundAdditionalAbility } from '../gameDataPacks/reviewedSourceBoundAdditionalAbility'
import {
  reviewedTeammateActivationMinimum,
  reviewedTeammateActivationTerms,
} from '../gameDataPacks/reviewedTeammateActivationMinimum'

export type AgentEventOperator =
  | {
      kind: 'linear_skill_level'
      base: number
      growthPerLevel: number
      minimumLevel: number
      maximumLevel: number
    }
  | { kind: 'constant'; value: number }

export type CurrentAgentEventContract = (typeof agentMechanicCatalog.items)[number] & {
  stableId: string
}

export type AgentTeamActivationTerm = {
  kind: 'attribute' | 'specialty' | 'faction'
  value: string
}

export type AgentTeamActivationDynamicTerm =
  | {
      kind: 'self_state_minimum'
      field: 'mindscape'
      minimum: number
      contribution: number
    }
  | {
      kind: 'other_member_capability'
      capability: 'defensive_assist'
      contribution: number
    }

export type AgentTeamActivationPredicate = {
  kind: 'category_sum_minimum'
  terms: AgentTeamActivationTerm[]
  minimum: number
  dynamicTerms: AgentTeamActivationDynamicTerm[]
  evaluationBoundary: 'base_mindscape_static_team_identity' | 'team_identity_and_account_state'
  locator: string
  normalizedFrom: 'active_at_minimum' | 'inactive_when_below_minimum'
}

const stableIdByExternalId = new Map<string, string>([
  ...agentCatalog.map(([stableId, , , externalId]) => [externalId, stableId] as const),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.stableId.startsWith('agent-'))
    .map((entry) => [entry.gameEvidenceId, entry.stableId] as const),
])

export const currentAgentEventContracts: readonly CurrentAgentEventContract[] = Object.freeze(
  agentMechanicCatalog.items.map((item) => {
    const stableId = stableIdByExternalId.get(item.externalId)
    if (!stableId) throw new Error(`角色机制目录无法解析 current stable id：${item.externalId}`)
    return { ...item, stableId }
  }),
)

const contractByStableId = new Map(
  currentAgentEventContracts.map((contract) => [contract.stableId, contract]),
)

if (contractByStableId.size !== currentAgentEventContracts.length)
  throw new Error('角色机制目录存在重复 current stable id')

export function getCurrentAgentEventContract(stableId: string) {
  return contractByStableId.get(stableId) ?? null
}

/**
 * Upstream count predicates include the owner in their threshold. Product
 * activation is phrased as "another teammate", so remove the owner's static
 * contribution before evaluating the remaining, unordered team members.
 */
export function resolveOtherMemberActivationMinimum(
  stableId: string,
  predicate: AgentTeamActivationPredicate,
) {
  const contract = getCurrentAgentEventContract(stableId)
  if (!contract) throw new Error(`角色机制合同不存在：${stableId}`)
  const reviewedMinimum = reviewedTeammateActivationMinimum(stableId, predicate.minimum)
  const selfContribution = predicate.terms.filter(
    (term) => contract.identity[term.kind] === term.value,
  ).length
  const minimum = reviewedMinimum - selfContribution
  if (minimum < 1)
    throw new Error(
      `追加能力不能由角色自身激活：${stableId} (${reviewedMinimum}-${selfContribution})`,
    )
  return minimum
}

export function evaluateAgentEventOperator(operator: AgentEventOperator, skillLevel: number) {
  if (!Number.isInteger(skillLevel))
    return { status: 'unsupported' as const, blockers: ['技能等级必须是整数。'] }
  if (operator.kind === 'constant') return { status: 'supported' as const, value: operator.value }
  if (skillLevel < operator.minimumLevel || skillLevel > operator.maximumLevel)
    return {
      status: 'unsupported' as const,
      blockers: [
        `技能等级 ${skillLevel} 超出来源合同 ${operator.minimumLevel}-${operator.maximumLevel}。`,
      ],
    }
  return {
    status: 'supported' as const,
    value: operator.base + operator.growthPerLevel * (skillLevel - 1),
  }
}

export function resolveCurrentAgentEvent(input: {
  stableId: string
  eventId: string
  skillLevel: number
}) {
  const contract = getCurrentAgentEventContract(input.stableId)
  if (!contract)
    return { status: 'unsupported' as const, blockers: [`角色机制合同不存在：${input.stableId}`] }
  const event = contract.eventContract.events.find(
    (candidate) => candidate.eventId === input.eventId,
  )
  if (!event)
    return {
      status: 'unsupported' as const,
      blockers: [`角色事件不存在：${input.stableId}:${input.eventId}`],
    }
  const damageMultiplier = evaluateAgentEventOperator(
    event.operators.damageMultiplier as AgentEventOperator,
    input.skillLevel,
  )
  const dazeMultiplier = evaluateAgentEventOperator(
    event.operators.dazeMultiplier as AgentEventOperator,
    input.skillLevel,
  )
  const anomalyBuildup = evaluateAgentEventOperator(
    event.operators.anomalyBuildup as AgentEventOperator,
    input.skillLevel,
  )
  if (
    damageMultiplier.status === 'unsupported' ||
    dazeMultiplier.status === 'unsupported' ||
    anomalyBuildup.status === 'unsupported'
  )
    return {
      status: 'unsupported' as const,
      blockers: [
        ...(damageMultiplier.status === 'unsupported' ? damageMultiplier.blockers : []),
        ...(dazeMultiplier.status === 'unsupported' ? dazeMultiplier.blockers : []),
        ...(anomalyBuildup.status === 'unsupported' ? anomalyBuildup.blockers : []),
      ],
    }
  return {
    status: 'supported' as const,
    stableId: input.stableId,
    eventId: input.eventId,
    skillLevel: input.skillLevel,
    damageMultiplier: damageMultiplier.value,
    dazeMultiplier: dazeMultiplier.value,
    anomalyBuildup: anomalyBuildup.value,
    source: contract.source,
  }
}

export function evaluateCurrentAgentTeamActivation(input: {
  stableId: string
  memberIds: readonly string[]
  agentState?: { mindscape?: number }
}) {
  const contract = getCurrentAgentEventContract(input.stableId)
  if (!contract)
    return { status: 'unsupported' as const, blockers: [`角色机制合同不存在：${input.stableId}`] }
  const activation = contract.teamActivationContract
  const sourceBoundPredicate = resolveSourceBoundAdditionalAbility(
    input.stableId,
    contract.identity,
    'attack',
  )
  if (!sourceBoundPredicate && (activation.status !== 'compiled' || !activation.predicate))
    return {
      status: 'unsupported' as const,
      blockers: [
        activation.status === 'dynamic_context_pending'
          ? `队伍触发条件仍依赖未编译动态上下文。`
          : activation.reason,
      ],
      source: contract.source,
    }
  const members = input.memberIds.map((memberId) => getCurrentAgentEventContract(memberId))
  const missingMemberIds = input.memberIds.filter((_, index) => !members[index])
  if (missingMemberIds.length)
    return {
      status: 'unsupported' as const,
      blockers: [`队伍成员机制合同不存在：${missingMemberIds.join(', ')}`],
      source: contract.source,
    }
  const sourcePredicate = activation.predicate as AgentTeamActivationPredicate | null
  const predicate = sourceBoundPredicate ?? {
    ...sourcePredicate!,
    terms: reviewedTeammateActivationTerms(input.stableId, sourcePredicate!.terms),
    minimum: resolveOtherMemberActivationMinimum(input.stableId, sourcePredicate!),
  }
  const uniqueOtherMembers = [
    ...new Map(
      members
        .filter((member) => member?.stableId !== input.stableId)
        .map((member) => [member!.stableId, member!] as const),
    ).values(),
  ]
  // Source terms are alternatives. A teammate that matches multiple terms is
  // still one qualifying teammate, and source/member order cannot change it.
  const categoryContribution = uniqueOtherMembers.filter((member) =>
    predicate.terms.some((term) => member.identity[term.kind] === term.value),
  ).length
  let dynamicContribution = 0
  for (const term of predicate.dynamicTerms) {
    if (term.kind === 'self_state_minimum') {
      const value = input.agentState?.[term.field]
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
        return {
          status: 'unsupported' as const,
          blockers: [`队伍触发求值缺少有效角色状态：${term.field}`],
          source: contract.source,
        }
      if (value >= term.minimum) dynamicContribution += term.contribution
      continue
    }
    const hasCapability = uniqueOtherMembers.some((member) =>
      member.eventContract.events.some(
        (event) =>
          term.capability === 'defensive_assist' &&
          event.skill === 'assist' &&
          event.actionId.startsWith('DefensiveAssist'),
      ),
    )
    if (hasCapability) dynamicContribution += term.contribution
  }
  const categorySum = categoryContribution + dynamicContribution
  return {
    status: 'supported' as const,
    active: categorySum >= predicate.minimum,
    categorySum,
    categoryContribution,
    dynamicContribution,
    predicate,
    activationProvenance: sourceBoundPredicate
      ? 'reviewed_source_bound_additional_ability_12'
      : 'compiled_raw_formula',
    rawFormulaStatus: activation.status,
    source: contract.source,
  }
}
