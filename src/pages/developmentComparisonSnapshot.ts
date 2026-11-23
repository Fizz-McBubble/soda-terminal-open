import type { DevelopmentCandidateAlternativesQueryResult } from '../application/calculationQueryContract'
import type { PersonalDevelopmentCandidatesResult } from '../application/publicPersonalDevelopment'

export type DevelopmentComparisonSnapshot =
  | DevelopmentCandidateAlternativesQueryResult
  | PersonalDevelopmentCandidatesResult
export type DevelopmentComparisonData = Omit<DevelopmentCandidateAlternativesQueryResult, 'runId'>

/** UI operation identity; a personal session is never registered as an account decision run. */
export function developmentComparisonIdentity(snapshot: DevelopmentComparisonSnapshot) {
  return 'sessionId' in snapshot ? `personal:${snapshot.sessionId}` : snapshot.runId
}
