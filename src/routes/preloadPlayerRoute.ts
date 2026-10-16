const routeModules = {
  assets: () => import('../pages/AssetCenterPage'),
  development: () => import('../pages/AgentDevelopmentGoldenDirectoryPage'),
  workbench: () => import('../pages/AgentDevelopmentWorkbenchPage'),
  comparison: () => import('../pages/AgentLoadoutComparisonPage'),
  team: () => import('../pages/OptimizerFlowPage'),
  teamDetail: () =>
    Promise.all([import('../pages/OptimizerFlowPage'), import('../pages/TeamPlan')]),
  savedPlan: () =>
    Promise.all([import('../pages/OptimizerFlowPage'), import('../pages/optimizer/SavedPlan')]),
  warehouse: () => import('../pages/WarehouseDiscsPage'),
  scanner: () => import('../pages/ScannerAssistantPage'),
  help: () => import('../pages/HelpAndPrivacyPage'),
} as const

type RouteModule = keyof typeof routeModules
const pending = new Map<RouteModule, Promise<unknown>>()

/** Actual content links and callback buttons share the same navigation-intent boundary. */
export function preloadPlayerRouteIntent(
  target: EventTarget | null,
  warm: (path: string) => void = preloadPlayerRoute,
): void {
  if (!(target instanceof Element)) return
  const control = target.closest('a[href], [data-player-route]')
  if (!control || control.matches(':disabled, [aria-disabled="true"]')) return
  const path = control.getAttribute('data-player-route') ?? control.getAttribute('href')
  if (!path) return
  const url = new URL(path, window.location.href)
  if (url.origin !== window.location.origin) return
  warm(url.pathname)
}

/** Navigation intent warms only the page that the player is about to open. */
export function preloadPlayerRoute(path: string): void {
  const pathname = path.split(/[?#]/, 1)[0]
  const target: RouteModule | null = pathname.startsWith('/assets')
    ? 'assets'
    : pathname === '/development'
      ? 'development'
      : /^\/development\/[^/]+\/loadouts$/.test(pathname)
        ? 'comparison'
        : pathname.startsWith('/development/')
          ? 'workbench'
          : pathname.startsWith('/loadouts/plans/')
            ? 'savedPlan'
            : pathname.startsWith('/loadouts/team/') &&
                !['/loadouts/team/portfolio', '/loadouts/team/result'].includes(pathname)
              ? 'teamDetail'
              : pathname.startsWith('/loadouts/team')
                ? 'team'
                : pathname === '/warehouse/discs'
                  ? 'warehouse'
                  : pathname === '/system/scanner'
                    ? 'scanner'
                    : pathname === '/system/help'
                      ? 'help'
                      : null
  if (!target || pending.has(target)) return
  const request = routeModules[target]().catch(() => {
    pending.delete(target)
  })
  pending.set(target, request)
}
