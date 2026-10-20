import type { TeamRatingBand } from './teamDecisionAuthority'

export const current31IndependentQualityEvaluationContractId =
  'soda-current-3.1-independent-quality-evaluation/v1' as const

export type IndependentQualityCase = {
  caseId: string
  labelIndependent: boolean
  acceptanceProtocolVerified: boolean
  expectedBand: TeamRatingBand
  predictedBand: TeamRatingBand | null
}

export type IndependentQualityMetric = {
  status: 'pass' | 'fail' | 'not_evaluated'
  numerator: number
  denominator: number
  observed: number | null
}

export type IndependentQualityEvaluation = {
  caseCount: number
  labelIndependentCaseCount: number
  evaluationEligibleCaseCount: number
  excludedExposedCaseCount: number
  excludedUnfrozenCaseCount: number
  effectivePredictionCaseCount: number
  unknownPredictionCaseCount: number
  bandAgreement: IndependentQualityMetric
  pairwiseConsistency: IndependentQualityMetric
  mainstreamUnknownRatio: IndependentQualityMetric
}

const ratingRank: Record<TeamRatingBand, number> = {
  'S+': 0,
  S: 1,
  'A+': 2,
  A: 3,
  B: 4,
  Experimental: 5,
}

function ratioMetric(
  numerator: number,
  denominator: number,
  minimum: number | null,
): IndependentQualityMetric {
  if (denominator === 0) {
    return Object.freeze({
      status: 'not_evaluated' as const,
      numerator,
      denominator,
      observed: null,
    })
  }

  const observed = numerator / denominator
  return Object.freeze({
    status:
      minimum === null
        ? ('pass' as const)
        : observed >= minimum
          ? ('pass' as const)
          : ('fail' as const),
    numerator,
    denominator,
    observed,
  })
}

function hasEffectivePrediction(
  item: IndependentQualityCase,
): item is IndependentQualityCase & { predictedBand: Exclude<TeamRatingBand, 'Experimental'> } {
  return item.predictedBand !== null && item.predictedBand !== 'Experimental'
}

export function evaluateCurrent31IndependentQualityCases(input: {
  cases: readonly IndependentQualityCase[]
  bandAgreementTarget: number
  pairwiseConsistencyTarget: number
  mainstreamUnknownRatioMaximum: number
}): IndependentQualityEvaluation {
  const labelIndependentCases = input.cases.filter((item) => item.labelIndependent)
  const evaluationEligibleCases = labelIndependentCases.filter(
    (item) => item.acceptanceProtocolVerified,
  )
  const effectivePredictionCases = evaluationEligibleCases.filter(hasEffectivePrediction)
  const unknownPredictionCaseCount =
    evaluationEligibleCases.length - effectivePredictionCases.length

  const alignedBandCount = effectivePredictionCases.filter(
    (item) => item.predictedBand === item.expectedBand,
  ).length

  let comparablePairCount = 0
  let alignedPairCount = 0
  for (let leftIndex = 0; leftIndex < effectivePredictionCases.length; leftIndex += 1) {
    const left = effectivePredictionCases[leftIndex]!
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < effectivePredictionCases.length;
      rightIndex += 1
    ) {
      const right = effectivePredictionCases[rightIndex]!
      if (ratingRank[left.expectedBand] === ratingRank[right.expectedBand]) continue

      const expectedStronger =
        ratingRank[left.expectedBand] < ratingRank[right.expectedBand] ? left : right
      const expectedWeaker = expectedStronger === left ? right : left

      comparablePairCount += 1
      if (ratingRank[expectedStronger.predictedBand] < ratingRank[expectedWeaker.predictedBand]) {
        alignedPairCount += 1
      }
    }
  }

  const mainstreamUnknownRatio = ratioMetric(
    unknownPredictionCaseCount,
    evaluationEligibleCases.length,
    null,
  )
  const mainstreamUnknownRatioStatus =
    evaluationEligibleCases.length === 0
      ? ('not_evaluated' as const)
      : mainstreamUnknownRatio.observed! <= input.mainstreamUnknownRatioMaximum
        ? ('pass' as const)
        : ('fail' as const)

  return Object.freeze({
    caseCount: input.cases.length,
    labelIndependentCaseCount: labelIndependentCases.length,
    evaluationEligibleCaseCount: evaluationEligibleCases.length,
    excludedExposedCaseCount: input.cases.length - labelIndependentCases.length,
    excludedUnfrozenCaseCount: labelIndependentCases.length - evaluationEligibleCases.length,
    effectivePredictionCaseCount: effectivePredictionCases.length,
    unknownPredictionCaseCount,
    bandAgreement: ratioMetric(
      alignedBandCount,
      effectivePredictionCases.length,
      input.bandAgreementTarget,
    ),
    pairwiseConsistency: ratioMetric(
      alignedPairCount,
      comparablePairCount,
      input.pairwiseConsistencyTarget,
    ),
    mainstreamUnknownRatio: Object.freeze({
      ...mainstreamUnknownRatio,
      status: mainstreamUnknownRatioStatus,
    }),
  })
}
