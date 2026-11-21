import { createAccountCalculationScope } from './accountCalculationScope'
/* eslint-disable react-refresh/only-export-components -- provider and its typed consumer hooks form one application boundary */
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { type AccountDecisionRun, type CalculationQueryClient } from './calculationQueryContract'
import { getActiveAccount } from '../accounts/repository'
import type { AccountProfile } from '../accounts/types'
import { AppLoadingState } from '../components/AppEntryState'
import { useAccountDecisionCalculation } from './useAccountDecisionCalculation'
import { useAccountDecisionRunLiveness } from './useAccountDecisionRunLiveness'
import { useAccountDecisionObservation } from './useAccountDecisionObservation'
import { useLiveDecisionFingerprint } from './useLiveDecisionFingerprint'
import {
  type AccountDecisionWorldContextValue,
  type RuntimeSelectionReader,
  readableCalculationError,
  observeRuntimeSelection,
  accountDecisionNextAction,
} from './accountDecisionWorldModel'
import {
  AccountDecisionWorldContext,
  CalculationQueryClientContext,
  DevelopmentDirectoryScaffoldContext,
} from './accountDecisionWorldHooks'
import {
  loadDevelopmentDirectoryScaffold,
  type DevelopmentDirectoryScaffoldReady,
} from './developmentDirectoryScaffold'
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
  useDevelopmentDirectoryScaffold,
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
  observeInput?: boolean | 'disabled'
  enableDevelopmentDirectoryScaffold?: boolean
}

export function AccountDecisionWorldProvider({
  children,
  queryClient,
  runtimeSelectionReader,
  repairRuntimeSelection,
  autoCalculate = true,
  observeInput = true,
  enableDevelopmentDirectoryScaffold = false,
}: AccountDecisionWorldProviderProps) {
  const [identityAttempt, setIdentityAttempt] = useState(0)
  const [identityTimedOutAttempt, setIdentityTimedOutAttempt] = useState<number | null>(null)
  const identity = useLiveQuery(async () => {
    try {
      return { attempt: identityAttempt, account: await getActiveAccount(), failed: false as const }
    } catch {
      return { attempt: identityAttempt, failed: true as const }
    }
  }, [identityAttempt])
  const currentIdentity = identity?.attempt === identityAttempt ? identity : undefined
  useEffect(() => {
    if (currentIdentity || identityTimedOutAttempt === identityAttempt) return
    const timer = setTimeout(() => setIdentityTimedOutAttempt(identityAttempt), 10_000)
    return () => clearTimeout(timer)
  }, [currentIdentity, identityAttempt, identityTimedOutAttempt])
  const retryIdentity = () => {
    setIdentityTimedOutAttempt(null)
    setIdentityAttempt((attempt) => attempt + 1)
  }
  // Do not mount editable consumers under a temporary loading key and discard their input
  // when the independent account lookup completes.
  if (identityTimedOutAttempt === identityAttempt || currentIdentity?.failed)
    return (
      <section className="app-entry-state" role="alert">
        <h1>当前账户资料暂时无法读取</h1>
        <p>请重试。</p>
        <button className="button button--primary" type="button" onClick={retryIdentity}>
          重试读取账户
        </button>
      </section>
    )
  if (!currentIdentity) return <AppLoadingState title="正在读取当前账户资料" />
  const account = currentIdentity.account ?? null
  return (
    <AccountScopedDecisionWorldProvider
      activeAccount={account}
      accountId={account?.id ?? null}
      queryClient={queryClient}
      runtimeSelectionReader={runtimeSelectionReader}
      repairRuntimeSelection={repairRuntimeSelection}
      autoCalculate={autoCalculate}
      observeInput={observeInput}
      enableDevelopmentDirectoryScaffold={enableDevelopmentDirectoryScaffold}
    >
      {children}
    </AccountScopedDecisionWorldProvider>
  )
}

function AccountScopedDecisionWorldProvider({
  children,
  activeAccount,
  accountId,
  queryClient,
  runtimeSelectionReader,
  repairRuntimeSelection,
  autoCalculate,
  observeInput,
  enableDevelopmentDirectoryScaffold,
}: {
  children: ReactNode
  activeAccount: AccountProfile | null
  accountId: string | null
  queryClient: CalculationQueryClient
  runtimeSelectionReader: RuntimeSelectionReader
  repairRuntimeSelection: (() => Promise<unknown>) | null
  autoCalculate: boolean
  observeInput: boolean | 'disabled'
  enableDevelopmentDirectoryScaffold: boolean
}) {
  const { liveInput, observingInput, rememberRequestedInput } = useAccountDecisionObservation({
    accountId,
    activeAccount,
    observeInput,
  })
  const accountIdentity = useMemo(() => ({ accountId }), [accountId])
  const directoryScaffoldScopeIdentity = useMemo(
    () => ({ accountId, enabled: enableDevelopmentDirectoryScaffold }),
    [accountId, enableDevelopmentDirectoryScaffold],
  )
  const scopedLiveInputReady = Boolean(accountId && liveInput?.warehouse.accountId === accountId)
  const [directoryScaffoldRead, setDirectoryScaffoldRead] = useState<
    | (DevelopmentDirectoryScaffoldReady & { scope: typeof directoryScaffoldScopeIdentity })
    | {
        status: 'failed'
        accountId: string
        scope: typeof directoryScaffoldScopeIdentity
      }
    | null
  >(null)
  const [directoryScaffoldRevision, setDirectoryScaffoldRevision] = useState(0)
  const retryDirectoryScaffold = useCallback(() => {
    setDirectoryScaffoldRead((current) =>
      current?.scope === directoryScaffoldScopeIdentity ? null : current,
    )
    setDirectoryScaffoldRevision((revision) => revision + 1)
  }, [directoryScaffoldScopeIdentity])
  useEffect(() => {
    const scopeIdentity = directoryScaffoldScopeIdentity
    if (!enableDevelopmentDirectoryScaffold || !accountId || scopedLiveInputReady) {
      queueMicrotask(() => {
        setDirectoryScaffoldRead((current) => (current?.scope === scopeIdentity ? null : current))
      })
      return
    }
    let active = true
    void loadDevelopmentDirectoryScaffold(accountId).then((result) => {
      if (!active) return
      if (result.status === 'ready')
        setDirectoryScaffoldRead({
          status: 'ready',
          accountId: result.accountId,
          roster: result.roster,
          priorityAgentIds: result.priorityAgentIds,
          scope: scopeIdentity,
        })
      else if (result.status === 'failed' || result.status === 'no_account')
        setDirectoryScaffoldRead({
          status: 'failed',
          accountId,
          scope: scopeIdentity,
        })
    })
    return () => {
      active = false
    }
  }, [
    accountId,
    directoryScaffoldRevision,
    directoryScaffoldScopeIdentity,
    enableDevelopmentDirectoryScaffold,
    scopedLiveInputReady,
  ])
  const directoryScaffold = useMemo(() => {
    if (!enableDevelopmentDirectoryScaffold || !accountId || scopedLiveInputReady) return null
    if (directoryScaffoldRead?.scope === directoryScaffoldScopeIdentity)
      return {
        ...directoryScaffoldRead,
        scope: directoryScaffoldScopeIdentity,
        retry: retryDirectoryScaffold,
      }
    return {
      status: 'loading' as const,
      accountId,
      scope: directoryScaffoldScopeIdentity,
      retry: retryDirectoryScaffold,
    }
  }, [
    accountId,
    directoryScaffoldRead,
    directoryScaffoldScopeIdentity,
    enableDevelopmentDirectoryScaffold,
    retryDirectoryScaffold,
    scopedLiveInputReady,
  ])
  // Keep the visible page mounted when the account or its calculation client changes.
  const calculationScope = useMemo(
    () => createAccountCalculationScope(queryClient, accountIdentity),
    [queryClient, accountIdentity],
  )
  const scopedClient = calculationScope.client
  useLayoutEffect(() => calculationScope.activate(), [calculationScope])
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
    refresh: refreshAccountDecision,
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
  const refresh = useCallback(async () => {
    const result = await refreshAccountDecision()
    if (result) rememberRequestedInput(result.input)
    return result
  }, [refreshAccountDecision, rememberRequestedInput])
  const liveFingerprint = useLiveDecisionFingerprint(queryClient, run, liveInput)
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
    const sameAccountRun = Boolean(
      run && liveInput?.warehouse.accountId === run.input.warehouse.accountId,
    )
    const analysisIssue: AccountDecisionWorldContextValue['analysisIssue'] =
      run && !retained
        ? { kind: 'run_lost', message: cancelled ? '分析已取消。' : '分析连接已中断，请重试分析。' }
        : runtimeObservation?.status === 'error'
          ? { kind: 'runtime_unavailable', message: runtimeObservation.message }
          : calculationError
            ? { kind: 'calculation_failed', message: calculationError }
            : null
    const common = {
      refresh,
      repairApplicationData,
      liveInput,
      analysisIssue,
      calculation:
        calculation ??
        (!observingInput
          ? null
          : liveInput === undefined
            ? { phase: 'reading_account' as const, startedAt: null }
            : runtimeObservation === undefined
              ? { phase: 'preparing_rules' as const, startedAt: null }
              : null),
      calculationCancelled: cancelled,
      cancelCalculation,
    }
    if (runtimeObservation === undefined && !sameAccountRun)
      return {
        status: 'loading',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        ...common,
      }
    if (runtimeObservation?.status === 'error' && !sameAccountRun)
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: runtimeObservation.message,
        canRepairApplicationData: false,
        ...common,
      }
    if (runtimeObservation?.status === 'ready' && runtimeObservation.selection.status === 'unbound')
      return {
        status: 'error',
        run: null,
        liveFingerprint: null,
        nextAction: null,
        message: repairError ?? runtimeObservation.selection.message,
        canRepairApplicationData: repairRuntimeSelection !== null,
        ...common,
      }
    if (calculationError && !sameAccountRun)
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
    const status = run.inputFingerprint === liveFingerprint ? 'current' : 'stale'
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
    observingInput,
  ])

  return (
    <DevelopmentDirectoryScaffoldContext.Provider value={directoryScaffold}>
      <CalculationQueryClientContext.Provider value={scopedClient}>
        <AccountDecisionWorldContext.Provider value={value}>
          {children}
        </AccountDecisionWorldContext.Provider>
      </CalculationQueryClientContext.Provider>
    </DevelopmentDirectoryScaffoldContext.Provider>
  )
}
