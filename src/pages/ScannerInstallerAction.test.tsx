import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import installerManifest from '../../public/downloads/scanner-installer-release.v1.json'
import { installerReleaseUrl } from '../scanner/installerRelease'
import { ScannerInstallerAction } from './ScannerInstallerAction'
import { registerScannerInstallerActionCases } from './ScannerInstallerAction.testCases'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'
import { createRef } from 'react'
import { PrepareChecklist } from './ScannerPrepareChecklist'
import { baseScannerSnapshot } from './scannerAssistantTestFixture'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import { presentScannerHelperSnapshot } from '../scanner/runtimeHelperVersion'
import { sanitizeInstallerFeedback } from '../assetQuickRead/installerFeedback'

const releaseStateFixture = vi.hoisted(() => ({
  value: 'published' as 'published' | 'not_published',
}))
vi.mock('../scanner/distribution', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scanner/distribution')>()
  return {
    ...actual,
    scannerDistributionManifest: {
      ...actual.scannerDistributionManifest,
      runtime: {
        ...actual.scannerDistributionManifest.runtime,
        get releaseState() {
          return releaseStateFixture.value
        },
      },
    },
  }
})
const executableFixture = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const freshRelease = {
  ...installerManifest,
  releaseState: 'published',
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
it('shows the connected old Helper upgrade in the compact preparation status', async () => {
  const snapshot = presentScannerHelperSnapshot(
    {
      ...(baseScannerSnapshot as ScannerAssistantSnapshot),
      state: 'ready',
      readiness: {
        ...baseScannerSnapshot.readiness,
        helperConnected: true,
        accountWriteEnabled: false,
      },
      distribution: { ...initialDistributionSnapshot, state: 'ready' },
    },
    '2.3.15',
  )
  render(
    <PrepareChecklist
      snapshot={snapshot}
      headingRef={createRef()}
      eyebrow="准备"
      title="画面扫描已连接"
      body="连接就绪"
      targetReady
      targetPanel={null}
      accountDisclosure={null}
      onStart={vi.fn()}
      onReconnect={vi.fn()}
      compact
      installer={<ScannerInstallerAction distribution={snapshot.distribution!} />}
    />,
  )
  expect(await screen.findByText(/画面扫描有新版本.*请更新/)).toBeVisible()
  expect(screen.getByRole('button', { name: '更新画面扫描' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
  expect(screen.queryByText('连接就绪')).not.toBeInTheDocument()
})
it('replaces compact preparation feedback instead of adding a download status row', async () => {
  setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executableFixture)))
  render(
    <PrepareChecklist
      snapshot={{
        ...(baseScannerSnapshot as ScannerAssistantSnapshot),
        state: 'unchecked',
        readiness: {
          ...baseScannerSnapshot.readiness,
          helperConnected: false,
          accountWriteEnabled: false,
        },
        distribution: initialDistributionSnapshot,
      }}
      headingRef={createRef()}
      eyebrow="准备"
      title="画面扫描未连接"
      body="旧连接提示"
      targetReady
      targetPanel={null}
      accountDisclosure={null}
      onStart={vi.fn()}
      onReconnect={vi.fn()}
      compact
      installer={<ScannerInstallerAction distribution={initialDistributionSnapshot} />}
    />,
  )
  expect(screen.getByRole('heading', { name: '准备游戏' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /下载画面扫描/ }))
  await waitFor(() =>
    expect(screen.getByText('文件已准备，请在下载列表打开安装包，安装后点击连接。')).toBeVisible(),
  )
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText('旧连接提示')).not.toBeInTheDocument()
  expect(screen.queryByText('画面扫描未连接')).not.toBeInTheDocument()
})
it('replaces prepared-download feedback after a new connection fails and accepts a later download', async () => {
  setDownloadFetcher(
    vi.fn().mockImplementation(() => Promise.resolve(new Response(executableFixture))),
  )
  const snapshot: ScannerAssistantSnapshot = {
    ...(baseScannerSnapshot as ScannerAssistantSnapshot),
    state: 'unchecked',
    readiness: {
      ...baseScannerSnapshot.readiness,
      helperConnected: false,
      accountWriteEnabled: false,
    },
    distribution: initialDistributionSnapshot,
  }
  const props = {
    headingRef: createRef<HTMLHeadingElement>(),
    eyebrow: '准备',
    title: '画面扫描未连接',
    body: '连接后继续',
    targetReady: true,
    targetPanel: null,
    accountDisclosure: null,
    onStart: vi.fn(),
    onReconnect: vi.fn(),
    compact: true,
    installer: <ScannerInstallerAction distribution={initialDistributionSnapshot} />,
  }
  const view = render(<PrepareChecklist {...props} snapshot={snapshot} />)
  fireEvent.click(screen.getByRole('button', { name: /下载画面扫描/ }))
  await waitFor(() =>
    expect(screen.getByText('文件已准备，请在下载列表打开安装包，安装后点击连接。')).toBeVisible(),
  )
  view.rerender(
    <PrepareChecklist
      {...props}
      snapshot={{ ...snapshot, state: 'connecting' }}
      actionPending
      title="正在连接画面扫描"
    />,
  )
  expect(
    screen.queryByText('文件已准备，请在下载列表打开安装包，安装后点击连接。'),
  ).not.toBeInTheDocument()
  const failed: ScannerAssistantSnapshot = {
    ...snapshot,
    state: 'connection_failed',
    error: {
      userMessage: '本次连接失败',
      remedy: '重新打开画面扫描后连接。',
      recoveryAction: 'retry',
    },
  }
  view.rerender(<PrepareChecklist {...props} snapshot={failed} title="本次连接失败" />)
  expect(screen.getByRole('heading', { name: '本次连接失败' })).toBeVisible()
  expect(screen.getByText('重新打开画面扫描后连接。')).toBeVisible()
  expect(
    screen.queryByText('文件已准备，请在下载列表打开安装包，安装后点击连接。'),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新下载' }))
  await waitFor(() =>
    expect(screen.getByText('文件已准备，请在下载列表打开安装包，安装后点击连接。')).toBeVisible(),
  )
  expect(screen.queryByRole('heading', { name: '本次连接失败' })).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('offers repair for incomplete components without calling it a version mismatch', () => {
  render(
    <ScannerInstallerAction
      distribution={{ ...initialDistributionSnapshot, state: 'repair_required', action: 'repair' }}
      issueCode="runtime_repair_required"
    />,
  )
  expect(screen.getByRole('button', { name: /修复画面扫描/ })).toBeEnabled()
  expect(screen.queryByRole('button', { name: /更新画面扫描/ })).not.toBeInTheDocument()
})
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
  releaseStateFixture.value = 'published'
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
it('keeps an unpublished candidate download hidden', () => {
  releaseStateFixture.value = 'not_published'
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  expect(screen.queryByRole('button', { name: '下载画面扫描' })).not.toBeInTheDocument()
})
it('offers an upgrade only for a detected old installation', () => {
  const { rerender } = render(
    <ScannerInstallerAction
      distribution={{
        ...initialDistributionSnapshot,
        state: 'ready',
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc8-7',
      }}
    />,
  )
  expect(screen.getByRole('button', { name: '更新画面扫描' })).toBeVisible()
  expect(screen.getByText(`v${scannerDistributionManifest.helper.installerVersion}`)).toBeVisible()
  expect(screen.getByRole('button', { name: '更新画面扫描' })).toHaveAccessibleDescription(
    `画面扫描安装包 v${scannerDistributionManifest.helper.installerVersion}`,
  )
  expect(screen.getByRole('button', { name: '更新画面扫描' })).toHaveAttribute(
    'title',
    `画面扫描安装包 v${scannerDistributionManifest.helper.installerVersion}`,
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
  expect(screen.getByRole('button', { name: '更新画面扫描' })).toBeVisible()
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
  const downloadButton = screen.getByRole('button', { name: '下载画面扫描' })
  const displayedVersion = downloadButton
    .querySelector('.scanner-installer__version')
    ?.textContent?.trim()
    .replace(/^v/, '')
  expect(displayedVersion).toBe(scannerDistributionManifest.helper.installerVersion)
  fireEvent.click(downloadButton)
  expect(fetch).toHaveBeenCalledOnce()
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  expect(downloadButton).toHaveAttribute('title', '画面扫描安装包 v1.0.9')
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
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      '文件已准备，请在下载列表打开安装包，安装后点击连接。',
    ),
  )
  expect(createObjectURL.mock.calls[0][0].size).toBe(8)
  expect(screen.getByText('v1.0.9')).toBeVisible()
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe(`SodaTerminal-Scanner-Setup-${freshRelease.version}.exe`)
})
it('rejects a bad refreshed release without fetching or saving installer bytes', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...freshRelease, sha256: 'invalid' }))
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][0]).toBe(installerReleaseUrl)
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: '报告下载问题' })).toBeVisible()
  expect(screen.getByRole('button', { name: '下载画面扫描' })).toBeEnabled()
})
it('rejects an alias that changed between the release refresh and byte download without retrying', async () => {
  const tampered = new Uint8Array(executableFixture)
  tampered[7] ^= 1
  const fetcher = vi.fn().mockResolvedValue(new Response(tampered))
  setDownloadFetcher(fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.getByText('v1.0.9')).toBeVisible()
})
it('refreshes one changed release identity and never mixes bytes across versions', async () => {
  const nextRelease = {
    ...freshRelease,
    version: '1.0.10',
    releaseTag: 'scanner-installer-v1.0.10',
    assetUrl:
      'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-installer-v1.0.10/Soda-Scanner-Setup.exe',
  }
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(freshRelease))
    .mockResolvedValueOnce(
      new Response(executableFixture, {
        status: 206,
        headers: {
          'content-range': 'bytes 0-7/8',
          'content-length': '8',
          etag: `"${'b'.repeat(64)}"`,
        },
      }),
    )
    .mockResolvedValueOnce(Response.json(nextRelease))
    .mockResolvedValueOnce(new Response(executableFixture))
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  expect(fetcher).toHaveBeenCalledTimes(4)
  expect(screen.getByText('v1.0.10')).toBeVisible()
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe('SodaTerminal-Scanner-Setup-1.0.10.exe')
})

it('stops after one manifest refresh when the release identity did not change', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(freshRelease))
    .mockResolvedValueOnce(
      new Response(executableFixture, {
        status: 206,
        headers: {
          'content-range': 'bytes 0-7/8',
          'content-length': '8',
          etag: `"${'b'.repeat(64)}"`,
        },
      }),
    )
    .mockResolvedValueOnce(Response.json(freshRelease))
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(createObjectURL).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: '报告下载问题' })).toBeVisible()
})

it('offers explicit bounded download feedback after package integrity failure', async () => {
  const tampered = new Uint8Array(executableFixture)
  tampered[7] ^= 1
  const feedbackRelease = {
    ...freshRelease,
    version: '1.2.9',
    releaseTag: 'scanner-installer-v1.2.9',
    assetUrl:
      'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-installer-v1.2.9/Soda-Scanner-Setup.exe',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) =>
      url === installerReleaseUrl
        ? Promise.resolve(Response.json(feedbackRelease))
        : Promise.resolve(new Response(tampered)),
    ),
  )
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  const link = screen.getByRole('link', { name: '报告下载问题' })
  const report = sanitizeInstallerFeedback(
    JSON.parse(decodeURIComponent(new URL((link as HTMLAnchorElement).href).hash.slice(1))),
  )
  expect(report).toMatchObject({
    tool: 'screen_scanner_installer',
    code: 'installer_download_integrity_mismatch',
    download: {
      phase: 'verify',
      bytesReceived: 8,
      attemptCount: 1,
      expectedRelease: { size: feedbackRelease.size, sha256: feedbackRelease.sha256 },
    },
  })
  expect(JSON.stringify(report)).not.toMatch(/token|private|https?:/u)
})
it('times out a stalled manifest independently and ignores its late release', async () => {
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
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60 * 1000)
  })
  expect(screen.getByRole('status')).toHaveTextContent('下载超时，请重试下载。')
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => {
    finish(Response.json(freshRelease))
  })
  expect(fetcher).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '下载画面扫描' })).toBeEnabled()
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
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  unmount()
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => {
    finish(Response.json(freshRelease))
  })
  expect(fetcher).toHaveBeenCalledOnce()
  expect(createObjectURL).not.toHaveBeenCalled()
})

registerScannerInstallerActionCases({
  streamedDownload,
  setDownloadFetcher,
  executableFixture,
  createObjectURL,
})
