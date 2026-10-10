import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import installerManifest from '../../public/downloads/scanner-installer-release.v1.json'
import { installerReleaseUrl } from '../scanner/installerRelease'
import { ScannerInstallerAction } from './ScannerInstallerAction'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'
const executableFixture = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const freshRelease = {
  ...installerManifest,
  version: '1.0.9',
  helperVersion: '2.3.11',
  releaseTag: 'scanner-installer-v1.0.9',
  assetUrl:
    'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-installer-v1.0.9/Soda-Scanner-Setup.exe',
  size: 8,
  sha256: '9f36b7c45ed5f988cdccc31daef10be8d5b0d55fdfc6181df5eff666a9c4f2db',
}
function setDownloadFetcher(fetcher: typeof fetch) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL, init?: RequestInit) =>
      url === installerReleaseUrl
        ? Promise.resolve(Response.json(freshRelease))
        : fetcher(url, init),
    ),
  )
}
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
  setDownloadFetcher(fetcher)
  return { streamController, cancel, fetcher, body }
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
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
  expect(screen.getByText(`v${scannerDistributionManifest.helper.installerVersion}`)).toBeVisible()
  expect(screen.getByRole('button', { name: '更新扫描助手' })).toHaveAccessibleDescription(
    `安装包 v${scannerDistributionManifest.helper.installerVersion}（助手 v${scannerDistributionManifest.helper.version}）`,
  )
  expect(screen.getByRole('button', { name: '更新扫描助手' })).toHaveAttribute(
    'title',
    `安装包 v${scannerDistributionManifest.helper.installerVersion}（助手 v${scannerDistributionManifest.helper.version}）`,
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
  const downloadButton = screen.getByRole('button', { name: '下载扫描助手' })
  const displayedVersion = downloadButton
    .querySelector('.scanner-installer__version')
    ?.textContent?.trim()
    .replace(/^v/, '')
  expect(displayedVersion).toBe(scannerDistributionManifest.helper.installerVersion)
  fireEvent.click(downloadButton)
  expect(fetch).toHaveBeenCalledOnce()
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  expect(downloadButton).toHaveAttribute('title', '安装包 v1.0.9（助手 v2.3.11）')
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    installerReleaseUrl,
    expect.objectContaining({
      credentials: 'omit',
      cache: 'no-store',
      mode: 'same-origin',
      redirect: 'error',
    }),
  )
  expect(picker).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /下载中/ }))
  expect(fetcher).toHaveBeenCalledOnce()
  await act(async () => {
    streamController.enqueue(executableFixture)
    streamController.close()
  })
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包'))
  expect(createObjectURL.mock.calls[0][0].size).toBe(8)
  expect(screen.getByText('v1.0.9')).toBeVisible()
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe(`Soda-Scanner-Setup-${freshRelease.version}.exe`)
})
it('rejects a bad refreshed release without fetching or saving installer bytes', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...freshRelease, sha256: 'invalid' }))
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][0]).toBe(installerReleaseUrl)
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '下载扫描助手' })).toBeEnabled()
})
it('rejects an alias that changed between the release refresh and byte download without retrying', async () => {
  const tampered = new Uint8Array(executableFixture)
  tampered[7] ^= 1
  const fetcher = vi.fn().mockResolvedValue(new Response(tampered))
  setDownloadFetcher(fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.getByText('v1.0.9')).toBeVisible()
})
it('includes the manifest refresh in the ten-minute total deadline', async () => {
  vi.useFakeTimers()
  let finish!: (response: Response) => void
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    )
    .mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000)
  })
  await act(async () => {
    finish(Response.json(freshRelease))
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60 * 1000)
  })
  expect(screen.getByRole('status')).toHaveTextContent('下载超时')
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true)
  expect(createObjectURL).not.toHaveBeenCalled()
})
it('cancels an unmounted manifest refresh and ignores its late release', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn().mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  const { unmount } = render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  unmount()
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => {
    finish(Response.json(freshRelease))
  })
  expect(fetcher).toHaveBeenCalledOnce()
  expect(createObjectURL).not.toHaveBeenCalled()
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
])('rejects a %s installer and permits only a verified retry', async (_, bytes) => {
  setDownloadFetcher(vi.fn().mockResolvedValue(new Response(bytes)))
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: '直接下载' })).not.toBeInTheDocument()
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
  setDownloadFetcher(fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: '取消下载' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
  expect(screen.queryByRole('button', { name: '取消下载' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '直接下载' })).not.toBeInTheDocument()
  fetcher.mockResolvedValue(new Response(executableFixture))
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包'))
  await act(async () => {
    finishFetch(new Response(executableFixture))
  })
  expect(createObjectURL).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('在下载列表打开安装包')
})
it('ends a stalled fetch at ten minutes and permits a verified retry', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {}))
  setDownloadFetcher(fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
  })
  expect(screen.getByRole('status')).toHaveTextContent('下载超时')
  expect(screen.getByRole('button', { name: '下载扫描助手' })).toBeEnabled()
  expect(screen.queryByRole('link', { name: '直接下载' })).not.toBeInTheDocument()
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
  setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executableFixture)))
  render(
    <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
  )
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toBeVisible())
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
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
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
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
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
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toBeVisible())
  fireEvent.blur(window)
  fireEvent.focus(window)
  expect(onConnect).toHaveBeenCalledOnce()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('启动助手后点击连接'))
  expect(screen.getByRole('button', { name: /重新下载/ })).toBeEnabled()
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
  setDownloadFetcher(fetcher)
  const onConnect = vi.fn().mockResolvedValue(undefined)
  render(
    <ScannerInstallerAction distribution={initialDistributionSnapshot} onConnect={onConnect} />,
  )
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
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
  await waitFor(() => expect(screen.getByRole('button', { name: /重新下载/ })).toHaveFocus())
})
