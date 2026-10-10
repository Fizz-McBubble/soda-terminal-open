import { Blob as NodeBlob } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AssetQuickReadInstallerAction } from './AssetQuickReadInstallerAction'
import { assetQuickReadRelease } from '../assetQuickRead/distribution'
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
it('does not pretend a missing release is downloadable', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<AssetQuickReadInstallerAction release={{ ...release, size: null }} />)
  expect(screen.getByRole('button', { name: '下载独立工具' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '下载独立工具' })).toHaveAttribute(
    'title',
    expect.stringContaining('尚未发布'),
  )
  fireEvent.click(screen.getByRole('button', { name: '下载独立工具' }))
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
  fireEvent.click(screen.getByRole('button', { name: '下载独立工具' }))
  await act(async () => stream.enqueue(executable.subarray(0, 4)))
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4'))
  expect(save).not.toHaveBeenCalled()
  const cancelButton = screen.getByRole('button', { name: '取消独立工具下载' })
  cancelButton.focus()
  fireEvent.click(cancelButton)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
  expect(cancel).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '下载独立工具' })).toHaveFocus()
  fetcher.mockResolvedValue(new Response(executable))
  fireEvent.click(screen.getByRole('button', { name: '下载独立工具' }))
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
  fireEvent.click(screen.getByRole('button', { name: '下载独立工具' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '下载独立工具' })).toBeEnabled()
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
  fireEvent.click(screen.getByRole('button', { name: '下载独立工具' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('文件已准备'))
  fireEvent(window, new Event('focus'))
  expect(onReturnConnect).not.toHaveBeenCalled()
  fireEvent(window, new Event('blur'))
  await act(async () => fireEvent(window, new Event('focus')))
  expect(onReturnConnect).toHaveBeenCalledOnce()
  fireEvent(window, new Event('focus'))
  expect(onReturnConnect).toHaveBeenCalledOnce()
  expect(onConnect).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '安装完成，继续连接' })))
  expect(onConnect).toHaveBeenCalledOnce()
})
it('blocks new download and continuation while keeping an in-flight cancel accessible', async () => {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
  const view = render(<AssetQuickReadInstallerAction release={release} blocked />)
  expect(screen.getByRole('button', { name: '下载独立工具' })).toBeDisabled()
  view.rerender(<AssetQuickReadInstallerAction release={release} />)
  fireEvent.click(screen.getByRole('button', { name: '下载独立工具' }))
  view.rerender(<AssetQuickReadInstallerAction release={release} blocked />)
  expect(screen.getByRole('button', { name: '取消独立工具下载' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '取消独立工具下载' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载已取消'))
})
