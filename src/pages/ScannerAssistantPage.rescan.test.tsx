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
import { readScannerTargetAccountBinding } from '../scanner/targetAccountBinding'

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

  it('ignores the same attempt replay but presents a new external scan and its completion', async () => {
    const account = await createAccount('外部重扫账户', database, { id: 'account-external-rescan' })
    await setActiveAccount(account.id, database)
    const oldId = '00000000-0000-4000-8000-000000000001'
    const newId = '00000000-0000-4000-8000-000000000002'
    const oldCompleted = {
      ...createScannerRuntimeSnapshot('completed'),
      diagnostics: { reportId: oldId },
    }
    runtime.snapshot = oldCompleted
    localStorage.setItem(
      'soda.scanner.completedImport',
      JSON.stringify({
        accountId: account.id,
        count: 1,
        attemptReportId: oldId,
        resultFileHandle: 'local-staging.json',
      }),
    )
    const rendered = render(page())
    await userEvent.setup().click(await screen.findByRole('button', { name: '重新扫描' }))
    runtime.snapshot = { ...oldCompleted }
    rendered.rerender(page())
    expect(screen.getByRole('heading', { name: '画面扫描已连接' })).toBeInTheDocument()
    runtime.snapshot = {
      ...createScannerRuntimeSnapshot('scanning'),
      diagnostics: { reportId: newId },
    }
    rendered.rerender(page())
    expect(await screen.findByRole('heading', { name: '正在读取游戏中的资产' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '上次导入已完成' })).not.toBeInTheDocument()
    runtime.snapshot = {
      ...createScannerRuntimeSnapshot('completed'),
      diagnostics: { reportId: newId },
      summary: { ...oldCompleted.summary!, resultFileHandle: 'new-staging.json' },
    }
    rendered.rerender(page())
    expect(
      await screen.findByRole('heading', { name: '结果已生成，先检查再导入' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认账户并继续' })).toBeEnabled()
    expect(runtime.commands.startScan).not.toHaveBeenCalled()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('uses a new result handle to leave preparation when an older helper has no attempt facts', async () => {
    const account = await createAccount('结果标识恢复账户', database, {
      id: 'account-result-handle-rescan',
    })
    await setActiveAccount(account.id, database)
    runtime.snapshot = createScannerRuntimeSnapshot('completed')
    const rendered = render(page())
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: '放弃此结果并重新扫描' }))
    const next = createScannerRuntimeSnapshot('completed')
    runtime.snapshot = {
      ...next,
      summary: { ...next.summary!, resultFileHandle: 'another-staging.json' },
    }
    rendered.rerender(page())
    expect(
      await screen.findByRole('heading', { name: '结果已生成，先检查再导入' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '画面扫描已连接' })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('does not let a saved import for an old result hide a new completed result after refresh', async () => {
    const account = await createAccount('刷新恢复账户', database, {
      id: 'account-completed-identity',
    })
    await setActiveAccount(account.id, database)
    localStorage.setItem(
      'soda.scanner.completedImport',
      JSON.stringify({ accountId: account.id, count: 1, resultFileHandle: 'old-staging.json' }),
    )
    runtime.snapshot = createScannerRuntimeSnapshot('completed')
    render(page())
    expect(
      await screen.findByRole('heading', { name: '结果已生成，先检查再导入' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '上次导入已完成' })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('does not reuse a failed local start binding for a later external attempt', async () => {
    const account = await createAccount('启动失败恢复账户', database, {
      id: 'account-failed-start',
    })
    await setActiveAccount(account.id, database)
    runtime.snapshot = {
      ...createScannerRuntimeSnapshot('ready'),
      diagnostics: { reportId: '00000000-0000-4000-8000-000000000003' },
    }
    runtime.commands.startScan.mockRejectedValueOnce(new Error('扫描启动失败，请重试。'))
    const rendered = render(page())
    await userEvent.setup().click(await screen.findByRole('button', { name: '开始扫描' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('扫描启动失败')
    expect(readScannerTargetAccountBinding()).toMatchObject({ valid: true })
    runtime.snapshot = {
      ...createScannerRuntimeSnapshot('scanning'),
      diagnostics: { reportId: '00000000-0000-4000-8000-000000000004' },
    }
    rendered.rerender(page())
    expect(await screen.findByRole('heading', { name: '正在读取游戏中的资产' })).toBeInTheDocument()
    expect(readScannerTargetAccountBinding()).toMatchObject({ valid: false })
    expect(await database.accountDriveDiscs.count()).toBe(0)
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
      expect(await screen.findByRole('heading', { name: '画面扫描已连接' })).toBeInTheDocument()

      // Reconnection can return the previous result after the user has restarted.
      runtime.snapshot = createScannerRuntimeSnapshot('completed')
      rendered.rerender(page())
      expect(screen.queryByRole('heading', { name: '上次导入已完成' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: '画面扫描已连接' })).toBeInTheDocument()
      expect(runtime.commands.startScan).not.toHaveBeenCalled()
      expect(await database.accountDriveDiscs.toArray()).toEqual(before)

      await user.click(screen.getByRole('button', { name: '开始扫描' }))
      await waitFor(() => expect(runtime.commands.startScan).toHaveBeenCalledTimes(1))
      runtime.snapshot = createScannerRuntimeSnapshot('checking')
      rendered.rerender(page())
      expect(
        screen.getByRole('heading', { name: '画面扫描正在检查游戏与权限' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: '上次导入已完成' })).not.toBeInTheDocument()
      expect(await database.accountDriveDiscs.toArray()).toEqual(before)
    },
  )
})
