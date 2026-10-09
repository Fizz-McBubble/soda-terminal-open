import { afterEach, describe, expect, it } from 'vitest'
import { applyRouteStyleScope, getRouteStyleScope, waitForRouteStyleScope } from './routeStyles'

function stylesheet(scope: 'f5' | 'legacy') {
  return document.querySelector<HTMLLinkElement>(`link[data-soda-route-styles='${scope}']`)
}

describe('route style isolation', () => {
  afterEach(() => {
    document.querySelectorAll('link[data-soda-route-styles]').forEach((link) => link.remove())
    delete document.documentElement.dataset.sodaStyleScope
  })

  it('maps the accepted F5 routes and the team entry to the isolated F5 stylesheet', () => {
    expect(getRouteStyleScope('/')).toBe('f5')
    expect(getRouteStyleScope('/system/scanner')).toBe('f5')
    expect(getRouteStyleScope('/system/help')).toBe('f5')
    expect(getRouteStyleScope('/system/data/import-discs')).toBe('f5')
    expect(getRouteStyleScope('/assets')).toBe('f5')
    expect(getRouteStyleScope('/assets/agents')).toBe('f5')
    expect(getRouteStyleScope('/development')).toBe('f5')
    expect(getRouteStyleScope('/development/agent-billy')).toBe('f5')
    expect(getRouteStyleScope('/loadouts/team')).toBe('f5')
    expect(getRouteStyleScope('/loadouts/team/team-r8-billy')).toBe('f5')
    expect(getRouteStyleScope('/loadouts/plans/plan-saved-team')).toBe('f5')
    expect(getRouteStyleScope('/warehouse/discs')).toBe('f5')
  })

  it('disables legacy CSS on F5 routes', () => {
    expect(applyRouteStyleScope('/')).toBe('f5')

    expect(stylesheet('f5')).toMatchObject({ disabled: false, media: 'all' })
    expect(stylesheet('legacy')).toBeNull()
    expect(document.documentElement).toHaveAttribute('data-soda-style-scope', 'f5')
  })

  it('only enables the legacy stylesheet for development tools', () => {
    applyRouteStyleScope('/system/scanner')
    expect(applyRouteStyleScope('/system/data/review-dev')).toBe('legacy')

    expect(stylesheet('f5')).toMatchObject({ disabled: true, media: 'not all' })
    expect(stylesheet('legacy')).toMatchObject({ disabled: false, media: 'all' })
    expect(document.documentElement).toHaveAttribute('data-soda-style-scope', 'legacy')
    expect(document.querySelectorAll('link[data-soda-route-styles]')).toHaveLength(2)
  })

  it('leaves the active stylesheet untouched while navigating within the same shell', () => {
    applyRouteStyleScope('/')
    const link = stylesheet('f5')
    const observer = new MutationObserver(() => undefined)
    observer.observe(document.head, { attributes: true, childList: true, subtree: true })
    observer.observe(document.documentElement, { attributes: true })
    for (const path of ['/assets/account', '/system/scanner', '/development', '/loadouts/team']) {
      applyRouteStyleScope(path)
      expect(stylesheet('f5')).toBe(link)
    }
    expect(observer.takeRecords()).toHaveLength(0)
    observer.disconnect()
  })

  it('keeps invalid URLs and old redirects in the current public stylesheet', () => {
    for (const path of [
      '/missing-page',
      '/system/scannerhttps%3A/sodaterminal.com/system/scanner',
      '/loadouts/agent',
      '/system/data',
      '/system/scanner/',
    ]) {
      expect(applyRouteStyleScope(path)).toBe('f5')
      expect(stylesheet('legacy')).toBeNull()
    }
  })

  it('keeps the current shell styled when entering saved plans from the team workspace', () => {
    applyRouteStyleScope('/loadouts/team')
    for (const path of ['/loadouts/plans/plan-saved-team']) {
      expect(applyRouteStyleScope(path)).toBe('f5')
      expect(stylesheet('f5')).toMatchObject({ disabled: false, media: 'all' })
      expect(stylesheet('legacy')).toBeNull()
    }
  })

  it('waits for the active stylesheet before allowing the public app to render', async () => {
    applyRouteStyleScope('/')
    const pending = waitForRouteStyleScope('f5')
    stylesheet('f5')?.dispatchEvent(new Event('load'))
    await expect(pending).resolves.toBeUndefined()
  })

  it('fails closed when the public route stylesheet cannot load', async () => {
    applyRouteStyleScope('/')
    const pending = waitForRouteStyleScope('f5')
    stylesheet('f5')?.dispatchEvent(new Event('error'))
    await expect(pending).rejects.toThrow('route_stylesheet_unavailable')
  })
})
