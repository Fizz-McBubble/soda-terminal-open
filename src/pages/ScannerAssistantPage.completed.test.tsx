import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { database, stageAccountPaddleScanImport } from '../db/database'
import {
  createScannerTargetAccountBinding,
  readScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'
import {
  cleanupScannerPageTestDatabase,
  createReadyScannerStaging,
  createScannerRuntimeCommands,
  resetScannerPageTestDatabase,
} from './scannerAssistantPageTestSupport'

const runtimeState = vi.hoisted(() => ({
  snapshot: {} as Record<string, unknown>,
}))

const runtimeMock = {
  get snapshot() {
    return runtimeState.snapshot
  },
  set snapshot(value: Record<string, unknown>) {
    runtimeState.snapshot = value
  },
  commands: createScannerRuntimeCommands(vi.fn),
}

vi.mock('../scanner/runtime', () => ({
  useScannerAssistantRuntime: () => runtimeMock,
}))

describe('ScannerAssistantPage completed-result handoff', () => {
  beforeEach(async () => {
    runtimeMock.snapshot = createScannerRuntimeSnapshot('unchecked')
    vi.clearAllMocks()
    runtimeMock.commands = createScannerRuntimeCommands(vi.fn)
    await resetScannerPageTestDatabase()
    window.history.pushState({}, '', '/system/scanner')
  })

  afterEach(async () => {
    await cleanupScannerPageTestDatabase()
  })

  it('shows successful import when the optional completion cache refuses the write', async () => {
    const user = userEvent.setup()
    const account = await createAccount('缓存受限账户', database, { id: 'account-storage-refused' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    runtimeMock.snapshot = createScannerRuntimeSnapshot('completed')
    runtimeMock.commands.requestResultStaging.mockResolvedValueOnce(createReadyScannerStaging())
    render(<App />)
    await user.click(
      await screen.findByRole('button', { name: '检查需确认的记录' }, { timeout: 10_000 }),
    )
    const confirm = await screen.findByRole('button', { name: '导入' })
    await waitFor(() => expect(confirm).toBeEnabled())
    const original = Storage.prototype.setItem
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === 'soda.scanner.completedImport')
        throw new DOMException('Full', 'QuotaExceededError')
      original.call(this, key, value)
    })
    try {
      await user.click(confirm)
      expect(await screen.findByRole('heading', { name: '导入完成' })).toBeInTheDocument()
      expect(await database.accountDriveDiscs.count()).toBe(1)
      expect(screen.queryByText(/更新失败/)).not.toBeInTheDocument()
      expect(localStorage.getItem('soda.scanner.completedImport')).toBeNull()
    } finally {
      write.mockRestore()
    }
  })

  it('deduplicates account binding and ignores a late binding after returning to preparation', async () => {
    const account = await createAccount('迟到绑定账户', database, { id: 'account-late-binding' })
    await setActiveAccount(account.id, database)
    runtimeMock.snapshot = createScannerRuntimeSnapshot('completed')
    render(<App />)
    const confirm = await screen.findByRole('button', { name: '确认账户并继续' })
    let finish!: (value: typeof account) => void
    const accountRead = vi.spyOn(database.accounts, 'get').mockImplementationOnce(
      () =>
        new Dexie.Promise<typeof account>((resolve) => {
          finish = (value) => resolve(value)
        }),
    )
    try {
      fireEvent.click(confirm)
      fireEvent.click(confirm)
      expect(accountRead).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: '放弃' }))
      expect(await screen.findByRole('heading', { name: '画面扫描已连接' })).toBeInTheDocument()
      await act(async () => finish(account))
      expect(runtimeMock.commands.requestResultFile).not.toHaveBeenCalled()
      expect(readScannerTargetAccountBinding()).toMatchObject({ valid: false })
      expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument()
      expect(await database.accountDriveDiscs.count()).toBe(0)
      expect(await database.accountScanImportBatches.count()).toBe(0)
    } finally {
      accountRead.mockRestore()
    }
  })

  it('keeps an old import receipt out of the workspace before the helper connects', async () => {
    const account = await createAccount('已导入账户', database, { id: 'account-import-reconnect' })
    await setActiveAccount(account.id, database)
    window.localStorage.setItem(
      'soda.scanner.completedImport',
      JSON.stringify({ accountId: account.id, count: 492 }),
    )
    runtimeMock.snapshot = createScannerRuntimeSnapshot('unchecked')
    render(<App />)
    await screen.findByRole('region', { name: '本次操作目标账户' })
    expect(screen.queryByRole('region', { name: '已导入扫描结果' })).not.toBeInTheDocument()
    expect(screen.queryByText('下载本机扫描器')).not.toBeInTheDocument()
    expect(screen.queryByText('辅助信息与备用导入')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '查看队伍建议' })).not.toBeInTheDocument()
    const before = await database.accountDriveDiscs.toArray()
    expect(await screen.findByRole('heading', { name: '画面扫描已连接' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeEnabled()
    expect(screen.queryByText(/上一次结果仍保留在本机/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '导入完成' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeInTheDocument()
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    expect(await database.accountDriveDiscs.toArray()).toEqual(before)
  })

  it('continues an already selected fallback file in the same page without rescanning or importing', async () => {
    const user = userEvent.setup()
    const account = await createAccount('备用文件账户', database, { id: 'account-file-review' })
    await setActiveAccount(account.id, database)
    runtimeMock.snapshot = createScannerRuntimeSnapshot('connection_failed')
    render(<App />)
    await screen.findByLabelText('选择本机文件（JSON）', {}, { timeout: 10_000 })
    expect(screen.queryByRole('navigation', { name: '导入后的下一步' })).not.toBeInTheDocument()
    const text = JSON.stringify(createReadyScannerStaging(2))
    const file = new File([text], 'result.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => text })
    await user.upload(screen.getByLabelText('选择本机文件（JSON）'), file)
    expect(await screen.findByRole('button', { name: '导入' })).toBeEnabled()
    expect(window.location.pathname).toBe('/system/scanner')
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
    expect(runtimeMock.commands.requestResultFile).not.toHaveBeenCalled()
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    expect(await database.accountDriveDiscs.count()).toBe(0)
    await user.click(screen.getByRole('button', { name: '放弃' }))
    // Restore the original preparation and its retry action without claiming the failed checks passed.
    expect(await screen.findByRole('heading', { name: '本次扫描未完成' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新扫描' })).toBeInTheDocument()
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeEnabled()
    expect(screen.queryByRole('region', { name: '扫描结果文件检查' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  }, 20_000)

  it('shows a newly selected invalid file instead of replaying an older import receipt', async () => {
    const user = userEvent.setup()
    const account = await createAccount('旧回执账户', database, {
      id: 'account-file-after-receipt',
    })
    await setActiveAccount(account.id, database)
    localStorage.setItem(
      'soda.scanner.completedImport',
      JSON.stringify({ accountId: account.id, count: 2 }),
    )
    render(<App />)
    await screen.findByRole('region', { name: '本次操作目标账户' })
    const file = new File(['{'], 'broken.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{' })
    await user.upload(screen.getByLabelText('选择本机文件（JSON）'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent('无法读取这份文件')
    expect(screen.queryByRole('heading', { name: '导入完成' })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
  })

  it('keeps the previous completed review hidden until a restarted scan advances', async () => {
    const user = userEvent.setup()
    const account = await createAccount('重扫账户', database, { id: 'account-rescan-transition' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    const completedSnapshot = createScannerRuntimeSnapshot('completed')
    runtimeMock.snapshot = {
      ...completedSnapshot,
      summary: {
        ...completedSnapshot.summary!,
        reliable: 1,
        needsReview: 0,
        unreadable: 0,
        resultStatus: 'ready_for_review',
        uniqueRecords: 1,
      },
    }
    runtimeMock.commands.requestResultStaging.mockResolvedValueOnce(createReadyScannerStaging())
    const rendered = render(<App />)
    expect(await screen.findByRole('button', { name: '导入' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '放弃' }))
    expect(await screen.findByRole('heading', { name: '画面扫描已连接' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始扫描' }))
    await waitFor(() => expect(runtimeMock.commands.startScan).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '扫描结果与下一步' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '已完成扫描结果' })).not.toBeInTheDocument()

    runtimeMock.snapshot = createScannerRuntimeSnapshot('checking')
    await setActiveAccount(account.id, database)
    rendered.rerender(<App />)
    await waitFor(() =>
      expect(document.querySelector('.scanner-golden')).toHaveAttribute(
        'data-scanner-state',
        'checking',
      ),
    )
    expect(
      await screen.findByRole('heading', { name: '画面扫描正在检查游戏与权限' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(window.localStorage.getItem('soda.scanner.discardedResultHandle')).toBeNull(),
    )

    runtimeMock.snapshot = createScannerRuntimeSnapshot('scanning')
    await setActiveAccount(account.id, database)
    rendered.rerender(<App />)
    await waitFor(() =>
      expect(document.querySelector('.scanner-golden')).toHaveAttribute(
        'data-scanner-state',
        'scanning',
      ),
    )
    expect(
      await screen.findByRole('progressbar', { name: '已处理 128，共 384' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument()

    runtimeMock.snapshot = {
      ...completedSnapshot,
      summary: {
        ...completedSnapshot.summary!,
        resultFileHandle: 'next-local-staging.json',
      },
    }
    await setActiveAccount(account.id, database)
    rendered.rerender(<App />)
    expect(await screen.findByRole('region', { name: '扫描结果与下一步' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '检查需确认的记录' })).toBeEnabled()
  })

  it('contains keyboard focus in the incomplete-draft confirmation and restores its trigger', async () => {
    const user = userEvent.setup()
    const account = await createAccount('异常草稿账户', database, { id: 'account-draft-dialog' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    runtimeMock.snapshot = createScannerRuntimeSnapshot('completed')
    runtimeMock.commands.requestResultStaging.mockRejectedValueOnce(
      new Error('当前账户已有不完整的同源识别结果，未覆盖。'),
    )
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '检查需确认的记录' }))
    const trigger = await screen.findByRole('button', { name: '重新读取扫描结果' })
    expect(screen.getByRole('alert')).toHaveTextContent('上次保存的扫描结果不完整')
    expect(screen.queryByText(/不完整的同源识别结果/)).not.toBeInTheDocument()
    await user.click(trigger)
    const cancel = screen.getByRole('button', { name: '取消' })
    expect(screen.getByRole('dialog', { name: '重新读取扫描结果？' })).toBeInTheDocument()
    expect(cancel).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('button', { name: '确认重新读取' })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(cancel).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('recovers incomplete saved scan results without rescanning or updating the warehouse', async () => {
    const user = userEvent.setup()
    const account = await createAccount('恢复账户', database, { id: 'account-result-recovery' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    const staging = createReadyScannerStaging(2)
    await stageAccountPaddleScanImport(account.id, staging, database)
    const item = await database.accountScanImportItems.where('accountId').equals(account.id).first()
    await database.accountScanImportItems.delete(item!.scopedId)
    runtimeMock.snapshot = createScannerRuntimeSnapshot('completed')
    runtimeMock.commands.requestResultStaging
      .mockResolvedValueOnce(staging)
      .mockResolvedValueOnce(staging)
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '检查需确认的记录' }))
    await user.click(await screen.findByRole('button', { name: '重新读取扫描结果' }))
    await user.click(screen.getByRole('button', { name: '确认重新读取' }))
    expect(await screen.findByRole('button', { name: '导入' })).toBeEnabled()
    expect(await database.accountScanImportItems.count()).toBe(2)
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '重新读取扫描结果？' })).not.toBeInTheDocument()
  })

  it('keeps an eligible result on its existing import-ready path instead of reopening the result dialog', async () => {
    const user = userEvent.setup()
    const account = await createAccount('正式接收账户', database, {
      id: 'account-result-dialog-ready',
    })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    runtimeMock.snapshot = createScannerRuntimeSnapshot('completed')
    render(<App />)

    expect(await screen.findByRole('button', { name: '检查需确认的记录' })).toBeEnabled()
    expect(document.querySelector('dialog:not(.sponsor-dialog)')).toBeNull()
    await user.click(screen.getByRole('button', { name: '放弃' }))
    await waitFor(() => expect(runtimeMock.commands.retryConnection).toHaveBeenCalledTimes(1))
    expect(readScannerTargetAccountBinding()).toMatchObject({ valid: false })
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
  })

  it('opens import-ready presentation only when result and binding gates both pass', async () => {
    const account = await createAccount('正式接收账户', database, { id: 'account-import-ready' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    runtimeMock.snapshot = createScannerRuntimeSnapshot('completed')
    render(<App />)

    expect(await screen.findByRole('region', { name: '扫描结果与下一步' })).toBeInTheDocument()
    expect(document.querySelector('.scanner-golden')).toHaveAttribute(
      'data-scanner-visual-state',
      'import_ready',
    )
    expect(document.querySelector('.scanner-golden')).toHaveAttribute('data-layout', 'flex')
    expect(document.querySelector('.scanner-golden__workbench')?.children).toHaveLength(1)
    expect(screen.queryByRole('complementary', { name: '本次扫描' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '检查需确认的记录' })).toBeEnabled()
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
  })

  it('automatically checks a perfect result in place but only writes after explicit import', async () => {
    const user = userEvent.setup()
    const account = await createAccount('同页导入账户', database, { id: 'account-inline-import' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    const completedSnapshot = createScannerRuntimeSnapshot('completed')
    runtimeMock.snapshot = {
      ...completedSnapshot,
      summary: {
        ...completedSnapshot.summary!,
        reliable: 1,
        needsReview: 0,
        unreadable: 0,
        resultStatus: 'ready_for_review',
        uniqueRecords: 1,
      },
    }
    runtimeMock.commands.requestResultStaging.mockResolvedValueOnce(createReadyScannerStaging())

    const rendered = render(<App />)
    expect(await screen.findByRole('button', { name: '导入' })).toBeEnabled()
    expect(document.querySelector('.scanner-web__handoff')).toHaveTextContent(
      '目标账户同页导入账户1 张 S 级驱动盘',
    )
    expect(document.querySelector('dialog:not(.sponsor-dialog)')).toBeNull()
    expect(window.location.pathname).toBe('/system/scanner')
    expect(screen.queryByRole('button', { name: '在本页确认导入' })).not.toBeInTheDocument()
    expect(runtimeMock.commands.requestResultFile).toHaveBeenCalledTimes(1)
    expect(runtimeMock.commands.requestResultStaging).toHaveBeenCalledTimes(1)
    expect(await database.accountDriveDiscs.count()).toBe(0)

    rendered.rerender(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: '导入' })).toBeEnabled())
    expect(runtimeMock.commands.requestResultFile).toHaveBeenCalledTimes(1)
    expect(runtimeMock.commands.requestResultStaging).toHaveBeenCalledTimes(1)
    expect(await database.accountDriveDiscs.count()).toBe(0)

    await user.click(screen.getByRole('button', { name: '导入' }))
    expect(screen.queryByRole('button', { name: '确认并正式导入' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '导入完成' })).toBeInTheDocument()
    const completed = within(screen.getByRole('region', { name: '已导入扫描结果' }))
    expect(completed.getByRole('link', { name: '查看驱动盘' })).toHaveAttribute(
      'href',
      '/assets/discs',
    )
    expect(completed.queryByRole('link', { name: '队伍配装' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '已导入 1 张正式驱动盘' })).not.toBeInTheDocument()
    expect(document.querySelector('.scanner-task__completion')).toHaveTextContent(
      '导入完成1 张驱动盘已更新至“同页导入账户”',
    )
    expect(screen.queryByText('先确认这是你的本地账户')).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(1)

    rendered.unmount()
    render(<App />)
    expect(await screen.findByText('导入完成')).toBeInTheDocument()
    expect(screen.queryByText('下载本机扫描器')).not.toBeInTheDocument()
    expect(screen.queryByText('辅助信息与备用导入')).not.toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: '扫描步骤' }).querySelectorAll('.is-complete'),
    ).toHaveLength(3)
    expect(screen.queryByRole('button', { name: '查看驱动盘' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新扫描' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '确认账户并继续' })).not.toBeInTheDocument()
    expect(screen.queryByText('放弃')).not.toBeInTheDocument()

    expect(window.location.pathname).toBe('/system/scanner')
  })

  it('binds a perfect existing result to the selected account without leaving the result card', async () => {
    const user = userEvent.setup()
    const account = await createAccount('波子汽水', database, { id: 'account-card-import' })
    await setActiveAccount(account.id, database)
    const completedSnapshot = createScannerRuntimeSnapshot('completed')
    runtimeMock.snapshot = {
      ...completedSnapshot,
      summary: {
        ...completedSnapshot.summary!,
        reliable: 1,
        needsReview: 0,
        unreadable: 0,
        resultStatus: 'ready_for_review',
        uniqueRecords: 1,
      },
    }
    runtimeMock.commands.requestResultStaging.mockResolvedValueOnce(createReadyScannerStaging())
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '确认账户并继续' }))

    expect(await screen.findByRole('button', { name: '导入' })).toBeEnabled()
    expect(document.querySelector('dialog:not(.sponsor-dialog)')).toBeNull()
    expect(window.location.pathname).toBe('/system/scanner')
    expect(runtimeMock.commands.requestResultFile).toHaveBeenCalledTimes(1)
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('keeps a blocked-import result in completed read-only presentation despite a valid binding', async () => {
    const account = await createAccount('受阻接收账户', database, { id: 'account-blocked' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    const completedSnapshot = createScannerRuntimeSnapshot('completed')
    runtimeMock.snapshot = {
      ...completedSnapshot,
      summary: {
        ...completedSnapshot.summary!,
        resultStatus: 'blocked_import',
      },
    }
    render(<App />)

    expect(await screen.findByRole('region', { name: '已完成扫描结果' })).toBeInTheDocument()
    expect(document.querySelector('.scanner-golden')).toHaveAttribute(
      'data-scanner-visual-state',
      'completed',
    )
    expect(screen.getByRole('button', { name: '返回准备步骤' })).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('本次结果无法安全导入')
    expect(screen.queryByRole('button', { name: /正式导入/ })).not.toBeInTheDocument()
    expect(runtimeMock.commands.requestResultFile).not.toHaveBeenCalled()
  })
})
