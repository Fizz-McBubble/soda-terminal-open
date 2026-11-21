import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { ensureOfficialCatalogInstalled } from '../assets/visualAssetInstallCoordinator'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppHealth } from '../appHealthContext'
import { database } from '../db/databaseCore'
import type { F5VisualShell } from './F5VisualShell'
const shellTest = vi.hoisted(() => ({ actual: false }))

vi.mock('../assets/visualAssetInstallCoordinator', () => ({
  ensureOfficialCatalogInstalled: vi.fn(),
}))
beforeEach(() => {
  vi.mocked(ensureOfficialCatalogInstalled).mockReset().mockResolvedValue(undefined)
  vi.mocked(useLiveQuery).mockReset().mockReturnValue(undefined)
  vi.mocked(useAppHealth).mockReturnValue({
    currentVersion: { gameVersion: 'test' },
    dataStatus: 'ready',
    databaseStatus: 'ready',
  } as never)
  shellTest.actual = false
})

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }))
vi.mock('../appHealthContext', () => ({
  useAppHealth: vi.fn(() => ({
    currentVersion: { gameVersion: 'test' },
    dataStatus: 'ready',
    databaseStatus: 'ready',
  })),
}))
vi.mock('./F5VisualShell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./F5VisualShell')>()
  return {
    F5VisualShell: (props: ComponentProps<typeof F5VisualShell>) =>
      shellTest.actual ? (
        <actual.F5VisualShell {...props} />
      ) : (
        <>
          <button>导航操作</button>
          <main>{props.children}</main>
        </>
      ),
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function view(children: ReactNode) {
  return (
    <MemoryRouter initialEntries={['/assets']}>
      <AppShell>{children}</AppShell>
    </MemoryRouter>
  )
}

describe('AppShell asynchronous route focus', () => {
  it('shows a database failure as unknown account facts, keeps navigation, and exposes initialization retry', () => {
    shellTest.actual = true
    const retry = vi.fn()
    vi.mocked(useAppHealth).mockReturnValue({
      currentVersion: { gameVersion: 'test' },
      dataStatus: 'ready',
      databaseStatus: 'error',
      retryDatabaseInitialization: retry,
    } as never)
    render(view(<h1>资产</h1>))
    const strip = screen.getByLabelText('账号状态')
    expect(strip).toHaveTextContent('暂无法读取')
    expect(strip).not.toHaveTextContent('读取中')
    expect(strip).not.toHaveTextContent('0 名代理人')
    expect(screen.getAllByRole('link', { name: /我的资产/ })[0]).toHaveAttribute('href', '/assets')
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('catches account query failures, then permits retry to a confirmed empty account', async () => {
    shellTest.actual = true
    const viewResult = render(view(<h1>资产</h1>))
    expect(screen.getByLabelText('账号状态')).toHaveTextContent('读取中')
    vi.spyOn(database, 'transaction').mockRejectedValueOnce(new Error('private-db-error'))
    const query = vi.mocked(useLiveQuery).mock.calls[0][0]
    const failed = await query()
    vi.mocked(useLiveQuery).mockReturnValue(failed)
    viewResult.rerender(view(<h1>资产</h1>))
    expect(screen.getByLabelText('账号状态')).toHaveTextContent('账户状态未知')
    expect(document.body.textContent).not.toContain('private-db-error')
    vi.mocked(useLiveQuery).mockReturnValue({
      status: 'ready',
      data: { accountId: null, name: '', discCount: 0, agentCount: 0, hasAccount: false },
    })
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    expect(screen.getByLabelText('账号状态')).toHaveTextContent('尚未创建账户')
    expect(
      within(screen.getByLabelText('账号状态')).getByText('0 名代理人 · 0 张驱动盘'),
    ).toBeInTheDocument()
  })
  it('loads the full catalog at mount and retries only when connectivity returns', async () => {
    vi.mocked(ensureOfficialCatalogInstalled).mockRejectedValue(new Error('offline'))
    const { unmount, rerender } = render(view(<h1>资产</h1>))
    expect(ensureOfficialCatalogInstalled).toHaveBeenCalledOnce()
    expect(ensureOfficialCatalogInstalled).toHaveBeenCalledWith()
    await waitFor(() => expect(screen.getByRole('heading')).toHaveFocus())
    rerender(view(<h1>账户</h1>))
    expect(ensureOfficialCatalogInstalled).toHaveBeenCalledOnce()
    act(() => window.dispatchEvent(new Event('online')))
    expect(ensureOfficialCatalogInstalled).toHaveBeenCalledTimes(2)
    unmount()
    act(() => window.dispatchEvent(new Event('online')))
    expect(ensureOfficialCatalogInstalled).toHaveBeenCalledTimes(2)
  })

  it('focuses the available heading on the initial route handoff', async () => {
    render(view(<h1>资产</h1>))
    await waitFor(() => expect(screen.getByRole('heading')).toHaveFocus())
  })

  it('does not steal chosen navigation focus when a delayed heading arrives', async () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const { rerender } = render(view(<div role="status">读取中</div>))
    act(() => frames.splice(0).forEach((callback) => callback(0)))
    screen.getByRole('button', { name: '导航操作' }).focus()
    rerender(view(<h1>资产</h1>))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: '导航操作' })).toHaveFocus()
  })

  it('recovers genuinely lost focus when the heading arrives', async () => {
    const { rerender } = render(view(<div role="status">读取中</div>))
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    rerender(view(<h1>资产</h1>))
    await waitFor(() => expect(screen.getByRole('heading')).toHaveFocus())
  })

  it('leaves a native dialog in charge during initial and later DOM updates', async () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const content = (updated: boolean) => (
      <>
        <h1>资产</h1>
        <dialog open>
          <button>取消恢复</button>
          {updated && <p role="alert">请先处理引用</p>}
        </dialog>
      </>
    )
    const { rerender } = render(view(content(false)))
    const cancel = screen.getByRole('button', { name: '取消恢复' })
    cancel.focus()
    act(() => frames.splice(0).forEach((callback) => callback(0)))
    rerender(view(content(true)))
    await act(async () => {
      await Promise.resolve()
    })
    expect(cancel).toHaveFocus()
  })
})
