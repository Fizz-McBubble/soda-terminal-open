import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AssetBridgeJob } from '../assetQuickRead/bridgeClient'
import { assetFailureDiagnostic, type AssetDiagnosticAction } from '../assetQuickRead/diagnostics'
import { assetFailureGuidance } from '../assetQuickRead/diagnosticGuidance'
import { assetCompatibilityMessage } from '../assetQuickRead/snapshotRecovery'
import {
  assetQuickReadJobActive as active,
  assetQuickReadErrorMessage as message,
  type Bridge,
} from './assetQuickReadControllerContract'
import type { AssetQuickReadState } from './assetQuickReadEntryContract'

type PollingOptions = {
  client: Bridge
  job: AssetBridgeJob | null
  targetAccountId: string | undefined
  generation: RefObject<number>
  ownedJob: RefObject<AssetBridgeJob | null>
  inspect: (raw: unknown, sha256: string, scope: number) => Promise<void>
  recordFailure: (
    stage: Parameters<typeof assetFailureDiagnostic>[0],
    failure?: unknown,
    failedJob?: AssetBridgeJob | null,
    action?: AssetDiagnosticAction,
  ) => void
  setJob: Dispatch<SetStateAction<AssetBridgeJob | null>>
  setState: Dispatch<SetStateAction<AssetQuickReadState>>
  setError: Dispatch<SetStateAction<string>>
}

// Keep the original effect lifetime and account generation checks together.
export function useAssetQuickReadPolling({
  client,
  job,
  targetAccountId,
  generation,
  ownedJob,
  inspect,
  recordFailure,
  setJob,
  setState,
  setError,
}: PollingOptions) {
  useEffect(() => {
    if (!job || !active(job)) return
    let cancelled = false
    const scope = generation.current
    const currentJob = job
    let failureStage: 'startup' | 'waiting' | 'result' =
      currentJob.state === 'capturing' ? 'waiting' : 'startup'
    const valid = () => !cancelled && generation.current === scope
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const latest = await client.status(currentJob.jobId)
          if (!valid()) return
          if (latest.jobId !== currentJob.jobId || latest.targetAccountId !== targetAccountId)
            throw new Error('资产快读任务与当前接收账户不一致，未采用结果。')
          ownedJob.current = latest
          if (latest.state === 'received') {
            failureStage = 'result'
            const result = await client.result(latest.jobId)
            if (!valid()) return
            if (result.jobId !== latest.jobId || result.targetAccountId !== targetAccountId)
              throw new Error('读取结果的账户或任务不一致，未采用结果。')
            await inspect(result.snapshot, result.sha256, scope)
            if (valid()) setJob(latest)
          } else {
            setJob(latest)
            setState(latest.state)
            if (latest.state === 'error' || latest.state === 'timed_out')
              recordFailure(
                latest.state === 'timed_out' || latest.readyAt ? 'waiting' : 'startup',
                undefined,
                latest,
                'start',
              )
            if (latest.state === 'error')
              setError(
                assetCompatibilityMessage(latest.code) ??
                  assetFailureGuidance(latest.code, latest.diagnostics)?.problem ??
                  '资产快读未完成本次读取，请核对游戏目录、管理员授权与准备状态后再试。',
              )
          }
        } catch (failure) {
          if (valid()) {
            recordFailure(failureStage, failure, ownedJob.current ?? currentJob, 'start')
            setError(message(failure))
            setState('error')
            const failedJob = ownedJob.current
            if (active(failedJob)) {
              void client
                .cancel(currentJob.jobId)
                .then((stopped) => {
                  if (
                    valid() &&
                    stopped.jobId === currentJob.jobId &&
                    stopped.targetAccountId === targetAccountId &&
                    !active(stopped)
                  ) {
                    ownedJob.current = stopped
                    setJob(stopped)
                  }
                })
                .catch(() => undefined)
            } else {
              // Result validation can fail after the service already finished.
              // Do not leave the previous polling job holding the workspace busy.
              setJob(failedJob)
            }
          }
        }
      })()
    }, 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // The binding generation invalidates results when the selected account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, job, targetAccountId])
}
