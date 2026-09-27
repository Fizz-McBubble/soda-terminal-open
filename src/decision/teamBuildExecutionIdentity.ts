import type { BangbooSelection } from '../teamEngine/contracts'

/**
 * Exact identity needed to allocate physical discs and project equipment actions.
 * A Team Engine candidate is structurally compatible, but its ranking, kernel,
 * and numerical score are not prerequisites for a source-backed warehouse fit.
 */
export type TeamBuildExecutionIdentity = {
  candidateId: string
  memberIds: [string, string, string]
  bangbooId: string | null
  /** Present only when the resolved Engine identity carried an exact Bangboo star. */
  bangbooStar?: 1 | 2 | 3 | 4 | 5 | null
  bangbooSelection?: BangbooSelection
  /** Empty means unavailable, never an invented combat scenario. */
  scenarioTags: string[]
  /** Omitted by existing Engine candidates and legacy saved projections. */
  provenance?: 'authority_exact'
}

export function hasUnresolvedAuthorityScenario(candidate: TeamBuildExecutionIdentity) {
  return candidate.provenance === 'authority_exact' && candidate.scenarioTags.length === 0
}
