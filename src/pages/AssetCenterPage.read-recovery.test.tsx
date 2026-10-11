import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetCenterPage } from './AssetCenterPage'
import { loadAssetAccountOptions, loadAssetData } from './assetCenterData'
import { createPublicScannerEmptyRoster } from '../accounts/publicScannerAccountCreation'
import { useAssetCenterData } from './useAssetCenterData'

vi.mock('./assetCenterData', async (original) => ({
  ...(await original<typeof import('./assetCenterData')>()),
  loadAssetData: vi.fn(),
  loadAssetAccountOptions: vi.fn(),
  loadAssetAccountIdentity: async () => 'synthetic-asset-read',
}))
vi.mock('../application/accountDecisionWorld', () => ({
  useOptionalAccountDecisionWorld: () => null,
}))
vi.mock('../accounts/acceptanceAccountRecoveryEntry', () => ({
  isN2AcceptanceRecoveryAvailable: async () => false,
}))
vi.mock('../accounts/repository', async (original) => ({
  ...(await original<typeof import('../accounts/repository')>()),
  setActiveAccount: async () => ({ displayName: '另一合成账户' }),
}))
vi.mock('../components/assets/r6/AssetMaintenanceGolden', () => ({
  AssetMaintenanceGolden: ({
    accountName,
    accountOptions,
    onSelectAccount,
  }: {
    accountName: string
    accountOptions: { id: string; displayName: string }[]
    onSelectAccount: (id: string) => Promise<void>
  }) => {
    const [selection, setSelection] = useState('原选择')
    return (
      <section aria-label="保留资产页面">
        <h1>{accountName}</h1>
        <p>{accountOptions.map((account) => account.displayName).join('、')}</p>
        <button onClick={() => setSelection('已选代理人')}>{selection}</button>
        <button onClick={() => void onSelectAccount('second')}>模拟切换账户</button>
      </section>
    )
  },
}))

function confirmedData() {
  return {
    account: {
      id: 'synthetic-asset-read',
      displayName: '合成资产账户',
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
      isDefault: true,
      status: 'active' as const,
      source: 'manual' as const,
    },
    roster: createPublicScannerEmptyRoster(),
    discs: [],
    planningDrafts: [],
    lastSelectedAgentId: null,
  }
}

function showPage() {
  return render(
    <MemoryRouter initialEntries={['/assets/agents?selected=agent-billy']}>
      <AssetCenterPage />
    </MemoryRouter>,
  )
}

function ReadProbe({ revision }: { revision: number }) {
  const reads = useAssetCenterData(revision)
  return <p>{reads.assets.failed ? '失败' : reads.assets.data?.account?.displayName}</p>
}

describe('asset page local read recovery', () => {
  beforeEach(() => {
    vi.mocked(loadAssetData).mockReset().mockResolvedValue(confirmedData())
    vi.mocked(loadAssetAccountOptions)
      .mockReset()
      .mockResolvedValue([{ id: 'synthetic-asset-read', displayName: '合成列表账户' }])
  })

  it.each(['assets', 'accounts'] as const)(
    'keeps an initial %s failure distinct from an empty account and retries locally',
    async (kind) => {
      const read = kind === 'assets' ? vi.mocked(loadAssetData) : vi.mocked(loadAssetAccountOptions)
      read.mockRejectedValueOnce(new Error('synthetic read failure'))
      showPage()
      expect(await screen.findByRole('alert')).toHaveTextContent(
        kind === 'assets' ? '账户资产读取失败' : '账户列表读取失败',
      )
      expect(screen.queryByRole('region', { name: '保留资产页面' })).toBeNull()
      expect(screen.queryByText('尚未选择账户')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
      expect(await screen.findByRole('heading', { name: '合成资产账户' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(read).toHaveBeenCalledTimes(2)
    },
  )

  it('retains the mounted selection and confirmed account during failure and pending retry', async () => {
    showPage()
    await screen.findByRole('heading', { name: '合成资产账户' })
    fireEvent.click(screen.getByRole('button', { name: '原选择' }))
    const frame = screen.getByRole('region', { name: '保留资产页面' })
    vi.mocked(loadAssetData).mockRejectedValueOnce(new Error('synthetic revalidation failure'))
    fireEvent.click(screen.getByRole('button', { name: '模拟切换账户' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('region', { name: '保留资产页面' })).toBe(frame)
    expect(screen.getByRole('button', { name: '已选代理人' })).toBeInTheDocument()
    expect(frame.parentElement).toHaveAttribute('inert')
    let finish!: (value: ReturnType<typeof confirmedData>) => void
    vi.mocked(loadAssetData).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    await screen.findByRole('status')
    expect(frame.parentElement).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: '已选代理人' })).toBeInTheDocument()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    finish(confirmedData())
    await waitFor(() => expect(frame.parentElement).not.toHaveAttribute('inert'))
    expect(screen.getByRole('region', { name: '保留资产页面' })).toBe(frame)
  })

  it('ignores a late failed read after a newer subscription has confirmed its account', async () => {
    let rejectOld!: (error: Error) => void
    vi.mocked(loadAssetData).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOld = reject
        }),
    )
    const view = render(<ReadProbe revision={0} />)
    await waitFor(() => expect(rejectOld).toBeTypeOf('function'))
    view.rerender(<ReadProbe revision={1} />)
    await screen.findByText('合成资产账户')
    rejectOld(new Error('late synthetic failure'))
    await waitFor(() => expect(screen.getByText('合成资产账户')).toBeInTheDocument())
    expect(screen.queryByText('失败')).toBeNull()
  })
})
