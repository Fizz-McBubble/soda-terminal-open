import { Blob as NodeBlob } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AssetQuickReadInstallerAction } from './AssetQuickReadInstallerAction'
import { assetQuickReadRelease } from '../assetQuickRead/distribution'
import { assetQuickReadInstallerReleaseUrl } from '../assetQuickRead/installerDownload'
import {
  consumeInstallerFeedbackFragment,
  sanitizeInstallerFeedback,
} from '../assetQuickRead/installerFeedback'
import { sanitizeScanFeedbackPayload } from '../../deploy/cloudflare/scan-feedback.mjs'
import { InstallerFeedbackPage } from './InstallerFeedbackPage'
import { AssetQuickReadEntry } from './AssetQuickReadEntry'
const executable = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const release = {
  ...assetQuickReadRelease,
  available: true,
  size: 8,
  sha256: createHash('sha256').update(executable).digest('hex'),
}
const save = vi.fn().mockReturnValue('blob:synthetic-installer')
function setDownloadFetcher(fetcher: typeof fetch) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL, init?: RequestInit) =>
      url === assetQuickReadInstallerReleaseUrl
        ? Promise.resolve(Response.json(release))
        : fetcher(url, init),
    ),
  )
}
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = save
      static revokeObjectURL = vi.fn()
    },
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  save.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('replaces the disconnected status with download feedback and removes installation copy once connected', async () => {
  setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executable)))
  const props = {
    onConnect: vi.fn(),
    onStart: vi.fn(),
    downloadAvailable: true,
    renderParts: ({
      preparation,
      task,
    }: {
      preparation: React.ReactNode
      task: React.ReactNode
    }) => (
      <>
        {preparation}
        {task}
      </>
    ),
  }
  const view = render(
    <AssetQuickReadEntry
      {...props}
      errorMessage="旧连接错误"
      installer={<AssetQuickReadInstallerAction release={release} />}
    />,
  )
  expect(screen.getByRole('heading', { name: '准备游戏' })).toBeVisible()
  expect(screen.getAllByRole('status')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.queryByText('旧连接错误')).not.toBeInTheDocument()
  expect(screen.queryByText(/首次使用先/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('游戏安装目录')).toBeVisible()
  view.rerender(
    <AssetQuickReadEntry
      {...props}
      capability="ready"
      installer={
        <AssetQuickReadInstallerAction
          release={release}
          connected
          toolVersion={release.bridgeVersion}
        />
      }
    />,
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('资产快读已连接'))
  expect(screen.queryByText(/文件已准备/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '重新下载' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '准备游戏' })).toBeVisible()
})
it('replaces prepared-download feedback with a new failure and lets a later download become current', async () => {
  setDownloadFetcher(vi.fn().mockImplementation(() => Promise.resolve(new Response(executable))))
  const props = {
    onConnect: vi.fn(),
    onStart: vi.fn(),
    downloadAvailable: true,
    installer: <AssetQuickReadInstallerAction release={release} />,
    renderParts: ({
      preparation,
      task,
    }: {
      preparation: React.ReactNode
      task: React.ReactNode
    }) => (
      <>
        {preparation}
        {task}
      </>
    ),
  }
  const view = render(<AssetQuickReadEntry {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  view.rerender(<AssetQuickReadEntry {...props} errorMessage="本次实际读取失败" />)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('本次实际读取失败'))
  expect(screen.queryByText(/文件已准备/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新下载' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  expect(screen.queryByText('本次实际读取失败')).not.toBeInTheDocument()
  props.onConnect.mockImplementationOnce(async () => {
    // The real Controller clears its previous error before probing. A retained
    // read failure is not an error supplied by this new connection request.
    view.rerender(<AssetQuickReadEntry {...props} />)
    throw new Error('synthetic connection failed')
  })
  fireEvent.click(screen.getByRole('button', { name: '连接资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('未能连接资产快读'))
  expect(screen.getByRole('status')).toHaveTextContent('请确认工具已运行')
  expect(screen.queryByText('本次实际读取失败')).not.toBeInTheDocument()
  expect(screen.queryByText('synthetic connection failed')).not.toBeInTheDocument()
  expect(screen.queryByText(/文件已准备/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('status')).toHaveLength(1)
})
it('uses the connected bridge version independently of the installer version', () => {
  const candidate = {
    ...release,
    version: '1.0.7',
    bridgeVersion: '1.0.3',
    fileName: 'SodaTerminal-AssetReader-Setup-1.0.7.exe',
    releaseTag: 'v1.0.7',
  }
  const view = render(
    <AssetQuickReadInstallerAction release={candidate} connected toolVersion="1.0.2" />,
  )
  expect(screen.getByRole('button', { name: '更新资产快读' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('资产快读有新版本')
  view.rerender(<AssetQuickReadInstallerAction release={candidate} connected toolVersion="1.0.3" />)
  expect(screen.queryByText('资产快读有新版本，请更新资产快读。')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '更新资产快读' })).not.toBeInTheDocument()
  view.rerender(<AssetQuickReadInstallerAction release={candidate} connected />)
  expect(screen.queryByRole('button', { name: '更新资产快读' })).not.toBeInTheDocument()
})
it('shows the connected old Bridge upgrade in the compact preparation status', async () => {
  render(
    <AssetQuickReadEntry
      capability="ready"
      onConnect={vi.fn()}
      onStart={vi.fn()}
      installer={<AssetQuickReadInstallerAction release={release} connected toolVersion="1.0.3" />}
      renderParts={({ preparation, task }) => (
        <>
          {preparation}
          {task}
        </>
      )}
    />,
  )
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('资产快读有新版本，请更新资产快读。'),
  )
  expect(screen.getByRole('button', { name: '更新资产快读' })).toBeEnabled()
  expect(screen.getAllByRole('status')).toHaveLength(1)
})
it('does not pretend a missing release is downloadable', () => {
  const fetcher = vi.fn()
  setDownloadFetcher(fetcher)
  render(<AssetQuickReadInstallerAction release={{ ...release, size: null }} />)
  expect(screen.getByRole('button', { name: '下载资产快读' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '下载资产快读' })).toHaveAttribute(
    'title',
    expect.stringContaining('尚未发布'),
  )
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  expect(fetcher).not.toHaveBeenCalled()
})
it('streams exact installer bytes, supports cancel/retry and prepares a file without claiming installation', async () => {
  let stream!: ReadableStreamDefaultController<Uint8Array>
  const cancel = vi.fn()
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller
        },
        cancel,
      }),
    ),
  )
  setDownloadFetcher(fetcher)
  const user = userEvent.setup()
  render(<AssetQuickReadInstallerAction release={release} />)
  const downloadButton = screen.getByRole('button', { name: '下载资产快读' })
  expect(downloadButton).toHaveAttribute('title', `资产快读安装包 v${release.version}`)
  expect(screen.getByText(`v${release.version}`)).toBeInTheDocument()
  await user.tab()
  expect(downloadButton).toHaveFocus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  await act(async () => stream.enqueue(executable.subarray(0, 4)))
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4'))
  expect(save).not.toHaveBeenCalled()
  const cancelButton = screen.getByRole('button', { name: '取消资产快读下载' })
  await user.tab()
  expect(cancelButton).toHaveFocus()
  await user.keyboard('{Enter}')
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('下载已取消')
    expect(downloadButton).toHaveFocus()
  })
  expect(cancel).toHaveBeenCalled()
  fetcher.mockResolvedValue(new Response(executable))
  await user.keyboard('{Enter}')
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  expect(screen.getByRole('status')).toHaveTextContent('打开安装包')
  expect(screen.queryByText('安装完成')).not.toBeInTheDocument()
  expect(save).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe(release.fileName)
})
it('resolves the current manifest before downloading so an old tab cannot bind stale bytes', async () => {
  const stale = {
    ...release,
    version: '1.0.0',
    bridgeVersion: '1.0.0',
    fileName: 'Soda-Asset-Quick-Read-Setup-1.0.0.exe',
    releaseTag: 'v1.0.0',
  }
  const fetcher = vi.fn().mockResolvedValue(new Response(executable))
  setDownloadFetcher(fetcher)
  render(<AssetQuickReadInstallerAction release={stale} />)
  expect(screen.getByText('v1.0.0')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(screen.getByText(`v${release.version}`)).toBeInTheDocument()
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe(release.fileName)
})

it('refreshes one changed manifest identity and discards stale package bytes', async () => {
  const nextExecutable = new Uint8Array([0x4d, 0x5a, 7, 7, 7, 7, 7, 7])
  const nextRelease = {
    ...release,
    sha256: createHash('sha256').update(nextExecutable).digest('hex'),
  }
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(release))
    .mockResolvedValueOnce(
      new Response(executable, {
        status: 206,
        headers: {
          'content-range': 'bytes 0-7/8',
          'content-length': '8',
          etag: `"${'b'.repeat(64)}"`,
        },
      }),
    )
    .mockResolvedValueOnce(Response.json(nextRelease))
    .mockResolvedValueOnce(new Response(nextExecutable))
  vi.stubGlobal('fetch', fetcher)
  render(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  expect(fetcher).toHaveBeenCalledTimes(4)
  expect(save).toHaveBeenCalledOnce()
  expect(save.mock.calls[0][0].size).toBe(nextExecutable.byteLength)
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe(nextRelease.fileName)
})

it('carries a refreshed 1.2.1 download 404 through fragment, explicit feedback and receipt refresh', async () => {
  localStorage.clear()
  const currentRelease = {
    ...release,
    version: '1.2.1',
    releaseTag: 'v1.2.1',
    fileName: 'SodaTerminal-AssetReader-Setup-1.2.1.exe',
  }
  const posts: unknown[] = []
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (url === assetQuickReadInstallerReleaseUrl) return Response.json(currentRelease)
    if (url === '/_soda/scan-feedback') {
      const report = JSON.parse(init?.body as string)
      expect(sanitizeScanFeedbackPayload(report)).toMatchObject({ ok: true, record: report })
      expect(init).toMatchObject({ method: 'POST', credentials: 'omit' })
      posts.push(report)
      return Response.json({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-23T08:45:00.000Z',
      })
    }
    expect(url).toBe(currentRelease.downloadUrl)
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  const action = render(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  const link = await screen.findByRole('link', { name: '报告下载问题' })
  expect(posts).toHaveLength(0)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(save).not.toHaveBeenCalled()
  const hash = new URL((link as HTMLAnchorElement).href).hash
  const replaceState = vi.fn()
  const report = consumeInstallerFeedbackFragment(
    { hash, pathname: '/installer-feedback' },
    { replaceState },
  )
  expect(replaceState).toHaveBeenCalledWith(null, '', '/installer-feedback')
  expect(report).toMatchObject({
    tool: 'asset_quick_read_installer',
    installerVersion: '1.2.1',
    stage: 'prepare',
    code: 'installer_download_request_failed',
    attempts: [],
    download: {
      phase: 'range',
      httpStatus: 404,
      expectedRelease: { size: currentRelease.size, sha256: currentRelease.sha256 },
    },
  })
  expect(sanitizeScanFeedbackPayload(report)).toMatchObject({ ok: true, record: report })
  action.unmount()
  const feedbackPage = render(<InstallerFeedbackPage initialReport={report} />)
  expect(screen.getByRole('button', { name: '发送反馈' })).toBeEnabled()
  expect(posts).toHaveLength(0)
  expect(fetcher).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: '发送反馈' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '已发送' })).toBeDisabled())
  expect(posts).toEqual([report])
  feedbackPage.unmount()
  render(<InstallerFeedbackPage initialReport={null} />)
  expect(screen.getByRole('button', { name: '已发送' })).toBeDisabled()
  expect(screen.getByText(`回执编号：${report!.reportId}`)).toBeVisible()
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(posts).toHaveLength(1)
  localStorage.clear()
})

it('offers explicit download feedback with bounded identity and no automatic upload', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(executable.subarray(0, 6), {
      status: 200,
    }),
  )
  setDownloadFetcher(fetcher)
  render(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  const link = screen.getByRole('link', { name: '报告下载问题' })
  const report = sanitizeInstallerFeedback(
    JSON.parse(decodeURIComponent(new URL((link as HTMLAnchorElement).href).hash.slice(1))),
  )
  expect(report).toMatchObject({
    tool: 'asset_quick_read_installer',
    code: 'installer_download_incomplete',
    download: {
      phase: 'range',
      bytesReceived: 6,
      attemptCount: 1,
      waitReason: 'none',
      expectedRelease: { size: release.size, sha256: release.sha256 },
    },
  })
  expect(JSON.stringify(report)).not.toMatch(/token|private|https?:/u)
  expect(fetcher).toHaveBeenCalledOnce()
})
it('rejects truncated bytes and exposes retry without preparing a wrong file', async () => {
  setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executable.subarray(0, 6))))
  render(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '下载资产快读' })).toBeEnabled()
})
it('returning after an installer download probes once, never invokes the explicit launch callback automatically', async () => {
  setDownloadFetcher(vi.fn().mockResolvedValue(new Response(executable)))
  const onConnect = vi.fn().mockResolvedValue(undefined)
  const onReturnConnect = vi.fn().mockRejectedValue(new Error('synthetic service missing'))
  render(
    <AssetQuickReadInstallerAction
      release={release}
      onConnect={onConnect}
      onReturnConnect={onReturnConnect}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  fireEvent(window, new Event('focus'))
  expect(onReturnConnect).not.toHaveBeenCalled()
  fireEvent(window, new Event('blur'))
  await act(async () => fireEvent(window, new Event('focus')))
  expect(onReturnConnect).toHaveBeenCalledOnce()
  fireEvent(window, new Event('focus'))
  expect(onReturnConnect).toHaveBeenCalledOnce()
  expect(onConnect).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '安装完成，继续连接' })).not.toBeInTheDocument()
  expect(onConnect).not.toHaveBeenCalled()
})
it('blocks new download and continuation while keeping an in-flight cancel accessible', async () => {
  setDownloadFetcher(vi.fn().mockReturnValue(new Promise(() => {})))
  const view = render(<AssetQuickReadInstallerAction release={release} blocked />)
  expect(screen.getByRole('button', { name: '下载资产快读' })).toBeDisabled()
  view.rerender(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  view.rerender(<AssetQuickReadInstallerAction release={release} blocked />)
  expect(screen.getByRole('button', { name: '取消资产快读下载' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '取消资产快读下载' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
})
