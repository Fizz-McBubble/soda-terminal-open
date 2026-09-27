import {
  createReviewedTeamDeploymentEvidenceIndex,
  type ReviewedTeamDeploymentEvidence,
} from './reviewedTeamDeploymentEvidence'
import {
  currentTeamDeploymentMechanicEvidence,
  type TeamDeploymentMechanicEvidence,
} from './teamDeploymentMechanicEvidence'
import {
  isTeamDeploymentOrder,
  type TeamDeploymentOrder,
} from '../application/publicTeamDeploymentOrder'

export { isTeamDeploymentOrder }
export type { TeamDeploymentOrder }

type DeploymentRule = ReviewedTeamDeploymentEvidence['rules'][number]
export type TeamDeploymentPlan = {
  orderedMemberIds: TeamDeploymentOrder
  starterAgentId: string | null
  status: 'recommended' | 'flexible' | 'custom' | 'unknown' | 'conflict'
  equivalentOrders: TeamDeploymentOrder[]
  openingReason: string | null
  handoffReasons: string[]
}

let evidenceIndex: ReturnType<typeof createReviewedTeamDeploymentEvidenceIndex> | undefined

function permutations([a, b, c]: TeamDeploymentOrder): TeamDeploymentOrder[] {
  return [
    [a, b, c],
    [a, c, b],
    [b, a, c],
    [b, c, a],
    [c, a, b],
    [c, b, a],
  ]
}

function satisfies(order: TeamDeploymentOrder, rule: DeploymentRule) {
  if (rule.kind === 'starter') return order[0] === rule.agentId
  if (rule.kind === 'slot') return order[rule.slot - 1] === rule.agentId
  const start = order.indexOf(rule.orderedMemberIds[0])
  return rule.orderedMemberIds.every((id, index) => order[(start + index) % 3] === id)
}

/** Position is separate from formation identity and warehouse allocation priority. */
export function recommendTeamDeployment(input: {
  memberIds: readonly string[]
  customOrder?: readonly string[]
  evidence?: ReviewedTeamDeploymentEvidence | null
  mechanics?: TeamDeploymentMechanicEvidence | null
}): TeamDeploymentPlan {
  if (!isTeamDeploymentOrder(input.memberIds, input.memberIds))
    throw new Error('站位需要三名不同的代理人。')
  const original: TeamDeploymentOrder = [...input.memberIds]
  if (isTeamDeploymentOrder(input.customOrder, original))
    return {
      orderedMemberIds: [...input.customOrder],
      starterAgentId: input.customOrder[0],
      status: 'custom',
      equivalentOrders: [[...input.customOrder]],
      openingReason: null,
      handoffReasons: [],
    }
  if (input.evidence === undefined) evidenceIndex ??= createReviewedTeamDeploymentEvidenceIndex()
  const evidence = input.evidence === undefined ? evidenceIndex!.lookup(original) : input.evidence
  const mechanics =
    input.mechanics === undefined
      ? currentTeamDeploymentMechanicEvidence(original)
      : input.mechanics
  const rules =
    evidence && isTeamDeploymentOrder(evidence.memberIds, original) ? evidence.rules : []
  if (!rules.length && !mechanics?.agents.length)
    return {
      orderedMemberIds: original,
      starterAgentId: null,
      status: 'unknown',
      equivalentOrders: [],
      openingReason: null,
      handoffReasons: [],
    }
  const required = rules.filter((rule) => rule.strength === 'required')
  const compatible = permutations(original).filter((order) =>
    required.every((rule) => satisfies(order, rule)),
  )
  if (!compatible.length)
    return {
      orderedMemberIds: original,
      starterAgentId: null,
      status: 'conflict',
      equivalentOrders: [],
      openingReason: null,
      handoffReasons: [],
    }
  const matches = (order: TeamDeploymentOrder, retained: boolean) =>
    rules.filter(
      (rule) =>
        rule.strength === 'preferred' &&
        (rule.basis === 'retained') === retained &&
        satisfies(order, rule),
    ).length
  const bestCurrent = Math.max(...compatible.map((order) => matches(order, false)))
  const currentPreferred = compatible.filter((order) => matches(order, false) === bestCurrent)
  const matchedEdges = (order: TeamDeploymentOrder) =>
    (mechanics?.ringEdges ?? []).filter(
      (edge) => order[(order.indexOf(edge.fromAgentId) + 1) % 3] === edge.toAgentId,
    )
  // Multiple possible receivers from one skill are alternatives, not extra votes.
  const edgeCount = (order: TeamDeploymentOrder) =>
    new Set(matchedEdges(order).map((edge) => edge.triggerAgentId)).size
  const bestEdges = Math.max(...currentPreferred.map(edgeCount))
  const mechanicPreferred = currentPreferred.filter((order) => edgeCount(order) === bestEdges)
  const bestRetained = Math.max(...mechanicPreferred.map((order) => matches(order, true)))
  const best = mechanicPreferred.filter((order) => matches(order, true) === bestRetained)
  const starterRank = (order: TeamDeploymentOrder) =>
    Math.max(
      0,
      ...(mechanics?.starterTendencies ?? [])
        .filter((item) => item.agentId === order[0])
        .map((item) => (item.kind === 'stun_first' ? 3 : item.kind === 'setup_first' ? 2 : 1)),
    )
  const bestStarter = Math.max(...best.map(starterRank))
  const openingPreferred = best.filter((order) => starterRank(order) === bestStarter)
  const anchorRule = [...rules]
    .sort((left, right) => Number(left.basis === 'retained') - Number(right.basis === 'retained'))
    .find((rule) => rule.kind === 'cyclic_order')
  const anchor = anchorRule?.kind === 'cyclic_order' ? anchorRule.orderedMemberIds[0] : undefined
  const selected =
    openingPreferred.find((order) => order[0] === anchor) ??
    openingPreferred.toSorted((left, right) => left.join('|').localeCompare(right.join('|')))[0]!
  const explicitOpening = rules.some(
    (rule) =>
      (rule.kind === 'starter' || (rule.kind === 'slot' && rule.slot === 1)) &&
      satisfies(selected, rule),
  )
  return {
    orderedMemberIds: [...selected],
    starterAgentId: explicitOpening || bestStarter > 0 ? selected[0] : null,
    status: openingPreferred.length === 1 ? 'recommended' : 'flexible',
    equivalentOrders: best.map((order) => [...order]),
    openingReason:
      mechanics?.starterTendencies.find((item) => item.agentId === selected[0])?.reason ?? null,
    handoffReasons: [...new Set(matchedEdges(selected).map((edge) => edge.reason))],
  }
}

export function orderTeamMembers<T>(
  members: readonly T[],
  memberId: (member: T) => string,
  order?: readonly string[],
) {
  const ids = members.map(memberId)
  if (!isTeamDeploymentOrder(ids, ids)) return [...members]
  const deployment = recommendTeamDeployment({ memberIds: ids, customOrder: order })
  const byId = new Map(members.map((member) => [memberId(member), member]))
  return deployment.orderedMemberIds.map((id) => byId.get(id)!)
}
