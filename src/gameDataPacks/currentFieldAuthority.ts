import { gameData31CurrentFields, type CurrentCanonicalField } from './gameData31CurrentCanonical'
import { currentVersionProjection } from './currentVersionProjection'
import { stableContentHash } from './types'

export const currentFieldApplicabilities = [
  'verified_current',
  'continuous',
  'stale',
  'not_applicable',
] as const
export type CurrentFieldApplicability = (typeof currentFieldApplicabilities)[number]

export type CurrentFieldAuthorityCandidate = {
  id: string
  subjectId: string
  fieldPath: string
  sourceVersion: string
  evaluatedForVersion: string | null
  evidence: 'formal' | 'candidate' | 'reference_only' | 'missing'
  currentApplicability: CurrentFieldApplicability
  affectedByDelta: boolean
  freshness: 'current' | 'stale' | 'unknown'
  supersedes: readonly string[]
  sourceRefs: readonly string[]
  contentHash: string
}

export type CurrentFieldResolution =
  | {
      status: 'resolved'
      targetVersion: string
      winner: CurrentFieldAuthorityCandidate
      consideredIds: readonly string[]
      fingerprint: string
    }
  | {
      status: 'unresolved'
      targetVersion: string
      winner: null
      consideredIds: readonly string[]
      reason: 'no_candidate_evaluated_for_target'
      fingerprint: string
    }

const applicabilityRank: Record<CurrentFieldApplicability, number> = {
  verified_current: 0,
  continuous: 1,
  stale: 2,
  not_applicable: 3,
}

const evidenceRank: Record<CurrentFieldAuthorityCandidate['evidence'], number> = {
  formal: 0,
  candidate: 1,
  reference_only: 2,
  missing: 3,
}

function versionParts(value: string) {
  const match = value.match(/^(\d+)\.(\d+)/)
  return match ? [Number(match[1]), Number(match[2])] : [-1, -1]
}

function byAuthority(left: CurrentFieldAuthorityCandidate, right: CurrentFieldAuthorityCandidate) {
  if (
    applicabilityRank[left.currentApplicability] !== applicabilityRank[right.currentApplicability]
  )
    return (
      applicabilityRank[left.currentApplicability] - applicabilityRank[right.currentApplicability]
    )
  if (evidenceRank[left.evidence] !== evidenceRank[right.evidence])
    return evidenceRank[left.evidence] - evidenceRank[right.evidence]
  const [leftMajor, leftMinor] = versionParts(left.sourceVersion)
  const [rightMajor, rightMinor] = versionParts(right.sourceVersion)
  if (leftMajor !== rightMajor) return rightMajor - leftMajor
  if (leftMinor !== rightMinor) return rightMinor - leftMinor
  return left.id.localeCompare(right.id)
}

/**
 * Resolves only candidates explicitly evaluated for the requested version. Source version is
 * provenance, never an applicability claim, so input order and a newer-looking source string
 * cannot bypass the target-version gate.
 */
export function resolveCurrentFieldAuthority(
  candidates: readonly CurrentFieldAuthorityCandidate[],
  targetVersion = currentVersionProjection.gameVersion,
): CurrentFieldResolution {
  const consideredIds = candidates.map((candidate) => candidate.id).sort()
  const usable = candidates.filter(
    (candidate) =>
      candidate.evaluatedForVersion === targetVersion &&
      candidate.freshness === 'current' &&
      candidate.evidence !== 'missing' &&
      candidate.sourceRefs.some((ref) => ref.trim().length > 0) &&
      candidate.contentHash.trim().length > 0 &&
      (candidate.currentApplicability === 'verified_current' ||
        candidate.currentApplicability === 'continuous'),
  )
  const eligible = usable
    .filter(
      (candidate) =>
        !usable.some(
          (other) =>
            other.id !== candidate.id &&
            other.subjectId === candidate.subjectId &&
            other.fieldPath === candidate.fieldPath &&
            other.supersedes.includes(candidate.id),
        ),
    )
    .sort(byAuthority)
  const winner = eligible[0] ?? null
  const fingerprint = stableContentHash({ targetVersion, consideredIds, winner })
  return winner
    ? { status: 'resolved', targetVersion, winner, consideredIds, fingerprint }
    : {
        status: 'unresolved',
        targetVersion,
        winner: null,
        consideredIds,
        reason: 'no_candidate_evaluated_for_target',
        fingerprint,
      }
}

function evidenceFor(field: CurrentCanonicalField): CurrentFieldAuthorityCandidate['evidence'] {
  if (field.status === 'formal') return 'formal'
  if (field.status === 'candidate') return 'candidate'
  return 'missing'
}

function evaluatedForVersion(field: CurrentCanonicalField) {
  return field.currentApplicability === 'verified_current' ||
    field.currentApplicability === 'continuous'
    ? currentVersionProjection.gameVersion
    : null
}

function projectField(field: CurrentCanonicalField): CurrentFieldAuthorityCandidate {
  const core = {
    id: field.id,
    subjectId: field.domain,
    fieldPath: field.fieldPath,
    sourceVersion: field.originalSourceVersion,
    evaluatedForVersion: evaluatedForVersion(field),
    evidence: evidenceFor(field),
    currentApplicability: field.currentApplicability,
    affectedByDelta:
      field.affectedVersion === currentVersionProjection.gameVersion ||
      field.effect === 'change' ||
      field.effect === 'overlay' ||
      field.effect === 'conflict',
    freshness:
      field.currentApplicability === 'stale'
        ? ('stale' as const)
        : field.currentApplicability === 'not_applicable'
          ? ('unknown' as const)
          : ('current' as const),
    supersedes: [] as readonly string[],
    sourceRefs: field.sourceRefs,
  }
  return { ...core, contentHash: stableContentHash(core) }
}

const entries = gameData31CurrentFields.map(projectField)
const projectionCore = {
  schema: 'soda-current-field-authority/v1' as const,
  id: 'current-field-authority-3.1-r1' as const,
  targetVersion: currentVersionProjection.gameVersion,
  entries,
  coverage: {
    total: entries.length,
    evaluatedForCurrent: entries.filter(
      (entry) => entry.evaluatedForVersion === currentVersionProjection.gameVersion,
    ).length,
    stale: entries.filter((entry) => entry.freshness === 'stale').length,
    affectedByDelta: entries.filter((entry) => entry.affectedByDelta).length,
  },
}

export const currentFieldAuthority = {
  ...projectionCore,
  fingerprint: stableContentHash(projectionCore),
}
