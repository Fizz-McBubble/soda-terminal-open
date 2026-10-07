import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ScannerInstallerAction } from './ScannerInstallerAction'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker
})
it('offers an upgrade only for a detected old installation', () => {
  const { rerender } = render(
    <ScannerInstallerAction
      distribution={{
        ...initialDistributionSnapshot,
        state: 'ready',
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc8-1',
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
})
it('asks where to save in the click task, then writes the actual downloaded file', async () => {
  const write = vi.fn(),
    close = vi.fn()
  const fetcher = vi.fn().mockResolvedValue(new Response('@echo off\r\necho ready\r\n'))
  const picker = vi.fn(() => {
    expect(fetcher).not.toHaveBeenCalled()
    return Promise.resolve({ createWritable: async () => ({ write, close }) })
  })
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker })
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  fireEvent.click(screen.getByRole('button', { name: '正在下载…' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(picker).toHaveBeenCalledOnce()
  expect(picker).toHaveBeenCalledWith({
    suggestedName: scannerDistributionManifest.helper.entry,
    startIn: 'downloads',
  })
  expect(write).toHaveBeenCalledWith('@echo off\r\necho ready\r\n')
})
it('does not start another download when the save dialog is cancelled', async () => {
  const picker = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: picker })
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '下载扫描助手' })).toBeEnabled())
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('leaves the destination untouched when the download is invalid and offers retry', async () => {
  const writable = vi.fn()
  Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true,
    value: vi.fn().mockResolvedValue({ createWritable: writable }),
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>offline</html>')))
  render(<ScannerInstallerAction distribution={initialDistributionSnapshot} />)
  fireEvent.click(screen.getByRole('button', { name: '下载扫描助手' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('下载未完成'))
  expect(writable).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '下载扫描助手' })).toBeEnabled()
})
it('uses the ordinary browser download when the save dialog is unavailable', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(
    <ScannerInstallerAction
      distribution={initialDistributionSnapshot}
      issueCode="helper_pairing_denied"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '更新扫描助手' }))
  await waitFor(() => expect(click).toHaveBeenCalledOnce())
})
