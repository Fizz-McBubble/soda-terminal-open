import type {
  AgentRule,
  BangbooRule,
  BangbooTeamObjective,
  PairSynergyKernel,
} from '../teamEngine/contracts'
import { evaluateTeamPredicate, type TeamContext } from '../teamEngine/teamMethodR1'

export type BangbooDamageCandidate = {
  bangbooId: string
  totalDamage: number | null
}

export type AuthoritativeBangbooRecommendation = {
  status: 'selected' | 'no_authoritative_recommendation'
  bangbooId: string | null
  rawDamageLeaderId: string | null
  teamObjective: BangbooTeamObjective
}

const objectiveBoundary =
  '先按游戏机制、激活条件、队伍组成与效果承接关系形成方案主选/替代项；具名攻略或社区阵容只提高 Evidence Confidence，不是 suitability 成立条件。该目标不读取账户库存，也不使用邦布直接伤害决定推荐。'

const objectiveBasis = [
  'game_mechanic',
  'activation',
  'team_composition',
  'effect_recipient_fit',
] as const
const maxBangbooRecommendations = 3

function unavailableObjective(
  evaluatedBangbooIds: string[],
  explanation: string,
): BangbooTeamObjective {
  return {
    contract: 'soda-bangboo-team-objective/v2',
    status: 'unsupported',
    basis: objectiveBasis,
    evidenceConfidence: 'insufficient',
    validationRole: 'confidence_only',
    primaryBangbooId: null,
    alternativeBangbooIds: [],
    evaluatedBangbooIds,
    explanation,
    boundary: objectiveBoundary,
  }
}

const agentRuleIndexCache = new WeakMap<readonly AgentRule[], Map<string, AgentRule>>()
const bangbooRuleIndexCache = new WeakMap<readonly BangbooRule[], Map<string, BangbooRule>>()

function indexedAgentRules(rules: readonly AgentRule[]) {
  const cached = agentRuleIndexCache.get(rules)
  if (cached) return cached
  const created = new Map(rules.map((rule) => [rule.agentId, rule]))
  agentRuleIndexCache.set(rules, created)
  return created
}

function indexedBangbooRules(rules: readonly BangbooRule[]) {
  const cached = bangbooRuleIndexCache.get(rules)
  if (cached) return cached
  const created = new Map(rules.map((rule) => [rule.bangbooId, rule]))
  bangbooRuleIndexCache.set(rules, created)
  return created
}

function appliesToFormation(kernel: PairSynergyKernel, memberIds: ReadonlySet<string>) {
  return (
    kernel.coreAgentIds.every((agentId) => memberIds.has(agentId)) &&
    kernel.eligibleThirdAgentIds.some((agentId) => memberIds.has(agentId))
  )
}

/**
 * Separates numeric fixed-event damage from a player-facing recommendation.
 * A Bangboo is recommendable only when its activation is modeled and true and
 * its mechanic-derived suitability matches the exact formation. Named guides or
 * community formations may raise confidence, but never create or veto suitability.
 */
export function selectAuthoritativeBangbooRecommendation(input: {
  memberIds: readonly [string, string, string]
  damageCandidates: readonly BangbooDamageCandidate[]
  agentRules: readonly AgentRule[]
  bangbooRules: readonly BangbooRule[]
  kernels: readonly PairSynergyKernel[]
}): AuthoritativeBangbooRecommendation {
  let rawDamageLeader: (BangbooDamageCandidate & { totalDamage: number }) | null = null
  for (const candidate of input.damageCandidates)
    if (
      candidate.totalDamage !== null &&
      (!rawDamageLeader ||
        candidate.totalDamage > rawDamageLeader.totalDamage ||
        (candidate.totalDamage === rawDamageLeader.totalDamage &&
          candidate.bangbooId.localeCompare(rawDamageLeader.bangbooId) < 0))
    )
      rawDamageLeader = candidate as BangbooDamageCandidate & { totalDamage: number }
  const rawDamageLeaderId = rawDamageLeader?.bangbooId ?? null
  const agentById = indexedAgentRules(input.agentRules)
  const agents = input.memberIds.flatMap((agentId) => {
    const rule = agentById.get(agentId)
    return rule ? [rule] : []
  })
  if (agents.length !== input.memberIds.length)
    return {
      status: 'no_authoritative_recommendation',
      bangbooId: null,
      rawDamageLeaderId,
      teamObjective: unavailableObjective(
        input.damageCandidates.map((candidate) => candidate.bangbooId),
        '队伍成员缺少 AgentRule，不能求值邦布团队目标。',
      ),
    }

  const producedTags = new Set(agents.flatMap((agent) => agent.produces))
  const context: TeamContext = { agents, producedTags, agentStateById: {} }
  const memberSet = new Set(input.memberIds)
  const applicableKernels = input.kernels.filter((kernel) => appliesToFormation(kernel, memberSet))
  const ruleById = indexedBangbooRules(input.bangbooRules)
  const eligible: Array<{
    candidate: BangbooDamageCandidate
    familyMatch: number
    scenarioMatch: number
  }> = []
  for (const candidate of input.damageCandidates) {
    const rule = ruleById.get(candidate.bangbooId)
    if (
      !rule ||
      rule.releaseState !== 'released' ||
      rule.activation.status !== 'modeled' ||
      !evaluateTeamPredicate(rule.activation.predicate, context) ||
      rule.suitability.status !== 'modeled'
    )
      continue
    const suitability = rule.suitability
    const familyMatch = applicableKernels.some((kernel) =>
      suitability.familyIds.includes(kernel.familyId),
    )
      ? 1
      : 0
    const scenarioMatch = Math.max(
      0,
      ...applicableKernels.map(
        (kernel) =>
          suitability.scenarioTags.filter((tag) => kernel.scenarioTags.includes(tag)).length,
      ),
    )
    if (familyMatch === 0 && scenarioMatch === 0) continue
    eligible.push({ candidate, familyMatch, scenarioMatch })
  }
  eligible.sort(
    (left, right) =>
      right.familyMatch - left.familyMatch ||
      right.scenarioMatch - left.scenarioMatch ||
      left.candidate.bangbooId.localeCompare(right.candidate.bangbooId),
  )
  const best = eligible[0]
  const tied = best
    ? eligible.filter(
        (item) =>
          item.familyMatch === best.familyMatch && item.scenarioMatch === best.scenarioMatch,
      )
    : []
  const selected = tied.length === 1 ? best!.candidate : null
  const selectedRule = selected ? ruleById.get(selected.bangbooId) : null
  const teamObjective: BangbooTeamObjective = {
    contract: 'soda-bangboo-team-objective/v2',
    status: selected ? 'supported' : 'partial',
    basis: objectiveBasis,
    evidenceConfidence:
      selectedRule?.suitability.status === 'modeled' &&
      (selectedRule.suitability.validationEvidence?.length ?? 0) > 0
        ? 'mechanic_plus_external_validation'
        : eligible.length > 0
          ? 'mechanic_derived'
          : 'insufficient',
    validationRole: 'confidence_only',
    primaryBangbooId: selected?.bangbooId ?? null,
    alternativeBangbooIds: eligible
      .map((item) => item.candidate.bangbooId)
      .filter((bangbooId) => bangbooId !== selected?.bangbooId)
      .slice(0, maxBangbooRecommendations - (selected ? 1 : 0)),
    evaluatedBangbooIds: input.damageCandidates
      .map((candidate) => candidate.bangbooId)
      .sort((left, right) => left.localeCompare(right)),
    explanation: selected
      ? '已按游戏机制、激活、队伍组成与效果承接形成唯一主选；外部阵容证据只增强置信度。'
      : '没有唯一的机制推导主选；保留适配候选，不以伤害值或外部攻略打破并列。',
    boundary: objectiveBoundary,
  }
  return selected
    ? {
        status: 'selected',
        bangbooId: selected.bangbooId,
        rawDamageLeaderId,
        teamObjective,
      }
    : {
        status: 'no_authoritative_recommendation',
        bangbooId: null,
        rawDamageLeaderId,
        teamObjective,
      }
}
