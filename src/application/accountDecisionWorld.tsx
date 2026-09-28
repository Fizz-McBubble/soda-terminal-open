/* eslint-disable react-refresh/only-export-components -- provider and its typed consumer hooks form one application boundary */
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { type AccountDecisionRun, type CalculationQueryClient } from './calculationQueryContract'
import { getActiveAccount } from '../accounts/repository'
import { AppLoadingState } from '../components/AppEntryState'
import {
  type AccountDecisionWorldContextValue,
  type RuntimeSelectionReader,
  readableCalculationError,
  observeRuntimeSelection,
  loadWorldInput,
  accountDecisionNextAction,
  createAccountDecisionRun,
  retainOrCreateInitialAccountDecisionRun,
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
  const requestGeneration = useRef(0)
  const activeRefreshGeneration = useRef<number | null>(null)
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
        try {
          return await guarded(async () => {
            state.runs.add(query.runId)
            result = await queryClient.calculateAccountDecision(query)
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
      queryDevelopmentCandidateAlternatives: (query) =>
        queryRun(query.runId, () => queryClient.queryDevelopmentCandidateAlternatives(query)),
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
      requestGeneration.current += 1
      for (const id of state.runs) queryClient.releaseAccountDecisionRun?.(id)
      state.runs.clear()
    }
  }, [queryClient])
  const [run, setRun] = useState<AccountDecisionRun | null>(null)
  const [calculationError, setCalculationError] = useState<string | null>(null)
  const [repairError, setRepairError] = useState<string | null>(null)
  const [runtimeSelectionRevision, setRuntimeSelectionRevision] = useState(0)
  const runRef = useRef<AccountDecisionRun | null>(null)
  const runtimeObservation = useLiveQuery(
    () => observeRuntimeSelection(runtimeSelectionReader),
    [runtimeSelectionReader, runtimeSelectionRevision],
  )
  const liveFingerprint = useMemo(() => {
    if (!liveInput?.warehouse.accountId) return null
    return queryClient.fingerprintAccountDecisionInput(liveInput, run?.runId)
  }, [liveInput, queryClient, run?.runId])

  useEffect(() => {
    if (liveInput === undefined || runtimeObservation === undefined) return
    let active = true
    if (
      runtimeObservation.status === 'error' ||
      runtimeObservation.selection.status === 'unbound'
    ) {
      // Clear the synchronous ref before the next selection can be observed; React state is then
      // cleared in the queued update to keep this subscription effect render-safe.
      if (runRef.current) scopedClient.releaseAccountDecisionRun?.(runRef.current.runId)
      runRef.current = null
      queueMicrotask(() => {
        if (!active) return
        setRun(null)
      })
      return () => {
        active = false
      }
    }
    if (!liveInput || !liveFingerprint) {
      queueMicrotask(() => {
        if (!active) return
        runRef.current = null
        setRun(null)
      })
      return () => {
        active = false
      }
    }
    if (runRef.current || activeRefreshGeneration.current !== null) return
    // The BOX landing page reads saved plans without needing a full warehouse
    // decision. Its explicit Analyze action already calls refresh(). Starting
    // that same calculation here blocks first paint and then repeats the work.
    if (!autoCalculate) return
    const generation = ++requestGeneration.current
    void retainOrCreateInitialAccountDecisionRun(null, liveInput, scopedClient)
      .then((next) => {
        if (!active || generation !== requestGeneration.current) {
          scopedClient.releaseAccountDecisionRun?.(next.runId)
          return
        }
        runRef.current = next
        setRun(next)
        setCalculationError(null)
      })
      .catch((error: unknown) => {
        if (active && generation === requestGeneration.current)
          setCalculationError(readableCalculationError(error))
      })
    return () => {
      active = false
    }
  }, [liveFingerprint, liveInput, scopedClient, runtimeObservation, autoCalculate])

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current
    activeRefreshGeneration.current = generation
    let pendingRun: AccountDecisionRun | null = null
    // Explicit refresh may immediately follow a committed save, before liveQuery
    // re-renders. Read the source again instead of capturing the pre-save closure.
    try {
      const input = await loadWorldInput()
      if (!input?.warehouse.accountId || input.warehouse.accountId !== accountId) return null
      const runtime = await runtimeSelectionReader()
      if (runtime.status === 'unbound') throw new Error(runtime.message)
      const next = await createAccountDecisionRun(input, { client: scopedClient })
      pendingRun = next
      const latestInput = await loadWorldInput()
      if (
        generation !== requestGeneration.current ||
        !scope.current.active ||
        latestInput?.warehouse.accountId !== accountId ||
        scopedClient.fingerprintAccountDecisionInput(latestInput) !==
          scopedClient.fingerprintAccountDecisionInput(input)
      ) {
        scopedClient.releaseAccountDecisionRun?.(next.runId)
        return null
      }
      if (runRef.current && runRef.current.runId !== next.runId)
        scopedClient.releaseAccountDecisionRun?.(runRef.current.runId)
      runRef.current = next
      setRun(next)
      setCalculationError(null)
      return next
    } catch (error) {
      if (pendingRun && runRef.current?.runId !== pendingRun.runId)
        scopedClient.releaseAccountDecisionRun?.(pendingRun.runId)
      if (scope.current.active && generation === requestGeneration.current) {
        setCalculationError(readableCalculationError(error))
      }
      return null
    } finally {
      if (activeRefreshGeneration.current === generation) {
        activeRefreshGeneration.current = null
        if (scope.current.active) setRuntimeSelectionRevision((current) => current + 1)
      }
    }
  }, [accountId, scopedClient, runtimeSelectionReader])

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
    if (runtimeObservation === undefined)
      return {
        status: 'loading',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        refresh,
        repairApplicationData,
        liveInput,
      }
    if (runtimeObservation.status === 'error')
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: runtimeObservation.message,
        canRepairApplicationData: false,
        refresh,
        repairApplicationData,
        liveInput,
      }
    if (runtimeObservation.selection.status === 'unbound')
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: repairError ?? runtimeObservation.selection.message,
        canRepairApplicationData: repairRuntimeSelection !== null,
        refresh,
        repairApplicationData,
        liveInput,
      }
    if (calculationError)
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: calculationError,
        canRepairApplicationData: false,
        refresh,
        repairApplicationData,
        liveInput,
      }
    if (liveInput === undefined)
      return {
        status: 'loading',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        refresh,
        repairApplicationData,
        liveInput,
      }
    if (!liveInput || !liveFingerprint)
      return {
        status: 'unavailable',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        refresh,
        repairApplicationData,
        liveInput,
      }
    if (!run || run.input.warehouse.accountId !== liveInput.warehouse.accountId)
      return {
        status: autoCalculate ? 'loading' : 'unavailable',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        refresh,
        repairApplicationData,
        liveInput,
      }
    const status = run.inputFingerprint === liveFingerprint ? 'current' : 'stale'
    return {
      status,
      run,
      liveFingerprint,
      nextAction: accountDecisionNextAction(
        status === 'stale' ? 'stale' : run.claimStatus,
        run.decisionAuthority,
      ),
      refresh,
      repairApplicationData,
      liveInput,
    }
  }, [
    calculationError,
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
