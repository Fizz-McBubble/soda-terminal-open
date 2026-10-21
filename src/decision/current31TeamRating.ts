import { compileCurrentPlanningInteractionBundle } from '../calculation/currentPlanningInteractionBundle'
import { createLevel60NeutralEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { inspectCurrent31FormationMechanicState } from '../teamEngine/current31FormationMechanicAudit'
import type { HardPruneDecision, TeamFeatureBand } from './teamDecisionAuthority'
import type { BenchmarkEvidence } from './teamDecisionAuthority'
import {
  evaluateTeamRating,
  extractTeamFeatureVector,
  projectAgentRulesToTeamFeatureSignals,
} from './teamRatingEvaluator'
import {
  projectCurrent31TeamStrength,
  type TeamStrengthEvidenceMode,
} from './current31TeamStrengthCalibration'
import { resolveCurrent31BangbooVariant } from './current31TeamCoreAggregation'
import { stableContentHash } from '../gameDataPacks/types'
import { resolveReviewedPhoenixTeam33 } from './reviewedPhoenixTeams33'
import { teamDecisionAuthorityContractId } from './teamDecisionAuthority'
import { teamRecommendationScore } from './teamRecommendationScore'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'

export const current31TeamRatingContractId = 'soda-current-3.1-team-rating/v3' as const

function benchmarkForThreeAgentRating(benchmark: BenchmarkEvidence): BenchmarkEvidence {
  if (benchmark.status === 'complete') return benchmark
  const unsupportedIssueIds = benchmark.unsupportedIssueIds.filter(
    (issueId) => !issueId.startsWith('bangboo-condition:'),
  )
  if (unsupportedIssueIds.length === benchmark.unsupportedIssueIds.length) return benchmark
  if (benchmark.status === 'partial' && unsupportedIssueIds.length === 0)
    return {
      status: 'unavailable',
      baselineId: null,
      outputIndex: null,
      unsupportedIssueIds: [],
      explanation: '原比较仅缺少邦布条件；三人评级不消费该结果，Benchmark 按不可用处理。',
    }
  return { ...benchmark, unsupportedIssueIds }
}

export function evaluateCurrent31TeamRating(input: {
  candidateId: string
  memberIds: readonly [string, string, string]
  bangbooId: string | null
  outputPotentialBand: TeamFeatureBand
  benchmark: BenchmarkEvidence
  /** Compatibility input; Bangboo conditions belong to its separate assessment. */
  bangbooConditionBlockers?: readonly string[]
  hardPrunes?: readonly HardPruneDecision[]
  /** Source/mechanic-only projections bypass model diagnostics; the default retains them. */
  reviewedOnly?: boolean
  /** Offline refits read labels in their source version, never as current meta. */
  sourceReviewVersion?: '3.1'
  /** Explicit blind evaluation isolates exact-team source labels, not mechanisms. */
  evidenceMode?: TeamStrengthEvidenceMode
}) {
  const memberIds = [...input.memberIds].sort() as [string, string, string]
  const teamIdentity = resolveCurrent31BangbooVariant(memberIds, input.bangbooId)
  const mechanicState = inspectCurrent31FormationMechanicState(memberIds)
  const missingEventIds = memberIds.filter((id) => !getCurrentAgentEventContract(id))
  const interaction = missingEventIds.length
    ? {
        status: 'unsupported' as const,
        blockers: missingEventIds.map(
          (id) => `缺少可执行角色事件合同：${id}；数值面板与本地队伍参考不代替事件。`,
        ),
      }
    : compileCurrentPlanningInteractionBundle({
        memberIds,
        members: memberIds.map(createLevel60NeutralEffectRuntimeMember),
      })
  const interactionHash =
    interaction.status === 'supported'
      ? interaction.bundleHash
      : stableContentHash({ memberIds, blockers: interaction.blockers })
  const interactionEvidenceId = `${interaction.status === 'supported' ? 'interaction-bundle' : 'interaction-unavailable'}:${interactionHash}`
  const benchmark = benchmarkForThreeAgentRating(input.benchmark)
  const outputPotentialBand =
    benchmark.status === 'unavailable' ? ('unknown' as const) : input.outputPotentialBand
  const signals = projectAgentRulesToTeamFeatureSignals({
    candidateId: input.candidateId,
    memberIds,
    bangbooId: null,
    agentRules: current31TeamEngineD1Pack.agentRules,
    mechanicState,
    outputPotentialBand,
    benchmark,
    unsupportedIssues:
      interaction.status === 'supported'
        ? []
        : interaction.blockers.map((impact, index) => ({
            issueId: `interaction-unavailable:${index}:${interactionHash}`,
            conditionKey: 'planning-interaction-observation',
            classification: 'benchmark_relevant' as const,
            impact,
            evidenceRefs: [interactionEvidenceId],
          })),
    hardPrunes: input.hardPrunes?.filter((prune) => !prune.subjectId.startsWith('bangboo-')),
    additionalEvidence: [
      {
        evidenceId: interactionEvidenceId,
        provenance: 'derived_state',
        reference: `current-3.1-interaction:${memberIds.join('+')}`,
        explanation:
          interaction.status === 'supported'
            ? '由 source-backed Mechanic IR、PlanningBaseline observation 与六类共享 interaction operator 编译。'
            : `机制比较缺少条件；保留独立来源评级，不将未知效果按零：${interaction.blockers.join('；')}`,
        contentHash: interactionHash,
      },
    ],
  })
  const featureVector = extractTeamFeatureVector(signals)
  const mechanicRating = evaluateTeamRating(featureVector)
  const strength = projectCurrent31TeamStrength({
    memberIds,
    bangbooId: null,
    mechanicRating,
    featureVector,
    benchmark,
    reviewedOnly: input.reviewedOnly || missingEventIds.length > 0,
    sourceReviewVersion: input.reviewedOnly ? input.sourceReviewVersion : undefined,
    evidenceMode: input.evidenceMode,
  })
  const limited =
    !input.sourceReviewVersion &&
    input.evidenceMode !== 'independent_evaluation' &&
    mechanicRating.status !== 'hard_invalid'
      ? resolveReviewedPhoenixTeam33(memberIds)
      : null
  if (limited) {
    const analysis = limited.analysis
    const explanation = `分析评级 ${analysis.band} · 低置信度。${analysis.rationale} 适用条件：${analysis.conditions.join('；')}`
    strength.mechanicValidity = 'partial'
    strength.metaCalibration = {
      ...strength.metaCalibration,
      status: 'aligned',
      authority: 'local_editorial_estimate',
      confidenceCeiling: 'low',
      analysis,
      projectedStrengthBand: analysis.band,
      versionPosition: null,
      evidenceRefs: analysis.evidenceRefs.map((ref) => ref.url),
      recommendationScore: teamRecommendationScore(analysis.band, featureVector) ?? undefined,
      explanation,
    }
    strength.realityCheck = {
      status: 'calibrated_band_supported',
      strengthBand: analysis.band,
      confidenceCeiling: 'low',
      referencePerformanceRequiredForCurrentGate: false,
      explanation,
    }
    strength.teamStrength = {
      contract: teamDecisionAuthorityContractId,
      status: 'rated',
      candidateId: input.candidateId,
      featureFingerprint: featureVector.fingerprint,
      ratingBand: analysis.band,
      confidence: 'low',
      explanation,
      tradeoffs: [...analysis.limitations],
    }
  }
  return {
    contract: current31TeamRatingContractId,
    teamIdentity,
    featureVector,
    mechanicValidity: strength.mechanicValidity,
    mainstreamRecognition: strength.mainstreamRecognition,
    mechanicRating,
    referencePerformance: strength.referencePerformance,
    metaCalibration: strength.metaCalibration,
    realityCheck: strength.realityCheck,
    rating: strength.teamStrength,
    interaction: {
      status: interaction.status,
      requiredOperators: interaction.status === 'supported' ? interaction.requiredOperators : [],
      bundleHash: interaction.status === 'supported' ? interaction.bundleHash : null,
      blockers: interaction.status === 'supported' ? [] : interaction.blockers,
    },
  }
}
