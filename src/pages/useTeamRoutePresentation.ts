import { useEffect, useState } from 'react'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  AccountDecisionSnapshot,
  CalculationQueryClient,
} from '../application/calculationQueryContract'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { currentTeamAnalysisSession, setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import {
  acceptTeamRoutePresentation,
  type TeamRoutePresentation,
} from './publicTeamRoutePresentation'

export function useTeamRoutePresentation({
  analysisRunId,
  warehouse,
  decision,
  teamKey,
  calculationClient,
}: {
  analysisRunId: string | undefined
  warehouse: CoreWarehouse
  decision: AccountDecisionSnapshot | undefined
  teamKey: string
  calculationClient: CalculationQueryClient | null
}) {
  const retainedSession = currentTeamAnalysisSession?.result
  const routeIdentity = `${analysisRunId ?? ''}:${warehouse.accountId ?? ''}:${decision?.fingerprint.inputHash ?? ''}:${teamKey}`
  const retainedRoute = retainedSession?.teamRoutePresentations?.[teamKey]
  const acceptedRetainedRoute = acceptTeamRoutePresentation(retainedRoute, {
    runId: analysisRunId ?? '',
    accountId: warehouse.accountId ?? '',
    inputFingerprint: decision?.fingerprint.inputHash ?? '',
    candidateId: teamKey,
  })
  const [routeState, setRouteState] = useState<{
    identity: string
    status: 'loading' | 'ready' | 'error'
    route: TeamRoutePresentation | null
  }>({
    identity: routeIdentity,
    status: acceptedRetainedRoute ? 'ready' : 'loading',
    route: acceptedRetainedRoute,
  })
  const route = routeState.identity === routeIdentity ? routeState.route : acceptedRetainedRoute
  const routeStatus =
    !acceptedRetainedRoute && (!analysisRunId || !decision || !calculationClient)
      ? 'error'
      : routeState.identity === routeIdentity
        ? routeState.status
        : acceptedRetainedRoute
          ? 'ready'
          : 'loading'
  useEffect(() => {
    if (acceptedRetainedRoute || !analysisRunId || !decision || !calculationClient) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setRouteState({ identity: routeIdentity, status: 'loading', route: null })
      void calculationClient
        .queryTeamRoutePresentation({
          contractVersion: calculationQueryContractVersion,
          kind: 'team_route_presentation',
          runId: analysisRunId,
          candidateId: teamKey,
        })
        .then((value) => {
          if (!active) return
          const accepted = acceptTeamRoutePresentation(value, {
            runId: analysisRunId,
            accountId: warehouse.accountId ?? '',
            inputFingerprint: decision.fingerprint.inputHash,
            candidateId: teamKey,
          })
          if (!accepted) throw new Error('队伍详情已过期。')
          const session = currentTeamAnalysisSession
          if (
            session?.result.analysisRunId === analysisRunId &&
            session.result.inputFingerprint === decision.fingerprint.inputHash
          )
            setCurrentTeamAnalysisSession({
              ...session,
              result: {
                ...session.result,
                teamRoutePresentations: {
                  ...session.result.teamRoutePresentations,
                  [teamKey]: accepted,
                },
              },
            })
          setRouteState({ identity: routeIdentity, status: 'ready', route: accepted })
        })
        .catch(() => {
          if (active) setRouteState({ identity: routeIdentity, status: 'error', route: null })
        })
    })
    return () => {
      active = false
    }
  }, [
    acceptedRetainedRoute,
    analysisRunId,
    calculationClient,
    decision,
    routeIdentity,
    teamKey,
    warehouse.accountId,
  ])
  return { retainedSession, route, routeStatus }
}
