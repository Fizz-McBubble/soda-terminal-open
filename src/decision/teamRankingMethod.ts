import {
  teamRatingDimensions,
  type DecisionConfidenceBand,
  type TeamFeatureBand,
  type TeamFeatureDimension,
  type TeamFeatureVector,
  type TeamRatingBand,
  type TeamRatingResult,
} from './teamDecisionAuthority'

export const teamRankingMethodPolicy = Object.freeze({
  contract: 'soda-team-ranking-method/v1',
  authority: 'candidate',
  productionEligible: false,
  objective: 'standard-formed-generic-team-reference',
  order: 'categorical-band-then-known-dimension-dominance',
  tie: 'equal-or-incomparable',
  score: 'none',
  excludedInputs: [
    'source-tier',
    'publisher',
    'popularity',
    'editorial-label',
    'account-state',
    'continuous-community-score',
  ],
  boundary:
    'Candidate general-team comparison only. It never creates a continuous score, never consumes source/account rank, and does not claim a comparison when known dimensions trade off or remain unknown.',
} as const)

const ratingBandOrder: Readonly<Record<TeamRatingBand, number>> = Object.freeze({
  'S+': 0,
  S: 1,
  'A+': 2,
  A: 3,
  'B+': 3.5,
  B: 4,
  C: 4.5,
  Experimental: 5,
})

const featureBandOrder: Readonly<Record<Exclude<TeamFeatureBand, 'unknown'>, number>> =
  Object.freeze({
    excellent: 3,
    good: 2,
    mixed: 1,
    weak: 0,
  })

const strengthDimensions = teamRatingDimensions.filter(
  (dimension) => dimension !== 'evidence_confidence',
)

export type TeamRankingMethodInput = {
  /** Source-free seven-dimensional mechanism rating, never the calibrated final band. */
  mechanicRating: TeamRatingResult
  featureVector: TeamFeatureVector
}

export type TeamRankingMethodDecision = {
  contract: typeof teamRankingMethodPolicy.contract
  candidateId: string
  status: 'rated' | 'unsupported'
  ratingBand: TeamRatingBand | null
  confidence: DecisionConfidenceBand | null
  reasons: string[]
  featureFingerprint: string
}

function dimensionsById(vector: TeamFeatureVector) {
  return new Map(vector.dimensions.map((row) => [row.dimension, row] as const))
}

function comparableBand(
  left: TeamFeatureDimension,
  right: TeamFeatureDimension,
): readonly [number, number] | null {
  if (left.band === 'unknown' || right.band === 'unknown') return null
  return [featureBandOrder[left.band], featureBandOrder[right.band]]
}

export function createTeamRankingMethodDecision(
  input: TeamRankingMethodInput,
): TeamRankingMethodDecision {
  const { mechanicRating: rating, featureVector } = input
  const common = {
    contract: teamRankingMethodPolicy.contract,
    candidateId: rating.candidateId,
    featureFingerprint: featureVector.fingerprint,
  } as const
  if (rating.featureFingerprint !== featureVector.fingerprint)
    return {
      ...common,
      status: 'unsupported',
      ratingBand: null,
      confidence: null,
      reasons: ['Team Rating 与 Team Feature Vector 指纹不一致。'],
    }
  if (rating.status !== 'rated')
    return {
      ...common,
      status: 'unsupported',
      ratingBand: null,
      confidence: null,
      reasons: [
        rating.status === 'hard_invalid'
          ? '候选存在机制硬排除。'
          : '候选存在 mechanic-critical 缺口。',
        ...rating.blockerIds,
      ],
    }
  if (rating.ratingBand === 'Experimental' || rating.confidence === 'experimental')
    return {
      ...common,
      status: 'unsupported',
      ratingBand: null,
      confidence: null,
      reasons: ['证据或规则完整性不足，不能形成通用强度比较。'],
    }
  return {
    ...common,
    status: 'rated',
    ratingBand: rating.ratingBand,
    confidence: rating.confidence,
    reasons: [],
  }
}

/**
 * Compare only decisions that the candidate method can place in one common
 * categorical band. Confidence is diagnostic and never changes strength.
 */
export function compareTeamRankingMethod(
  left: TeamRankingMethodInput,
  right: TeamRankingMethodInput,
): 'left' | 'right' | 'tie' | 'incomparable' | 'unsupported' {
  const leftDecision = createTeamRankingMethodDecision(left)
  const rightDecision = createTeamRankingMethodDecision(right)
  if (leftDecision.status !== 'rated' || rightDecision.status !== 'rated') return 'unsupported'
  const leftBand = ratingBandOrder[leftDecision.ratingBand!]
  const rightBand = ratingBandOrder[rightDecision.ratingBand!]
  if (leftBand !== rightBand) return leftBand < rightBand ? 'left' : 'right'

  const leftDimensions = dimensionsById(left.featureVector)
  const rightDimensions = dimensionsById(right.featureVector)
  let leftDominates = false
  let rightDominates = false
  for (const dimension of strengthDimensions) {
    const leftRow = leftDimensions.get(dimension)
    const rightRow = rightDimensions.get(dimension)
    if (!leftRow || !rightRow) return 'incomparable'
    const comparable = comparableBand(leftRow, rightRow)
    if (!comparable) {
      // Equal unknown states do not prove one team stronger; they are neutral
      // only when both sides lack the same dimension.
      if (leftRow.band === 'unknown' && rightRow.band === 'unknown') continue
      return 'incomparable'
    }
    const [leftValue, rightValue] = comparable
    if (leftValue > rightValue) leftDominates = true
    if (rightValue > leftValue) rightDominates = true
    if (leftDominates && rightDominates) return 'incomparable'
  }
  if (leftDominates) return 'left'
  if (rightDominates) return 'right'
  return 'tie'
}
