import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  calculationQueryContractVersion,
  type AccountDecisionQueryInput,
  type CalculationQueryClient,
  type DecisionPortfolioQueryResult,
  type DevelopmentCandidateAlternativesQueryResult,
  type TargetTeamEquipmentParameterSelection,
  type TargetTeamWarehouseFitQueryResult,
} from './calculationQueryContract'
import { type AccountDecisionWorldContextValue } from './accountDecisionWorldModel'
import { createAccountDecisionRun } from './publicAccountDecisionRun'

export const AccountDecisionWorldContext = createContext<AccountDecisionWorldContextValue | null>(
  null,
)

export const CalculationQueryClientContext = createContext<CalculationQueryClient | null>(null)

export function useDecisionPortfolioQuery(
  runId: string | null | undefined,
  teamCount: number | null,
  lockedTemplateIds: readonly string[],
  equipmentParametersByCandidateId?: Readonly<
    Record<string, TargetTeamEquipmentParameterSelection>
  >,
) {
  const client = useContext(CalculationQueryClientContext)
  const lockedKey = lockedTemplateIds.join('|')
  const equipmentParametersKey = JSON.stringify(
    Object.entries(equipmentParametersByCandidateId ?? {}).toSorted(([left], [right]) =>
      left.localeCompare(right),
    ),
  )
  const [result, setResult] = useState<DecisionPortfolioQueryResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    if (!client || !runId || teamCount === null) {
      queueMicrotask(() => {
        setResult(null)
        setStatus('idle')
      })
      return
    }
    let active = true
    queueMicrotask(() => setStatus('loading'))
    void client
      .queryDecisionPortfolio({
        contractVersion: calculationQueryContractVersion,
        kind: 'decision_portfolio',
        runId,
        teamCount,
        lockedTemplateIds: lockedKey ? lockedKey.split('|') : [],
        equipmentParametersByCandidateId:
          equipmentParametersKey === '[]'
            ? undefined
            : Object.fromEntries(
                JSON.parse(equipmentParametersKey) as [
                  string,
                  TargetTeamEquipmentParameterSelection,
                ][],
              ),
      })
      .then((next) => {
        if (!active) return
        setResult(next)
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setResult(null)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [client, equipmentParametersKey, lockedKey, runId, teamCount])

  return { status, result }
}

export function useTargetTeamWarehouseFitCalculation() {
  const client = useContext(CalculationQueryClientContext)
  return useCallback(
    async (
      runId: string,
      candidateId: string,
      equipmentParameters?: import('./calculationQueryContract').TargetTeamEquipmentParameterSelection,
    ): Promise<TargetTeamWarehouseFitQueryResult> => {
      if (!client) throw new Error('Calculation/Query client is unavailable.')
      return client.calculateTargetTeamWarehouseFit({
        contractVersion: calculationQueryContractVersion,
        kind: 'target_team_warehouse_fit',
        runId,
        candidateId,
        equipmentParameters,
      })
    },
    [client],
  )
}

/** Creates a separate, cached query run without replacing the live account world. */
export function useReleaseAccountDecisionRun() {
  const client = useContext(CalculationQueryClientContext)
  return useCallback((runId: string) => client?.releaseAccountDecisionRun?.(runId), [client])
}

export function useDetachedAccountDecisionCalculation() {
  const client = useContext(CalculationQueryClientContext)
  return useCallback(
    (input: AccountDecisionQueryInput) => {
      if (!client) throw new Error('当前分析服务不可用，请重试。')
      return createAccountDecisionRun(input, { client })
    },
    [client],
  )
}

export function useDevelopmentCandidateAlternativesCalculation() {
  const client = useContext(CalculationQueryClientContext)
  return useCallback(
    async (
      runId: string,
      agentId: string,
      candidateParametersByRank?: import('./calculationQueryContract').DevelopmentCandidateAlternativesQuery['candidateParametersByRank'],
    ): Promise<DevelopmentCandidateAlternativesQueryResult> => {
      if (!client) throw new Error('Calculation/Query client is unavailable.')
      return client.queryDevelopmentCandidateAlternatives({
        contractVersion: calculationQueryContractVersion,
        kind: 'development_candidate_alternatives',
        runId,
        agentId,
        candidateParametersByRank,
      })
    },
    [client],
  )
}

export function useDevelopmentWorkbenchRouteCalculation() {
  const client = useContext(CalculationQueryClientContext)
  return useCallback(
    async (
      runId: string,
      selection: import('./publicDevelopmentWorkbenchRoute').DevelopmentWorkbenchRouteSelection,
    ): Promise<
      import('./publicDevelopmentWorkbenchRoute').DevelopmentWorkbenchRoutePresentation
    > => {
      if (!client) throw new Error('Calculation/Query client is unavailable.')
      return client.queryDevelopmentWorkbenchRoute({
        contractVersion: calculationQueryContractVersion,
        kind: 'development_workbench_route',
        runId,
        selection,
      })
    },
    [client],
  )
}

export function useAccountDecisionWorld() {
  const value = useContext(AccountDecisionWorldContext)
  if (!value)
    throw new Error('Account Decision consumer must be inside AccountDecisionWorldProvider.')
  return value
}

export function useOptionalAccountDecisionWorld() {
  return useContext(AccountDecisionWorldContext)
}

export function useReviewedIncrementalEvent32Calculation() {
  const client = useContext(CalculationQueryClientContext)
  return useCallback(
    async (
      runId: string,
      input: import('./publicReviewedIncrementalEvent32').ReviewedIncrementalEventInput32Dto,
    ) => {
      if (!client?.queryReviewedIncrementalEvent32)
        throw new Error('单次命中计算服务不可用，请刷新应用。')
      return client.queryReviewedIncrementalEvent32({
        contractVersion: calculationQueryContractVersion,
        kind: 'reviewed_incremental_event32',
        runId,
        input,
      })
    },
    [client],
  )
}

export function useCommonAnomalySettlement32Calculation() {
  const client = useContext(CalculationQueryClientContext)
  return useCallback(
    async (
      runId: string,
      input:
        | import('./publicCommonAnomalySettlement32').PublicCommonAnomalySettlementInput32
        | null,
    ) => {
      if (!client?.queryCommonAnomalySettlement32)
        throw new Error('风异常声明结算服务不可用，请刷新应用。')
      return client.queryCommonAnomalySettlement32({
        contractVersion: calculationQueryContractVersion,
        kind: 'common_anomaly_settlement32',
        runId,
        input,
      })
    },
    [client],
  )
}
