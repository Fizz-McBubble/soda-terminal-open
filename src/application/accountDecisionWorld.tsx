/* eslint-disable react-refresh/only-export-components -- provider and its typed consumer hooks form one application boundary */
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { type AccountDecisionRun, type CalculationQueryClient } from './calculationQueryContract'
import { getActiveAccount } from '../accounts/repository'
import { AppLoadingState } from '../components/AppEntryState'
import { useAccountDecisionCalculation } from './useAccountDecisionCalculation'
import { useAccountDecisionRunLiveness } from './useAccountDecisionRunLiveness'
import {
  type AccountDecisionWorldContextValue,
  type RuntimeSelectionReader,
  readableCalculationError,
  observeRuntimeSelection,
  loadWorldInput,
  accountDecisionNextAction,
} from './accountDecisionWorldModel'
import {
  AccountDecisionWorldContext,
  CalculationQueryClientContext,
} from './accountDecisionWorldHooks'
export {
  useDecisionPortfolioQuery,
  useTargetTeamWarehouseFitCalculation,
  useReleaseAccountDecisionRun,
  useDetachedAccountDecisionCalculation,
  useDevelopmentCandidateAlternativesCalculation,
  useDevelopmentWorkbenchRouteCalculation,
  useReviewedIncrementalEvent32Calculation,
  useAccountDecisionWorld,
  useOptionalAccountDecisionWorld,
} from './accountDecisionWorldHooks'

export {
  type AccountDecisionWorldInput,
  type AccountDecisionNextAction,
  type AccountDecisionWorld,
  accountDecisionNextAction,
  createAccountDecisionRun,
  retainOrCreateInitialAccountDecisionRun,
} from './accountDecisionWorldModel'

export type { AccountDecisionRun }

export type AccountDecisionWorldProviderProps = {
  children: ReactNode
  queryClient: CalculationQueryClient
  runtimeSelectionReader: RuntimeSelectionReader
  repairRuntimeSelection: (() => Promise<unknown>) | null
  autoCalculate?: boolean
}

export function AccountDecisionWorldProvider({
  children,
  queryClient,
  runtimeSelectionReader,
  repairRuntimeSelection,
  autoCalculate = true,
}: AccountDecisionWorldProviderProps) {
  const identity = useLiveQuery(async () => ({ account: await getActiveAccount() }), [])
  // Do not mount editable consumers under a temporary loading key and discard their input
  // when the independent account lookup completes.
  if (!identity) return <AppLoadingState title="正在读取当前账户资料" />
  const account = identity.account
  return (
    <AccountScopedDecisionWorldProvider
      key={account?.id ?? 'no-account'}
      accountId={account?.id ?? null}
      queryClient={queryClient}
      runtimeSelectionReader={runtimeSelectionReader}
      repairRuntimeSelection={repairRuntimeSelection}
      autoCalculate={autoCalculate}
    >
      {children}
    </AccountScopedDecisionWorldProvider>
  )
}

function AccountScopedDecisionWorldProvider({
  children,
  accountId,
  queryClient,
  runtimeSelectionReader,
  repairRuntimeSelection,
  autoCalculate,
}: {
  children: ReactNode
  accountId: string | null
  queryClient: CalculationQueryClient
  runtimeSelectionReader: RuntimeSelectionReader
  repairRuntimeSelection: (() => Promise<unknown>) | null
  autoCalculate: boolean
}) {
  const liveInput = useLiveQuery(async () => {
    const input = await loadWorldInput()
    return input?.warehouse.accountId === accountId ? input : null
  }, [accountId])
  const scope = useRef({ active: true, epoch: 0, runs: new Set<string>() })
  const scopedClient = useMemo<CalculationQueryClient>(() => {
    const state = scope.current
    const assertCurrent = async (epoch: number) => {
      const current = await getActiveAccount()
      if (!state.active || state.epoch !== epoch || current?.id !== accountId)
        throw new Error('账户已切换，请在当前账户重新分析。')
    }
    const guarded = async <T,>(operation: () => Promise<T>) => {
      const epoch = state.epoch
      await assertCurrent(epoch)
      const result = await operation()
      await assertCurrent(epoch)
      return result
    }
    const queryRun = <T,>(runId: string, operation: () => Promise<T>) =>
      guarded(async () => {
        if (!state.runs.has(runId)) throw new Error('分析结果已释放，请在当前账户重新分析。')
        const result = await operation()
        if (!state.runs.has(runId)) throw new Error('分析结果已更新，请使用新的分析结果。')
        return result
      })
    return {
      ...queryClient,
      releaseAccountDecisionRun(runId) {
        state.runs.delete(runId)
        queryClient.releaseAccountDecisionRun?.(runId)
      },
      async calculateAccountDecision(query) {
        if (query.input.warehouse.accountId !== accountId)
          throw new Error('分析输入不属于当前账户。')
        let result: AccountDecisionRun | undefined
        state.runs.add(query.runId)
        try {
          return await guarded(async () => {
            if (!state.runs.has(query.runId)) throw new Error('本次分析已取消，可重新分析。')
            result = await queryClient.calculateAccountDecision(query)
            if (!state.runs.has(query.runId)) throw new Error('本次分析已取消，可重新分析。')
            return result
          })
        } catch (error) {
          state.runs.delete(query.runId)
          queryClient.releaseAccountDecisionRun?.(result?.runId ?? query.runId)
          throw error
        }
      },
      queryDecisionPortfolio: (query) =>
        queryRun(query.runId, () => queryClient.queryDecisionPortfolio(query)),
      calculateTargetTeamWarehouseFit: (query) =>
        queryRun(query.runId, () => queryClient.calculateTargetTeamWarehouseFit(query)),
      queryTeamOverviewPresentation: (query, internal) =>
        queryRun(query.runId, () => queryClient.queryTeamOverviewPresentation(query, internal)),
      queryTeamRoutePresentation: (query) =>
        queryRun(query.runId, () => queryClient.queryTeamRoutePresentation(query)),
      querySavedTeamPlanReplay: (query) =>
        queryRun(query.runId, () => queryClient.querySavedTeamPlanReplay(query)),
      querySavedTeamSolutionComponents: (query) =>
        queryRun(query.runId, () => queryClient.querySavedTeamSolutionComponents(query)),
      queryDevelopmentCandidateAlternatives: (query) =>
        queryRun(query.runId, () => queryClient.queryDevelopmentCandidateAlternatives(query)),
      queryDevelopmentWorkbenchRoute: (query) =>
        queryRun(query.runId, () => queryClient.queryDevelopmentWorkbenchRoute(query)),
      queryWarehouseDiscTransitionUses: queryClient.queryWarehouseDiscTransitionUses
        ? (query, options) =>
            queryRun(query.runId, () =>
              queryClient.queryWarehouseDiscTransitionUses!(query, options),
            )
        : undefined,
    }
  }, [accountId, queryClient])
  useEffect(() => {
    const state = scope.current
    state.active = true
    return () => {
      state.active = false
      state.epoch += 1
      for (const id of state.runs) queryClient.releaseAccountDecisionRun?.(id)
      state.runs.clear()
    }
  }, [queryClient])
  const [repairError, setRepairError] = useState<string | null>(null)
  const [runtimeSelectionRevision, setRuntimeSelectionRevision] = useState(0)
  const runtimeObservation = useLiveQuery(
    () => observeRuntimeSelection(runtimeSelectionReader),
    [runtimeSelectionReader, runtimeSelectionRevision],
  )
  const reviewRuntime = useCallback(() => setRuntimeSelectionRevision((current) => current + 1), [])
  const {
    run,
    error: calculationError,
    calculation,
    cancelled,
    refresh,
    cancelCalculation,
  } = useAccountDecisionCalculation({
    accountId,
    liveInput,
    client: scopedClient,
    runtimeObservation,
    runtimeSelectionReader,
    autoCalculate,
    reviewRuntime,
  })
  const liveFingerprint = useMemo(() => {
    if (!liveInput?.warehouse.accountId) return null
    return queryClient.fingerprintAccountDecisionInput(liveInput, run?.runId)
  }, [liveInput, queryClient, run?.runId])
  const retained = useAccountDecisionRunLiveness(queryClient, run?.runId)

  const repairApplicationData = useCallback(async () => {
    if (
      !repairRuntimeSelection ||
      runtimeObservation === undefined ||
      runtimeObservation.status !== 'ready' ||
      runtimeObservation.selection.status !== 'unbound'
    ) {
      setRepairError('当前无法确认游戏资料状态，请稍后重试。')
      return null
    }
    try {
      await repairRuntimeSelection()
      setRepairError(null)
      setRuntimeSelectionRevision((current) => current + 1)
      return await refresh()
    } catch (error) {
      setRepairError(readableCalculationError(error))
      return null
    }
  }, [refresh, runtimeObservation, repairRuntimeSelection])

  const value = useMemo<AccountDecisionWorldContextValue>(() => {
    const common = {
      refresh,
      repairApplicationData,
      liveInput,
      calculation:
        calculation ??
        (liveInput === undefined
          ? { phase: 'reading_account' as const, startedAt: null }
          : runtimeObservation === undefined
            ? { phase: 'preparing_rules' as const, startedAt: null }
            : null),
      calculationCancelled: cancelled,
      cancelCalculation,
    }
    if (runtimeObservation === undefined)
      return {
        status: 'loading',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        ...common,
      }
    if (runtimeObservation.status === 'error')
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: runtimeObservation.message,
        canRepairApplicationData: false,
        ...common,
      }
    if (runtimeObservation.selection.status === 'unbound')
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: repairError ?? runtimeObservation.selection.message,
        canRepairApplicationData: repairRuntimeSelection !== null,
        ...common,
      }
    if (calculationError)
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: calculationError,
        canRepairApplicationData: false,
        ...common,
      }
    if (liveInput === undefined)
      return {
        status: 'loading',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        ...common,
      }
    if (!liveInput || !liveFingerprint)
      return {
        status: 'unavailable',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        ...common,
      }
    if (!run || run.input.warehouse.accountId !== liveInput.warehouse.accountId)
      return {
        status: autoCalculate ? 'loading' : 'unavailable',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        ...common,
      }
    const status = run.inputFingerprint === liveFingerprint && retained ? 'current' : 'stale'
    return {
      status,
      run,
      liveFingerprint,
      nextAction: accountDecisionNextAction(
        status === 'stale' ? 'stale' : run.claimStatus,
        run.decisionAuthority,
      ),
      ...common,
    }
  }, [
    calculationError,
    calculation,
    cancelled,
    cancelCalculation,
    retained,
    liveFingerprint,
    liveInput,
    refresh,
    repairApplicationData,
    repairError,
    repairRuntimeSelection,
    run,
    runtimeObservation,
    autoCalculate,
  ])

  return (
    <CalculationQueryClientContext.Provider value={scopedClient}>
      <AccountDecisionWorldContext.Provider value={value}>
        {children}
      </AccountDecisionWorldContext.Provider>
    </CalculationQueryClientContext.Provider>
  )
}
