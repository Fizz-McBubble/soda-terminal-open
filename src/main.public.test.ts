import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as routeStyles from './styles/routeStyles'
import * as scheduleShell from './offline/schedulePublicOfflineShell'
import { mountPublicApp } from './main.publicBootstrap'

vi.mock('./offline/schedulePublicOfflineShell', () => ({
  schedulePublicOfflineShell: vi.fn(),
}))

describe('mountPublicApp', () => {
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    root = document.getElementById('root')!
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders application and schedules offline shell when styles resolve successfully', async () => {
    vi.spyOn(routeStyles, 'applyRouteStyleScope').mockReturnValue('f5')
    vi.spyOn(routeStyles, 'waitForRouteStyleScope').mockResolvedValue(undefined)

    const DummyApp = () => createElement('div', { id: 'dummy-app' }, 'App Loaded')
    mountPublicApp(DummyApp)

    await act(async () => {
      await Promise.resolve()
    })

    expect(root.querySelector('#dummy-app')?.textContent).toBe('App Loaded')
    expect(scheduleShell.schedulePublicOfflineShell).toHaveBeenCalledOnce()
  })

  it('renders startup recovery card for styles when style resolution fails', async () => {
    vi.spyOn(routeStyles, 'applyRouteStyleScope').mockReturnValue('f5')
    vi.spyOn(routeStyles, 'waitForRouteStyleScope').mockRejectedValue(
      new Error('route_stylesheet_unavailable'),
    )

    const DummyApp = () => createElement('div', { id: 'dummy-app' }, 'App Loaded')
    mountPublicApp(DummyApp)

    // Wait for the rejection handler
    await Promise.resolve()
    await Promise.resolve()

    expect(root.querySelector('#dummy-app')).toBeNull()
    const alert = root.querySelector('main[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.querySelector('h1')?.textContent).toBe('页面样式暂时无法加载')
    expect(alert?.querySelector('p')?.textContent).toContain('本地账户和方案仍保存在此浏览器中')
    expect(scheduleShell.schedulePublicOfflineShell).not.toHaveBeenCalled()
  })
})
