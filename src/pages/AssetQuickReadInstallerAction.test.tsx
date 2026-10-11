import { Blob as NodeBlob } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AssetQuickReadInstallerAction } from './AssetQuickReadInstallerAction'
import { assetQuickReadRelease } from '../assetQuickRead/distribution'
import { AssetQuickReadEntry } from './AssetQuickReadEntry'
const executable = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const release = {
  ...assetQuickReadRelease,
  available: true,
  size: 8,
  sha256: createHash('sha256').update(executable).digest('hex'),
}
const save = vi.fn().mockReturnValue('blob:synthetic-installer')
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
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable)))
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
  expect(screen.queryByRole('heading', { name: '准备游戏' })).not.toBeInTheDocument()
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
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(new Response(executable))),
  )
  const props = {
    onConnect: vi.fn().mockRejectedValue(new Error('synthetic connection failed')),
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
  fireEvent.click(screen.getByRole('button', { name: '连接资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('资产快读连接未完成'))
  expect(screen.queryByText(/文件已准备/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('status')).toHaveLength(1)
})
it('uses the connected version for upgrade prompts instead of connection alone', () => {
  const candidate = {
    ...release,
    version: '1.0.1',
    bridgeVersion: '1.0.1',
    fileName: 'SodaTerminal-AssetReader-Setup-1.0.1.exe',
    releaseTag: 'v1.0.1',
  }
  const view = render(
    <AssetQuickReadInstallerAction release={candidate} connected toolVersion="1.0.0" />,
  )
  expect(screen.getByRole('button', { name: '更新资产快读' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('资产快读有新版本')
  view.rerender(<AssetQuickReadInstallerAction release={candidate} connected toolVersion="1.0.1" />)
  expect(screen.queryByText('资产快读有新版本，请更新资产快读。')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '更新资产快读' })).not.toBeInTheDocument()
  view.rerender(<AssetQuickReadInstallerAction release={candidate} connected />)
  expect(screen.queryByRole('button', { name: '更新资产快读' })).not.toBeInTheDocument()
})
it('does not pretend a missing release is downloadable', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
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
  vi.stubGlobal('fetch', fetcher)
  render(<AssetQuickReadInstallerAction release={release} />)
  expect(screen.getByRole('button', { name: '下载资产快读' })).toHaveAttribute(
    'title',
    `资产快读安装包 v${release.version}`,
  )
  expect(screen.getByText(`v${release.version}`)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await act(async () => stream.enqueue(executable.subarray(0, 4)))
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4'))
  expect(save).not.toHaveBeenCalled()
  const cancelButton = screen.getByRole('button', { name: '取消资产快读下载' })
  cancelButton.focus()
  fireEvent.click(cancelButton)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
  expect(cancel).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '下载资产快读' })).toHaveFocus()
  fetcher.mockResolvedValue(new Response(executable))
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  expect(screen.getByRole('status')).toHaveTextContent('打开安装包')
  expect(screen.queryByText('安装完成')).not.toBeInTheDocument()
  expect(save).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(
    (vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0] as HTMLAnchorElement).download,
  ).toBe(release.fileName)
})
it('rejects truncated bytes and exposes retry without preparing a wrong file', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable.subarray(0, 6))))
  render(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '下载资产快读' })).toBeEnabled()
})
it('returning after an installer download probes once, never invokes the explicit launch callback automatically', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(executable)))
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
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
  const view = render(<AssetQuickReadInstallerAction release={release} blocked />)
  expect(screen.getByRole('button', { name: '下载资产快读' })).toBeDisabled()
  view.rerender(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载资产快读' }))
  view.rerender(<AssetQuickReadInstallerAction release={release} blocked />)
  expect(screen.getByRole('button', { name: '取消资产快读下载' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '取消资产快读下载' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
})
