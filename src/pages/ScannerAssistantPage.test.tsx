import { registerScannerRecoveryTests } from './scannerAssistantRecoveryTests'
import { registerScannerDataFileCompatibilityTests } from './scannerDataFileCompatibilityTests'
import { registerScannerCompletedResultTests } from './scannerAssistantCompletedResultTests'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { database } from '../db/database'
import { readLastScanDiagnostic } from '../scanner/scanFeedback'
import { readScannerTargetAccountBinding } from '../scanner/targetAccountBinding'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))
import {
  baseScannerSnapshot as baseSnapshot,
  createScannerRuntimeSnapshot,
} from './scannerAssistantTestFixture'
import {
  cleanupScannerPageTestDatabase,
  createScannerRuntimeCommands,
  resetScannerPageTestDatabase,
} from './scannerAssistantPageTestSupport'

const runtimeState = vi.hoisted(() => ({
  hookCalls: 0,
  snapshot: {} as Record<string, unknown>,
}))

const releaseStateFixture = vi.hoisted(() => ({
  override: null as null | 'published' | 'not_published',
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
          return (
            releaseStateFixture.override ?? actual.scannerDistributionManifest.runtime.releaseState
          )
        },
      },
    },
  }
})

const runtimeMock = {
  get hookCalls() {
    return runtimeState.hookCalls
  },
  set hookCalls(value: number) {
    runtimeState.hookCalls = value
  },
  get snapshot() {
    return runtimeState.snapshot
  },
  set snapshot(value: Record<string, unknown>) {
    runtimeState.snapshot = value
  },
  commands: createScannerRuntimeCommands(vi.fn),
}

let uuidCounter = 0

vi.mock('../scanner/runtime', () => ({
  useScannerAssistantRuntime: () => {
    runtimeMock.hookCalls += 1
    return runtimeMock
  },
}))

function setRuntimeState(state: string) {
  runtimeMock.snapshot = createScannerRuntimeSnapshot(state)
}

describe('ScannerAssistantPage', () => {
  beforeEach(async () => {
    releaseStateFixture.override = null
    setRuntimeState('unchecked')
    runtimeMock.hookCalls = 0
    vi.clearAllMocks()
    await resetScannerPageTestDatabase()
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: vi.fn(() => `00000000-0000-4000-8000-${String((uuidCounter += 1)).padStart(12, '0')}`),
    })
    window.history.pushState({}, '', '/system/scanner')
  })

  afterEach(async () => {
    await cleanupScannerPageTestDatabase()
  })

  it('offers the current published installer when the scanner is not installed', async () => {
    const user = userEvent.setup()
    releaseStateFixture.override = 'published'
    runtimeMock.snapshot = {
      ...baseSnapshot,
      readiness: { ...baseSnapshot.readiness, helperConnected: false },
      distribution: {
        ...baseSnapshot.distribution,
        state: 'not_installed',
        installedVersion: null,
        action: 'download',
      },
    }
    render(<App />)
    expect(
      await screen.findByRole('button', { name: '下载扫描助手' }, { timeout: 10000 }),
    ).toBeEnabled()
    expect(screen.getAllByRole('button', { name: '连接扫描助手' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '连接扫描助手' }))
    await waitFor(() => expect(runtimeMock.commands.openHelper).toHaveBeenCalledWith(true))
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('offers reconnection without an obsolete download while the current runtime is unpublished', async () => {
    const user = userEvent.setup()
    releaseStateFixture.override = 'not_published'
    runtimeMock.snapshot = {
      ...baseSnapshot,
      readiness: { ...baseSnapshot.readiness, helperConnected: false },
      distribution: {
        state: 'not_installed',
        installedVersion: null,
        targetVersion: 'soda-scanner-native-ppocrv6-3',
        progressPercent: null,
        action: 'none',
        message: '扫描组件发布包尚未就绪，暂时不能下载。',
      },
    }
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '连接扫描助手' }))
    expect(runtimeMock.commands.retryConnection).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('正在处理…')).not.toBeInTheDocument()
    expect(screen.queryByText('已重新连接扫描助手。')).not.toBeInTheDocument()
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '下载扫描助手' })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('does not claim an account was selected when only the helper is connected', async () => {
    const user = userEvent.setup()
    setRuntimeState('ready')
    render(<App />)
    expect(await screen.findByRole('heading', { name: '扫描助手已连接' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '新账户名称' })).toBeVisible()
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
    expect(
      screen.queryByText('已选择接收结果的本地账户。', { exact: false }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('先确定数据归属')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '断开授权' }))
    expect(runtimeMock.commands.revokePairing).toHaveBeenCalledTimes(1)
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('shows a verified installed component as one-click open without changing account data', async () => {
    const user = userEvent.setup()
    setRuntimeState('connection_failed')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      readiness: { ...baseSnapshot.readiness, helperConnected: false },
      distribution: {
        state: 'ready',
        installedVersion: 'soda-scanner-zzz-next-ppocrv6-14',
        targetVersion: 'soda-scanner-zzz-next-ppocrv6-14',
        progressPercent: null,
        action: 'open',
        message: '扫描组件已校验，可由网页直接打开。',
      },
    }
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '重新连接扫描助手' }))
    await waitFor(() => expect(runtimeMock.commands.openHelper).toHaveBeenCalledTimes(1))
    expect(runtimeMock.commands.retryConnection).not.toHaveBeenCalled()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('keeps reconnection failures in player language without requesting a scan or install', async () => {
    const user = userEvent.setup()
    setRuntimeState('connection_failed')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      readiness: { ...baseSnapshot.readiness, helperConnected: false },
    }
    runtimeMock.commands.openHelper.mockRejectedValueOnce(new Error('helper_request_failed_503'))
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '重新连接扫描助手' }))
    await waitFor(() =>
      expect(document.querySelector('.scanner-task__feedback')).toHaveTextContent(
        '未能连接扫描助手，请确认助手已运行后重试。',
      ),
    )
    expect(screen.queryByText('helper_request_failed_503')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(readLastScanDiagnostic()).toMatchObject({
        code: 'helper_unavailable',
        stage: 'connection',
        outcome: 'failed',
      }),
    )
    expect(screen.getByText('网页暂时没有连接到本机扫描助手。')).toBeInTheDocument()
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('keeps the JSON fallback in the page-level recovery area rather than the result dialog', async () => {
    runtimeMock.snapshot = createScannerRuntimeSnapshot('connection_failed')
    render(<App />)
    await screen.findByLabelText('选择本机文件（JSON）')
    expect(screen.getByRole('region', { name: '扫描前必需条件' })).toHaveTextContent('清除筛选')
    expect(screen.queryByText('扫描准备条件与导入范围')).not.toBeInTheDocument()
    expect(screen.queryByText(/\d \/ 5 项准备已通过/)).not.toBeInTheDocument()
    expect(document.querySelector('.scanner-task dialog')).toBeNull()
    expect(screen.getAllByLabelText('选择本机文件（JSON）')).toHaveLength(1)
    expect(screen.getByLabelText('选择本机文件（JSON）')).toHaveAttribute('type', 'file')
    expect(document.querySelector('.scanner-task dialog')).toBeNull()
  })
  it.each(['unchecked', 'ready'])(
    'offers the secondary JSON entry during %s preparation',
    async (state) => {
      setRuntimeState(state)
      render(<App />)
      expect(await screen.findByLabelText('选择本机文件（JSON）')).toHaveAttribute('type', 'file')
      expect(screen.getByText('S 级驱动盘 · 无需重新登录')).toBeVisible()
      expect(screen.queryByText('辅助信息与备用导入')).not.toBeInTheDocument()
    },
  )

  it.each([
    ['connection_failed', '本次扫描未完成', '重新扫描'],
    ['ready', '扫描助手已连接', '开始扫描'],
    ['checking', '本机助手正在检查游戏与权限', '正在检查'],
    ['awaiting_elevation', '请确认管理员权限提示', '等待 Windows 权限确认'],
    ['scanning', '正在读取游戏中的资产', '停止本次扫描'],
    ['completed', '创建账户后检查本次结果', '确认账户并继续'],
  ])('renders the isolated %s state without account writes', async (state, heading, action) => {
    setRuntimeState(state)
    render(<App />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
    expect(document.querySelector('.scanner-golden')).toHaveAttribute(
      'data-scanner-visual-state',
      state,
    )
    expect(document.querySelector('.scanner-task__slant')).toBeNull()
    expect(await database.accounts.count()).toBe(0)
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
  })

  it('shows an unknown total without inventing zero percent or zero inventory', async () => {
    setRuntimeState('scanning')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      progress: { processed: 169, total: null, stageLabel: '正在读取驱动盘', etaSeconds: null },
    }
    render(<App />)
    const progress = await screen.findByRole('progressbar', { name: '已处理 169，总量待确认' })
    expect(progress).not.toHaveAttribute('value')
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('reports a partial scan failure without offering it as a complete import', async () => {
    setRuntimeState('connection_failed')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      progress: { processed: 169, total: 492, stageLabel: '读取中断', etaSeconds: null },
    }
    render(<App />)
    expect(await screen.findByRole('heading', { name: '本次扫描未完成' })).toBeInTheDocument()
    expect(screen.getByText(/本次已处理 169 张，部分结果不会作为完整仓库导入/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '反馈此问题' })).toBeEnabled()
    expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('查看诊断信息'))
    const diagnostic = readLastScanDiagnostic()
    expect(diagnostic?.counts).toEqual({ processed: 169, total: 492 })
    expect(diagnostic?.reportId).toMatch(/^[0-9a-f-]{36}$/)
    expect(diagnostic?.durationMs).toBeNull()
    expect(screen.getByText('遇到的问题')).toBeVisible()
    expect(screen.getByText('可以这样做')).toBeVisible()
    expect(screen.getByText('已处理 169 / 492 张')).toBeVisible()
    expect(screen.queryByText(diagnostic!.reportId)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /确认导入/ })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
  })

  it('keeps route focus on the unique page heading during direct state restoration', async () => {
    setRuntimeState('scanning')
    render(<App />)
    const heading = await screen.findByRole('heading', { name: '正在读取游戏中的资产' })
    const pageHeading = screen.getByRole('heading', { name: '扫描与导入' })
    await waitFor(() => expect(pageHeading).toHaveFocus())
    expect(heading).not.toHaveFocus()
    expect(screen.getByRole('progressbar', { name: '已处理 128，共 384' })).toBeInTheDocument()
  })

  it('lets the helper atomically check and start when browser-side game facts are missing', async () => {
    const user = userEvent.setup()
    const account = await createAccount('主账号', database, { id: 'account-main' })
    await setActiveAccount(account.id, database)
    setRuntimeState('ready')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      prepare: {
        ...baseSnapshot.prepare,
        playerChecks: {
          filtersClear: null,
          overlayClear: null,
          inventoryCapacity: null,
        },
      },
    }
    render(<App />)
    const start = await screen.findByRole('button', { name: '开始扫描' })
    await waitFor(() => expect(start).toBeEnabled())
    expect(screen.getByRole('heading', { name: '扫描助手已连接' })).toBeInTheDocument()
    expect(screen.queryByText('仍有筛选条件')).not.toBeInTheDocument()
    expect(screen.queryByText(/项准备全部通过/)).not.toBeInTheDocument()
    await user.click(start)
    await waitFor(() => expect(runtimeMock.commands.startScan).toHaveBeenCalledTimes(1))
    expect(readScannerTargetAccountBinding()).toMatchObject({
      valid: true,
      binding: { accountId: 'account-main', baselineDiscCount: 0 },
    })
  })

  it('keeps the single start action gated by the target account and local helper only', async () => {
    const account = await createAccount('主账号', database, { id: 'account-main' })
    await setActiveAccount(account.id, database)
    setRuntimeState('unchecked')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      readiness: {
        ...baseSnapshot.readiness,
        helperConnected: false,
        gameFrameReadable: false,
      },
      prepare: undefined,
    }
    render(<App />)
    await screen.findByRole('combobox', { name: '目标账户' })
    expect(screen.getByRole('button', { name: '连接扫描助手' })).toBeEnabled()
    const requirements = screen.getByRole('region', { name: '扫描前必需条件' })
    expect(requirements).toHaveTextContent('打开“驱动仓库”完整列表')
    expect(requirements).toHaveTextContent('清除筛选')
    expect(screen.getByRole('heading', { name: '扫描助手未连接' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '实际准备检查结果' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '连接扫描助手' })).toHaveLength(1)
    expect(screen.getByText('本机扫描组件与助手可用后即可检查并开始。')).toBeInTheDocument()
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
  })

  it('shows the dynamic warehouse count and opens the gate only after all checks pass', async () => {
    const user = userEvent.setup()
    const account = await createAccount('主账号', database, { id: 'account-main' })
    await setActiveAccount(account.id, database)
    setRuntimeState('ready')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      prepare: {
        ...baseSnapshot.prepare,
        observedTotal: 417,
        expectedTotal: 417,
      },
      config: {
        ...baseSnapshot.config,
        scopeLabel: '完整驱动盘仓库 · 417 张',
      },
    }
    render(<App />)
    expect(await screen.findByText(/417 \/ 3000/)).toBeInTheDocument()
    const start = screen.getByRole('button', { name: '开始扫描' })
    await screen.findByRole('combobox', { name: '目标账户' })
    await waitFor(() => expect(start).toBeEnabled())
    await user.click(start)
    await waitFor(() => expect(runtimeMock.commands.startScan).toHaveBeenCalledTimes(1))
    expect(readScannerTargetAccountBinding()).toMatchObject({
      valid: true,
      binding: {
        accountId: 'account-main',
        displayName: '主账号',
        operation: 'replace_drive_discs',
        baselineDiscCount: 0,
      },
    })
  })

  it('creates an explicit empty account before opening the scan gate', async () => {
    const user = userEvent.setup()
    setRuntimeState('ready')
    render(<App />)

    fireEvent.change(await screen.findByRole('textbox', { name: '新账户名称' }), {
      target: { value: '复扫账号' },
    })
    const create = screen.getByRole('button', { name: '创建并用于本次操作' })
    await waitFor(() => expect(create).toBeEnabled())
    await user.click(create)
    await waitFor(async () => expect(await database.accounts.count()).toBe(1))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: '目标账户' })).toHaveTextContent('复扫账号'),
    )
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(screen.queryByText(/替换前 0 张|再次更新/)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '开始扫描' })).toBeEnabled())
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
  })

  it('keeps an unbound completed result visible while a zero-account user creates its target', async () => {
    const user = userEvent.setup()
    setRuntimeState('completed')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '创建账户后检查本次结果' }),
    ).toBeInTheDocument()
    const result = screen.getByRole('region', { name: '已完成扫描结果' })
    expect(result).toHaveTextContent('本次结果 · 平均 230 张/分钟384可直接导入 350 · 待检查 30')
    expect(screen.getByRole('button', { name: '确认账户并继续' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: '新账户名称' }), '扫描结果账户')
    await user.click(screen.getByRole('button', { name: '创建并用于本次操作' }))

    await waitFor(async () => expect(await database.accounts.count()).toBe(1))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '确认账户并继续' })).toBeEnabled(),
    )
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
    expect(runtimeMock.commands.requestResultFile).not.toHaveBeenCalled()
  })

  it('can create an isolated scan account without replacing an existing account', async () => {
    const user = userEvent.setup()
    const existing = await createAccount('既有验收账户', database, { id: 'account-existing' })
    await setActiveAccount(existing.id, database)
    setRuntimeState('ready')
    render(<App />)

    await user.click(await screen.findByText('新建账户'))
    const accountName = screen.getByRole('textbox', { name: '新账户名称' })
    expect(accountName.closest('details')).toHaveAttribute('open')
    await user.type(accountName, '真实扫描账户')
    await user.click(screen.getByRole('button', { name: '创建并用于本次操作' }))

    await waitFor(async () => expect(await database.accounts.count()).toBe(2))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: '目标账户' })).toHaveTextContent('真实扫描账户'),
    )
    expect(await database.accounts.get('account-existing')).toMatchObject({
      displayName: '既有验收账户',
      status: 'active',
    })
  })

  it('uses the shared account selector without loading account imagery', async () => {
    const alphaName = 'F4X Current HEAD 完整主账户名称'
    const betaName = 'F4X Current HEAD 完整备用账户名称'
    const alpha = await createAccount(alphaName, database, { id: 'account-alpha' })
    await createAccount(betaName, database, { id: 'account-beta' })
    await setActiveAccount(alpha.id, database)
    setRuntimeState('ready')
    render(<App />)

    const picker = await screen.findByRole('combobox', { name: '目标账户' })
    expect(picker).toHaveTextContent(alphaName)
    await choosePlayerSelect(picker, 'account-beta')
    expect(picker).toHaveValue('account-beta')
    expect(picker).toHaveTextContent(betaName)
    expect(picker).toHaveFocus()
  })

  registerScannerCompletedResultTests({ App, runtimeMock, setRuntimeState })
  registerScannerRecoveryTests({ App, runtimeMock, setRuntimeState })
  registerScannerDataFileCompatibilityTests({ App, setRuntimeState, runtimeMock })
})
