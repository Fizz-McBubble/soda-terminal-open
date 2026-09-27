import { stableContentHash } from '../gameDataPacks/types'
import type { AgentRule } from '../teamEngine/contracts'
import type {
  BenchmarkEvidence,
  DecisionEvidence,
  HardPruneDecision,
  TeamFeatureBand,
  UnsupportedDecisionIssue,
} from './teamDecisionAuthority'
import type { TeamFeatureExtractionSignals } from './teamFeatureSignalsSchema'

export type TeamFeatureSignalProjectionInput = {
  candidateId: string
  memberIds: readonly [string, string, string]
  bangbooId: string | null
  agentRules: readonly AgentRule[]
  mechanicState: {
    ruleComplete: boolean
    fieldTimeWithinBudget: boolean
    resourceLoopClosed: boolean
    activationAtBase: boolean
    observedPartnerRelationForEveryMember: boolean
    observedSourceBackedTeamFamily: boolean
  }
  outputPotentialBand: TeamFeatureBand
  benchmark: BenchmarkEvidence
  unsupportedIssues?: readonly UnsupportedDecisionIssue[]
  hardPrunes?: readonly HardPruneDecision[]
  additionalEvidence?: readonly DecisionEvidence[]
}

type RuleSignalSnapshot = {
  agentId: string
  specialty: AgentRule['specialty']
  attribute: AgentRule['attribute']
  evidence: DecisionEvidence[]
  effectRecipientCounts: Record<'self' | 'active_agent' | 'team' | 'enemy', number>
}

const agentRuleIndexCache = new WeakMap<
  readonly AgentRule[],
  { agentIds: string[]; rules: AgentRule[]; index: Map<string, AgentRule> }
>()
const agentRuleSignalsCache = new WeakMap<
  AgentRule,
  { signature: string; snapshot: RuleSignalSnapshot }
>()

function agentRuleIndex(agentRules: readonly AgentRule[]) {
  const cached = agentRuleIndexCache.get(agentRules)
  if (
    cached &&
    cached.rules.length === agentRules.length &&
    cached.rules.every(
      (rule, index) => rule === agentRules[index] && cached.agentIds[index] === rule.agentId,
    )
  )
    return cached.index
  const created = new Map(agentRules.map((rule) => [rule.agentId, rule]))
  agentRuleIndexCache.set(agentRules, {
    agentIds: agentRules.map((rule) => rule.agentId),
    rules: [...agentRules],
    index: created,
  })
  return created
}

function agentRuleSignals(rule: AgentRule) {
  const signature = stableContentHash({
    agentId: rule.agentId,
    evidence: rule.evidence,
    effects: rule.effects,
  })
  const cached = agentRuleSignalsCache.get(rule)
  if (cached?.signature === signature) return cached.snapshot
  const effectRecipientCounts = { self: 0, active_agent: 0, team: 0, enemy: 0 }
  for (const effect of rule.effects) effectRecipientCounts[effect.recipient] += 1
  const snapshot = {
    agentId: rule.agentId,
    specialty: rule.specialty,
    attribute: rule.attribute,
    evidence: rule.evidence.map((reference) => ({
      evidenceId: `agent-rule:${rule.agentId}:${reference.sourceId}`,
      provenance: 'source_fact' as const,
      reference: reference.locator,
      explanation: `${rule.agentId} 的 current AgentRule 来源。`,
      contentHash: stableContentHash(reference),
    })),
    effectRecipientCounts,
  }
  agentRuleSignalsCache.set(rule, { signature, snapshot })
  return snapshot
}

function projectWithSnapshots(
  input: Omit<TeamFeatureSignalProjectionInput, 'agentRules'>,
  snapshotsById: ReadonlyMap<string, RuleSignalSnapshot>,
): TeamFeatureExtractionSignals {
  const rules = input.memberIds.flatMap((agentId) => {
    const snapshot = snapshotsById.get(agentId)
    return snapshot ? [snapshot] : []
  })
  const evidence: DecisionEvidence[] = rules.flatMap((rule) =>
    rule.evidence.map((item) => ({ ...item })),
  )
  const uniqueEvidence = [
    ...new Map(
      [...evidence, ...(input.additionalEvidence ?? []).map((item) => ({ ...item }))].map(
        (item) => [item.evidenceId, item] as const,
      ),
    ).values(),
  ]
  const effectRecipientCounts = { self: 0, active_agent: 0, team: 0, enemy: 0 }
  for (const rule of rules) {
    effectRecipientCounts.self += rule.effectRecipientCounts.self
    effectRecipientCounts.active_agent += rule.effectRecipientCounts.active_agent
    effectRecipientCounts.team += rule.effectRecipientCounts.team
    effectRecipientCounts.enemy += rule.effectRecipientCounts.enemy
  }
  return {
    candidateId: input.candidateId,
    memberIds: [...input.memberIds],
    bangbooId: input.bangbooId,
    rulesComplete: input.mechanicState.ruleComplete && rules.length === input.memberIds.length,
    fieldTimeWithinBudget: input.mechanicState.fieldTimeWithinBudget,
    resourceLoopClosed: input.mechanicState.resourceLoopClosed,
    activationAtBase: input.mechanicState.activationAtBase,
    observedPartnerRelationCount: input.mechanicState.observedSourceBackedTeamFamily
      ? 3
      : input.mechanicState.observedPartnerRelationForEveryMember
        ? 2
        : 0,
    effectRecipientCounts,
    distinctSpecialtyCount: new Set(rules.map((rule) => rule.specialty)).size,
    distinctAttributeCount: new Set(rules.map((rule) => rule.attribute)).size,
    outputPotentialBand: input.outputPotentialBand,
    benchmark: input.benchmark,
    evidence: uniqueEvidence,
    unsupportedIssues: [...(input.unsupportedIssues ?? [])],
    hardPrunes: [...(input.hardPrunes ?? [])],
  }
}

export function projectAgentRulesToTeamFeatureSignals(input: TeamFeatureSignalProjectionInput) {
  const rulesById = agentRuleIndex(input.agentRules)
  const snapshotsById = new Map(
    [...rulesById].map(([agentId, rule]) => [agentId, agentRuleSignals(rule)] as const),
  )
  return projectWithSnapshots(input, snapshotsById)
}
