import legacyStylesheetHref from '../styles.css?url'
import f5StylesheetHref from './f5-golden.css?url'

export type RouteStyleScope = 'f5' | 'legacy'

// C1 player-account journeys must never fall back to the tactical stylesheet
// between scanning and the explicit import confirmation.
export const F5_STYLE_PATHS = [
  '/',
  '/system/scanner',
  '/system/help',
  '/system/data/import-discs',
] as const

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
  return F5_STYLE_PATHS.includes(pathname as (typeof F5_STYLE_PATHS)[number]) ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/development') ||
    pathname === '/loadouts/team' ||
    pathname.startsWith('/loadouts/team/') ||
    pathname.startsWith('/loadouts/plans/') ||
    pathname === '/warehouse/discs'
    ? 'f5'
    : 'legacy'
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

  for (const scope of ['legacy', 'f5'] as const) {
    const stylesheet = ensureStylesheet(documentRoot, scope)
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
