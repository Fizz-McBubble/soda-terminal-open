import { driveDiscData } from '../data/gameData'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { sourcedFunctionalMains } from './absoluteDiscRetentionFunctions'
import { retentionCondition } from './absoluteDiscRetentionConditions'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'
import { resolveRetentionQualityWeights } from './absoluteDiscRetentionWeights'
import type {
  Applicability,
  Profile,
  RetentionBranchSetPlan,
  UtilityEvidence,
} from './absoluteDiscRetentionContract'

export function retentionConstraintSources(constraint: CandidateWarehouseConstraint) {
  return constraint.sources
    .filter((source) => source.verified)
    .map((source) => `${source.id}:${source.contentHash}`)
}

function applicability(evidence: UtilityEvidence): Applicability {
  return evidence.state === 'incidental' || evidence.state === 'incompatible'
    ? 'incompatible'
    : evidence.state === 'valid'
      ? 'valid'
      : 'conditional'
}

function retentionBranchSetPlan(
  plan: CandidateSetPlan | undefined,
): RetentionBranchSetPlan | undefined {
  if (!plan) return undefined
  return {
    pattern: plan.pattern,
    primarySetIds: [...plan.primarySetIds],
    secondarySetIds: [...plan.secondarySetIds],
    ...(plan.purpose ? { purpose: plan.purpose } : {}),
    ...(plan.sourceText ? { sourceText: plan.sourceText } : {}),
  }
}

export function buildRetentionProfile(
  constraint: CandidateWarehouseConstraint,
  branchId: string,
  fourPieceIds: readonly string[],
  availability: Applicability,
  condition?: string | CandidateSetPlan['condition'],
  mainAvailability: Applicability = 'valid',
  selectedSetPlan?: CandidateSetPlan,
  evidenceSetPlan?: CandidateSetPlan,
): Profile {
  const agentId = resolveCurrentReleasedIdentity(constraint.agentId)
  const sources = retentionConstraintSources(constraint)
  const facts = resolveRetentionUseFacts(constraint, agentId, undefined, selectedSetPlan)
  const branchSetPlan = retentionBranchSetPlan(evidenceSetPlan ?? selectedSetPlan)
  const quality = resolveRetentionQualityWeights(constraint, agentId, facts)
  const mainStatsBySlot = Object.fromEntries(
    (['4', '5', '6'] as const).map((slot) => [
      slot,
      Object.fromEntries(
        (driveDiscData?.rules.mainStatsBySlot[slot] ?? []).map((stat): [string, Applicability] => [
          stat,
          (constraint.mainStats[slot] ?? []).includes(stat)
            ? 'valid'
            : constraint.status === 'candidate' &&
                sources.length > 0 &&
                constraint.mainStats[slot]?.length
              ? 'incompatible'
              : 'conditional',
        ]),
      ),
    ]),
  )
  // Recommendations define the main-stat gate for this build only. Other guide and
  // conditional alternatives are separate profiles; no other build's weights leak in.
  const functionalMains = sourcedFunctionalMains(
    constraint,
    agentId,
    fourPieceIds,
    sources[0] ?? '',
    facts.goal,
  )
  return {
    id: `${agentId}:${branchId}`,
    agentId,
    sourceIds: [
      ...new Set([
        ...sources,
        ...facts.sourceIds,
        ...functionalMains.map((entry) => entry.sourceId),
      ]),
    ],
    verified:
      constraint.status === 'candidate' &&
      sources.length > 0 &&
      Object.values(constraint.mainStats).every((stats) => stats.length > 0) &&
      (Object.values(quality.weights).some((weight) => weight > 0) ||
        (facts.goal === 'functional' &&
          quality.weightEvidence.method === 'source_proven_no_functional_substat_goal')),
    ...quality,
    ...(branchSetPlan ? { branchSetPlan } : {}),
    goal: facts.goal,
    mainStatsBySlot,
    effectUtility: Object.fromEntries(
      Object.entries(facts.effects).map(([stat, evidence]) => [stat, applicability(evidence)]),
    ),
    actionUtility: Object.fromEntries(
      Object.entries(facts.actions).map(([stat, evidence]) => [stat, applicability(evidence)]),
    ),
    utilityEvidence: {
      ...facts.effects,
      ...Object.fromEntries(
        Object.entries(facts.actions).map(([key, value]) => [`action:${key}`, value]),
      ),
    },
    conditionEvidence: retentionCondition(condition, `${agentId}:${branchId}:condition`, sources),
    fourPieceUses: Object.fromEntries(fourPieceIds.map((id) => [id, availability])),
    functionalMains,
    availability,
    mainAvailability,
  }
}
