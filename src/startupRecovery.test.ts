import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showStartupRecovery } from './startupRecovery'

describe('startupRecovery', () => {
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    root = document.getElementById('root')!
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders application recovery card with reload button and data preservation reminder', () => {
    const reload = vi.fn()
    showStartupRecovery('application', reload)

    const alert = root.querySelector('main[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.querySelector('h1')?.textContent).toBe('页面暂时无法加载')
    expect(alert?.querySelector('p')?.textContent).toContain(
      '网络可能暂时不稳定，请稍后重新加载。本地账户和方案仍保存在此浏览器中，请勿清除网站数据。',
    )

    const button = alert?.querySelector('button')
    expect(button?.textContent).toBe('重新加载')
    button?.click()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('renders style recovery card when stage is styles', () => {
    const reload = vi.fn()
    showStartupRecovery('styles', reload)

    const alert = root.querySelector('main[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.querySelector('h1')?.textContent).toBe('页面样式暂时无法加载')
    expect(alert?.querySelector('p')?.textContent).toContain('本地账户和方案仍保存在此浏览器中')
  })

  it('safely handles missing root element without throwing', () => {
    document.body.innerHTML = ''
    expect(() => showStartupRecovery('application')).not.toThrow()
  })
})
