import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as routeStyles from './styles/routeStyles'
import * as scheduleShell from './offline/schedulePublicOfflineShell'
import {
  bootstrapPublicApp,
  mountPublicApp,
  resetBootstrapStateForTesting,
} from './main.publicBootstrap'

vi.mock('./offline/schedulePublicOfflineShell', () => ({
  schedulePublicOfflineShell: vi.fn(),
}))

describe('mountPublicApp', () => {
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    root = document.getElementById('root')!
    vi.clearAllMocks()
    resetBootstrapStateForTesting()
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

  it('reuses the bounded mount path with the local offline-shell hook', async () => {
    vi.spyOn(routeStyles, 'applyRouteStyleScope').mockReturnValue('f5')
    vi.spyOn(routeStyles, 'waitForRouteStyleScope').mockResolvedValue(undefined)
    const afterMount = vi.fn().mockResolvedValue(undefined)
    const DummyApp = () => createElement('div', { id: 'local-app' }, 'Local App')

    mountPublicApp(DummyApp, { afterMount })
    await act(async () => {
      await Promise.resolve()
    })

    expect(root.querySelector('#local-app')?.textContent).toBe('Local App')
    expect(afterMount).toHaveBeenCalledOnce()
    expect(scheduleShell.schedulePublicOfflineShell).not.toHaveBeenCalled()
  })
})

describe('bootstrapPublicApp startup reliability', () => {
  let root: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div id="root"></div>'
    root = document.getElementById('root')!
    vi.clearAllMocks()
    resetBootstrapStateForTesting()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('triggers startup recovery when module loader hangs past deadline (timeout)', () => {
    const neverResolvingLoader = () => new Promise<{ default: React.ComponentType }>(() => {})
    const onRecovery = vi.fn()
    const mountApp = vi.fn()

    bootstrapPublicApp(neverResolvingLoader, {
      timeoutMs: 3000,
      onRecovery,
      mountApp,
    })

    expect(onRecovery).not.toHaveBeenCalled()
    expect(mountApp).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2999)
    expect(onRecovery).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2)
    expect(onRecovery).toHaveBeenCalledOnce()
    expect(onRecovery).toHaveBeenCalledWith('application', expect.any(Function))
    expect(mountApp).not.toHaveBeenCalled()
  })

  it('triggers startup recovery immediately when module loader rejects', async () => {
    const failingLoader = () => Promise.reject(new Error('ChunkLoadError'))
    const onRecovery = vi.fn()
    const mountApp = vi.fn()

    bootstrapPublicApp(failingLoader, {
      timeoutMs: 5000,
      onRecovery,
      mountApp,
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(onRecovery).toHaveBeenCalledOnce()
    expect(mountApp).not.toHaveBeenCalled()
  })

  it('suppresses late resolve after timeout expires to prevent mounting over recovery UI', async () => {
    let resolveLoader!: (val: { default: React.ComponentType }) => void
    const delayedLoader = () =>
      new Promise<{ default: React.ComponentType }>((resolve) => {
        resolveLoader = resolve
      })
    const onRecovery = vi.fn()
    const mountApp = vi.fn()

    bootstrapPublicApp(delayedLoader, {
      timeoutMs: 1000,
      onRecovery,
      mountApp,
    })

    // Advance past deadline
    vi.advanceTimersByTime(1001)
    expect(onRecovery).toHaveBeenCalledOnce()
    expect(mountApp).not.toHaveBeenCalled()

    // Module resolves late (e.g. 5 seconds later)
    const LateApp = () => createElement('div', null, 'Late App')
    resolveLoader({ default: LateApp })

    await Promise.resolve()
    await Promise.resolve()

    // Must NOT mount late app!
    expect(mountApp).not.toHaveBeenCalled()
  })

  it('allows user retry after recovery, successfully mounting when retry resolves in time', async () => {
    let callCount = 0
    let resolveFirst!: (val: { default: React.ComponentType }) => void
    let retryCallback!: () => void

    const onRecovery = vi.fn((_stage, retry) => {
      retryCallback = retry
    })
    const mountApp = vi.fn()

    const loader = vi.fn(() => {
      callCount += 1
      if (callCount === 1) {
        return new Promise<{ default: React.ComponentType }>((resolve) => {
          resolveFirst = resolve
        })
      }
      const FreshApp = () => createElement('div', null, 'Fresh App')
      return Promise.resolve({ default: FreshApp })
    })

    bootstrapPublicApp(loader, {
      timeoutMs: 1000,
      onRecovery,
      mountApp,
    })

    // First attempt times out
    vi.advanceTimersByTime(1001)
    expect(onRecovery).toHaveBeenCalledOnce()
    expect(mountApp).not.toHaveBeenCalled()

    // User triggers retry
    retryCallback()
    expect(loader).toHaveBeenCalledTimes(2)

    await Promise.resolve()
    await Promise.resolve()

    // Fresh attempt mounts!
    expect(mountApp).toHaveBeenCalledOnce()

    // Late resolve of first attempt arrives after retry succeeded: must be ignored!
    const StaleApp = () => createElement('div', null, 'Stale App')
    resolveFirst({ default: StaleApp })
    await Promise.resolve()
    expect(mountApp).toHaveBeenCalledOnce()
  })

  it('wires the rendered startup recovery button to a real fresh bootstrap attempt', async () => {
    let callCount = 0
    const loader = vi.fn(() => {
      callCount += 1
      if (callCount === 1) return new Promise<{ default: React.ComponentType }>(() => {})
      const FreshApp = () => createElement('div', null, 'Fresh App')
      return Promise.resolve({ default: FreshApp })
    })
    const mountApp = vi.fn()

    bootstrapPublicApp(loader, { timeoutMs: 1000, mountApp })
    vi.advanceTimersByTime(1001)

    const retryButton = root.querySelector('button')
    expect(retryButton?.textContent).toBe('重新加载')
    retryButton!.click()

    await Promise.resolve()
    await Promise.resolve()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(mountApp).toHaveBeenCalledOnce()
  })
})
