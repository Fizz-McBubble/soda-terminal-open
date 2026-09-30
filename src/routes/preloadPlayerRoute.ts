const routeModules = {
  assets: () => import('../pages/AssetCenterPage'),
  development: () => import('../pages/AgentDevelopmentGoldenDirectoryPage'),
  workbench: () => import('../pages/AgentDevelopmentWorkbenchPage'),
  comparison: () => import('../pages/AgentLoadoutComparisonPage'),
  team: () => import('../pages/OptimizerFlowPage'),
  warehouse: () => import('../pages/WarehouseDiscsPage'),
  scanner: () => import('../pages/ScannerAssistantPage'),
  help: () => import('../pages/HelpAndPrivacyPage'),
} as const

type RouteModule = keyof typeof routeModules
const pending = new Map<RouteModule, Promise<unknown>>()

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
          : pathname.startsWith('/loadouts/team') || pathname.startsWith('/loadouts/plans/')
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
