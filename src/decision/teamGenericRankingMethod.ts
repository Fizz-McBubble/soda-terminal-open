import { resolveSourcePreferenceOrder } from './sourcePreferenceOrder'
import type { TeamRatingResult } from './teamDecisionAuthority'
import type { CurrentTeamSystemRanking } from './teamSystemRanking'
import { referenceRatingBands, type GenericReferenceInterval } from './teamReferenceInterval'
import { graduatedTeamRatingBands } from './graduatedTeamRatingBands'
export type { GenericReferenceInterval } from './teamReferenceInterval'
import {
  finiteTeamPlayContract,
  isCompleteFiniteTeamPlay,
  type FiniteTeamPlay,
} from './teamFinitePlayContract'
import { isAdmittedTeamPlay } from '../domain/teamPlayMechanismContract'

export const teamGenericRankingPolicy = Object.freeze({
  contract: 'soda-generic-team-ranking/v1',
  objective: 'formed-generic-team-recommendation',
  order: 'applicable-reference-intervals-then-reviewed-partial-order',
  fullTimelineRequired: false,
  diagnosticCapacityIsStrength: false,
  independentAccuracyClaimed: false,
  candidateDomain: 'unique-three-agent-identities-not-playable-team-count',
  screening: 'identity-then-mechanic-and-build-conditions-then-strength-evidence',
  evidenceEncoding: 'graded-objects-and-interned-direction-proofs-with-play-binding/v2',
  structuralPlayContract: finiteTeamPlayContract,
  mechanismAdmission: 'team-play-mechanism/v1',
  catalogContract: 'finite-team-play-catalog/v1',
  legacyStrengthGold: 'historical-diagnostic-prior-not-current-reference',
})
export const genericRankingBands = referenceRatingBands
export const genericRankingConfidences = ['high', 'medium', 'low'] as const
export const genericRankingAuthorities = [
  'strength_gold',
  'variant_reality_profile',
  'single_publisher_tier',
  'local_editorial_estimate',
  'mechanism_direction',
] as const
export const genericRankingClassificationBases = [
  'reviewed_exact_team_output_module',
  'primary_special_output_family',
  'anomaly_output_capacity',
  'standard_direct_output',
] as const

/** Encoding only: no source adoption, rating or ranking inference. Each proof
 * retains its actual primary, classification and distinct source identities. */
export function createGenericRankingProofEncoder(agentIds: readonly string[]) {
  const agents = new Map(agentIds.map((id, index) => [id, index]))
  if (agents.size !== agentIds.length) throw new Error('Duplicate proof agent identity')
  const sourceRefs: string[] = []
  const proofs: number[][] = []
  const sourcesByRef = new Map<string, number>()
  const proofsByValue = new Map<string, number>()
  return {
    sourceRefs,
    proofs,
    classificationBases: [...genericRankingClassificationBases],
    intern(input: {
      memberIds: readonly string[]
      primaryOutputAgentId: string | null
      classificationBasis: string | null
      sourceRefs: readonly string[]
    }) {
      const primary =
        input.primaryOutputAgentId === null ? -1 : agents.get(input.primaryOutputAgentId)
      const basis = genericRankingClassificationBases.findIndex(
        (value) => value === input.classificationBasis,
      )
      if (
        input.memberIds.length !== 3 ||
        new Set(input.memberIds).size !== 3 ||
        input.memberIds.some((id) => !agents.has(id)) ||
        primary === undefined ||
        (input.primaryOutputAgentId !== null &&
          !input.memberIds.includes(input.primaryOutputAgentId)) ||
        (input.classificationBasis !== null && basis < 0) ||
        input.sourceRefs.some((ref) => typeof ref !== 'string' || !ref || ref.trim() !== ref)
      )
        throw new Error('Invalid compact proof identity')
      const refs = [...new Set(input.sourceRefs)].map((ref) => {
        let index = sourcesByRef.get(ref)
        if (index === undefined) {
          index = sourceRefs.length
          sourceRefs.push(ref)
          sourcesByRef.set(ref, index)
        }
        return index
      })
      const proof = [primary, basis, ...refs]
      const identity = JSON.stringify(proof)
      let index = proofsByValue.get(identity)
      if (index === undefined) {
        index = proofs.length
        proofs.push(proof)
        proofsByValue.set(identity, index)
      }
      return index
    },
  }
}

/** Lossless evidence view only. Index values are dictionary coordinates, never
 * a strength score. The reader additionally verifies each row's membership. */
export function decodeGenericRankingProof(
  dictionaries: {
    agentIds: readonly string[]
    classificationBases: readonly string[]
    sourceRefs: readonly string[]
  },
  proof: readonly number[],
) {
  const [primary, basis, ...refs] = proof
  if (
    proof.length < 2 ||
    !proof.every(Number.isInteger) ||
    primary! < -1 ||
    primary! >= dictionaries.agentIds.length ||
    basis! < -1 ||
    basis! >= dictionaries.classificationBases.length ||
    refs.some((index) => index < 0 || index >= dictionaries.sourceRefs.length) ||
    new Set(refs).size !== refs.length
  )
    throw new Error('Invalid compact proof coordinate')
  const classificationBasis =
    genericRankingClassificationBases.find(
      (value) => value === dictionaries.classificationBases[basis!],
    ) ?? null
  const sourceRefs = refs.map((index) => dictionaries.sourceRefs[index]!)
  if (
    (basis! >= 0 && classificationBasis === null) ||
    sourceRefs.some((ref) => typeof ref !== 'string' || !ref || ref.trim() !== ref)
  )
    throw new Error('Invalid compact proof dictionary value')
  return {
    primaryOutputAgentId: dictionaries.agentIds[primary!] ?? null,
    classificationBasis,
    sourceRefs,
  }
}
export type GenericRankingBand = (typeof genericRankingBands)[number]
export type GenericRankingInput = {
  key: string
  mechanicAllowed: boolean
  applicable: boolean
  withdrawn: boolean
  sourceExcluded: boolean
  band: string | null
  confidence: string | null
  authority: string
  evidenceRefs: readonly string[]
  referenceInterval?: GenericReferenceInterval | null
  mechanismDirection?: {
    status: string
    evidenceRefs: readonly string[]
    primaryOutputAgentId?: string | null
    /** Older persisted directions without this contract remain exploration. */
    playability?: FiniteTeamPlay | null
  }
}
export type GenericRankingDecision = {
  key: string
  status: 'recommended' | 'exploration' | 'unsupported'
  band: GenericRankingBand | null
  confidence: (typeof genericRankingConfidences)[number] | null
  authority: string
  reason: string | null
  displayOrder: number
  referenceInterval?: GenericReferenceInterval | null
}

const named = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const sourced = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(named)
export function hasValidGenericReferenceInterval(
  input: Pick<GenericRankingInput, 'referenceInterval' | 'band' | 'authority' | 'confidence'>,
) {
  const value = input.referenceInterval
  if (value == null) return true
  const lower = genericRankingBands.indexOf(value.lower),
    upper = genericRankingBands.indexOf(value.upper)
  return (
    lower >= 0 &&
    upper >= 0 &&
    lower >= upper &&
    input.band === value.lower &&
    input.authority === 'local_editorial_estimate' &&
    input.confidence === 'low' &&
    value.scope === 'formed_generic_reference' &&
    value.confidence === 'low' &&
    named(value.claimId) &&
    named(value.referenceIdentity) &&
    named(value.rationale) &&
    sourced(value.sourceRefs) &&
    sourced(value.conditions) &&
    sourced(value.limitations)
  )
}

/** Three distinct members need actual roles and named conditions. This is a
 * finite play, not a specialty quota, rotation, or whole-team strength claim. */
function hasFiniteTeamPlay(input: GenericRankingInput): boolean {
  const direction = input.mechanismDirection
  return (
    direction?.status === 'conditional' &&
    sourced(direction.evidenceRefs) &&
    direction.primaryOutputAgentId === direction.playability?.primaryOutputAgentId &&
    isCompleteFiniteTeamPlay(direction.playability, input.key) &&
    isAdmittedTeamPlay(direction.playability!, input.key)
  )
}

/** Lists, details and saved-current ratings all read the same adopted grade.
 * An inference may remain a selectable exploration; it cannot retain a model S
 * label after the generic authority declined to assign it a strength band. */
export function projectGenericTeamRating(
  rating: TeamRatingResult,
  ranking: CurrentTeamSystemRanking | null,
): TeamRatingResult {
  if (rating.status !== 'rated') return rating
  const generic = ranking?.genericOrder
  if (generic?.status === 'recommended' && generic.band && generic.confidence) {
    const interval = generic.referenceInterval
    return {
      ...rating,
      ratingBand: generic.band,
      confidence: generic.confidence,
      referenceInterval: interval ?? undefined,
      playAdmission: undefined,
      ...(interval
        ? {
            explanation: `成型搭配参考${interval.lower === interval.upper ? interval.lower : `${interval.lower}～${interval.upper}`}，低置信度。${interval.rationale}`,
            tradeoffs: [...interval.conditions, ...interval.limitations],
          }
        : {}),
    }
  }
  if (generic?.status === 'exploration' || (generic?.status === 'recommended' && !generic.band))
    return {
      ...rating,
      ratingBand: 'Experimental',
      confidence: 'experimental',
      referenceInterval: undefined,
      playAdmission: generic?.status === 'recommended' ? 'complete_conditional_play' : undefined,
      explanation:
        generic?.status === 'recommended'
          ? '有来源支持的接受者与搭配方向；需要满足触发条件，队伍强弱尚不确定。'
          : '该组合尚无适用的通用强度结论，可手动查看构筑条件。',
    }
  return {
    contract: rating.contract,
    status: 'blocked',
    candidateId: rating.candidateId,
    featureFingerprint: rating.featureFingerprint,
    blockerIds: ['generic_team_not_eligible'],
    explanation: '当前搭配未通过推荐条件核对，请查看具体条件。',
  }
}

/** Evidence determines the precision of a judgement, never a damage multiplier.
 * Missing rotation timing does not make a legal trio invalid. Model-only bands
 * remain exploration and cannot acquire an independently reviewed source tier. */
export function genericTeamRankingDecision(input: GenericRankingInput): GenericRankingDecision {
  const base = { key: input.key, authority: input.authority, displayOrder: 0 }
  if (!input.mechanicAllowed || input.withdrawn)
    return {
      ...base,
      status: 'unsupported',
      band: null,
      confidence: null,
      reason: input.withdrawn ? 'withdrawn' : 'mechanic_constraint',
    }
  const band = genericRankingBands.find((value) => value === input.band)
  const confidence = genericRankingConfidences.find((value) => value === input.confidence)
  if (
    !hasFiniteTeamPlay(input) ||
    !input.applicable ||
    input.sourceExcluded ||
    !band ||
    !confidence ||
    !hasValidGenericReferenceInterval(input) ||
    input.authority === 'strength_gold' ||
    input.authority === 'mechanism_direction' ||
    !genericRankingAuthorities.some((value) => value === input.authority) ||
    !input.evidenceRefs.length
  )
    return hasFiniteTeamPlay(input)
      ? {
          ...base,
          authority: 'mechanism_direction',
          status: 'recommended',
          band: null,
          confidence: null,
          reason: 'conditional_mechanism_direction_strength_unrated',
        }
      : {
          ...base,
          status: 'exploration',
          band: null,
          confidence: null,
          reason: 'applicable_strength_evidence_pending',
        }
  return {
    ...base,
    status: 'recommended',
    band,
    confidence,
    reason: null,
    referenceInterval: input.referenceInterval ?? null,
  }
}

/** Only separated reference intervals establish an overall reference order.
 * Overlap is not a numerical tie or a licence to order by one damage packet. */
export function compareGenericTeamReferences(
  left: Pick<NonNullable<CurrentTeamSystemRanking['genericOrder']>, 'status' | 'band' | 'referenceInterval'>,
  right: Pick<NonNullable<CurrentTeamSystemRanking['genericOrder']>, 'status' | 'band' | 'referenceInterval'>,
) {
  const bounds = (row: typeof left) =>
    row.status === 'recommended' && row.band
      ? {
          best: graduatedTeamRatingBands.indexOf(row.referenceInterval?.upper ?? row.band),
          worst: graduatedTeamRatingBands.indexOf(row.referenceInterval?.lower ?? row.band),
        }
      : null
  const a = bounds(left),
    b = bounds(right)
  if (!a || !b) return 'unrated' as const
  if (a.worst < b.best) return 'left_preferred' as const
  if (b.worst < a.best) return 'right_preferred' as const
  return 'not_strictly_ordered' as const
}

/** Display linearization preserves the partial relation. It is not a new
 * strength rank: disconnected peers and rejected cyclic components stay tied. */
export function orderGenericTeamRanking(
  inputs: readonly GenericRankingInput[],
  relations: readonly (readonly [string, string])[],
) {
  if (new Set(inputs.map((row) => row.key)).size !== inputs.length)
    throw new Error('Duplicate generic ranking identity')
  const decisions = inputs
    .map(genericTeamRankingDecision)
    .sort((a, b) => a.key.localeCompare(b.key))
  const output: GenericRankingDecision[] = []
  let cycles = 0
  let activeRelations = 0
  const graded = decisions
    .filter((row) => row.band && row.status === 'recommended')
    .sort(
      (a, b) =>
        genericRankingBands.indexOf(a.referenceInterval?.upper ?? a.band!) -
          genericRankingBands.indexOf(b.referenceInterval?.upper ?? b.band!) ||
        a.key.localeCompare(b.key),
    )
  const intervalKey = (row: GenericRankingDecision) =>
    row.referenceInterval
      ? row.referenceInterval.lower + '|' + row.referenceInterval.upper
      : row.band + '|' + row.band
  const ordered = [...graded]
  for (const signature of new Set(graded.map(intervalKey))) {
    const positions = graded.flatMap((row, index) =>
      intervalKey(row) === signature ? [index] : [],
    )
    const peers = positions.map((index) => graded[index]!)
    const resolved = resolveSourcePreferenceOrder(peers, (row) => row.key, relations)
    cycles += resolved.cyclicComponentCount
    activeRelations += resolved.activeRelationCount
    positions.forEach((position, index) => {
      ordered[position] = resolved.ordered[index]!
    })
  }
  output.push(...ordered)
  output.push(...decisions.filter((row) => row.status === 'recommended' && row.band === null))
  output.push(...decisions.filter((row) => row.status === 'exploration'))
  output.push(...decisions.filter((row) => row.status === 'unsupported'))
  return { rows: output.map((row, i) => ({ ...row, displayOrder: i })), cycles, activeRelations }
}
