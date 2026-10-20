import { stableContentHash } from '../gameDataPacks/types'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import publishedLabels from '../gameDataPacks/data/reviewed-team-strength.v1.json'
import editorialLabels from '../gameDataPacks/data/reviewed-team-analysis.3.1.json'
import guideVerification from '../gameDataPacks/data/reviewed-team-guide-verification.3.1.json'
import performance31 from '../gameDataPacks/data/reviewed-team-performance.3.1.json'
import performance323 from '../gameDataPacks/data/reviewed-team-performance.3.2.3.json'
import { currentReviewedTeamSourceDirections } from '../gameDataPacks/reviewedTeamSourceDirections'
import type { TeamRatingBand } from './teamDecisionAuthority'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'
import { current31VariantRealityProfileSet } from './current31VariantRealityProfile'
import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'
import { evaluateCurrent31IndependentQualityCases } from './current31IndependentQualityEvaluation'
import { current31ObservedFormationRobustnessDiagnostics } from './current31ObservedPerformanceDataQuality'

export const current31BlindMetaHoldoutContractId = 'soda-current-3.1-blind-meta-holdout/v1' as const

const gameVikaSnapshot = Object.freeze({
  publisher: 'GameVika',
  url: 'https://gamevika.com/en/zzz/teams',
  capturedAt: '2026-09-02T14:08:00Z',
  scrapeId: '01a0626f-1b21-74ba-9117-a418db1071d9',
  lines: Object.freeze([
    'S+|Ye Shunguang|Dialyn|Sunna',
    'S+|Miyabi|Yanagi|Astra Yao',
    'S+|Velina|Aria|Yuzuha',
    'S|Yixuan|Ju Fufu|Lucia',
    'S|Evelyn|Dialyn|Astra Yao',
    'S|Vivian|Yanagi|Astra Yao',
    'S|Alice|Yuzuha|Vivian',
    'S|Zhu Yuan|Qingyi|Astra Yao',
    'S|Hugo|Lighter|Astra Yao',
    'S|Seed|Orphie & Magus|Trigger',
    'S|Soldier 0 - Anby|Astra Yao|Trigger',
    'S|Pyrois|Dialyn|Sunna',
    'S|Velina|Promeia|Yuzuha',
    'A|Jane|Seth|Caesar',
    'S|Evelyn|Norma|Astra Yao',
    'S|Aria|Nangong Yu|Sunna',
  ]),
})

const sourceContentHash = stableContentHash({
  url: gameVikaSnapshot.url,
  lines: gameVikaSnapshot.lines,
})

type HoldoutCase = {
  caseId: string
  memberIds: readonly [string, string, string]
  publisherTier: 'S+' | 'S' | 'A'
  expectedBand: TeamRatingBand
  locator: string
}

const holdoutCases = [
  {
    caseId: 'blind-gamevika-ye-dialyn-sunna',
    memberIds: ['agent-ye-shunguang', 'agent-dialyn', 'agent-sunna'],
    publisherTier: 'S+',
    expectedBand: 'S',
    locator: 'S+|Ye Shunguang|Dialyn|Sunna',
  },
  {
    caseId: 'blind-gamevika-yixuan-ju-fufu-lucia',
    memberIds: ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
    publisherTier: 'S',
    expectedBand: 'A+',
    locator: 'S|Yixuan|Ju Fufu|Lucia',
  },
  {
    caseId: 'blind-gamevika-alice-vivian-yuzuha',
    memberIds: ['agent-alice', 'agent-vivian', 'agent-yuzuha'],
    publisherTier: 'S',
    expectedBand: 'A+',
    locator: 'S|Alice|Yuzuha|Vivian',
  },
  {
    caseId: 'blind-gamevika-jane-seth-caesar',
    memberIds: ['agent-jane', 'agent-seth', 'agent-caesar'],
    publisherTier: 'A',
    expectedBand: 'B',
    locator: 'A|Jane|Seth|Caesar',
  },
] as const satisfies readonly HoldoutCase[]

const unavailableBenchmark = Object.freeze({
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [] as string[],
  explanation: 'Blind Meta Holdout 只验证来源化粗档，不借用 Reference Performance。',
})

const ratingRank: Record<TeamRatingBand, number> = {
  'S+': 0,
  S: 1,
  'A+': 2,
  A: 3,
  B: 4,
  Experimental: 5,
}

function memberKey(memberIds: readonly string[]) {
  return [...memberIds].map(resolveCurrentReleasedIdentity).sort().join('|')
}

const goldMembers = new Set(
  [
    ...current31StrengthGoldSet.cases,
    ...current31StrengthGoldSet.versionedTeamStrengthSupplements,
  ].map((row) => memberKey(row.memberIds)),
)
const publishedMembers = new Set(publishedLabels.records.map((row) => memberKey(row.memberIds)))
const editorialMembers = new Set(editorialLabels.records.map((row) => memberKey(row.memberIds)))
// These are the exact-team label authorities used by the frozen reviewedOnly collector.
// Include withdrawn historical rows: withdrawal cannot make a previously seen label unseen.
const frozenTrainingLabelMembers = new Set([
  ...goldMembers,
  ...publishedMembers,
  ...editorialMembers,
])
const realityMembers = new Set(
  current31VariantRealityProfileSet.profiles.map((row) => memberKey(row.memberIds)),
)
const consensusMembers = new Set(
  current31IndependentConsensusGoldSet.observations.map((row) => memberKey(row.memberIds)),
)
const performanceMembers = new Set(
  [...performance31.targetTrios, ...performance323.targetTrios].map((row) =>
    memberKey(row.stableMemberIds),
  ),
)
const sourceDirectionMembers = new Set(
  currentReviewedTeamSourceDirections().map((row) => memberKey(row.memberIds)),
)
const guideVerificationMembers = new Set(
  guideVerification.records.map((row) => memberKey(row.memberIds)),
)
const observedPerformanceMembers = new Set(
  current31ObservedFormationRobustnessDiagnostics.map((row) => row.exactAgentFormationKey),
)

export function current31BlindMetaAuthorityExposure(memberIds: readonly string[]) {
  const key = memberKey(memberIds)
  return Object.freeze({
    exactMemberKey: key,
    goldLabelSeen: goldMembers.has(key),
    publisherLabelSeen: publishedMembers.has(key),
    editorialLabelSeen: editorialMembers.has(key),
    frozenTrainingLabelSeen: frozenTrainingLabelMembers.has(key),
    realityProfileSeen: realityMembers.has(key),
    consensusMembershipSeen: consensusMembers.has(key),
    performanceDataSeen: performanceMembers.has(key),
    sourceDirectionSeen: sourceDirectionMembers.has(key),
    guideVerificationSeen: guideVerificationMembers.has(key),
    observedPerformanceSeen: observedPerformanceMembers.has(key),
  })
}

const cases = holdoutCases.map((item) => {
  const input = {
    candidateId: item.caseId,
    memberIds: item.memberIds,
    bangbooId: null,
    outputPotentialBand: 'unknown' as const,
    benchmark: unavailableBenchmark,
  }
  const independentResult = evaluateCurrent31TeamRating({
    ...input,
    evidenceMode: 'independent_evaluation',
  })
  // Retain the prior source-reference regression result without calling it a blind prediction.
  const result = evaluateCurrent31TeamRating({ ...input, evidenceMode: 'source_reference' })
  const observedBand = result.rating.status === 'rated' ? result.rating.ratingBand : null
  const productionEvidenceRefs = result.metaCalibration.evidenceRefs
  const authorityExposure = current31BlindMetaAuthorityExposure(item.memberIds)
  const sourceUrlSeen = productionEvidenceRefs.includes(gameVikaSnapshot.url)
  const labelLeak =
    authorityExposure.frozenTrainingLabelSeen ||
    authorityExposure.realityProfileSeen ||
    authorityExposure.consensusMembershipSeen ||
    authorityExposure.performanceDataSeen ||
    authorityExposure.sourceDirectionSeen ||
    authorityExposure.guideVerificationSeen ||
    authorityExposure.observedPerformanceSeen ||
    sourceUrlSeen
  return Object.freeze({
    ...item,
    sourceUrl: gameVikaSnapshot.url,
    sourceContentHash,
    observedBand,
    aligned: observedBand === item.expectedBand,
    productionEvidenceRefs,
    sourceUrlSeen,
    authorityExposure,
    labelLeak,
    eligibleForIndependentAcceptance: !labelLeak,
    independentEvaluation: Object.freeze({
      evidenceMode: 'independent_evaluation' as const,
      observedBand:
        independentResult.rating.status === 'rated' ? independentResult.rating.ratingBand : null,
      calibrationStatus: independentResult.metaCalibration.status,
      evidenceRefs: independentResult.metaCalibration.evidenceRefs,
      recommendationScore: independentResult.metaCalibration.recommendationScore ?? null,
    }),
  })
})

const pairwiseRelations = cases.flatMap((left, leftIndex) =>
  cases.slice(leftIndex + 1).flatMap((right) => {
    if (ratingRank[left.expectedBand] === ratingRank[right.expectedBand]) return []
    const expectedStronger =
      ratingRank[left.expectedBand] < ratingRank[right.expectedBand] ? left : right
    const expectedWeaker = expectedStronger === left ? right : left
    const comparable =
      expectedStronger.observedBand !== null && expectedWeaker.observedBand !== null
    const aligned =
      comparable &&
      ratingRank[expectedStronger.observedBand!] < ratingRank[expectedWeaker.observedBand!]
    return [
      Object.freeze({
        strongerCaseId: expectedStronger.caseId,
        weakerCaseId: expectedWeaker.caseId,
        aligned,
        eligibleForIndependentAcceptance:
          left.eligibleForIndependentAcceptance && right.eligibleForIndependentAcceptance,
      }),
    ]
  }),
)

const alignedBandCount = cases.filter((item) => item.aligned).length
const alignedPairwiseCount = pairwiseRelations.filter((item) => item.aligned).length
const labelLeakCount = cases.filter((item) => item.labelLeak).length
const independentQualityEvaluation = evaluateCurrent31IndependentQualityCases({
  cases: cases.map((item) => ({
    caseId: item.caseId,
    labelIndependent: item.eligibleForIndependentAcceptance,
    acceptanceProtocolVerified: false,
    expectedBand: item.expectedBand,
    predictedBand: item.independentEvaluation.observedBand,
  })),
  bandAgreementTarget: 0.95,
  pairwiseConsistencyTarget: 0.95,
  mainstreamUnknownRatioMaximum: 0.05,
})
const independentMetricStatuses = [
  independentQualityEvaluation.bandAgreement.status,
  independentQualityEvaluation.pairwiseConsistency.status,
  independentQualityEvaluation.mainstreamUnknownRatio.status,
] as const
const independentAcceptanceStatus = independentMetricStatuses.includes('fail')
  ? ('fail' as const)
  : independentMetricStatuses.every((status) => status === 'not_evaluated')
    ? ('not_evaluated' as const)
    : independentMetricStatuses.every((status) => status === 'pass')
      ? ('pass' as const)
      : ('incomplete' as const)

export const current31BlindMetaHoldout = Object.freeze({
  contract: current31BlindMetaHoldoutContractId,
  gameVersion: '3.1',
  split: 'known_label_regression' as const,
  diagnosticEvidenceMode: 'source_reference' as const,
  blindEvidenceMode: 'independent_evaluation' as const,
  frozenTrainingLabelCaseCount: frozenTrainingLabelMembers.size,
  sourceSnapshot: Object.freeze({
    ...gameVikaSnapshot,
    sourceContentHash,
    rowCount: gameVikaSnapshot.lines.length,
  }),
  taxonomyCrosswalk: Object.freeze({
    'S+': 'S',
    S: 'A+',
    A: 'B',
  } as const),
  bandCoverage: Object.freeze(['S', 'A+', 'B'] as const),
  cases,
  bandCaseCount: cases.length,
  alignedBandCount,
  bandAgreement: alignedBandCount / cases.length,
  pairwiseRelations,
  pairwiseRelationCount: pairwiseRelations.length,
  alignedPairwiseCount,
  pairwiseConsistency: alignedPairwiseCount / pairwiseRelations.length,
  labelLeakCount,
  labelIndependent: labelLeakCount === 0,
  independentQualityEvaluation,
  independentBandCaseCount: independentQualityEvaluation.bandAgreement.denominator,
  independentPairwiseRelationCount: independentQualityEvaluation.pairwiseConsistency.denominator,
  independentAcceptanceStatus,
  predictionFreezeStatus: 'legacy_labels_already_exposed' as const,
  predictionFreezeVerified: false as boolean,
  boundary:
    '保留四条旧来源标签和五条派生偏序作诊断回归；其完整三人成员标签已进入 Gold 与冻结训练集，URL 未读取不证明整链独立。独立执行显式使用 independent_evaluation 隔离 prior 标签路径；旧标签已暴露，不能因此成为一次新冻结预测解盲证据，也不计入当前独立验收分母。标签独立但只有 Experimental 的样本只进入 Unknown 分母，不进入档位或偏序准确率分母。来源原生 3.1 标签不证明本地标准条件下的 3.2 Meta。',
})
