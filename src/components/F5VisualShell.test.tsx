import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { F5VisualShell } from './F5VisualShell'
import { preloadPlayerRoute, preloadPlayerRouteIntent } from '../routes/preloadPlayerRoute'

vi.mock('../motion/useDetailsDisclosureMotion', () => ({ useDetailsDisclosureMotion: vi.fn() }))
vi.mock('../motion/useStateTransitionMotion', () => ({ useStateTransitionMotion: vi.fn() }))
vi.mock('../routes/preloadPlayerRoute', () => ({
  preloadPlayerRoute: vi.fn(),
  preloadPlayerRouteIntent: vi.fn(),
}))

function mockWidth(initial: boolean) {
  let narrow = initial
  const listeners = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return narrow
      },
      addEventListener: (_event: string, callback: () => void) => listeners.add(callback),
      removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback),
    })),
  )
  return (next: boolean) =>
    act(() => {
      narrow = next
      listeners.forEach((listener) => listener())
    })
}

function Harness({ navigationPending = false }: { navigationPending?: boolean }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    // Mirrors AppShell's route-heading focus ownership.
    document.querySelector<HTMLElement>('h1')?.focus()
  }, [location.pathname])
  return (
    <F5VisualShell
      navigationPending={navigationPending}
      currentPath={location.pathname}
      currentTitle="首页"
      currentVersion="测试"
      account={{
        hydrating: false,
        status: 'ready',
        name: '',
        agentCount: 0,
        discCount: 0,
        hasAccount: false,
      }}
      systemStatus="ready"
      sidebarOpen={open}
      closeSidebar={() => setOpen(false)}
      toggleSidebar={() => setOpen((value) => !value)}
      isPrimaryCurrent={(path) => path === location.pathname}
    >
      <h1 tabIndex={-1}>页面内容</h1>
      <button>页面操作</button>
    </F5VisualShell>
  )
}

function setup() {
  return render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('F5VisualShell narrow navigation', () => {
  it('keeps current content while reporting a pending route in the existing location bar', () => {
    mockWidth(false)
    const { rerender } = render(
      <MemoryRouter>
        <Harness navigationPending />
      </MemoryRouter>,
    )
    expect(screen.getByText('页面内容')).toBeVisible()
    expect(screen.getByText('页面操作')).toBeEnabled()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('正在打开页面')
    rerender(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    )
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy')
    expect(screen.queryByText('正在打开页面…')).not.toBeInTheDocument()
  })

  it('forwards content navigation intent without running the click action', () => {
    mockWidth(false)
    setup()
    vi.mocked(preloadPlayerRouteIntent).mockClear()
    const action = screen.getByText('页面操作')
    fireEvent.pointerOver(action)
    expect(preloadPlayerRouteIntent).toHaveBeenCalledWith(action)
    fireEvent.focus(action)
    expect(preloadPlayerRouteIntent).toHaveBeenCalledTimes(2)
  })

  it('warms only enabled local destinations, including callback buttons and nested link content', async () => {
    const actual = await vi.importActual<typeof import('../routes/preloadPlayerRoute')>(
      '../routes/preloadPlayerRoute',
    )
    const warm = vi.fn()
    const { container } = render(
      <div>
        <a href="/development/agent-billy/loadouts?plan=one">
          <span>比较入口</span>
        </a>
        <button data-player-route="/loadouts/plans/saved-one">已存方案</button>
        <button disabled data-player-route="/loadouts/team/blocked">
          不可操作
        </button>
        <a href="https://example.org/development">外部链接</a>
      </div>,
    )
    for (const control of container.querySelectorAll('span, button, a[href^="https"]'))
      actual.preloadPlayerRouteIntent(control, warm)
    expect(warm.mock.calls).toEqual([
      ['/development/agent-billy/loadouts'],
      ['/loadouts/plans/saved-one'],
    ])
  })

  it('uses stable outerWidth for desktop composition scaling without canceling native browser zoom', () => {
    const resizeNarrow = mockWidth(false)
    vi.stubGlobal('outerWidth', 1440)
    vi.stubGlobal('innerWidth', 1440)
    const { container } = setup()
    const shell = container.querySelector<HTMLElement>('.f5v-shell')!
    const navigation = screen.getByRole('navigation', { name: '主导航' })
    expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBeCloseTo(0.75)
    expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('14.4px')

    // 1440/1600 desktop windows preserve baseline composition (tolerating OS frame width)
    // while keeping scale and fluid typography unit fixed when native browser zoom shrinks innerWidth.
    vi.stubGlobal('outerWidth', 1456)
    for (const innerWidth of [1440, 1309, 1152]) {
      vi.stubGlobal('innerWidth', innerWidth)
      fireEvent.resize(window)
      expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBeCloseTo(1456 / 1920)
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('14.56px')
    }

    vi.stubGlobal('outerWidth', 1600)
    for (const innerWidth of [1600, 1455, 1280]) {
      vi.stubGlobal('innerWidth', innerWidth)
      fireEvent.resize(window)
      expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBeCloseTo(1600 / 1920)
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('16px')
    }

    // Approach 1920 continuously without a large jump, then hold 1x around 1920 (+/-24px frame).
    for (const outerWidth of [1280, 1880]) {
      vi.stubGlobal('outerWidth', outerWidth)
      fireEvent.resize(window)
      expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBeCloseTo(outerWidth / 1920)
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe(`${outerWidth / 100}px`)
    }

    for (const outerWidth of [1896, 1920, 1936, 1944]) {
      vi.stubGlobal('outerWidth', outerWidth)
      fireEvent.resize(window)
      expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe(`${outerWidth / 100}px`)
    }
    vi.stubGlobal('outerWidth', 1936)
    for (const innerWidth of [1920, 1745, 1536, 1280]) {
      vi.stubGlobal('innerWidth', innerWidth)
      fireEvent.resize(window)
      expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('19.36px')
    }

    // 2560 ultra-wide windows scale cleanly and remain fixed across native zoom levels.
    vi.stubGlobal('outerWidth', 2560)
    fireEvent.resize(window)
    expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBeCloseTo(2560 / 1920)
    expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('25.6px')

    vi.stubGlobal('outerWidth', 2578)
    for (const innerWidth of [2560, 2327, 2048, 1707, 1463]) {
      vi.stubGlobal('innerWidth', innerWidth)
      fireEvent.resize(window)
      expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBeCloseTo(2578 / 1920)
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('25.78px')
    }

    vi.stubGlobal('outerWidth', 3840)
    fireEvent.resize(window)
    expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBe(1.5)
    expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('38.4px')

    // Narrow viewports reset to 1x and omit --soda-type-vw so fluid clamp() falls back to 1vw.
    resizeNarrow(true)
    expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
    expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('')
    vi.stubGlobal('outerWidth', 1440)
    fireEvent.resize(window)
    expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
    expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('')
    vi.stubGlobal('outerWidth', 390)
    fireEvent.resize(window)
    expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
    expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('')

    // Invalid or unset outerWidth values safely fall back to 1x and omit --soda-type-vw.
    resizeNarrow(false)
    for (const outerWidth of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      vi.stubGlobal('outerWidth', outerWidth)
      fireEvent.resize(window)
      expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe('')
    }
    for (const outerWidth of [1024, 1279]) {
      vi.stubGlobal('outerWidth', outerWidth)
      fireEvent.resize(window)
      expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
      expect(shell.style.getPropertyValue('--soda-type-vw')).toBe(`${outerWidth / 100}px`)
    }

    expect(screen.getByRole('navigation', { name: '主导航' })).toBe(navigation)
    expect(within(navigation).getByRole('link', { name: '首页' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      within(screen.getByLabelText('账号状态')).getByText('0 名代理人 · 0 张驱动盘'),
    ).toBeInTheDocument()
  })

  it('warms a destination on navigation intent without loading every page on render', () => {
    mockWidth(false)
    setup()
    expect(preloadPlayerRoute).not.toHaveBeenCalled()
    const development = screen.getByRole('link', { name: '代理人养成' })
    fireEvent.pointerEnter(development)
    expect(preloadPlayerRoute).toHaveBeenCalledWith('/development')
    fireEvent.focus(development)
    expect(preloadPlayerRoute).toHaveBeenCalledTimes(2)
  })

  it('hides the closed rail from assistive technology and makes its controls inert', () => {
    mockWidth(true)
    const { container } = setup()
    expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument()
    expect(container.querySelector('.f5v-rail')).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: '打开导航' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('focuses and traps the open navigation, then restores the menu on Escape', async () => {
    mockWidth(true)
    const user = userEvent.setup()
    const { container } = setup()
    await user.click(screen.getByRole('button', { name: '打开导航' }))
    const dialog = screen.getByRole('dialog', { name: '主导航' })
    expect(within(dialog).getByRole('button', { name: '关闭导航' })).toHaveFocus()
    expect(container.querySelector('.f5v-content')).toHaveAttribute('inert')
    const first = within(dialog).getByRole('link', { name: 'Soda Terminal 首页' })
    const last = within(dialog).getByRole('link', { name: '帮助与隐私' })
    first.focus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开导航' })).toHaveFocus()
    expect(container.querySelector('.f5v-content')).not.toHaveAttribute('inert')
  })

  it('leaves route-heading focus to AppShell when a navigation link changes pages', async () => {
    mockWidth(true)
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: '打开导航' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: '代理人养成' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '页面内容' })).toHaveFocus()
  })

  it('scrolls the scanner page from its initial heading with standard keyboard keys', () => {
    mockWidth(false)
    render(
      <MemoryRouter initialEntries={['/system/scanner']}>
        <Harness />
      </MemoryRouter>,
    )
    const main = screen.getByRole('main')
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(main, 'scrollHeight', { configurable: true, value: 1200 })
    main.scrollTop = 0
    const heading = screen.getByRole('heading', { name: '页面内容' })

    fireEvent.keyDown(heading, { key: 'PageDown' })
    expect(main.scrollTop).toBe(360)
    fireEvent.keyDown(heading, { key: 'ArrowDown' })
    expect(main.scrollTop).toBe(400)
    fireEvent.keyDown(heading, { key: 'End' })
    expect(main.scrollTop).toBe(800)
    fireEvent.keyDown(heading, { key: 'Home' })
    expect(main.scrollTop).toBe(0)
    expect(screen.getByRole('button', { name: '页面操作' })).toBeEnabled()
  })

  it('exposes stable route-section metadata on the shell for cross-route tonal continuity', () => {
    mockWidth(false)
    for (const [entry, expectedSection] of [
      ['/', 'home'],
      ['/assets/agents', 'assets'],
      ['/development/agent-billy', 'development'],
      ['/loadouts/team', 'teams'],
      ['/warehouse/discs', 'warehouse'],
      ['/system/help', 'system'],
    ] as const) {
      const { container, unmount } = render(
        <MemoryRouter initialEntries={[entry]}>
          <Harness />
        </MemoryRouter>,
      )
      expect(container.querySelector('.f5v-shell')).toHaveAttribute(
        'data-route-section',
        expectedSection,
      )
      unmount()
    }
  })

  it('keeps desktop navigation accessible and responds to crossing the CSS breakpoint', () => {
    const resize = mockWidth(false)
    const { container } = setup()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(container.querySelector('.f5v-rail')).not.toHaveAttribute('inert')
    resize(true)
    expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument()
    resize(false)
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(container.querySelector('.f5v-content')).not.toHaveAttribute('inert')
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 960px)')
  })
})
