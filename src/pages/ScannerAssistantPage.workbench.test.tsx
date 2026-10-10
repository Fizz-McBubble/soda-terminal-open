import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { ScannerAssistantPage } from './ScannerAssistantPage'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { database } from '../db/database'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'
import {
  cleanupScannerPageTestDatabase,
  resetScannerPageTestDatabase,
  createScannerRuntimeCommands,
} from './scannerAssistantPageTestSupport'
import { syntheticWorkbenchQuickSnapshot } from './ScannerAssistantPage.workbench.syntheticfixture'
import type { AssetBridgeJob } from '../assetQuickRead/bridgeClient'
import { initialDistributionSnapshot } from '../scanner/distribution'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))
const runtimeState = vi.hoisted(() => ({ snapshot: {} as Record<string, unknown> }))
const commands = createScannerRuntimeCommands(vi.fn)
vi.mock('../scanner/runtime', () => ({
  useScannerAssistantRuntime: () => ({ snapshot: runtimeState.snapshot, commands }),
}))
const bridge = vi.hoisted(() => ({
  connect: vi.fn(),
  start: vi.fn(),
  status: vi.fn(),
  cancel: vi.fn(),
  result: vi.fn(),
}))
vi.mock('../assetQuickRead/bridgeClient', () => ({
  AssetQuickReadBridgeClient: class {
    connect = bridge.connect
    start = bridge.start
    status = bridge.status
    cancel = bridge.cancel
    result = bridge.result
  },
}))
const accountId = 'account-workbench-synthetic'
const job: AssetBridgeJob = {
  jobId: 'b41d3a49-e16c-4d14-98a5-afbfdbad1cba',
  targetAccountId: accountId,
  state: 'starting',
  phase: 'awaiting_elevation',
  code: null,
  startedAt: '2026-10-10T00:00:00Z',
  readyAt: null,
  deadline: null,
  remainingSeconds: null,
  counts: { agents: 0, discs: 0, engines: 0 },
  candidateAvailable: false,
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubGlobal('crypto', webcrypto)
  await resetScannerPageTestDatabase()
  await createAccount('合成主账户', database, { id: accountId })
  await createAccount('合成备用账户', database, { id: 'account-workbench-other' })
  await setActiveAccount(accountId, database)
  runtimeState.snapshot = createScannerRuntimeSnapshot('ready')
  bridge.connect.mockResolvedValue({})
  bridge.start.mockResolvedValue(job)
  bridge.status.mockResolvedValue(job)
  bridge.cancel.mockResolvedValue({ ...job, state: 'stopped' })
  bridge.result.mockResolvedValue({
    jobId: job.jobId,
    targetAccountId: accountId,
    snapshot: syntheticWorkbenchQuickSnapshot(),
    sha256: 'a'.repeat(64),
  })
})
afterEach(async () => {
  await cleanupScannerPageTestDatabase()
  vi.unstubAllGlobals()
})
function page() {
  return (
    <MemoryRouter>
      <ScannerAssistantPage />
    </MemoryRouter>
  )
}
async function showPage() {
  const result = render(page())
  await screen.findByRole('region', { name: '本次操作目标账户' })
  return result
}
function assertRiskLast() {
  const risk = screen.getByRole('region', { name: '采集方式与风险说明' })
  expect(risk.parentElement?.lastElementChild).toBe(risk)
}
async function facts() {
  return {
    discs: await database.accountDriveDiscs.toArray(),
    rosters: await database.accountRosters.toArray(),
    accounts: await database.accounts.toArray(),
    batches: await database.accountScanImportBatches.toArray(),
  }
}
function quickFile(snapshot = syntheticWorkbenchQuickSnapshot()) {
  const text = JSON.stringify(snapshot)
  const file = new File([text], 'synthetic-workbench-quick.json', { type: 'application/json' })
  Object.defineProperties(file, {
    text: { value: async () => text },
    arrayBuffer: { value: async () => new TextEncoder().encode(text).buffer },
  })
  return file
}
async function prepareQuick() {
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:ee09b7b910b89ca3d044849bf8cbb524" },
  })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  fireEvent.click(screen.getByRole('button', { name: '开始读取' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' })))
}

it('presents one account area, both acquisition methods and exactly one file input without an initial task', async () => {
  const result = await showPage()
  expect(screen.getAllByRole('region', { name: '本次操作目标账户' })).toHaveLength(1)
  expect(screen.getAllByRole('combobox', { name: '目标账户' })).toHaveLength(1)
  const acquisition = screen.getByRole('region', { name: '获取资产' })
  expect(within(acquisition).getByRole('heading', { name: '画面扫描' })).toBeInTheDocument()
  expect(within(acquisition).getByRole('heading', { name: '资产快读（实验）' })).toBeInTheDocument()
  expect(result.container.querySelectorAll('input[type="file"]')).toHaveLength(1)
  expect(screen.queryByRole('region', { name: '本次任务' })).not.toBeInTheDocument()
  expect(result.container.querySelector('.scanner-journey-cards')).toBeNull()
  assertRiskLast()
})

it('keeps account selection in the shared action area with only one account', async () => {
  await database.accounts.delete('account-workbench-other')
  await showPage()
  const target = screen.getByRole('region', { name: '本次操作目标账户' })
  expect(within(target).getByRole('combobox', { name: '目标账户' })).toHaveValue(accountId)
  expect(within(target).getByRole('combobox')).toHaveTextContent('合成主账户')
  expect(within(target).getByText('新建账户')).toBeInTheDocument()
  expect(within(target).getByLabelText('选择本机文件（JSON）')).toBeInTheDocument()
})

it('shows an empty target selector beside account creation before allowing acquisition', async () => {
  await resetScannerPageTestDatabase()
  await showPage()
  const target = screen.getByRole('region', { name: '本次操作目标账户' })
  expect(within(target).getByRole('combobox', { name: '目标账户' })).toBeDisabled()
  expect(within(target).getByRole('combobox')).toHaveTextContent('请先创建账户')
  expect(within(target).getByLabelText('新账户名称')).toBeVisible()
  expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  expect(screen.getByRole('button', { name: '开始读取' })).toBeDisabled()
})

it('drops a quick snapshot into the existing shared inspection without connecting or writing accounts', async () => {
  const before = await facts()
  await showPage()
  fireEvent.drop(screen.getByRole('region', { name: '扫描与导入' }), {
    dataTransfer: { files: [quickFile()], types: ['Files'] },
  })
  await screen.findByRole('heading', { name: '检查本次读取结果' })
  expect(screen.getByRole('button', { name: '确认导入本次资产快读结果' })).toBeDisabled()
  expect(bridge.connect).not.toHaveBeenCalled()
  expect(bridge.start).not.toHaveBeenCalled()
  expect(await facts()).toEqual(before)
})

it('rejects multiple dragged files without replacing any account facts', async () => {
  const before = await facts()
  await showPage()
  fireEvent.drop(screen.getByRole('region', { name: '扫描与导入' }), {
    dataTransfer: { files: [quickFile(), quickFile()], types: ['Files'] },
  })
  expect(screen.getByText('请一次拖入一个 JSON 文件。')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '本次任务' })).not.toBeInTheDocument()
  expect(await facts()).toEqual(before)
})

it('recognizes a synthetic quick snapshot from the shared file without connecting or writing account facts', async () => {
  const before = await facts()
  await showPage()
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
    target: { files: [quickFile()] },
  })
  const task = await screen.findByRole('region', { name: '本次任务' })
  await within(task).findByRole('heading', { name: '检查本次读取结果' })
  expect(within(task).getByRole('heading', { name: '检查本次读取结果' })).toHaveFocus()
  expect(within(task).getByText('资产快读 · 合成主账户')).toBeInTheDocument()
  expect(bridge.connect).not.toHaveBeenCalled()
  expect(bridge.start).not.toHaveBeenCalled()
  expect(commands.startScan).not.toHaveBeenCalled()
  expect(await facts()).toEqual(before)
  expect(screen.getByRole('button', { name: '确认导入本次资产快读结果' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
  expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
  const scannerTools = screen.getByText('扫描准备与工具').closest('details')!
  const quickTools = screen.getByText('资产快读准备').closest('details')!
  expect(scannerTools).not.toHaveAttribute('open')
  expect(quickTools).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText('扫描准备与工具'))
  fireEvent.click(screen.getByText('资产快读准备'))
  expect(scannerTools).toHaveAttribute('open')
  expect(quickTools).toHaveAttribute('open')
  expect(screen.getByLabelText('游戏安装目录')).toBeVisible()
  expect(screen.queryByRole('button', { name: '开始读取' })).not.toBeInTheDocument()
  expect(screen.getByText('资产快读指南')).toBeVisible()
  assertRiskLast()
})

it('keeps an existing installer download mounted and cancellable when a quick file becomes the task', async () => {
  runtimeState.snapshot = {
    ...createScannerRuntimeSnapshot('ready'),
    distribution: initialDistributionSnapshot,
  }
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
  const before = await facts()
  await showPage()
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  const progress = await screen.findByRole('progressbar', { name: '画面扫描下载进度' })
  const cancel = screen.getByRole('button', { name: '取消下载' })
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
    target: { files: [quickFile()] },
  })
  await screen.findByRole('heading', { name: '检查本次读取结果' })
  expect(screen.getByRole('progressbar', { name: '画面扫描下载进度' })).toBe(progress)
  expect(screen.getByRole('button', { name: '取消下载' })).toBe(cancel)
  expect(cancel).toBeVisible()
  expect(cancel).toBeEnabled()
  expect(screen.getByText('扫描准备与工具').closest('details')).toHaveAttribute('open')
  fireEvent.click(cancel)
  await waitFor(() => expect(screen.getByText('下载已取消')).toBeVisible())
  expect(screen.getByRole('heading', { name: '检查本次读取结果' })).toBeVisible()
  expect(await facts()).toEqual(before)
  expect(bridge.start).not.toHaveBeenCalled()
  assertRiskLast()
})

it.each(['starting', 'capturing'] as const)(
  'locks OCR, account selection and files during quick %s while keeping own stop available',
  async (state) => {
    bridge.start.mockResolvedValue({
      ...job,
      state,
      ...(state === 'capturing' ? { readyAt: '2026-10-10T00:00:01Z', remainingSeconds: 179 } : {}),
    })
    bridge.status.mockResolvedValue({ ...job, state })
    const before = await facts()
    await showPage()
    await prepareQuick()
    expect(screen.getByRole('region', { name: '本次任务' })).toHaveTextContent(
      '资产快读 · 合成主账户',
    )
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '目标账户' })).toBeDisabled()
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
    fireEvent.drop(screen.getByRole('region', { name: '扫描与导入' }), {
      dataTransfer: { files: [quickFile()], types: ['Files'] },
    })
    expect(screen.queryByRole('heading', { name: '检查本次读取结果' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '停止本次资产快读' })).toBeEnabled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '停止本次资产快读' })))
    expect(bridge.cancel).toHaveBeenCalledWith(job.jobId)
    expect(commands.startScan).not.toHaveBeenCalled()
    expect(await facts()).toEqual(before)
    assertRiskLast()
  },
)

it('blocks quick actions and shared file while OCR owns an active scan', async () => {
  runtimeState.snapshot = createScannerRuntimeSnapshot('scanning')
  await showPage()
  expect(screen.getByRole('button', { name: '连接资产快读' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: '目标账户' })).toBeDisabled()
  expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
  expect(screen.getByRole('region', { name: '本次任务' })).toHaveTextContent(
    '画面扫描 · 合成主账户',
  )
  expect(bridge.start).not.toHaveBeenCalled()
  assertRiskLast()
})

it('keeps the shared account picker focused while invalidating an old quick candidate on account change', async () => {
  const before = await facts()
  await showPage()
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
    target: { files: [quickFile()] },
  })
  await screen.findByRole('heading', { name: '检查本次读取结果' })
  const picker = screen.getByRole('combobox', { name: '目标账户' })
  expect(picker).toBeEnabled()
  picker.focus()
  await choosePlayerSelect(picker, 'account-workbench-other')
  expect(screen.getByRole('combobox', { name: '目标账户' })).toBe(picker)
  expect(picker).toHaveFocus()
  expect(screen.queryByRole('heading', { name: '检查本次读取结果' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '确认导入本次资产快读结果' })).not.toBeInTheDocument()
  expect(await facts()).toEqual(before)
  expect(bridge.start).not.toHaveBeenCalled()
  assertRiskLast()
})

it.each([false, true])(
  'can abandon a quick file candidate (has issues: %s) without writes and unlock both acquisition paths',
  async (withIssues) => {
    const before = await facts()
    await showPage()
    const snapshot = syntheticWorkbenchQuickSnapshot()
    if (withIssues) snapshot.assets.agents[0].catalog_id.value = 999999
    fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
      target: { files: [quickFile(snapshot)] },
    })
    await screen.findByRole('heading', { name: '检查本次读取结果' })
    if (withIssues) expect(screen.getByText('需要核对的问题')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '放弃本次结果' })))
    expect(screen.queryByRole('region', { name: '本次任务' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeEnabled()
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeEnabled()
    expect(await facts()).toEqual(before)
    fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
      target: { files: [quickFile()] },
    })
    await screen.findByRole('heading', { name: '检查本次读取结果' })
    expect(screen.getByRole('button', { name: '确认导入本次资产快读结果' })).toBeDisabled()
    expect(await facts()).toEqual(before)
    assertRiskLast()
  },
)
