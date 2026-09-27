import { current31IndependentConsensusGoldSet } from './current31IndependentConsensusGoldSet'
import { current31StrengthGoldSet } from './current31StrengthGoldSet'
import { current31VariantRealityProfileSet } from './current31VariantRealityProfile'
import {
  currentReviewedTeamSourceDirections,
  type ReviewedTeamSourceDirection,
} from '../gameDataPacks/reviewedTeamSourceDirections'
import { currentScopeManifest } from '../gameDataPacks/currentScopeManifest'

export type ReviewedTeamCoverageSource =
  | 'reviewed_source_direction'
  | 'consensus_observation'
  | 'strength_gold_identity'
  | 'strength_supplement'
  | 'reality_profile'

export type ReviewedTeamCoverageInput = {
  directions?: readonly ReviewedTeamSourceDirection[]
  authority: readonly {
    candidateId: string
    memberIds: readonly [string, string, string]
    bangbooId: string | null
    teamRating: { status: string }
  }[]
  overviewCandidateIds: ReadonlySet<string>
  detailCandidateIds: ReadonlySet<string>
  resolveRating: (input: {
    memberIds: readonly [string, string, string]
    bangbooId: string | null
  }) => {
    status: string
    ratingBand?: string
    confidence?: string
  }
}

export type ReviewedTeamCoverageRow = {
  memberIds: readonly [string, string, string]
  sources: readonly ReviewedTeamCoverageSource[]
  rating: 'rated' | 'unknown'
  defaultBangboo: 'has_default' | 'no_default'
  authority: boolean
  overview: boolean
  detail: boolean
  /** Consumer-query gaps; an explicit Unknown rating is reported separately. */
  gaps: readonly ('authority' | 'overview' | 'detail')[]
}

function memberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

/**
 * The denominator is every released exact trio already adopted by a current
 * source path. It deliberately does not read Gold case labels or holdout final
 * labels: those are evaluated by the production rating resolver, not copied
 * into this audit's source membership.
 */
export function current31AdoptedExactTeamCoverageSources(
  directions: readonly ReviewedTeamSourceDirection[] = currentReviewedTeamSourceDirections(),
) {
  const released = new Set(
    currentScopeManifest.entries
      .filter(
        (entry) =>
          entry.domain === 'agent' && entry.releaseState === 'released' && entry.accountOwnable,
      )
      .map((entry) => entry.stableId),
  )
  const sources = new Map<
    string,
    { memberIds: readonly [string, string, string]; sources: Set<ReviewedTeamCoverageSource> }
  >()
  const add = (
    memberIds: readonly [string, string, string],
    source: ReviewedTeamCoverageSource,
  ) => {
    if (memberIds.some((memberId) => !released.has(memberId))) return
    const key = memberKey(memberIds)
    const existing = sources.get(key)
    if (existing) existing.sources.add(source)
    else sources.set(key, { memberIds, sources: new Set([source]) })
  }
  for (const direction of directions) add(direction.memberIds, 'reviewed_source_direction')
  // Identity only: the Gold case's Band/confidence/final label is intentionally
  // not read into this audit. This keeps an injected direction list from
  // silently shrinking the adopted exact-three denominator.
  for (const goldCase of current31StrengthGoldSet.cases)
    add(goldCase.memberIds, 'strength_gold_identity')
  for (const observation of current31IndependentConsensusGoldSet.observations)
    add(observation.memberIds, 'consensus_observation')
  for (const supplement of current31StrengthGoldSet.versionedTeamStrengthSupplements)
    add(supplement.memberIds, 'strength_supplement')
  for (const profile of current31VariantRealityProfileSet.profiles)
    add(profile.memberIds, 'reality_profile')
  return [...sources.values()]
    .map((item) => ({ ...item, sources: [...item.sources].sort() }))
    .sort((left, right) => memberKey(left.memberIds).localeCompare(memberKey(right.memberIds)))
}

export function auditReviewedTeamCoverage(input: ReviewedTeamCoverageInput) {
  const authorityByMembers = new Map<string, (typeof input.authority)[number]>()
  for (const recommendation of input.authority)
    authorityByMembers.set(memberKey(recommendation.memberIds), recommendation)
  const rows: ReviewedTeamCoverageRow[] = current31AdoptedExactTeamCoverageSources(
    input.directions,
  ).map(({ memberIds, sources }) => {
    const authority = authorityByMembers.get(memberKey(memberIds))
    const resolved = input.resolveRating({ memberIds, bangbooId: authority?.bangbooId ?? null })
    const rating =
      resolved.status === 'rated' &&
      resolved.ratingBand !== 'Experimental' &&
      resolved.confidence !== 'experimental'
        ? 'rated'
        : 'unknown'
    const candidateId = authority?.candidateId ?? null
    const gaps = [
      ...(authority ? [] : (['authority'] as const)),
      ...(candidateId && input.overviewCandidateIds.has(candidateId)
        ? []
        : (['overview'] as const)),
      ...(candidateId && input.detailCandidateIds.has(candidateId) ? [] : (['detail'] as const)),
    ]
    return {
      memberIds,
      sources,
      rating,
      defaultBangboo: authority?.bangbooId ? 'has_default' : 'no_default',
      authority: Boolean(authority),
      overview: Boolean(candidateId && input.overviewCandidateIds.has(candidateId)),
      detail: Boolean(candidateId && input.detailCandidateIds.has(candidateId)),
      gaps,
    }
  })
  const releasedAgentIds = currentScopeManifest.entries
    .filter(
      (entry) =>
        entry.domain === 'agent' && entry.releaseState === 'released' && entry.accountOwnable,
    )
    .map((entry) => entry.stableId)
  const sourceCoveredAgentIds = new Set(rows.flatMap((row) => row.memberIds))
  return Object.freeze({
    contract: 'soda-reviewed-team-coverage-audit/v1' as const,
    fixtureBoundary:
      'Coverage is evaluated against the supplied Authority and consumer snapshot. A released synthetic fixture proves only released-path connectivity, never real-account ownership, readiness, saved-plan recovery, or product acceptance.',
    rows,
    // This independent structural denominator prevents an adopted-source union
    // from being mistaken for complete coverage of the released character set.
    releasedAgentCoverage: {
      total: releasedAgentIds.length,
      withReviewedExactTeam: releasedAgentIds.filter((id) => sourceCoveredAgentIds.has(id)).length,
      withoutReviewedExactTeam: releasedAgentIds.filter((id) => !sourceCoveredAgentIds.has(id)),
      boundary:
        'Character presence is not complete family, variant, Bangboo, or strength coverage.',
    },
    coverage: {
      adoptedExactTeamCount: rows.length,
      ratedCount: rows.filter((row) => row.rating === 'rated').length,
      unknownCount: rows.filter((row) => row.rating === 'unknown').length,
      defaultBangbooCount: rows.filter((row) => row.defaultBangboo === 'has_default').length,
      noDefaultBangbooCount: rows.filter((row) => row.defaultBangboo === 'no_default').length,
      authorityCount: rows.filter((row) => row.authority).length,
      overviewCount: rows.filter((row) => row.overview).length,
      detailCount: rows.filter((row) => row.detail).length,
    },
    gaps: rows.filter((row) => row.gaps.length > 0),
  })
}
