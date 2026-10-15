import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import { ScannerPreparationStatus, type PreparationStatus } from './ScannerPreparationStatus'
import { ScannerInstallerAction } from './ScannerInstallerAction'
import { AssetQuickReadInstallerAction } from './AssetQuickReadInstallerAction'
import { initialDistributionSnapshot } from '../scanner/distribution'
import { installerTransferStatus } from '../scanner/installerTransferStatus'
import type { InstallerTransferProgress } from '../scanner/installerDownload'

const { download, release } = vi.hoisted(() => ({
  download: vi.fn(),
  release: {
    version: '1.1.7',
    fileName: 'SodaTerminal-Scanner-Setup-1.1.7.exe',
    downloadUrl: '/downloads/Soda-Scanner-Setup.exe',
    size: 133_528_903,
    sha256: 'a'.repeat(64),
  },
}))
vi.mock('../scanner/installerDownload', () => ({ downloadScannerInstaller: download }))
vi.mock('../scanner/installerRelease', () => ({ readInstallerRelease: async () => release }))

function Preparation({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PreparationStatus>({ text: '尚未连接', pending: false })
  return (
    <ScannerPreparationStatus.Provider value={setStatus}>
      <div role="status">{status.text}</div>
      {children}
    </ScannerPreparationStatus.Provider>
  )
}
const progress: InstallerTransferProgress = {
  phase: 'downloading',
  bytes: 12_000_000,
  total: 186_844_149,
  bytesPerSecond: 128_000,
  resumedBytes: 8_000_000,
  retryAttempt: 0,
}
beforeEach(() => {
  download.mockReset().mockImplementation(() => new Promise(() => {}))
})

it.each([
  ['画面扫描', () => <ScannerInstallerAction distribution={initialDistributionSnapshot} />],
  ['资产快读', () => <AssetQuickReadInstallerAction />],
])(
  'shows %s speed and retry feedback inside its existing preparation status',
  async (name, view) => {
    render(<Preparation>{view()}</Preparation>)
    fireEvent.click(screen.getByRole('button', { name: `下载${name}` }))
    await act(async () => {})
    const callbacks = download.mock.calls[0][0]
    act(() => {
      callbacks.onProgress(progress.bytes)
      callbacks.onTransfer(progress)
    })
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('12.0 MB / 186.8 MB · 128 KB/s · 已续传')
    expect(screen.getByRole('button', { name: /下载中/ })).toBeDisabled()
    act(() => callbacks.onTransfer({ ...progress, phase: 'retrying', retryAttempt: 2 }))
    expect(screen.getByRole('status')).toHaveTextContent('连接中断，正在续传（2/3）')
    expect(screen.queryByRole('button', { name: '切换线路' })).not.toBeInTheDocument()
  },
)

it('formats connecting, small bytes and unknown numbers without inventing speed', () => {
  expect(
    installerTransferStatus({ ...progress, bytes: 0, bytesPerSecond: 0, resumedBytes: 0 }),
  ).toBe('0 B / 186.8 MB · 连接中')
  expect(
    installerTransferStatus({ ...progress, bytes: 500, bytesPerSecond: 50, resumedBytes: 0 }),
  ).toBe('500 B / 186.8 MB · 50 B/s')
  expect(
    installerTransferStatus({ ...progress, bytes: NaN, bytesPerSecond: 0, resumedBytes: 0 }),
  ).toBe('— / 186.8 MB · 连接中')
  expect(
    installerTransferStatus({ ...progress, phase: 'retrying', bytes: 0, retryAttempt: 1 }),
  ).toBe('连接中断，正在重试（1/3）')
})
