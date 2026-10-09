import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { F5VisualShell } from './F5VisualShell'
import { preloadPlayerRoute } from '../routes/preloadPlayerRoute'

vi.mock('../motion/useDetailsDisclosureMotion', () => ({ useDetailsDisclosureMotion: vi.fn() }))
vi.mock('../motion/useStateTransitionMotion', () => ({ useStateTransitionMotion: vi.fn() }))
vi.mock('../routes/preloadPlayerRoute', () => ({ preloadPlayerRoute: vi.fn() }))

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

function Harness() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    // Mirrors AppShell's route-heading focus ownership.
    document.querySelector<HTMLElement>('h1')?.focus()
  }, [location.pathname])
  return (
    <F5VisualShell
      currentPath={location.pathname}
      currentTitle="首页"
      currentVersion="测试"
      account={{ hydrating: false, name: '', agentCount: 0, discCount: 0, hasAccount: false }}
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
  it('resets the shared desktop scale when a wide window becomes a compact window', () => {
    mockWidth(false)
    vi.stubGlobal('innerWidth', 2560)
    const { container } = setup()
    const shell = container.querySelector<HTMLElement>('.f5v-shell')!
    expect(Number(shell.style.getPropertyValue('--soda-ui-scale'))).toBeCloseTo(4 / 3)
    const navigation = screen.getByRole('navigation', { name: '主导航' })
    vi.stubGlobal('innerWidth', 1366)
    fireEvent.resize(window)
    expect(shell.style.getPropertyValue('--soda-ui-scale')).toBe('1')
    expect(screen.getByRole('navigation', { name: '主导航' })).toBe(navigation)
    expect(within(navigation).getByRole('link', { name: '首页' })).toHaveAttribute(
      'aria-current',
      'page',
    )
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
