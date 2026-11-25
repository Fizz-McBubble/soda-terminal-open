import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CalculationQueryClientContext } from './accountDecisionWorldHooks'
import { calculationQueryContractVersion } from './calculationQueryContract'
import type { AccountDecisionWorldContextValue } from './accountDecisionWorldModel'
import {
  warehouseAnalysisStopReason,
  type WarehouseActionProjection,
} from './warehouseActionContract'

type WarehouseRead = {
  runId: string
  projection?: WarehouseActionProjection
  startedAt?: number
  error?: string
  cancelled?: boolean
}

/** Only the warehouse surface requests the full retention analysis. */
export function useWarehouseActions(world: AccountDecisionWorldContextValue) {
  const client = useContext(CalculationQueryClientContext)
  const run = world.status === 'current' || world.status === 'stale' ? world.run : null
  const [read, setRead] = useState<WarehouseRead | null>(null)
  const [attempt, setAttempt] = useState(0)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => {
    if (world.status !== 'current' || !run || run.warehouseActions) return
    const controller = new AbortController()
    pending.current = controller
    const active = () => !controller.signal.aborted
    // Start after the committed effect; cleanup cancels this captured run before
    // either the loading state or a late result can reach another account.
    queueMicrotask(() => {
      if (active()) setRead({ runId: run.runId, startedAt: Date.now() })
    })
    const load = async () => {
      if (!client?.queryWarehouseActions) throw new Error('请更新页面后重新分析仓库。')
      return client.queryWarehouseActions(
        {
          contractVersion: calculationQueryContractVersion,
          kind: 'warehouse_actions',
          runId: run.runId,
        },
        { signal: controller.signal },
      )
    }
    void load()
      .then((projection) => {
        if (!active()) return
        if (
          projection.runId !== run.runId ||
          projection.accountId !== run.input.warehouse.accountId ||
          projection.fingerprint !== run.inputFingerprint
        )
          throw new Error('仓库记录已变化，请重新分析。')
        run.warehouseActions = projection
        setRead({ runId: run.runId, projection })
      })
      .catch((error: unknown) => {
        if (active())
          setRead({
            runId: run.runId,
            error: error instanceof Error ? error.message : '仓库分析未完成，请重试。',
          })
      })
      .finally(() => {
        if (pending.current === controller) pending.current = null
      })
    return () => {
      controller.abort()
      if (pending.current === controller) pending.current = null
    }
  }, [client, run, world.status, attempt])
  const cancel = useCallback(() => {
    pending.current?.abort(warehouseAnalysisStopReason)
    pending.current = null
    if (run) setRead({ runId: run.runId, cancelled: true })
  }, [run])
  const retry = useCallback(() => {
    if (!run || client?.hasAccountDecisionRun?.(run.runId) === false) return false
    setAttempt((value) => value + 1)
    return true
  }, [client, run])
  const current = read?.runId === run?.runId ? read : null
  return {
    projection: run?.warehouseActions ?? current?.projection,
    calculation:
      world.status === 'current' && current?.startedAt !== undefined
        ? { phase: 'analyzing' as const, startedAt: current.startedAt }
        : null,
    error: current?.error,
    cancelled: current?.cancelled,
    cancel,
    retry,
  }
}
