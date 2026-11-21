/** Start the expensive account decision only where the visible route consumes it. */
export function shouldAutoCalculateAccountDecision(
  pathname: string,
  search: string,
  mode: 'local' | 'remote',
  personalFactsAvailable = false,
  personalSessionAvailable = false,
): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return true
  if (path === '/warehouse/discs') return true
  if (path === '/development' || /^\/development\/[^/]+$/.test(path))
    return mode !== 'local' || !personalFactsAvailable
  if (/^\/development\/[^/]+\/loadouts$/.test(path))
    return mode !== 'local' || !personalSessionAvailable
  if (path.startsWith('/development/')) return true
  if (path.startsWith('/loadouts/plans/'))
    return mode === 'local' && new URLSearchParams(search).get('review') === '1'
  // TeamPicker owns both the normal BOX action and an explicit URL rematch.
  // An eager provider run here is duplicated by the exact rematch refresh.
  if (path === '/loadouts/team') return false
  if (path.startsWith('/loadouts/team/'))
    return path !== '/loadouts/team/result' && path !== '/loadouts/team/portfolio'
  return false
}

export function shouldAutoCalculatePlayerDecisionWorld({
  pathname,
  search,
  mode,
  onlineMode,
  onlineAllowed,
  personalFactsAvailable = false,
  personalSessionAvailable = false,
}: {
  pathname: string
  search: string
  mode: 'local' | 'remote'
  onlineMode: boolean
  onlineAllowed: boolean
  personalFactsAvailable?: boolean
  personalSessionAvailable?: boolean
}) {
  const isScannerRoute = pathname.replace(/\/+$/, '').toLowerCase() === '/system/scanner'
  return (
    !isScannerRoute &&
    (!onlineMode || onlineAllowed) &&
    shouldAutoCalculateAccountDecision(
      pathname,
      search,
      mode,
      personalFactsAvailable,
      personalSessionAvailable,
    )
  )
}

export function usesAssetRosterSummary(tab?: string) {
  return tab === 'agents' || tab === 'wengines' || tab === 'bangboos'
}

export function playerDecisionInputObservation(
  pathname: string,
  mode: 'local' | 'remote' = 'local',
  personalFactsAvailable = false,
  personalSessionAvailable = false,
  search = '',
) {
  const path = pathname.replace(/\/+$/, '').toLowerCase() || '/'
  if (usesAssetRosterSummary(/^\/assets\/([^/]+)$/.exec(path)?.[1])) return 'disabled' as const
  if (
    mode === 'local' &&
    personalFactsAvailable &&
    (path === '/development' || /^\/development\/[^/]+$/.test(path))
  )
    return false
  if (mode === 'local' && personalSessionAvailable && /^\/development\/[^/]+\/loadouts$/.test(path))
    return false
  if (mode === 'local' && path.startsWith('/loadouts/plans/'))
    return new URLSearchParams(search).get('review') === '1'
  return path !== '/system/scanner' && path !== '/system/help'
}
