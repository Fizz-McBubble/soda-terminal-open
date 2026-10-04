import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { database } from '../db/databaseCore'
import { warehouseTestDisc } from '../warehouse/discWarehouseAnalysis.testFixtures'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'
import { ScannerAssistantPage } from './ScannerAssistantPage'

const runtime = vi.hoisted(() => ({
  snapshot: {} as Record<string, unknown>,
  commands: { retryConnection: vi.fn(), startScan: vi.fn(), safeStop: vi.fn() },
}))
vi.mock('../scanner/runtime', () => ({ useScannerAssistantRuntime: () => runtime }))
const page = () => (
  <MemoryRouter>
    <ScannerAssistantPage />
  </MemoryRouter>
)

describe('preparing another scan', () => {
  beforeEach(async () => {
    database.close()
    await Dexie.delete(database.name)
    await database.open()
    localStorage.clear()
    vi.clearAllMocks()
    runtime.snapshot = createScannerRuntimeSnapshot('unchecked')
  })
  afterEach(async () => {
    database.close()
    await Dexie.delete(database.name)
  })

  it.each(['unchecked', 'completed'])(
    'ignores the old completed replay after restarting from %s',
    async (initialState) => {
      const user = userEvent.setup()
      const account = await createAccount('重扫账户', database, { id: 'account-rescan-replay' })
      await setActiveAccount(account.id, database)
      await database.accountDriveDiscs.add({
        ...warehouseTestDisc('kept-disc'),
        accountId: account.id,
        scopedId: `${account.id}:kept-disc`,
        sourceLegacyId: null,
        migratedAt: null,
      })
      const before = await database.accountDriveDiscs.toArray()
      window.localStorage.setItem(
        'soda.scanner.completedImport',
        JSON.stringify({ accountId: account.id, count: 1 }),
      )
      runtime.snapshot = createScannerRuntimeSnapshot(initialState)
      const rendered = render(page())
      await user.click(await screen.findByRole('button', { name: '重新扫描' }))
      expect(
        await screen.findByRole('heading', { name: '确认账户，然后开始本地扫描' }),
      ).toBeInTheDocument()

      // Reconnection can return the previous result after the user has restarted.
      runtime.snapshot = createScannerRuntimeSnapshot('completed')
      rendered.rerender(page())
      expect(screen.queryByRole('heading', { name: '上次导入已完成' })).not.toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: '确认账户，然后开始本地扫描' }),
      ).toBeInTheDocument()
      expect(runtime.commands.startScan).not.toHaveBeenCalled()
      expect(await database.accountDriveDiscs.toArray()).toEqual(before)

      await user.click(screen.getByRole('button', { name: '切换游戏并开始扫描' }))
      await waitFor(() => expect(runtime.commands.startScan).toHaveBeenCalledTimes(1))
      runtime.snapshot = createScannerRuntimeSnapshot('checking')
      rendered.rerender(page())
      expect(
        screen.getByRole('heading', { name: '本机助手正在检查游戏与权限' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: '上次导入已完成' })).not.toBeInTheDocument()
      expect(await database.accountDriveDiscs.toArray()).toEqual(before)
    },
  )
})
