export type TeamRematchTraceWindow = typeof window & {
  __sodaTeamRematchTraceEnabled?: boolean
  __sodaTeamRematchTrace?: Array<{
    step: string
    at: number
    checks: Record<string, string | number | boolean>
  }>
}

/** Explicit isolated-debug opt-in; metadata stays in a bounded in-memory buffer. */
export function traceTeamRematch(step: string, checks: Record<string, string | number | boolean>) {
  if (
    !import.meta.env.DEV &&
    import.meta.env.MODE !== 'test' &&
    import.meta.env.VITE_SODA_TEAM_REMATCH_TRACE !== 'true'
  )
    return
  const target = window as TeamRematchTraceWindow
  if (target.__sodaTeamRematchTraceEnabled !== true) return
  const entries = (target.__sodaTeamRematchTrace ??= [])
  entries.push({ step, at: performance.now(), checks })
  if (entries.length > 200) entries.splice(0, entries.length - 200)
}
