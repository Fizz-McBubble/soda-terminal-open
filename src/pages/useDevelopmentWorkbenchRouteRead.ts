import { useEffect, useState } from 'react'
import type { AccountDecisionRun } from '../application/calculationQueryContract'
import type {
  DevelopmentWorkbenchRoutePresentation,
  DevelopmentWorkbenchRouteSelection,
} from '../application/publicDevelopmentWorkbenchRoute'
import type { Props } from './agentDevelopmentWorkbenchViewState'
import {
  readDevelopmentWorkbenchRoute,
  rememberDevelopmentWorkbenchRoute,
} from './developmentWorkbenchRouteCache'

export function useDevelopmentWorkbenchRouteRead({
  currentRun,
  routeKey,
  routeSelection,
  queryDevelopmentWorkbenchRoute,
  analysisVersion,
  agentId,
}: {
  currentRun: AccountDecisionRun | null
  routeKey: string | null
  routeSelection: DevelopmentWorkbenchRouteSelection
  queryDevelopmentWorkbenchRoute: Props['queryDevelopmentWorkbenchRoute']
  analysisVersion: number
  agentId: string
}) {
  const [lastRouteProjection, setLastRouteProjection] = useState<{
    accountId: string
    agentId: string
    value: DevelopmentWorkbenchRoutePresentation
  } | null>(null)
  const [routeRead, setRouteRead] = useState<{
    key: string
    value: DevelopmentWorkbenchRoutePresentation
  } | null>(null)
  const [routeFailureKey, setRouteFailureKey] = useState<string | null>(null)
  useEffect(() => {
    if (!currentRun || !routeKey) return
    let active = true
    const cached = readDevelopmentWorkbenchRoute(routeKey)
    void (
      cached?.equipment
        ? Promise.resolve(cached)
        : queryDevelopmentWorkbenchRoute(currentRun.runId, routeSelection)
    )
      .then((value) => {
        if (active) {
          if (value.equipment) rememberDevelopmentWorkbenchRoute(routeKey, value)
          setRouteFailureKey(null)
          setRouteRead({ key: routeKey, value })
          setLastRouteProjection({
            accountId: currentRun.input.warehouse.accountId ?? '',
            agentId,
            value,
          })
        }
      })
      .catch(() => {
        if (active) {
          setRouteFailureKey(routeKey)
        }
      })
    return () => {
      active = false
    }
  }, [
    currentRun,
    routeKey,
    routeSelection,
    queryDevelopmentWorkbenchRoute,
    analysisVersion,
    agentId,
  ])
  return {
    lastRouteProjection,
    setLastRouteProjection,
    routeRead,
    setRouteRead,
    routeFailureKey,
    setRouteFailureKey,
  }
}
