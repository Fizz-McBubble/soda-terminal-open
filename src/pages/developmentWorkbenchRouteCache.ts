import type { DevelopmentWorkbenchRoutePresentation } from '../application/publicDevelopmentWorkbenchRoute'

// Only derived presentation for an exact run/input/selection; never persisted or shared across accounts.
const routes = new Map<string, DevelopmentWorkbenchRoutePresentation>()
export const readDevelopmentWorkbenchRoute = (key: string | null) =>
  key ? routes.get(key) : undefined
export function rememberDevelopmentWorkbenchRoute(
  key: string,
  value: DevelopmentWorkbenchRoutePresentation,
) {
  routes.delete(key)
  routes.set(key, value)
  while (routes.size > 24) routes.delete(routes.keys().next().value!)
}
export function clearDevelopmentWorkbenchRoutes() {
  routes.clear()
}
