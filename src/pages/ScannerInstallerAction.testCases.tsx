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
  createObjectURL: ReturnType<typeof vi.fn>
}) {
  const { streamedDownload, setDownloadFetcher, executableFixture, createObjectURL } = context

  it('shows streamed bytes before EOF and requests browser save only after all bytes arrive', async () => {
    const { streamController } = streamedDownload()
    render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await act(async () => {
      streamController.enqueue(executableFixture.subarray(0, 4))
    })
    const progress = screen.getByRole('progressbar', { name: '画面扫描下载进度' })
    await waitFor(() => expect(progress).toHaveAttribute('value', '4'))
    expect(progress).toHaveAttribute('max', '8')
    expect(progress).toHaveAttribute('aria-valuetext', expect.stringContaining('50%'))
    expect(screen.getByRole('button', { name: /下载中/ })).toBeDisabled()
    expect(createObjectURL).not.toHaveBeenCalled()
    await act(async () => {
      streamController.enqueue(executableFixture.subarray(4))
      streamController.close()
    })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '文件已准备，请在下载列表打开安装包，安装后点击连接。',
      ),
    )
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/下载完成。打开/)).not.toBeInTheDocument()
  })

  it.each([
    ['invalid', new Uint8Array([60, 104, 116, 109, 108])],
    ['truncated', executableFixture.subarray(0, 7)],
    ['oversized', new Uint8Array([...executableFixture, 9])],
  ])('rejects a %s installer and permits only a verified retry', async (_, bytes) => {
    setDownloadFetcher(vi.fn().mockResolvedValue(new Response(bytes)))
    render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: '直接下载' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下载画面扫描' })).toBeEnabled()
  })

  it('cancels a partial stream and permits a fresh download', async () => {
    const { streamController, cancel, fetcher, body } = streamedDownload()
    render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await act(async () => {
      streamController.enqueue(executableFixture.subarray(0, 4))
    })
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4'))
    fireEvent.click(screen.getByRole('button', { name: '取消下载' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
    expect(cancel).toHaveBeenCalledOnce()
    expect(body.locked).toBe(false)
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
    fetcher.mockResolvedValue(new Response(executableFixture))
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '文件已准备，请在下载列表打开安装包，安装后点击连接。',
      ),
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('ends a non-settling host fetch immediately on cancellation and ignores a late result', async () => {
    let finishFetch!: (response: Response) => void
    const fetcher = vi.fn().mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishFetch = resolve
      }),
    )
    setDownloadFetcher(fetcher)
    render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: '取消下载' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
    expect(screen.queryByRole('button', { name: '取消下载' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '直接下载' })).not.toBeInTheDocument()
    fetcher.mockResolvedValue(new Response(executableFixture))
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '文件已准备，请在下载列表打开安装包，安装后点击连接。',
      ),
    )
    await act(async () => {
      finishFetch(new Response(executableFixture))
    })
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent(
      '文件已准备，请在下载列表打开安装包，安装后点击连接。',
    )
  })

  it('ends a repeatedly stalled fetch after bounded recovery and permits a verified retry', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockReturnValue(new Promise(() => {}))
    setDownloadFetcher(fetcher)
    render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    })
    expect(screen.getByRole('status')).toHaveTextContent('下载超时，请重试下载。')
    expect(screen.getByRole('button', { name: '下载画面扫描' })).toBeEnabled()
    expect(screen.queryByRole('link', { name: '直接下载' })).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(fetcher.mock.calls.every(([, request]) => request.signal.aborted)).toBe(true)
    expect(createObjectURL).not.toHaveBeenCalled()
    vi.useRealTimers()
    fetcher.mockResolvedValueOnce(new Response(executableFixture))
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
    expect(fetcher).toHaveBeenCalledTimes(5)
    expect(createObjectURL).toHaveBeenCalledOnce()
  })

  it('aborts the stream and releases the reader on unmount', async () => {
    const { streamController, cancel, fetcher, body } = streamedDownload()
    const { unmount } = render(
      <ScannerInstallerAction distribution={initialDistributionSnapshot} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await act(async () => {
      streamController.enqueue(executableFixture.subarray(0, 4))
    })
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4'))
    await act(async () => {
      unmount()
    })
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
    expect(cancel).toHaveBeenCalledOnce()
    expect(body.locked).toBe(false)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('leaves manual connection to the existing parent action after requesting save', async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined)
    setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executableFixture)))
    render(
      <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toBeEnabled())
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /重新下载/ })).toBeEnabled()
    expect(onConnect).not.toHaveBeenCalled()
  })

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
