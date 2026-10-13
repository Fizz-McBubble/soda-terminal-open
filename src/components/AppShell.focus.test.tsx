import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { ensureOfficialCatalogInstalled } from '../assets/visualAssetInstallCoordinator'

vi.mock('../assets/visualAssetInstallCoordinator', () => ({
  ensureOfficialCatalogInstalled: vi.fn(),
}))
beforeEach(() => {
  vi.mocked(ensureOfficialCatalogInstalled).mockReset().mockResolvedValue(undefined)
})

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => undefined }))
vi.mock('../appHealthContext', () => ({
  useAppHealth: () => ({
    currentVersion: { gameVersion: 'test' },
    dataStatus: 'ready',
    databaseStatus: 'ready',
  }),
}))
vi.mock('./F5VisualShell', () => ({
  F5VisualShell: ({ children }: { children: ReactNode }) => (
    <>
      <button>导航操作</button>
      <main>{children}</main>
    </>
  ),
}))

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
