import { z } from 'zod'
import {
  createTeamFeatureVector,
  decisionConfidenceBands,
  deriveTeamRatingReadiness,
  teamDecisionAuthorityContractId,
  teamRatingDimensions,
  teamRatingResultSchema,
  type BenchmarkEvidence,
  type DecisionConfidenceBand,
  type TeamFeatureBand,
  type TeamFeatureDimension,
  type TeamFeatureVector,
  type TeamRatingBand,
  type TeamRatingResult,
  type UnsupportedDecisionIssue,
} from './teamDecisionAuthority'
import {
  teamFeatureExtractionSignalsSchema,
  type TeamFeatureExtractionSignals,
} from './teamFeatureSignalsSchema'
export { type TeamFeatureExtractionSignals } from './teamFeatureSignalsSchema'
export {
  projectAgentRulesToTeamFeatureSignals,
  type TeamFeatureSignalProjectionInput,
} from './teamFeatureSignalProjection'

export const teamRatingEvaluatorContractId = 'soda-team-rating-evaluator/v1' as const

const classificationOrder = {
  mechanic_critical: 0,
  benchmark_relevant: 1,
  rotation_sensitive: 2,
  environment_specific: 3,
} as const

function sortedIssues(issues: readonly UnsupportedDecisionIssue[]) {
  return [...issues].sort(
    (left, right) =>
      classificationOrder[left.classification] - classificationOrder[right.classification] ||
      left.issueId.localeCompare(right.issueId),
  )
}

function issueIds(
  issues: readonly UnsupportedDecisionIssue[],
  classifications: readonly UnsupportedDecisionIssue['classification'][],
) {
  const allowed = new Set(classifications)
  return issues.filter((issue) => allowed.has(issue.classification)).map((issue) => issue.issueId)
}

function featureConfidence(input: {
  rulesComplete: boolean
  issues: readonly UnsupportedDecisionIssue[]
  relevantClasses: readonly UnsupportedDecisionIssue['classification'][]
  benchmarkStatus?: BenchmarkEvidence['status']
  observedPartnerRelationCount?: number
}): DecisionConfidenceBand {
  if (!input.rulesComplete) return 'experimental'
  const relevant = issueIds(input.issues, input.relevantClasses)
  if (input.benchmarkStatus === 'unavailable') return 'low'
  if (input.benchmarkStatus === 'partial' || relevant.length) return 'medium'
  if (input.observedPartnerRelationCount !== undefined && input.observedPartnerRelationCount < 3)
    return 'medium'
  return 'high'
}

function dimension(
  input: Omit<TeamFeatureDimension, 'positiveEvidenceRefs'> & {
    positiveEvidenceRefs: readonly string[]
  },
): TeamFeatureDimension {
  return { ...input, positiveEvidenceRefs: [...input.positiveEvidenceRefs].sort() }
}

function mechanicSynergyBand(signals: z.output<typeof teamFeatureExtractionSignalsSchema>) {
  if (!signals.rulesComplete) return 'unknown' as const
  if (
    signals.activationAtBase &&
    signals.resourceLoopClosed &&
    signals.observedPartnerRelationCount === 3
  )
    return 'excellent' as const
  if (signals.activationAtBase && signals.resourceLoopClosed) return 'good' as const
  if (signals.activationAtBase || signals.resourceLoopClosed) return 'mixed' as const
  return 'weak' as const
}

function cycleStabilityBand(signals: z.output<typeof teamFeatureExtractionSignalsSchema>) {
  if (!signals.rulesComplete) return 'unknown' as const
  if (signals.resourceLoopClosed && signals.fieldTimeWithinBudget) return 'excellent' as const
  if (signals.resourceLoopClosed || signals.fieldTimeWithinBudget) return 'mixed' as const
  return 'weak' as const
}

function teamEffectQualityBand(signals: z.output<typeof teamFeatureExtractionSignalsSchema>) {
  if (!signals.rulesComplete) return 'unknown' as const
  const recipients = signals.effectRecipientCounts
  const externalRecipientKinds = [
    recipients.active_agent,
    recipients.team,
    recipients.enemy,
  ].filter((count) => count > 0).length
  if (
    signals.observedPartnerRelationCount === 3 &&
    signals.activationAtBase &&
    signals.resourceLoopClosed &&
    recipients.team > 0 &&
    externalRecipientKinds >= 2
  )
    return 'excellent' as const
  if (signals.observedPartnerRelationCount === 3 && externalRecipientKinds >= 1)
    return 'good' as const
  if (externalRecipientKinds >= 1) return 'mixed' as const
  if (recipients.self > 0) return 'mixed' as const
  return 'weak' as const
}

function flexibilityBand(signals: z.output<typeof teamFeatureExtractionSignalsSchema>) {
  if (!signals.rulesComplete) return 'unknown' as const
  const diverse = signals.distinctSpecialtyCount === 3 && signals.distinctAttributeCount >= 2
  if (signals.observedPartnerRelationCount === 3 && diverse) return 'excellent' as const
  if (signals.observedPartnerRelationCount === 3 || diverse) return 'good' as const
  if (signals.distinctSpecialtyCount >= 2 || signals.distinctAttributeCount >= 2)
    return 'mixed' as const
  return 'weak' as const
}

function confidenceFeatureBand(confidence: DecisionConfidenceBand): TeamFeatureBand {
  if (confidence === 'high') return 'excellent'
  if (confidence === 'medium') return 'good'
  if (confidence === 'low') return 'mixed'
  return 'unknown'
}

export function extractTeamFeatureVector(raw: TeamFeatureExtractionSignals): TeamFeatureVector {
  const signals = teamFeatureExtractionSignalsSchema.parse(raw)
  const issues = sortedIssues(signals.unsupportedIssues)
  const evidence = [...signals.evidence].sort((left, right) =>
    left.evidenceId.localeCompare(right.evidenceId),
  )
  const evidenceRefs = evidence.map((item) => item.evidenceId)
  const mechanicIssues = issueIds(issues, ['mechanic_critical'])
  const cycleIssues = issueIds(issues, ['mechanic_critical', 'rotation_sensitive'])
  const outputIssues = issues.map((issue) => issue.issueId)
  const effectIssues = issueIds(issues, ['mechanic_critical', 'benchmark_relevant'])
  const flexibilityIssues = issueIds(issues, ['environment_specific'])
  const mechanicConfidence = featureConfidence({
    rulesComplete: signals.rulesComplete,
    issues,
    relevantClasses: ['mechanic_critical'],
    observedPartnerRelationCount: signals.observedPartnerRelationCount,
  })
  const cycleConfidence = featureConfidence({
    rulesComplete: signals.rulesComplete,
    issues,
    relevantClasses: ['mechanic_critical', 'rotation_sensitive'],
    observedPartnerRelationCount: signals.observedPartnerRelationCount,
  })
  const outputConfidence = featureConfidence({
    rulesComplete: signals.rulesComplete,
    issues,
    relevantClasses: [
      'mechanic_critical',
      'benchmark_relevant',
      'rotation_sensitive',
      'environment_specific',
    ],
    benchmarkStatus: signals.benchmark.status,
    observedPartnerRelationCount: signals.observedPartnerRelationCount,
  })
  const overallConfidence = worstConfidence([
    mechanicConfidence,
    cycleConfidence,
    outputConfidence,
    featureConfidence({
      rulesComplete: signals.rulesComplete,
      issues,
      relevantClasses: ['environment_specific'],
      observedPartnerRelationCount: signals.observedPartnerRelationCount,
    }),
  ])
  const dimensions: TeamFeatureDimension[] = [
    dimension({
      dimension: 'mechanic_synergy',
      band: mechanicSynergyBand(signals),
      confidence: mechanicConfidence,
      positiveEvidenceRefs: evidenceRefs,
      penalties: [
        ...(signals.activationAtBase ? [] : ['追加能力在基础账户状态下未全部激活。']),
        ...(signals.resourceLoopClosed ? [] : ['已声明资源产消链尚未闭合。']),
        ...(signals.observedPartnerRelationCount === 3
          ? []
          : ['并非每名成员都有队内具名协同关系。']),
      ],
      missingIssueIds: mechanicIssues,
      explanation: '综合追加能力、资源产消与具名成员协同；未观察关系不会被当作 hard prune。',
    }),
    dimension({
      dimension: 'cycle_stability',
      band: cycleStabilityBand(signals),
      confidence: cycleConfidence,
      positiveEvidenceRefs: evidenceRefs,
      penalties: [
        ...(signals.resourceLoopClosed ? [] : ['资源循环未闭合。']),
        ...(signals.fieldTimeWithinBudget ? [] : ['场上时间需求超过当前共享预算。']),
      ],
      missingIssueIds: cycleIssues,
      explanation: '只评估声明式资源闭合和场上时间预算，不推导逐帧 rotation。',
    }),
    dimension({
      dimension: 'output_potential',
      band: signals.outputPotentialBand,
      confidence: outputConfidence,
      positiveEvidenceRefs: evidenceRefs,
      penalties: signals.benchmark.status === 'complete' ? [] : ['Benchmark 未完整覆盖。'],
      missingIssueIds: outputIssues,
      explanation:
        '采用同一具名 baseline 下的宽 Output Potential band；不把小数差直接变成队伍名次。',
    }),
    dimension({
      dimension: 'field_time_efficiency',
      band: signals.rulesComplete ? (signals.fieldTimeWithinBudget ? 'good' : 'weak') : 'unknown',
      confidence: featureConfidence({
        rulesComplete: signals.rulesComplete,
        issues,
        relevantClasses: ['rotation_sensitive'],
        observedPartnerRelationCount: signals.observedPartnerRelationCount,
      }),
      positiveEvidenceRefs: evidenceRefs,
      penalties: signals.fieldTimeWithinBudget ? [] : ['共享 field-time demand 超出预算。'],
      missingIssueIds: issueIds(issues, ['rotation_sensitive']),
      explanation: '使用已冻结 field-time mode 的相对需求，不描述实测站场秒数。',
    }),
    dimension({
      dimension: 'team_effect_quality',
      band: teamEffectQualityBand(signals),
      confidence: featureConfidence({
        rulesComplete: signals.rulesComplete,
        issues,
        relevantClasses: ['mechanic_critical', 'benchmark_relevant'],
        observedPartnerRelationCount: signals.observedPartnerRelationCount,
      }),
      positiveEvidenceRefs: evidenceRefs,
      penalties:
        signals.effectRecipientCounts.active_agent +
          signals.effectRecipientCounts.team +
          signals.effectRecipientCounts.enemy >
        0
          ? []
          : ['当前合同只观察到 self effect。'],
      missingIssueIds: effectIssues,
      explanation:
        '先要求队内具名关系与机制闭合，再参考 source-backed effect recipient 覆盖；不按效果数量相加计分。',
    }),
    dimension({
      dimension: 'flexibility_robustness',
      band: flexibilityBand(signals),
      confidence: featureConfidence({
        rulesComplete: signals.rulesComplete,
        issues,
        relevantClasses: ['environment_specific'],
        observedPartnerRelationCount: signals.observedPartnerRelationCount,
      }),
      positiveEvidenceRefs: evidenceRefs,
      penalties: flexibilityIssues.length ? ['存在具名场景依赖。'] : [],
      missingIssueIds: flexibilityIssues,
      explanation: '综合成员特性/属性多样性、具名协同完整度与场景依赖；不采用社区排名。',
    }),
    dimension({
      dimension: 'evidence_confidence',
      band: confidenceFeatureBand(overallConfidence),
      confidence: overallConfidence,
      positiveEvidenceRefs: evidenceRefs,
      penalties: issues.map((issue) => issue.impact),
      missingIssueIds: issues.map((issue) => issue.issueId),
      explanation: 'Confidence 取相关维度中的最弱证据带；缺口保持结构化，不补默认值。',
    }),
  ]
  return createTeamFeatureVector({
    contract: teamDecisionAuthorityContractId,
    candidateId: signals.candidateId,
    memberIds: signals.memberIds,
    bangbooId: signals.bangbooId,
    hardPrunes: [...signals.hardPrunes],
    dimensions,
    benchmark: signals.benchmark,
    evidence,
    unsupportedIssues: issues,
  })
}

const confidenceRank: Record<DecisionConfidenceBand, number> = {
  high: 0,
  medium: 1,
  low: 2,
  experimental: 3,
}

function worstConfidence(confidences: readonly DecisionConfidenceBand[]) {
  return confidences.reduce((worst, candidate) =>
    confidenceRank[candidate] > confidenceRank[worst] ? candidate : worst,
  )
}

function deriveRatingBand(dimensions: readonly TeamFeatureDimension[]): TeamRatingBand {
  const count = (band: TeamFeatureBand) => dimensions.filter((item) => item.band === band).length
  const excellent = count('excellent')
  const goodOrBetter = excellent + count('good')
  const mixed = count('mixed')
  const weak = count('weak')
  const unknown = count('unknown')
  if (unknown >= 2 || weak >= 3) return 'Experimental'
  if (excellent >= 4 && mixed === 0 && weak === 0 && unknown === 0) return 'S+'
  if (goodOrBetter >= 6 && weak === 0 && unknown === 0) return 'S'
  if (goodOrBetter >= 5 && weak <= 1 && unknown === 0) return 'A+'
  if (goodOrBetter >= 3 && unknown <= 1) return 'A'
  return 'B'
}

const ratingRank: Record<TeamRatingBand, number> = {
  'S+': 0,
  S: 1,
  'A+': 2,
  A: 3,
  B: 4,
  Experimental: 5,
}

function capRatingBand(
  ratingBand: TeamRatingBand,
  dimensions: readonly TeamFeatureDimension[],
): TeamRatingBand {
  const band = (dimension: TeamFeatureDimension['dimension']) =>
    dimensions.find((item) => item.dimension === dimension)?.band
  const mechanic = band('mechanic_synergy')
  const output = band('output_potential')
  const cap = mechanic === 'weak' || output === 'weak' ? 'B' : mechanic === 'mixed' ? 'A' : null
  return cap && ratingRank[ratingBand] < ratingRank[cap] ? cap : ratingBand
}

export function evaluateTeamRating(vector: TeamFeatureVector): TeamRatingResult {
  const readiness = deriveTeamRatingReadiness(vector)
  if (readiness.status !== 'ready')
    return teamRatingResultSchema.parse({
      contract: teamDecisionAuthorityContractId,
      status: readiness.status,
      candidateId: vector.candidateId,
      featureFingerprint: vector.fingerprint,
      blockerIds: readiness.blockers,
      explanation:
        readiness.status === 'hard_invalid'
          ? '候选命中 hard prune，不能进入 Team Rating。'
          : '候选存在 mechanic-critical 缺口，Team Rating 保持 blocked。',
    })
  const confidence = worstConfidence(vector.dimensions.map((item) => item.confidence))
  const ratingBand =
    confidence === 'experimental'
      ? 'Experimental'
      : capRatingBand(deriveRatingBand(vector.dimensions), vector.dimensions)
  const tradeoffs = vector.dimensions
    .filter((item) => item.band === 'mixed' || item.band === 'weak' || item.band === 'unknown')
    .map((item) => `${item.dimension}: ${item.explanation}`)
  return teamRatingResultSchema.parse({
    contract: teamDecisionAuthorityContractId,
    status: 'rated',
    candidateId: vector.candidateId,
    featureFingerprint: vector.fingerprint,
    ratingBand,
    confidence,
    explanation: `按七维 categorical 决策表评为 ${ratingBand}；未计算连续总分。`,
    tradeoffs,
  })
}

export const teamRatingDecisionTable = Object.freeze({
  contract: teamRatingEvaluatorContractId,
  dimensions: teamRatingDimensions,
  confidenceBands: decisionConfidenceBands,
  ratingBands: ['S+', 'S', 'A+', 'A', 'B', 'Experimental'] as const,
  boundary:
    '只使用 categorical 维度与公开序位门；不产生连续 Team Rating score，不使用社区排名或 Reference Rotation DPS。',
})
