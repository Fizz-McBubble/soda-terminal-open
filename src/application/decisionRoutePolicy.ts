/** Start the expensive account decision only where the visible route consumes it. */
export function shouldAutoCalculateAccountDecision(
  pathname: string,
  search: string,
  mode: 'local' | 'remote',
): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return true
  if (path === '/warehouse/discs') return true
  if (path === '/development' || path.startsWith('/development/')) return true
  if (path.startsWith('/loadouts/plans/')) return mode === 'local'
  if (path === '/loadouts/team') return new URLSearchParams(search).get('reanalyze') === '1'
  if (path.startsWith('/loadouts/team/'))
    return path !== '/loadouts/team/result' && path !== '/loadouts/team/portfolio'
  return false
}
