export type UsageAction = 'scanner_connection' | 'disc_import' | 'team_loadout' | 'plan_save'
export type UsageOutcome = 'success' | 'failure' | 'cancelled' | 'incomplete'
export type UsagePage =
  | 'home'
  | 'assets'
  | 'development'
  | 'loadouts'
  | 'warehouse'
  | 'scanner'
  | 'help'
type UsageEvent =
  | { schema: 1; event: 'page_view'; category: UsagePage }
  | {
      schema: 1
      event: 'operation'
      category: UsageAction
      outcome: UsageOutcome
      durationMs: number
    }
  | { schema: 1; event: 'performance'; category: 'startup'; durationMs: number }

const preferenceKey = 'soda-usage-statistics-v1'
const preferenceChanged = 'soda-usage-statistics-changed'
const configuredOrigin = 'https://app.sodaterminal.workers.dev'
const maxDuration = 3_600_000

// Never return or transmit a route parameter, query, fragment, title, or account field.
export function usagePage(pathname: string): UsagePage | null {
  if (pathname === '/') return 'home'
  if (/^\/assets(?:\/|$)/u.test(pathname)) return 'assets'
  if (/^\/development(?:\/|$)/u.test(pathname)) return 'development'
  if (/^\/loadouts(?:\/|$)/u.test(pathname)) return 'loadouts'
  if (/^\/warehouse(?:\/|$)/u.test(pathname)) return 'warehouse'
  if (pathname === '/system/scanner') return 'scanner'
  if (pathname === '/system/help') return 'help'
  return null
}

type UsageRuntime = Pick<Window, 'fetch' | 'localStorage' | 'setTimeout' | 'clearTimeout'> & {
  location: Pick<Location, 'origin'>
  navigator: Pick<Navigator, 'onLine' | 'doNotTrack'> & { globalPrivacyControl?: boolean }
  performance: Pick<Performance, 'now'>
}

export function createUsageStatistics({
  enabled,
  release,
  runtime,
}: {
  enabled: boolean
  release: string
  runtime: () => UsageRuntime | null
}) {
  const pending = new Set<AbortController>()
  let lastPage: UsagePage | null = null
  let startupReported = false
  let budgetStarted = 0
  let sent = 0
  const privacyBlocked = () => {
    const nav = runtime()?.navigator
    return nav?.doNotTrack === '1' || nav?.globalPrivacyControl === true
  }
  const configured = () =>
    enabled &&
    /^[A-Za-z0-9._-]{8,80}$/u.test(release) &&
    runtime()?.location.origin === configuredOrigin
  const allowed = () => {
    const current = runtime()
    if (!configured() || !current || privacyBlocked()) return false
    try {
      return current.localStorage.getItem(preferenceKey) !== 'disabled'
    } catch {
      // A blocked preference store must not silently enable collection.
      return false
    }
  }
  const send = (event: UsageEvent) => {
    const current = runtime()
    if (!current || !allowed() || current.navigator.onLine === false || pending.size >= 2) return
    const now = current.performance.now()
    if (now - budgetStarted >= 60_000) {
      budgetStarted = now
      sent = 0
    }
    if (sent >= 30) return
    sent += 1
    const controller = new AbortController()
    pending.add(controller)
    const timer = current.setTimeout(() => controller.abort(), 3_000)
    try {
      void current
        .fetch('/_soda/usage', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...event, release }),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store',
          signal: controller.signal,
        })
        .catch(() => undefined)
        .finally(() => {
          current.clearTimeout(timer)
          pending.delete(controller)
        })
    } catch {
      current.clearTimeout(timer)
      pending.delete(controller)
    }
  }
  const duration = (start: number) => {
    const elapsed = (runtime()?.performance.now() ?? start) - start
    return Number.isFinite(elapsed) ? Math.min(maxDuration, Math.max(0, Math.round(elapsed))) : 0
  }
  return {
    configured,
    allowed,
    privacyBlocked,
    suspend() {
      pending.forEach((controller) => controller.abort())
      lastPage = null
    },
    setAllowed(value: boolean) {
      try {
        runtime()?.localStorage.setItem(preferenceKey, value ? 'enabled' : 'disabled')
      } catch {
        return
      }
      if (!value) {
        pending.forEach((controller) => controller.abort())
        lastPage = null
      }
    },
    page(pathname: string) {
      const category = usagePage(pathname)
      if (!category || category === lastPage) return
      lastPage = category
      send({ schema: 1, event: 'page_view', category })
    },
    startup() {
      if (startupReported) return
      startupReported = true
      send({ schema: 1, event: 'performance', category: 'startup', durationMs: duration(0) })
    },
    begin(action: UsageAction) {
      const collect = allowed()
      const started = runtime()?.performance.now() ?? 0
      let finished = false
      return (outcome: UsageOutcome) => {
        if (finished) return
        finished = true
        if (collect)
          send({
            schema: 1,
            event: 'operation',
            category: action,
            outcome,
            durationMs: duration(started),
          })
      }
    },
  }
}

export const usageStatistics = createUsageStatistics({
  enabled: import.meta.env.PROD && import.meta.env.VITE_SODA_USAGE_STATISTICS === 'enabled',
  release: import.meta.env.VITE_SODA_RELEASE_ID ?? '',
  runtime: () => (typeof window === 'undefined' ? null : window),
})
export const beginUsageOperation = (action: UsageAction) => usageStatistics.begin(action)
export function setUsageStatisticsAllowed(value: boolean) {
  usageStatistics.setAllowed(value)
  window.dispatchEvent(new Event(preferenceChanged))
}
export const usageStatisticsPreferenceEvent = preferenceChanged
