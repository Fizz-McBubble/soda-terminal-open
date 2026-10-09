import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ScannerInstallerAction } from './ScannerInstallerAction'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'
const executableFixture = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
vi.mock('../scanner/distribution', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scanner/distribution')>()
  return {
    ...actual,
    scannerDistributionManifest: {
      ...actual.scannerDistributionManifest,
      helper: { ...actual.scannerDistributionManifest.helper, size: 8 },
    },
  }
})
const createObjectURL = vi.fn().mockReturnValue('blob:installer')
function streamedDownload() {
  let streamController!: ReadableStreamDefaultController<Uint8Array>
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
    },
    cancel,
  })
  const fetcher = vi.fn().mockResolvedValue(new Response(body))
  vi.stubGlobal('fetch', fetcher)
  return { streamController, cancel, fetcher, body }
}
beforeEach(() => {
  createObjectURL.mockClear()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = vi.fn()
    },
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker
})
it('offers an upgrade only for a detected old installation', () => {
  const { rerender } = render(
    <ScannerInstallerAction
      distribution={{ ...initialDistributionSnapshot, state: 'ready', installedVersion: 'old' }}
    />,
  )
  expect(screen.getByRole('button', { name: '更新扫描助手' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent(
    `新版本 ${scannerDistributionManifest.helper.installerVersion}`,
  )
  rerender(
    <ScannerInstallerAction
      distribution={{
        ...initialDistributionSnapshot,
        state: 'update_available',
        installedVersion: scannerDistributionManifest.runtime.version,
      }}
    />,
  )
  expect(screen.getByRole('button', { name: '更新扫描助手' })).toBeVisible()
  rerender(
    <ScannerInstallerAction
      distribution={{
        ...initialDistributionSnapshot,
        state: 'ready',
        installedVersion: scannerDistributionManifest.runtime.version,
      }}
    />,
  )
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('starts fetching in the click task without calling an exposed non-settling save picker', async () => {
  const picker = vi.fn().mockReturnValue(new Promise(() => {}))
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker })
  const { streamController, fetcher } = streamedDownload()
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(picker).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /下载中/ }))
  expect(fetcher).toHaveBeenCalledOnce()
  await act(async () => {
    streamController.enqueue(executableFixture)
    streamController.close()
  })
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包'))
  expect(createObjectURL.mock.calls[0][0].size).toBe(8)
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe(`Soda-Scanner-Setup-${scannerDistributionManifest.helper.installerVersion}.exe`)
})
it('shows streamed bytes before EOF and requests browser save only after all bytes arrive', async () => {
  const { streamController } = streamedDownload()
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await act(async () => {
    streamController.enqueue(executableFixture.subarray(0, 4))
  })
  const progress = screen.getByRole('progressbar', { name: '扫描助手下载进度' })
  await waitFor(() => expect(progress).toHaveAttribute('value', '4'))
  expect(progress).toHaveAttribute('max', '8')
  expect(progress).toHaveAttribute('aria-valuetext', expect.stringContaining('50%'))
  expect(screen.getByRole('button', { name: /下载中/ })).toBeDisabled()
  expect(createObjectURL).not.toHaveBeenCalled()
  await act(async () => {
    streamController.enqueue(executableFixture.subarray(4))
    streamController.close()
  })
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包'))
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.queryByText(/下载完成。打开/)).not.toBeInTheDocument()
})
it.each([
  ['invalid', new Uint8Array([60, 104, 116, 109, 108])],
  ['truncated', executableFixture.subarray(0, 7)],
  ['oversized', new Uint8Array([...executableFixture, 9])],
])('rejects a %s installer and offers explicit native recovery', async (_, bytes) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)))
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: '直接下载' })).toHaveAttribute(
    'href',
    scannerDistributionManifest.helper.downloadUrl,
  )
  expect(screen.getByRole('link', { name: '直接下载' })).toHaveAttribute(
    'download',
    `Soda-Scanner-Setup-${scannerDistributionManifest.helper.installerVersion}.exe`,
  )
  expect(screen.getByRole('button', { name: '下载扫描助手' })).toBeEnabled()
})
it('cancels a partial stream and permits a fresh download', async () => {
  const { streamController, cancel, fetcher, body } = streamedDownload()
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
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
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包'))
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('ends a non-settling host fetch immediately on cancellation and ignores a late result', async () => {
  let finishFetch!: (response: Response) => void
  const fetcher = vi.fn().mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      finishFetch = resolve
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  fireEvent.click(screen.getByRole('button', { name: '取消下载' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
  expect(screen.queryByRole('button', { name: '取消下载' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '直接下载' })).toBeVisible()
  fetcher.mockResolvedValue(new Response(executableFixture))
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包'))
  await act(async () => {
    finishFetch(new Response(executableFixture))
  })
  expect(createObjectURL).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包')
})
it('ends a stalled fetch at ten minutes and offers direct download', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
  })
  expect(screen.getByRole('status')).toHaveTextContent('下载超时')
  expect(screen.getByRole('button', { name: '下载扫描助手' })).toBeEnabled()
  expect(screen.getByRole('link', { name: '直接下载' })).toBeVisible()
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('aborts the stream and releases the reader on unmount', async () => {
  const { streamController, cancel, fetcher, body } = streamedDownload()
  const { unmount } = render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executableFixture)))
  render(
    <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
  )
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toBeVisible())
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.getByRole('button', { name: '重新下载' })).toBeEnabled()
  expect(onConnect).not.toHaveBeenCalled()
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
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  fireEvent.blur(window)
  fireEvent.focus(window)
  expect(onConnect).not.toHaveBeenCalled()
  await act(async () => {
    streamController.enqueue(executableFixture)
    streamController.close()
  })
  await waitFor(() => expect(screen.getByRole('button', { name: '重新下载' })).toBeVisible())
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executableFixture)))
  const onConnect = vi.fn().mockRejectedValue(new Error('helper_not_ready'))
  render(
    <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
  )
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '重新下载' })).toBeVisible())
  fireEvent.blur(window)
  fireEvent.focus(window)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('启动助手后点击连接'))
  expect(screen.getByRole('button', { name: '重新下载' })).toBeEnabled()
  fireEvent.blur(window)
  fireEvent.focus(window)
  expect(onConnect).toHaveBeenCalledOnce()
})
it('keeps a pending download cancellable when the runtime becomes ready', async () => {
  const { streamController, cancel } = streamedDownload()
  const { rerender } = render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
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
  vi.stubGlobal('fetch', fetcher)
  const onConnect = vi.fn().mockResolvedValue(undefined)
  render(
    <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
  )
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '重新下载' })).toBeEnabled())
  const visibility = vi.spyOn(document, 'visibilityState', 'get')
  visibility.mockReturnValue('hidden')
  fireEvent(document, new Event('visibilitychange'))
  visibility.mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(onConnect).toHaveBeenCalledOnce())
  fireEvent(document, new Event('visibilitychange'))
  fireEvent.focus(window)
  expect(onConnect).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: '重新下载' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.getByRole('button', { name: '重新下载' })).toBeEnabled())
  fireEvent.focus(window)
  expect(onConnect).toHaveBeenCalledOnce()
  fireEvent.blur(window)
  fireEvent.focus(window)
  await waitFor(() => expect(onConnect).toHaveBeenCalledTimes(2))
})

it('restores keyboard focus to download when the compact cancel action disappears', async () => {
  streamedDownload()
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  const cancelButton = screen.getByRole('button', { name: '取消下载' })
  cancelButton.focus()
  fireEvent.click(cancelButton)
  await waitFor(() => expect(screen.getByRole('button', { name: '下载扫描助手' })).toHaveFocus())
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

it('preserves keyboard focus when completion removes the cancel action', async () => {
  const { streamController } = streamedDownload()
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  screen.getByRole('button', { name: '取消下载' }).focus()
  await act(async () => {
    streamController.enqueue(executableFixture)
    streamController.close()
  })
  await waitFor(() => expect(screen.getByRole('button', { name: '重新下载' })).toHaveFocus())
})
