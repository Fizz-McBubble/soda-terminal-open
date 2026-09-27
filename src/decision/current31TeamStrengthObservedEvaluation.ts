import type { TeamRatingBand } from './teamDecisionAuthority'
import { current31Shiyu313ObservedCalibration } from './current31Shiyu313ObservedCalibration'
import { evaluateCurrent31TeamRating } from './current31TeamRating'

export const current31TeamStrengthObservedEvaluationContractId =
  'soda-current-3.1-team-strength-observed-evaluation/v1' as const

const ratingRank: Record<Exclude<TeamRatingBand, 'Experimental'>, number> = {
  'S+': 0,
  S: 1,
  'A+': 2,
  A: 3,
  B: 4,
}

export function compareObservedStrengthBands(
  higher: TeamRatingBand | null,
  lower: TeamRatingBand | null,
) {
  if (!higher || !lower || higher === 'Experimental' || lower === 'Experimental') return 'unknown'
  if (higher === lower) return 'tie'
  return ratingRank[higher] < ratingRank[lower] ? 'concordant' : 'discordant'
}

const unavailableBenchmark = {
  status: 'unavailable' as const,
  baselineId: null,
  outputIndex: null,
  unsupportedIssueIds: [] as string[],
  explanation:
    'Reference Performance 尚未在统一 Reference Build / Rotation 下闭合；观测评测不借用实战标签伪造 Benchmark。',
}

export type Current31ObservedTeamEvaluationInput = {
  observationId: string
  stage: string
  split: string
  rank: number
  memberIds: readonly [string, string, string]
}

export function evaluateCurrent31ObservedTeamSet(input: {
  datasetId: string
  observations: readonly Current31ObservedTeamEvaluationInput[]
  boundary: string
}) {
  const predictions = input.observations.map((observation) => {
    const result = evaluateCurrent31TeamRating({
      candidateId: `observed:${observation.observationId}`,
      memberIds: observation.memberIds,
      bangbooId: null,
      outputPotentialBand: 'unknown',
      benchmark: unavailableBenchmark,
    })
    return {
      observationId: observation.observationId,
      stage: observation.stage,
      split: observation.split,
      publishedRank: observation.rank,
      memberIds: observation.memberIds,
      predictedBand: result.rating.status === 'rated' ? result.rating.ratingBand : null,
      confidence: result.rating.status === 'rated' ? result.rating.confidence : null,
      mechanicValidity: result.mechanicValidity,
      mainstreamRecognitionStatus: result.mainstreamRecognition.status,
      metaCalibrationStatus: result.metaCalibration.status,
      recognized:
        result.mainstreamRecognition.status === 'confirmed' ||
        (result.rating.status === 'rated' && result.rating.ratingBand !== 'Experimental'),
    }
  })
  const predictionByObservationId = new Map(
    predictions.map((prediction) => [prediction.observationId, prediction]),
  )
  const evaluatedPairs = input.observations.flatMap((left, leftIndex, observations) =>
    observations.slice(leftIndex + 1).flatMap((right) => {
      if (left.stage !== right.stage || left.split !== right.split || left.rank === right.rank)
        return []
      const leftPrediction = predictionByObservationId.get(left.observationId)
      const rightPrediction = predictionByObservationId.get(right.observationId)
      if (!leftPrediction || !rightPrediction) return []
      const publishedHigher = left.rank < right.rank ? leftPrediction : rightPrediction
      const publishedLower = left.rank < right.rank ? rightPrediction : leftPrediction
      const higherBand = publishedHigher.predictedBand
      const lowerBand = publishedLower.predictedBand
      const relation = compareObservedStrengthBands(higherBand, lowerBand)
      return [
        {
          stage: left.stage,
          higherObservationId: publishedHigher.observationId,
          lowerObservationId: publishedLower.observationId,
          relation,
          strictlyConcordant: relation === 'concordant',
        },
      ]
    }),
  )
  const comparablePairs = evaluatedPairs.filter(
    (pair) => pair.relation === 'concordant' || pair.relation === 'discordant',
  )
  const recognizedCount = predictions.filter((item) => item.recognized).length
  const experimentalCount = predictions.filter(
    (item) => item.predictedBand === 'Experimental',
  ).length
  const strictConcordantPairCount = comparablePairs.filter((item) => item.strictlyConcordant).length
  return Object.freeze({
    contract: current31TeamStrengthObservedEvaluationContractId,
    datasetId: input.datasetId,
    gameVersion: '3.1.3',
    status: 'diagnostic_only' as const,
    predictionCount: predictions.length,
    recognizedCount,
    recognitionRatio: predictions.length ? recognizedCount / predictions.length : null,
    experimentalCount,
    mainstreamUnknownRatio: predictions.length ? experimentalCount / predictions.length : null,
    unknownPairCount: evaluatedPairs.filter((pair) => pair.relation === 'unknown').length,
    tiedPairCount: evaluatedPairs.filter((pair) => pair.relation === 'tie').length,
    evaluatedPairCount: evaluatedPairs.length,
    comparablePairCount: comparablePairs.length,
    strictConcordantPairCount,
    strictPairwiseConsistency:
      comparablePairs.length === 0 ? null : strictConcordantPairCount / comparablePairs.length,
    referencePerformanceCompleteCount: 0,
    predictions,
    comparablePairs,
    boundary: input.boundary,
  })
}

export const current31TeamStrengthObservedEvaluation = evaluateCurrent31ObservedTeamSet({
  datasetId: current31Shiyu313ObservedCalibration.contract,
  observations: current31Shiyu313ObservedCalibration.observations,
  boundary:
    '这是对当前模型的失败诊断，不是产品通过证明。发布排名受关卡、环境、样本与使用率影响；只用于检测主流组合识别缺口和同场景严格顺序偏差，不直接生成理论强度或账号培养优先级。',
})
