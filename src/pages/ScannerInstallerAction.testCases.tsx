import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ScannerInstallerAction } from './ScannerInstallerAction'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'

export function registerScannerInstallerActionCases(context: {
  streamedDownload: () => {
    streamController: ReadableStreamDefaultController<Uint8Array>
    cancel: ReturnType<typeof vi.fn>
    fetcher: ReturnType<typeof vi.fn>
    body: ReadableStream<Uint8Array>
  }
  setDownloadFetcher: (fetcher: typeof fetch) => void
  executableFixture: Uint8Array<ArrayBuffer>
}) {
  const { streamedDownload, setDownloadFetcher, executableFixture } = context

  it('defers installation return connection while another task owns the workbench', async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined)
    const onAttentionChange = vi.fn()
    setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executableFixture)))
    const { rerender } = render(
      <ScannerInstallerAction
        distribution={initialDistributionSnapshot}
        onConnect={onConnect}
        connectionBlocked
        onAttentionChange={onAttentionChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await screen.findByRole('button', { name: /重新下载/ })
    expect(onAttentionChange).toHaveBeenLastCalledWith(true)
    fireEvent.blur(window)
    fireEvent.focus(window)
    expect(onConnect).not.toHaveBeenCalled()
    rerender(
      <ScannerInstallerAction
        distribution={initialDistributionSnapshot}
        onConnect={onConnect}
        onAttentionChange={onAttentionChange}
      />,
    )
    fireEvent.focus(window)
    await waitFor(() => expect(onConnect).toHaveBeenCalledOnce())
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('ignores premature focus and connects once after leaving the completed download', async () => {
    const { streamController } = streamedDownload()
    let finishConnect!: () => void
    const onConnect = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        finishConnect = resolve
      }),
    )
    const { unmount } = render(
      <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    fireEvent.blur(window)
    fireEvent.focus(window)
    expect(onConnect).not.toHaveBeenCalled()
    await act(async () => {
      streamController.enqueue(executableFixture)
      streamController.close()
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toBeVisible())
    fireEvent.focus(window)
    expect(onConnect).not.toHaveBeenCalled()
    fireEvent.blur(window)
    fireEvent.focus(window)
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
    await act(async () => {
      finishConnect()
    })
    fireEvent.blur(window)
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
    unmount()
    fireEvent.blur(window)
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('handles rejected automatic connection without repeating attempts on focus', async () => {
    setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executableFixture)))
    const onConnect = vi.fn().mockRejectedValue(new Error('helper_not_ready'))
    render(
      <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toBeVisible())
    fireEvent.blur(window)
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('启动画面扫描后点击连接'),
    )
    expect(screen.getByRole('button', { name: /重新下载/ })).toBeEnabled()
    fireEvent.blur(window)
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('keeps a pending download cancellable when the runtime becomes ready', async () => {
    const { streamController, cancel } = streamedDownload()
    const { rerender } = render(
      <ScannerInstallerAction distribution={initialDistributionSnapshot} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await act(async () => {
      streamController.enqueue(executableFixture.subarray(0, 4))
    })
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4'))
    rerender(
      <ScannerInstallerAction
        distribution={{
          ...initialDistributionSnapshot,
          state: 'ready',
          installedVersion: scannerDistributionManifest.runtime.version,
        }}
      />,
    )
    expect(screen.getByRole('progressbar')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '取消下载' }))
    await waitFor(() => expect(cancel).toHaveBeenCalledOnce())
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('connects once after a visible return and resets eligibility for a new download', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(executableFixture))
    setDownloadFetcher(fetcher)
    const onConnect = vi.fn().mockResolvedValue(undefined)
    render(
      <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toBeEnabled())
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    visibility.mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    visibility.mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(onConnect).toHaveBeenCalledOnce())
    fireEvent(document, new Event('visibilitychange'))
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /重新下载/ }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toBeEnabled())
    fireEvent.focus(window)
    expect(onConnect).toHaveBeenCalledOnce()
    fireEvent.blur(window)
    fireEvent.focus(window)
    await waitFor(() => expect(onConnect).toHaveBeenCalledTimes(2))
  })

  it('restores keyboard focus to download when the compact cancel action disappears', async () => {
    streamedDownload()
    render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    const cancelButton = screen.getByRole('button', { name: '取消下载' })
    cancelButton.focus()
    fireEvent.click(cancelButton)
    await waitFor(() => expect(screen.getByRole('button', { name: '下载画面扫描' })).toHaveFocus())
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('preserves keyboard focus when completion removes the cancel action', async () => {
    const { streamController } = streamedDownload()
    render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    screen.getByRole('button', { name: '取消下载' }).focus()
    await act(async () => {
      streamController.enqueue(executableFixture)
      streamController.close()
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toHaveFocus())
  })
}
