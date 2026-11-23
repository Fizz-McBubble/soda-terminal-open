import { useSyncExternalStore } from 'react'
import { getTeamAnalysisSession, subscribeTeamAnalysisSession } from './teamAnalysisSession'

export function useTeamAnalysisSession() {
  return useSyncExternalStore(
    subscribeTeamAnalysisSession,
    getTeamAnalysisSession,
    getTeamAnalysisSession,
  )
}
