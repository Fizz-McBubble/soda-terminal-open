import type { CurrentMetaStrengthBand } from '../teamEngine/contracts'
import type { TeamRatingBand } from './teamDecisionAuthority'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'
import { current31ProductionPartialOrder } from './current31ProductionPartialOrder'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { resolveCurrent31VariantRealityProfile } from './current31VariantRealityProfile'

const expectedRatingBand: Record<CurrentMetaStrengthBand, TeamRatingBand> = {
  apex: 'S',
  meta: 'A+',
  viable: 'B',
}

const unavailableBenchmark = {
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [],
  explanation: 'Reference Performance 不是当前 BOX Reliable 前置门。',
}

const cases = current31StrengthGoldSet.independentHoldoutCases.map((goldCase) => {
  const runtimeProfile = resolveCurrent31VariantRealityProfile({
    memberIds: goldCase.memberIds,
    bangbooId: goldCase.bangbooId,
  })
  const labelEvidenceRefs: readonly string[] = goldCase.labelEvidenceRefs ?? []
  const runtimeEvidenceRefs: readonly string[] = runtimeProfile?.evidenceRefs ?? []
  const sourceOverlapRefs = labelEvidenceRefs.filter((ref) => runtimeEvidenceRefs.includes(ref))
  const result = evaluateCurrent31TeamRating({
    candidateId: `strength-gold-holdout:${goldCase.caseId}`,
    memberIds: goldCase.memberIds,
    bangbooId: goldCase.bangbooId,
    outputPotentialBand: 'unknown',
    benchmark: unavailableBenchmark,
  })
  const observedBand = result.rating.status === 'rated' ? result.rating.ratingBand : null
  return Object.freeze({
    caseId: goldCase.caseId,
    expectedBand: expectedRatingBand[goldCase.band],
    observedBand,
    aligned: observedBand === expectedRatingBand[goldCase.band],
    runtimeGoldLeak: result.metaCalibration.authority === 'strength_gold',
    constructionIdentityLeak: runtimeProfile != null,
    metaCalibrationAuthority: result.metaCalibration.authority,
    realityCheckStatus: result.realityCheck.status,
    labelEvidenceRefs,
    runtimeEvidenceRefs,
    sourceOverlapRefs,
  })
})

const alignedCount = cases.filter((item) => item.aligned).length

const recognizedCount = cases.filter(
  (item) => item.observedBand != null && item.observedBand !== 'Experimental',
).length

const constructionIdentityLeakCount = cases.filter((item) => item.constructionIdentityLeak).length

export const current31StrengthGoldSetEvaluation = Object.freeze({
  contract: 'soda-current-3.1-strength-gold-set-evaluation/v1' as const,
  status:
    cases.length >= 10 &&
    alignedCount / cases.length >= 0.9 &&
    cases.every((item) => !item.runtimeGoldLeak) &&
    cases.every((item) => !item.constructionIdentityLeak) &&
    cases.every((item) => item.labelEvidenceRefs.length > 0 && item.sourceOverlapRefs.length === 0)
      ? ('calibration_reliable_candidate' as const)
      : ('diagnostic_construction_leakage' as const),
  holdoutCaseCount: cases.length,
  alignedCount,
  bandAgreement: cases.length ? alignedCount / cases.length : null,
  runtimeGoldLeakCount: cases.filter((item) => item.runtimeGoldLeak).length,
  constructionIdentityLeakCount,
  missingLabelEvidenceCount: cases.filter((item) => item.labelEvidenceRefs.length === 0).length,
  sourceOverlapCaseCount: cases.filter((item) => item.sourceOverlapRefs.length > 0).length,
  mainstreamRecall: cases.length ? recognizedCount / cases.length : null,
  mainstreamUnknownRatio: cases.length ? (cases.length - recognizedCount) / cases.length : null,
  pairwiseHoldout: Object.freeze({
    status: 'pending' as const,
    caseCount: 0,
    alignedCount: 0,
    consistency: null,
    boundary:
      '已有 10 条关系正在生产 partial-order contract 中消费，不能再同时充当 source-disjoint Pairwise holdout。',
  }),
  productionPartialOrderRelationCount: current31ProductionPartialOrder.relationCount,
  cases,
  boundary:
    '现有 10 支样本没有直接读取 Gold Band，标签 URL 与运行时 URL 也不重叠，但全部精确 Variant 已进入 Reality Profile 构造表，预测档位可由 guideStanding 直接确定，因此只能保留为诊断样本，不能声称 source-disjoint holdout。Pairwise 已迁入独立的 production partial-order contract；真正的 Band/Pairwise holdout 均待建立。该门不证明同档全序或 Reference Performance。',
})
