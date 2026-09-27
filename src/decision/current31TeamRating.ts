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
import { projectCurrent31TeamStrength } from './current31TeamStrengthCalibration'
import { resolveCurrent31BangbooVariant } from './current31TeamCoreAggregation'

export const current31TeamRatingContractId = 'soda-current-3.1-team-rating/v2' as const

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
  /** Offline calibration labels must bypass the model being evaluated. */
  reviewedOnly?: boolean
}) {
  const memberIds = [...input.memberIds].sort() as [string, string, string]
  const teamIdentity = resolveCurrent31BangbooVariant(memberIds, input.bangbooId)
  const mechanicState = inspectCurrent31FormationMechanicState(memberIds)
  const interaction = compileCurrentPlanningInteractionBundle({
    memberIds,
    members: memberIds.map(createLevel60NeutralEffectRuntimeMember),
  })
  if (interaction.status === 'unsupported')
    throw new Error(`current 3.1 interaction bundle 未闭合：${interaction.blockers.join('；')}`)
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
    unsupportedIssues: [],
    hardPrunes: input.hardPrunes?.filter((prune) => !prune.subjectId.startsWith('bangboo-')),
    additionalEvidence: [
      {
        evidenceId: `interaction-bundle:${interaction.bundleHash}`,
        provenance: 'derived_state',
        reference: `current-3.1-interaction:${memberIds.join('+')}`,
        explanation:
          '由 source-backed Mechanic IR、PlanningBaseline observation 与六类共享 interaction operator 编译。',
        contentHash: interaction.bundleHash,
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
    reviewedOnly: input.reviewedOnly,
  })
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
      requiredOperators: interaction.requiredOperators,
      bundleHash: interaction.bundleHash,
    },
  }
}
