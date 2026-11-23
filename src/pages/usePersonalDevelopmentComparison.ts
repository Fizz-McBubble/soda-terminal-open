import { useContext, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalculationQueryClientContext } from '../application/accountDecisionWorldHooks'
import { loadPersonalDevelopmentInput } from '../application/personalDevelopmentInput'
import { personalDevelopmentInputFingerprint } from '../application/publicPersonalDevelopment'
import { queryPersonalComparison } from './personalDevelopmentComparisonActions'
import {
  isCurrentPersonalDevelopmentCapture,
  readPersonalDevelopmentCapture,
  rememberPersonalDevelopmentCapture,
} from './personalDevelopmentSessionStore'

/** The comparison reads actual inventory without requesting an Account Decision run. */
export function usePersonalDevelopmentComparison(agentId: string, snapshotVersion: number) {
  const client = useContext(CalculationQueryClientContext)
  const enabled = Boolean(
    client?.openPersonalDevelopmentSession &&
    client.queryPersonalDevelopmentCandidates &&
    client.queryPersonalDevelopmentRoute &&
    client.releasePersonalDevelopmentSession &&
    client.hasPersonalDevelopmentSession,
  )
  const [readRetryVersion, setReadRetryVersion] = useState(0)
  const read = useLiveQuery(async () => {
    if (!enabled) return { client, status: 'disabled' as const }
    try {
      return { client, status: 'ready' as const, input: await loadPersonalDevelopmentInput() }
    } catch {
      return { client, status: 'error' as const }
    }
  }, [client, enabled, agentId, readRetryVersion])
  const scoped = read?.client === client ? read : undefined
  const input = scoped?.status === 'ready' ? scoped.input : null
  const accountId = input?.warehouse.accountId
  const capture = accountId ? readPersonalDevelopmentCapture(accountId, agentId) : null
  const fingerprint = input ? personalDevelopmentInputFingerprint(input) : null
  const [upgrade, setUpgrade] = useState<{
    key: string
    pending: boolean
    cancelled?: boolean
    error?: string
  } | null>(null)
  const upgradeRequest = useRef<AbortController | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const [, bump] = useState(0)
  const inputCurrent = Boolean(capture && isCurrentPersonalDevelopmentCapture(capture, input))
  const sessionAvailable = Boolean(
    capture && client?.hasPersonalDevelopmentSession?.(capture.session.sessionId),
  )
  const current = inputCurrent && sessionAvailable
  const staleReason = !inputCurrent
    ? ('input_changed' as const)
    : !sessionAvailable
      ? ('session_unavailable' as const)
      : undefined
  const upgradeKey =
    capture && current && capture.result.mode === 'generate'
      ? JSON.stringify([
          capture.session.sessionId,
          capture.result.generationIdentity,
          fingerprint,
          snapshotVersion,
          retryVersion,
        ])
      : null
  useEffect(() => {
    if (!upgradeKey || !capture || !client) return
    const controller = new AbortController()
    upgradeRequest.current = controller
    void queryPersonalComparison({ client, capture, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        rememberPersonalDevelopmentCapture({ ...capture, result }, client)
        setUpgrade({ key: upgradeKey, pending: false })
        bump((n) => n + 1)
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setUpgrade({
            key: upgradeKey,
            pending: false,
            error: error instanceof Error ? error.message : '比较暂未完成，请重试。',
          })
      })
    return () => {
      controller.abort()
      if (upgradeRequest.current === controller) upgradeRequest.current = null
    }
  }, [upgradeKey, capture, client])
  return {
    enabled,
    client,
    input,
    capture,
    fingerprint,
    stale: !current,
    staleReason,
    // Generated six-disc results are already readable. Adding comparison data
    // must not replace the whole page with an account-loading screen.
    loading: enabled && !scoped,
    error: scoped?.status === 'error' ? '当前账户资料未读取完整。' : undefined,
    comparing: enabled && upgradeKey !== null && (upgrade?.key !== upgradeKey || upgrade.pending),
    comparisonError: upgradeKey && upgrade?.key === upgradeKey ? upgrade.error : undefined,
    comparisonCancelled: Boolean(upgradeKey && upgrade?.key === upgradeKey && upgrade.cancelled),
    cancelComparison: () => {
      upgradeRequest.current?.abort()
      if (upgradeKey) setUpgrade({ key: upgradeKey, pending: false, cancelled: true })
    },
    retryComparison: () => setRetryVersion((version) => version + 1),
    retryRead: () => setReadRetryVersion((version) => version + 1),
  }
}
