import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { ScannerAssistantPage } from './ScannerAssistantPage'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { saveAccountPlanningDraft } from '../accounts/planningDrafts'
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

it('uses the top-level account selection for quick read without another confirmation', async () => {
  await showPage()
  await choosePlayerSelect(
    screen.getByRole('combobox', { name: '目标账户' }),
    'account-workbench-other',
  )
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: '目标账户' })).toHaveTextContent('合成备用账户'),
  )
  expect(screen.queryByRole('button', { name: '使用所选接收账户' })).not.toBeInTheDocument()
  expect(bridge.start).not.toHaveBeenCalled()
  expect(await database.accountDriveDiscs.count()).toBe(0)
})
function assertFocusedWorkspace() {
  expect(screen.getByRole('complementary', { name: '非官方工具风险提示' })).toBeVisible()
  expect(document.getElementById('scanner-workbench-guides')).toBeNull()
  expect(screen.getByRole('region', { name: '采集方式与风险说明' })).toBeVisible()
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

it('keeps a failed connection in one diagnosis without a duplicate alert or stage badge', async () => {
  const snapshot = createScannerRuntimeSnapshot('unchecked')
  runtimeState.snapshot = {
    ...snapshot,
    readiness: { ...snapshot.readiness, helperConnected: false },
  }
  commands.openHelper.mockRejectedValueOnce(new Error('helper_request_failed_503'))
  await showPage()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接画面扫描' })))
  const diagnosis = await screen.findByRole('region', { name: '扫描诊断' })
  expect(diagnosis.querySelector('.scanner-diagnostic-entry__status')).toHaveTextContent(
    '网页暂时没有连接到画面扫描。',
  )
  expect(document.querySelector('.scanner-task__feedback')).toBeNull()
  expect(within(diagnosis).queryByText('连接画面扫描')).not.toBeInTheDocument()
  expect(commands.startScan).not.toHaveBeenCalled()
  expect(await database.accountDriveDiscs.count()).toBe(0)
})
async function prepareQuick() {
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:ee09b7b910b89ca3d044849bf8cbb524" },
  })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  fireEvent.click(screen.getByRole('button', { name: '一键读取' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始读取' })))
}

it('presents one account area, both acquisition methods and exactly one file input without an initial task', async () => {
  const result = await showPage()
  expect(screen.getAllByRole('region', { name: '本次操作目标账户' })).toHaveLength(1)
  expect(screen.getAllByRole('combobox', { name: '目标账户' })).toHaveLength(1)
  const acquisition = screen.getByRole('region', { name: '获取资产' })
  expect(within(acquisition).getByRole('heading', { name: '画面扫描' })).toBeInTheDocument()
  expect(within(acquisition).getByRole('heading', { name: /资产快读.*测试/ })).toBeInTheDocument()
  expect(within(acquisition).getByText('测试', { exact: true })).toBeInTheDocument()
  expect(acquisition).not.toHaveTextContent('Beta')
  expect(result.container.querySelectorAll('input[type="file"]')).toHaveLength(1)
  expect(screen.queryByRole('region', { name: '本次任务' })).not.toBeInTheDocument()
  expect(result.container.querySelector('.scanner-journey-cards')).toBeNull()
  assertFocusedWorkspace()
})

it('keeps account selection in the shared action area with only one account', async () => {
  await database.accounts.delete('account-workbench-other')
  await showPage()
  const target = screen.getByRole('region', { name: '本次操作目标账户' })
  expect(within(target).getByRole('combobox', { name: '目标账户' })).toHaveValue(accountId)
  expect(within(target).getByRole('combobox')).toHaveTextContent('合成主账户')
  expect(within(target).getByLabelText('新账户名称')).toBeVisible()
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
  const readAction = screen.queryByRole('button', { name: '一键读取' })
  if (readAction) expect(readAction).toBeDisabled()
  expect(bridge.start).not.toHaveBeenCalled()
})

it('drops a quick snapshot into the existing shared inspection without connecting or writing accounts', async () => {
  const before = await facts()
  await showPage()
  fireEvent.drop(screen.getByRole('region', { name: '扫描与导入' }), {
    dataTransfer: { files: [quickFile()], types: ['Files'] },
  })
  await screen.findByRole('heading', { name: '本次读取结果' })
  expect(screen.getByRole('button', { name: '导入' })).toBeEnabled()
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
  const task = await screen.findByRole('region', { name: '资产快读操作与结果' })
  await within(task).findByRole('heading', { name: '本次读取结果' })
  await waitFor(() =>
    expect(within(task).getByRole('heading', { name: '本次读取结果' })).toHaveFocus(),
  )
  expect(within(task).getByText('合成主账户')).toBeInTheDocument()
  expect(task.closest('#scanner-quick-read')).not.toBeNull()
  expect(screen.queryByRole('region', { name: '本次任务' })).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('list', { name: '读取步骤' }))
      .getByText('导入')
      .closest('li'),
  ).toHaveAttribute('aria-current', 'step')
  expect(bridge.connect).not.toHaveBeenCalled()
  expect(bridge.start).not.toHaveBeenCalled()
  expect(commands.startScan).not.toHaveBeenCalled()
  expect(await facts()).toEqual(before)
  expect(screen.getByRole('button', { name: '导入' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
  expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
  expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: '扫描前必需条件' }).closest('details')).toBeNull()
  expect(screen.getByText('资产快读指南')).toBeVisible()
  expect(screen.queryByRole('heading', { name: '资产快读指南' })).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: '代理人读取预览' })).not.toBeInTheDocument()
  assertFocusedWorkspace()
})

it('keeps an existing installer download mounted and cancellable when a quick file becomes the task', async () => {
  runtimeState.snapshot = {
    ...createScannerRuntimeSnapshot('ready'),
    distribution: initialDistributionSnapshot,
  }
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const before = await facts()
  await showPage()
  fireEvent.click(screen.getByRole('button', { name: '下载画面扫描' }))
  const progress = await screen.findByRole('progressbar', { name: '画面扫描下载进度' })
  const cancel = screen.getByRole('button', { name: '取消下载' })
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
    target: { files: [quickFile()] },
  })
  await screen.findByRole('heading', { name: '本次读取结果' })
  expect(screen.getByRole('progressbar', { name: '画面扫描下载进度' })).toBe(progress)
  expect(screen.getByRole('button', { name: '取消下载' })).toBe(cancel)
  expect(cancel).toBeVisible()
  expect(cancel).toBeEnabled()
  expect(progress.closest('details')).toBeNull()
  fireEvent.click(cancel)
  await waitFor(() =>
    expect(screen.queryByRole('progressbar', { name: '画面扫描下载进度' })).not.toBeInTheDocument(),
  )
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  expect(screen.queryByRole('button', { name: '取消下载' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '下载画面扫描' })).toBeEnabled()
  expect(screen.getByRole('heading', { name: '本次读取结果' })).toBeVisible()
  expect(await facts()).toEqual(before)
  expect(bridge.start).not.toHaveBeenCalled()
  assertFocusedWorkspace()
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
    expect(
      screen.getByRole('region', { name: '资产快读操作与结果' }).closest('#scanner-quick-read'),
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '目标账户' })).toBeDisabled()
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
    fireEvent.drop(screen.getByRole('region', { name: '扫描与导入' }), {
      dataTransfer: { files: [quickFile()], types: ['Files'] },
    })
    expect(screen.queryByRole('heading', { name: '本次读取结果' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '停止本次资产快读' })).toBeEnabled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '停止本次资产快读' })))
    expect(bridge.cancel).toHaveBeenCalledWith(job.jobId)
    expect(commands.startScan).not.toHaveBeenCalled()
    expect(await facts()).toEqual(before)
    assertFocusedWorkspace()
  },
)

it('blocks quick actions and shared file while OCR owns an active scan', async () => {
  runtimeState.snapshot = createScannerRuntimeSnapshot('scanning')
  await showPage()
  expect(screen.getByRole('button', { name: '连接资产快读' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: '目标账户' })).toBeDisabled()
  expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
  expect(
    screen.getByRole('region', { name: '画面扫描操作与结果' }).closest('#scanner-ocr'),
  ).not.toBeNull()
  expect(bridge.start).not.toHaveBeenCalled()
  assertFocusedWorkspace()
})

it('keeps the shared account picker focused while invalidating an old quick candidate on account change', async () => {
  const before = await facts()
  await showPage()
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
    target: { files: [quickFile()] },
  })
  await screen.findByRole('heading', { name: '本次读取结果' })
  const picker = screen.getByRole('combobox', { name: '目标账户' })
  expect(picker).toBeEnabled()
  picker.focus()
  await choosePlayerSelect(picker, 'account-workbench-other')
  await waitFor(() => expect(picker).toHaveValue('account-workbench-other'))
  expect(screen.getByRole('combobox', { name: '目标账户' })).toBe(picker)
  expect(picker).toHaveFocus()
  // Once the shared picker presents the committed account, the layout reset has
  // already invalidated the former candidate; no navigation or refresh is needed.
  expect(screen.queryByRole('heading', { name: '本次读取结果' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument()
  expect(await facts()).toEqual(before)
  expect(bridge.start).not.toHaveBeenCalled()
  assertFocusedWorkspace()
})

it('automatically imports newer observed progression and current equipment over older manual values', async () => {
  const record = (await database.accountRosters.get(accountId))!
  const agent = record.roster.agents.find((row) => row.agentId === 'agent-koleda')!
  Object.assign(agent, {
    owned: true,
    manualSource: 'manual_override',
    progressionManuallySet: true,
    level: 40,
    ascension: 3,
    mindscape: 2,
    skillLevels: { basic: 8, dodge: 8, assist: 8, special: 8, chain: 8, core: 4 },
    wEngineDetails: { id: 'manual-engine', name: '手动音擎意图', level: 40, refinement: 3 },
  })
  record.updatedAt = record.roster.updatedAt = '2026-10-08T00:00:00.000Z'
  await database.accountRosters.put(record)
  const before = await facts()
  await showPage()
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
    target: { files: [quickFile()] },
  })
  await screen.findByRole('heading', { name: '本次读取结果' })
  expect(screen.queryByRole('region', { name: '同步手动养成' })).not.toBeInTheDocument()
  expect(screen.queryByRole('list', { name: '代理人读取预览' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('checkbox', { name: /我确认这是同一个游戏账户/ }),
  ).not.toBeInTheDocument()
  const importButton = screen.getByRole('button', { name: '导入' })
  expect(importButton).toBeEnabled()
  expect(screen.queryByRole('checkbox', { name: /同时用本次读取值/ })).not.toBeInTheDocument()
  expect(await facts()).toEqual(before)
  fireEvent.click(importButton)
  fireEvent.click(importButton)
  await screen.findByRole('heading', { name: '导入完成' })
  const imported = (await database.accountRosters.get(accountId))!.roster.agents.find(
    (row) => row.agentId === 'agent-koleda',
  )!
  expect(imported).toMatchObject({
    level: 60,
    ascension: 5,
    mindscape: 0,
    skillLevels: { basic: 11, dodge: 11, assist: 11, special: 11, chain: 11, core: 7 },
    wEngineDetails: { id: 'wengine-14110', name: '燃狱齿轮', level: 60, refinement: 1 },
    manualSource: 'manual_override',
    progressionManuallySet: true,
  })
  expect(imported.observedFacts?.fields['skillLevels.core']).toBeDefined()
  expect(await database.accountDriveDiscs.where('accountId').equals(accountId).count()).toBe(1)
  expect(
    await database.accountPreferences
      .where('accountId')
      .equals(accountId)
      .filter((row) => row.key.startsWith('asset-quick-read-recovery-'))
      .count(),
  ).toBe(1)
  expect(bridge.start).not.toHaveBeenCalled()
  expect(commands.startScan).not.toHaveBeenCalled()
})

it.each(['none', 'optional-agent', 'disc-identity'] as const)(
  'can abandon a quick file candidate (%s) without writes and unlock both acquisition paths',
  async (issue) => {
    const before = await facts()
    await showPage()
    const snapshot = syntheticWorkbenchQuickSnapshot()
    if (issue === 'optional-agent') snapshot.assets.agents[0].catalog_id.value = 999999
    if (issue === 'disc-identity') snapshot.assets.discs[0].catalog_id.value = 99941
    fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
      target: { files: [quickFile(snapshot)] },
    })
    await screen.findByRole('heading', { name: '本次读取结果' })
    if (issue === 'disc-identity') {
      expect(screen.getByText(/暂时不能导入 · \d+ 项需核对/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
    } else {
      expect(screen.getByRole('button', { name: '导入' })).toBeEnabled()
    }
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '放弃' })))
    expect(screen.queryByRole('region', { name: '本次任务' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '开始扫描' })).toBeEnabled())
    expect(screen.getByLabelText('选择本机文件（JSON）')).toBeEnabled()
    expect(await facts()).toEqual(before)
    fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
      target: { files: [quickFile()] },
    })
    await screen.findByRole('heading', { name: '本次读取结果' })
    expect(screen.getByRole('button', { name: '导入' })).toBeEnabled()
    expect(await facts()).toEqual(before)
    assertFocusedWorkspace()
  },
)

it('keeps a production recovery blocker in its modal and preserves real persisted assets and plans', async () => {
  await showPage()
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), {
    target: { files: [quickFile()] },
  })
  await screen.findByRole('heading', { name: '本次读取结果' })
  fireEvent.click(screen.getByRole('button', { name: '导入' }))
  await screen.findByRole('heading', { name: '导入完成' })
  const disc = (await database.accountDriveDiscs.toArray())[0]!
  const saved = await saveAccountPlanningDraft(disc.accountId, {
    kind: 'agent',
    name: '合成恢复保护方案',
    selection: { agentIds: ['agent-koleda'], bangbooId: null, scenario: '合成规划' },
    manualOverrides: {
      wEngineDirection: '',
      discDirection: '',
      progressionDirection: '',
      notes: '',
    },
    knowledgeRefs: [],
    warehouseRefs: [disc.id],
    comparisonCapability: 'direction',
  })
  const before = await facts()
  const preferences = await database.accountPreferences.toArray()
  fireEvent.click(screen.getByRole('button', { name: '撤销本次导入' }))
  const dialog = screen.getByRole('dialog', { name: '撤销这次资产快读导入？' })
  fireEvent.click(within(dialog).getByRole('button', { name: '确认撤销导入' }))
  await waitFor(() =>
    expect(within(dialog).getByRole('alert')).toHaveTextContent('合成恢复保护方案'),
  )
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(within(dialog).getByRole('alert')).not.toHaveTextContent(saved.id)
  expect(await facts()).toEqual(before)
  expect(await database.accountPlanningDrafts.toArray()).toEqual([saved])
  expect(await database.accountPreferences.toArray()).toEqual(preferences)
  fireEvent.click(within(dialog).getByRole('button', { name: '取消撤销' }))
  expect(screen.queryByRole('dialog', { name: '撤销这次资产快读导入？' })).not.toBeInTheDocument()
  expect(screen.queryByText(/合成恢复保护方案/)).not.toBeInTheDocument()
})
