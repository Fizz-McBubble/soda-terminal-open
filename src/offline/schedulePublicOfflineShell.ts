import { registerPublicOfflineShell } from './registerPublicOfflineShell'

const recoverableRetryDelayMs = 2000
const foregroundWaitMs = 30_000
const foregroundResultEvent = 'soda-public-foreground-result'
const foregroundResults = new Set<'team_overview_presentation' | 'warehouse_actions'>()

export function notePublicOfflineForegroundResult(
  kind: 'team_overview_presentation' | 'warehouse_actions',
) {
  foregroundResults.add(kind)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(foregroundResultEvent))
}

function pendingInitialResult() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/loadouts/team') return !foregroundResults.has('team_overview_presentation')
  if (path === '/warehouse/discs') return !foregroundResults.has('warehouse_actions')
  return false
}

/** Keep a complete offline install while giving the first visible calculation the network first. */
export function schedulePublicOfflineShell(
  register: (options?: {
    onRecoverableFailure?: () => void
  }) => Promise<unknown> = registerPublicOfflineShell,
): () => void {
  let stopped = false
  let frame: number | undefined
  let idle: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let foregroundTimer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let recoverable = false
  let retried = false
  let onlineDuringAttempt = false
  const onOnline = () => {
    if (stopped || retried) return
    if (running) {
      onlineDuringAttempt = true
      return
    }
    if (!recoverable || navigator.onLine === false) return
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }
    retried = true
    window.removeEventListener('online', onOnline)
    start()
  }
  const start = () => {
    if (stopped || running) return
    running = true
    recoverable = false
    onlineDuringAttempt = false
    if (!retried) window.addEventListener('online', onOnline)
    void register({
      onRecoverableFailure: () => {
        recoverable = true
      },
    })
      .catch(() => {})
      .finally(() => {
        running = false
        if (stopped || !recoverable || retried) window.removeEventListener('online', onOnline)
        else if (onlineDuringAttempt) onOnline()
        else if (navigator.onLine !== false)
          retryTimer = setTimeout(() => {
            retryTimer = undefined
            onOnline()
          }, recoverableRetryDelayMs)
      })
  }
  const clearForegroundWait = () => {
    window.removeEventListener(foregroundResultEvent, afterForeground)
    if (foregroundTimer !== undefined) clearTimeout(foregroundTimer)
    foregroundTimer = undefined
  }
  const afterForeground = () => {
    if (stopped) return
    if (!pendingInitialResult()) {
      clearForegroundWait()
      start()
    } else if (foregroundTimer === undefined) {
      window.addEventListener(foregroundResultEvent, afterForeground)
      // Empty accounts and interrupted calculations still get a background install.
      foregroundTimer = setTimeout(() => {
        clearForegroundWait()
        start()
      }, foregroundWaitMs)
    }
  }
  const afterPaint = () => {
    if (stopped) return
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(afterForeground, { timeout: 5000 })
    } else {
      timer = setTimeout(afterForeground, 1000)
    }
  }
  const afterLoad = () => {
    window.removeEventListener('load', afterLoad)
    if (stopped) return
    // Two frames put registration after the initial rendering opportunity, including cached loads.
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(afterPaint)
    })
  }
  if (document.readyState === 'complete') afterLoad()
  else window.addEventListener('load', afterLoad, { once: true })
  return () => {
    stopped = true
    clearForegroundWait()
    window.removeEventListener('load', afterLoad)
    window.removeEventListener('online', onOnline)
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    if (idle !== undefined) window.cancelIdleCallback?.(idle)
    if (timer !== undefined) clearTimeout(timer)
    if (retryTimer !== undefined) clearTimeout(retryTimer)
  }
}
