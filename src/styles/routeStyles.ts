import legacyStylesheetHref from '../styles.css?url'
import f5StylesheetHref from './f5-golden.css?url'

export type RouteStyleScope = 'f5' | 'legacy'

export const LEGACY_TOOL_PATHS = ['/system/data/review-dev', '/system/data/audit'] as const

const routeStyles = {
  f5: {
    id: 'soda-route-styles-f5',
    href: f5StylesheetHref,
  },
  legacy: {
    id: 'soda-route-styles-legacy',
    href: legacyStylesheetHref,
  },
} as const

export function getRouteStyleScope(pathname: string): RouteStyleScope {
  // Only the two development-only tools retain the old layout. Public redirects
  // and invalid URLs share the current shell, including before route resolution.
  return import.meta.env.DEV &&
    LEGACY_TOOL_PATHS.includes(pathname as (typeof LEGACY_TOOL_PATHS)[number])
    ? 'legacy'
    : 'f5'
}

function ensureStylesheet(documentRoot: Document, scope: RouteStyleScope) {
  const config = routeStyles[scope]
  const existing = documentRoot.getElementById(config.id)
  if (existing instanceof HTMLLinkElement) return existing

  const link = documentRoot.createElement('link')
  link.id = config.id
  link.rel = 'stylesheet'
  link.href = config.href
  link.dataset.sodaRouteStyles = scope
  documentRoot.head.append(link)
  return link
}

export function applyRouteStyleScope(
  pathname: string,
  documentRoot: Document = document,
): RouteStyleScope {
  const activeScope = getRouteStyleScope(pathname)

  // Only fetch the selected scope on first entry. Previously even a home-only visit created
  // the legacy link before disabling it, allowing the browser to schedule an unused stylesheet.
  ensureStylesheet(documentRoot, activeScope)
  for (const scope of ['legacy', 'f5'] as const) {
    const stylesheet = documentRoot.getElementById(routeStyles[scope].id)
    if (!(stylesheet instanceof HTMLLinkElement)) continue
    const active = scope === activeScope
    stylesheet.disabled = !active
    stylesheet.media = active ? 'all' : 'not all'
    stylesheet.setAttribute('aria-disabled', String(!active))
  }

  documentRoot.documentElement.dataset.sodaStyleScope = activeScope
  return activeScope
}

export function waitForRouteStyleScope(
  scope: RouteStyleScope,
  documentRoot: Document = document,
  timeoutMs = 15000,
): Promise<void> {
  const link = documentRoot.getElementById(routeStyles[scope].id)
  if (!(link instanceof HTMLLinkElement))
    return Promise.reject(new Error('route_stylesheet_missing'))
  if (link.sheet) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      link.removeEventListener('load', onLoad)
      link.removeEventListener('error', onError)
      if (error) reject(error)
      else resolve()
    }
    const onLoad = () => finish()
    const onError = () => finish(new Error('route_stylesheet_unavailable'))
    const timer = setTimeout(() => finish(new Error('route_stylesheet_timeout')), timeoutMs)
    link.addEventListener('load', onLoad, { once: true })
    link.addEventListener('error', onError, { once: true })
    if (link.sheet) finish()
  })
}
