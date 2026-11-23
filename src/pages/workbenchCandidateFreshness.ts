import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'
import { isDevelopmentCandidateSnapshotStale } from './agentDevelopmentCandidateSession'
import type { PersonalDevelopmentCapture } from './personalDevelopmentSessionStore'
import type { AnalysisRefresh } from './agentDevelopmentWorkbenchViewState'

export function workbenchCandidateIsStale(
  personalCapture: PersonalDevelopmentCapture | null,
  personalCurrent: boolean,
  decisionWorld: AccountDecisionWorldContextValue,
  analysisRefresh: AnalysisRefresh | null,
  legacyCandidateSnapshot: Parameters<typeof isDevelopmentCandidateSnapshotStale>[0] | null,
) {
  return personalCapture
    ? !personalCurrent
    : decisionWorld.status === 'stale' ||
        Boolean(analysisRefresh) ||
        (legacyCandidateSnapshot
          ? isDevelopmentCandidateSnapshotStale(
              legacyCandidateSnapshot,
              decisionWorld.liveFingerprint,
            )
          : false)
}
