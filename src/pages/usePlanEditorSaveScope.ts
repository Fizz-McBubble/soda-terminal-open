import { useLocation } from 'react-router-dom'
import { usePageOperationScope } from '../components/usePageOperationScope'
import type { PlanEditorProps } from './PlanEditorProps'

export function usePlanEditorSaveScope(
  { warehouse, kind, analysisRunId, restored, team, profiles }: PlanEditorProps,
  appSessionId: string | undefined,
) {
  const location = useLocation()
  const scopeIdentity = JSON.stringify([
    appSessionId,
    warehouse.accountId,
    kind,
    analysisRunId,
    restored?.id,
    team?.id,
    profiles.map((profile) => profile.agentId),
    location.pathname,
    location.search,
  ])
  const captureSaveScope = usePageOperationScope(scopeIdentity)
  return { scopeIdentity, captureSaveScope }
}
