import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AccountDecisionRun, CalculationQueryClient } from './calculationQueryContract'
import {
  createAccountDecisionRun,
  loadWorldInput,
  readableCalculationError,
  type AccountDecisionWorldContextValue,
  type AccountDecisionWorldInput,
  type RuntimeSelectionObservation,
  type RuntimeSelectionReader,
} from './accountDecisionWorldModel'

type PendingCalculation = {
  runId: string
  generation: number
  initial: boolean
  fingerprint: string | null
  startedAt: number
}

/** The account owns the request; changing the visible route does not discard it. */
export function useAccountDecisionCalculation({
  accountId,
  liveInput,
  client,
  runtimeObservation,
  runtimeSelectionReader,
  autoCalculate,
  reviewRuntime,
}: {
  accountId: string | null
  liveInput: AccountDecisionWorldInput | null | undefined
  client: CalculationQueryClient
  runtimeObservation: RuntimeSelectionObservation | undefined
  runtimeSelectionReader: RuntimeSelectionReader
  autoCalculate: boolean
  reviewRuntime: () => void
}) {
  const [run, setRun] = useState<AccountDecisionRun | null>(null)
  const runRef = useRef<AccountDecisionRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [calculation, setCalculation] =
    useState<AccountDecisionWorldContextValue['calculation']>(null)
  const [cancelled, setCancelled] = useState(false)
  const [previousClient, setPreviousClient] = useState(client)
  if (previousClient !== client) {
    setPreviousClient(client)
    setRun(null)
    setError(null)
    setCalculation(null)
    setCancelled(false)
  }
  const cancelledRef = useRef(false)
  const active = useRef(true)
  const generation = useRef(0)
  const pending = useRef<PendingCalculation | null>(null)
  const isCurrent = useCallback(
    (task: PendingCalculation) => active.current && generation.current === task.generation,
    [],
  )
  const discardPending = useCallback(() => {
    generation.current += 1
    const task = pending.current
    pending.current = null
    if (task) client.releaseAccountDecisionRun?.(task.runId)
  }, [client])

  useLayoutEffect(() => {
    active.current = true
    runRef.current = null
    cancelledRef.current = false
    return () => {
      active.current = false
      discardPending()
      if (runRef.current) client.releaseAccountDecisionRun?.(runRef.current.runId)
      runRef.current = null
    }
  }, [accountId, client, discardPending])

  const begin = useCallback(
    (capturedInput?: AccountDecisionWorldInput) => {
      discardPending()
      const task: PendingCalculation = {
        runId: crypto.randomUUID(),
        generation: generation.current,
        initial: capturedInput !== undefined,
        fingerprint: capturedInput ? client.fingerprintAccountDecisionInput(capturedInput) : null,
        startedAt: Date.now(),
      }
      pending.current = task
      cancelledRef.current = false
      // Defer subscription updates, while reserving the request synchronously to prevent duplicates.
      return Promise.resolve().then(async () => {
        if (!isCurrent(task)) return null
        setCancelled(false)
        setError(null)
        setCalculation({
          phase: capturedInput ? 'preparing_rules' : 'reading_account',
          startedAt: task.startedAt,
        })
        let next: AccountDecisionRun | null = null
        try {
          // A save may have committed before liveQuery updates; explicit refresh reads the source.
          const input = capturedInput ?? (await loadWorldInput())
          if (!isCurrent(task) || input?.warehouse.accountId !== accountId || !input) return null
          task.fingerprint = client.fingerprintAccountDecisionInput(input)
          setCalculation({ phase: 'preparing_rules', startedAt: task.startedAt })
          const runtime = await runtimeSelectionReader()
          if (!isCurrent(task)) return null
          if (runtime.status === 'unbound') throw new Error(runtime.message)
          setCalculation({ phase: 'analyzing', startedAt: task.startedAt })
          next = await createAccountDecisionRun(input, { client, runId: task.runId })
          const latestInput = await loadWorldInput()
          if (
            !isCurrent(task) ||
            latestInput?.warehouse.accountId !== accountId ||
            client.fingerprintAccountDecisionInput(latestInput) !== task.fingerprint
          ) {
            client.releaseAccountDecisionRun?.(next.runId)
            return null
          }
          if (runRef.current && runRef.current.runId !== next.runId)
            client.releaseAccountDecisionRun?.(runRef.current.runId)
          runRef.current = next
          setRun(next)
          return next
        } catch (cause) {
          if (next && runRef.current?.runId !== next.runId)
            client.releaseAccountDecisionRun?.(next.runId)
          if (isCurrent(task)) setError(readableCalculationError(cause))
          return null
        } finally {
          if (isCurrent(task)) {
            pending.current = null
            setCalculation(null)
            reviewRuntime()
          }
        }
      })
    },
    [accountId, client, discardPending, isCurrent, runtimeSelectionReader, reviewRuntime],
  )

  useEffect(() => {
    if (liveInput === undefined || runtimeObservation === undefined) return
    if (
      !liveInput ||
      runtimeObservation.status === 'error' ||
      runtimeObservation.selection.status === 'unbound'
    ) {
      // Explicit retry validates the runtime again; a cached failed observation must not cancel it.
      if (!liveInput || pending.current?.initial !== false) discardPending()
      if (runRef.current) client.releaseAccountDecisionRun?.(runRef.current.runId)
      runRef.current = null
      queueMicrotask(() => {
        if (!active.current) return
        setRun(null)
        if (!pending.current) setCalculation(null)
      })
      return
    }
    const task = pending.current
    if (task) {
      // Account edits supersede an initial capture. Merely leaving the route keeps it alive.
      if (!task.initial || task.fingerprint === client.fingerprintAccountDecisionInput(liveInput))
        return
      discardPending()
    }
    if (runRef.current || !autoCalculate || error || cancelledRef.current) return
    void begin(liveInput)
  }, [autoCalculate, begin, client, discardPending, error, liveInput, runtimeObservation])

  const refresh = useCallback(() => begin(), [begin])
  const cancelCalculation = useCallback(() => {
    if (!pending.current) return
    discardPending()
    cancelledRef.current = true
    setCancelled(true)
    setCalculation(null)
    setError(null)
  }, [discardPending])

  return { run, error, calculation, cancelled, refresh, cancelCalculation }
}
