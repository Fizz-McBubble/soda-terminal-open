import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  AssetQuickReadController,
  type AssetQuickReadWorkbenchView,
} from './AssetQuickReadController'
import type { AssetBridgeJob, AssetQuickReadBridgeClient } from '../assetQuickRead/bridgeClient'
import type { AssetQuickReadCandidate } from '../assetQuickRead/snapshotAdapter'

const persistence = vi.hoisted(() => ({
  prepare: vi.fn(),
  confirm: vi.fn(),
  restore: vi.fn(),
  readRecovery: vi.fn(),
  activate: vi.fn(),
}))
vi.mock('../assetQuickRead/accountImport', () => ({
  prepareAssetQuickReadImport: persistence.prepare,
  confirmAssetQuickReadImport: persistence.confirm,
  restoreAssetQuickReadImport: persistence.restore,
  readLatestAssetQuickReadRecovery: persistence.readRecovery,
}))
vi.mock('../accounts/publicScannerAccountCreation', () => ({
  setPublicScannerActiveAccount: persistence.activate,
}))
const converted = vi.hoisted(() => ({ candidate: null as unknown as AssetQuickReadCandidate }))
vi.mock('../assetQuickRead/snapshotAdapter', () => ({
  convertAssetSnapshot: () => converted.candidate,
  assetSnapshotSchema: { parse: (raw: unknown) => raw },
}))
const targetAccountId = 'account-synthetic'
const jobId = '1e80b26d-39fa-41a5-afbf-fca374acb6ee'
const job: AssetBridgeJob = {
  jobId,
  targetAccountId,
  state: 'starting',
  phase: 'awaiting_elevation',
  code: null,
  startedAt: '2026-10-10T00:00:00Z',
  readyAt: null,
  deadline: null,
  remainingSeconds: null,
  counts: { discs: 0, engines: 0, agents: 0 },
  candidateAvailable: false,
}
type BridgeHealth = Awaited<ReturnType<AssetQuickReadBridgeClient['connect']>>
const health: BridgeHealth = {
  service: 'soda-asset-quick-read',
  version: '1.0.0',
  protocolVersion: 1,
  capabilities: ['asset_snapshot', 'explicit_uac_start', 'cancel'],
  state: 'idle',
}
function bridge() {
  return {
    connect: vi.fn<AssetQuickReadBridgeClient['connect']>().mockResolvedValue(health),
    start: vi.fn().mockResolvedValue(job),
    status: vi.fn().mockResolvedValue({ ...job, state: 'received', candidateAvailable: true }),
    cancel: vi.fn().mockResolvedValue({ ...job, state: 'stopped' }),
    result: vi.fn().mockResolvedValue({
      jobId,
      targetAccountId,
      snapshot: { synthetic: true },
      sha256: 'a'.repeat(64),
      capturedAt: '2026-10-10T00:00:00Z',
    }),
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  converted.candidate = {
    protocolVersion: '3.2',
    capturedAt: '2026-10-10T00:00:00Z',
    snapshotSha256: 'a'.repeat(64),
    discs: {
      format: 'soda-terminal-drive-disc-import',
      formatVersion: 1,
      source: { adapter: 'asset-quick-read' },
      batch: {},
      discs: [],
    },
    agents: [
      {
        agentId: 'agent-nicole',
        name: '妮可',
        fields: { level: 60, mindscape: 0 },
        observedFields: ['level', 'mindscape'],
        equippedSourceIds: [],
      },
    ],
    counts: { discs: 0, sDiscs: 0, engines: 0, agents: 1, importableAgents: 1 },
    issues: [],
    importable: true,
    fullInventoryVerified: false,
  }
  persistence.prepare.mockResolvedValue({
    accountId: targetAccountId,
    importable: true,
    summary: {
      observedDiscs: 0,
      newDiscs: 0,
      updatedDiscs: 0,
      retainedDiscs: 0,
      observedAgents: 1,
      protectedFields: 0,
      inferredDiscLinks: 0,
    },
  })
  persistence.confirm.mockResolvedValue({
    observedAgents: 1,
    observedDiscs: 0,
    totalDiscs: 0,
    recoveryKey: 'synthetic-recovery',
  })
  persistence.restore.mockResolvedValue({ restoredDiscs: 0 })
  persistence.readRecovery.mockResolvedValue(null)
})
afterEach(() => {
  vi.useRealTimers()
})

async function prepareStart() {
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:24d5780e541a1a1ad1393e8962be6e18" },
  })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  fireEvent.click(screen.getByRole('button', { name: /准备资产快读|开始读取/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
}
async function startAndReceive() {
  await prepareStart()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' })))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
}

it('uses the independent bridge and reviews early success without any account mutation', async () => {
  const client = bridge()
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  expect(client.connect).not.toHaveBeenCalled()
  await startAndReceive()
  expect(screen.getByRole('status')).toHaveTextContent('已收到数据，待核对')
  expect(client.result).toHaveBeenCalledOnce()
  expect(persistence.prepare).toHaveBeenCalledWith(targetAccountId, converted.candidate)
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(persistence.activate).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '确认导入本次资产快读结果' })).toBeDisabled()
  await act(async () => vi.advanceTimersByTimeAsync(180000))
  expect(client.status).toHaveBeenCalledOnce()
})

it('imports only after a separate account and count confirmation and offers guarded recovery', async () => {
  const client = bridge()
  const refresh = vi.fn()
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
      onImported={refresh}
    />,
  )
  await startAndReceive()
  fireEvent.click(screen.getByRole('checkbox', { name: /我确认这是同一个游戏账户/ }))
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '确认导入本次资产快读结果' })),
  )
  expect(persistence.confirm).toHaveBeenCalledOnce()
  expect(persistence.confirm.mock.calls[0][2]).toEqual({
    accountId: targetAccountId,
    snapshotSha256: 'a'.repeat(64),
    sameGameAccountAndCounts: true,
  })
  expect(screen.getByRole('status')).toHaveTextContent('本机')
  fireEvent.click(screen.getByRole('button', { name: '恢复本次导入' }))
  expect(persistence.restore).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '确认恢复到导入前' })))
  expect(persistence.restore).toHaveBeenCalledWith(
    targetAccountId,
    'synthetic-recovery',
    'restore_asset_quick_read',
  )
  expect(refresh).toHaveBeenCalledTimes(2)
})

it('cancels a late start response after the selected account changes', async () => {
  const client = bridge()
  let resolveStart!: (value: AssetBridgeJob) => void
  client.start.mockImplementation(
    () =>
      new Promise<AssetBridgeJob>((resolve) => {
        resolveStart = resolve
      }),
  )
  const { rerender } = render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  await prepareStart()
  act(() => fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' })))
  rerender(
    <AssetQuickReadController
      client={client}
      targetAccountId="account-other"
      activeAccountId="account-other"
      targetAccountName="另一个合成账户"
    />,
  )
  await act(async () => resolveStart(job))
  expect(client.cancel).toHaveBeenCalledWith(jobId)
  expect(persistence.prepare).not.toHaveBeenCalled()
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('尚未接通')
})

it('stops during reading and ignores a result already in flight', async () => {
  const client = bridge()
  let resolveResult!: (value: unknown) => void
  client.result.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveResult = resolve
      }),
  )
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  await prepareStart()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' })))
  await act(async () => {
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
  })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '停止本次资产快读' })))
  await act(async () =>
    resolveResult({ jobId, targetAccountId, snapshot: {}, sha256: 'a'.repeat(64) }),
  )
  expect(screen.getByRole('status')).toHaveTextContent('已停止')
  expect(persistence.prepare).not.toHaveBeenCalled()
  expect(persistence.confirm).not.toHaveBeenCalled()
})

it('rejects a different job or account result before any candidate adoption', async () => {
  const client = bridge()
  client.result.mockResolvedValue({
    jobId,
    targetAccountId: 'account-other',
    snapshot: {},
    sha256: 'a'.repeat(64),
  })
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  await startAndReceive()
  expect(screen.getByRole('status')).toHaveTextContent('未采用结果')
  expect(persistence.prepare).not.toHaveBeenCalled()
  expect(persistence.confirm).not.toHaveBeenCalled()
})

it('disarms failed imports and rechecks without retrying writes', async () => {
  const client = bridge()
  persistence.confirm.mockRejectedValueOnce(new Error('账户在检查后发生了变化'))
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  await startAndReceive()
  fireEvent.click(screen.getByRole('checkbox', { name: /我确认这是同一个游戏账户/ }))
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '确认导入本次资产快读结果' })),
  )
  expect(persistence.confirm).toHaveBeenCalledOnce()
  expect(persistence.prepare).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: '确认导入本次资产快读结果' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('账户在检查后发生了变化')
})

it('keeps cancellation available when transport and automatic cancellation both fail', async () => {
  const client = bridge()
  client.status.mockRejectedValueOnce(new Error('连接中断'))
  client.cancel.mockRejectedValueOnce(new Error('停止请求连接中断'))
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  await startAndReceive()
  expect(screen.getByRole('button', { name: '重新连接资产快读' })).toBeDisabled()
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '尝试停止本次资产快读' })),
  )
  expect(client.cancel).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('status')).toHaveTextContent('已停止')
  expect(persistence.prepare).not.toHaveBeenCalled()
  expect(persistence.confirm).not.toHaveBeenCalled()
})

it('offers persisted recovery after remounting without pairing, capture or automatic restore', async () => {
  persistence.readRecovery.mockResolvedValue({
    recoveryKey: 'saved-recovery',
    createdAt: '2026-10-10T00:00:00Z',
    canRestore: true,
  })
  const client = bridge()
  await act(async () =>
    render(
      <AssetQuickReadController
        client={client}
        targetAccountId={targetAccountId}
        activeAccountId={targetAccountId}
        targetAccountName="合成账户"
      />,
    ),
  )
  expect(persistence.readRecovery).toHaveBeenCalledWith(targetAccountId)
  expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '恢复上次资产快读导入' }))
  expect(screen.getByRole('button', { name: '确认恢复到导入前' })).toBeEnabled()
  expect(persistence.restore).not.toHaveBeenCalled()
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(client.connect).not.toHaveBeenCalled()
  expect(client.start).not.toHaveBeenCalled()
})

it('shows the retained receipt but disables undo when later account changes are detected', async () => {
  persistence.readRecovery.mockResolvedValue({
    recoveryKey: 'saved-recovery',
    createdAt: '2026-10-10T00:00:00Z',
    canRestore: false,
    unavailableReason: '导入后账户已有其他修改，恢复副本保留，不能直接覆盖。',
  })
  await act(async () =>
    render(
      <AssetQuickReadController
        client={bridge()}
        targetAccountId={targetAccountId}
        activeAccountId={targetAccountId}
        targetAccountName="合成账户"
      />,
    ),
  )
  expect(screen.getByText(/恢复副本保留，不能直接覆盖/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeDisabled()
  expect(persistence.restore).not.toHaveBeenCalled()
})

it('ignores a saved-recovery lookup arriving after the selected account changes', async () => {
  let resolveSaved!: (value: unknown) => void
  persistence.readRecovery.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSaved = resolve
      }),
  )
  const client = bridge()
  const view = render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
    />,
  )
  view.rerender(
    <AssetQuickReadController
      client={client}
      targetAccountId="account-other"
      activeAccountId="account-other"
      targetAccountName="另一个合成账户"
    />,
  )
  await act(async () =>
    resolveSaved({
      recoveryKey: 'old-account-recovery',
      createdAt: '2026-10-10T00:00:00Z',
      canRestore: true,
    }),
  )
  expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
  expect(persistence.restore).not.toHaveBeenCalled()
})

function workbenchHarness() {
  let latest!: AssetQuickReadWorkbenchView
  return {
    read: () => latest,
    render: (view: AssetQuickReadWorkbenchView) => {
      latest = view
      return (
        <>
          <div data-testid="preparation">{view.preparation}</div>
          <div data-testid="task">{view.task}</div>
          <div data-testid="recovery">{view.recovery}</div>
        </>
      )
    },
  }
}
function syntheticFile() {
  const file = new File(['{}'], 'synthetic.json', { type: 'application/json' })
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: async () => new TextEncoder().encode('{}').buffer,
  })
  return file
}

it('renders workbench parts without duplicate steps or file buttons and inspects a unified file offline', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  vi.stubGlobal('crypto', {
    subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) },
  })
  try {
    await act(async () =>
      render(
        <AssetQuickReadController
          client={client}
          targetAccountId={targetAccountId}
          activeAccountId={targetAccountId}
          targetAccountName="合成账户"
          workbench={harness.render}
        />,
      ),
    )
    expect(harness.read().task).toBeNull()
    expect(harness.read().hasTask).toBe(false)
    expect(screen.queryByRole('list', { name: '资产快读与导入进度' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '检查资产快读 JSON 候选' })).not.toBeInTheDocument()
    await act(async () => harness.read().inspectFile(syntheticFile()))
    expect(client.connect).not.toHaveBeenCalled()
    expect(harness.read().state).toBe('received')
    expect(harness.read().hasTask).toBe(true)
    expect(harness.read().busy).toBe(false)
    expect(screen.getByTestId('task')).toHaveTextContent('检查本次读取结果')
    expect(screen.getByText('代理人读取详情（1 位）').closest('details')).not.toHaveAttribute(
      'open',
    )
    expect(persistence.confirm).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('blocks new file, connect and import actions while keeping an owned capture stoppable', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  const props = {
    client,
    targetAccountId,
    activeAccountId: targetAccountId,
    targetAccountName: '合成账户',
    workbench: harness.render,
  }
  const rendered = render(<AssetQuickReadController {...props} blocked />)
  expect(screen.getByRole('button', { name: '连接资产快读' })).toBeDisabled()
  await act(async () => harness.read().inspectFile(syntheticFile()))
  expect(persistence.prepare).not.toHaveBeenCalled()
  rendered.rerender(<AssetQuickReadController {...props} />)
  await prepareStart()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' })))
  expect(harness.read().busy).toBe(true)
  rendered.rerender(<AssetQuickReadController {...props} blocked />)
  expect(screen.getByRole('button', { name: '停止本次资产快读' })).toBeEnabled()
  await act(async () => harness.read().inspectFile(syntheticFile()))
  expect(persistence.prepare).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '停止本次资产快读' })))
  expect(client.cancel).toHaveBeenCalledWith(jobId)
  expect(harness.read().state).toBe('stopped')
  expect(harness.read().busy).toBe(false)
})

it('reports connection in flight as busy without making it a task, and historical recovery stays separate', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  let finish!: () => void
  client.connect.mockImplementation(
    () =>
      new Promise<BridgeHealth>((resolve) => {
        finish = () => resolve(health)
      }),
  )
  persistence.readRecovery.mockResolvedValue({
    recoveryKey: 'saved-recovery',
    createdAt: '2026-10-10T00:00:00Z',
    canRestore: true,
  })
  await act(async () =>
    render(
      <AssetQuickReadController
        client={client}
        targetAccountId={targetAccountId}
        activeAccountId={targetAccountId}
        targetAccountName="合成账户"
        workbench={harness.render}
      />,
    ),
  )
  expect(screen.getByTestId('recovery')).toHaveTextContent('恢复上次资产快读导入')
  expect(harness.read().hasTask).toBe(false)
  act(() => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  expect(harness.read().busy).toBe(true)
  expect(harness.read().hasTask).toBe(false)
  expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeDisabled()
  await act(async () => finish())
  expect(harness.read().busy).toBe(false)
  expect(harness.read().hasTask).toBe(false)
})

it('blocks a reviewed candidate import and emits task start only for adopted new work', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  const onTaskStart = vi.fn()
  const props = {
    client,
    targetAccountId,
    activeAccountId: targetAccountId,
    targetAccountName: '合成账户',
    workbench: harness.render,
    onTaskStart,
  }
  const rendered = render(<AssetQuickReadController {...props} />)
  await startAndReceive()
  expect(onTaskStart).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('checkbox', { name: /我确认这是同一个游戏账户/ }))
  rendered.rerender(<AssetQuickReadController {...props} blocked />)
  expect(screen.getByRole('button', { name: '确认导入本次资产快读结果' })).toBeDisabled()
  await act(async () => harness.read().inspectFile(syntheticFile()))
  expect(onTaskStart).toHaveBeenCalledOnce()
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(harness.read().state).toBe('received')
})

it('locks file inspection in flight and ignores its late account-bound response', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  const onTaskStart = vi.fn()
  let finish!: (bytes: ArrayBuffer) => void
  const file = syntheticFile()
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        finish = resolve
      }),
  })
  vi.stubGlobal('crypto', {
    subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) },
  })
  try {
    const props = {
      client,
      targetAccountId,
      activeAccountId: targetAccountId,
      targetAccountName: '合成账户',
      workbench: harness.render,
      onTaskStart,
    }
    const rendered = render(<AssetQuickReadController {...props} />)
    let pending!: Promise<void>
    act(() => {
      pending = harness.read().inspectFile(file)
    })
    expect(harness.read().busy).toBe(true)
    expect(harness.read().hasTask).toBe(true)
    await act(async () => harness.read().inspectFile(syntheticFile()))
    expect(onTaskStart).toHaveBeenCalledOnce()
    rendered.rerender(
      <AssetQuickReadController
        {...props}
        targetAccountId="account-other"
        activeAccountId="account-other"
      />,
    )
    await act(async () => {
      finish(new TextEncoder().encode('{}').buffer)
      await pending
    })
    expect(harness.read().state).toBe('idle')
    expect(harness.read().hasTask).toBe(false)
    expect(persistence.prepare).not.toHaveBeenCalled()
    expect(persistence.confirm).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('ignores a pending stop response after the stable workbench changes account binding', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  let finish!: (value: AssetBridgeJob) => void
  client.cancel.mockImplementationOnce(
    () =>
      new Promise<AssetBridgeJob>((resolve) => {
        finish = resolve
      }),
  )
  const props = {
    client,
    targetAccountId,
    activeAccountId: targetAccountId,
    targetAccountName: '合成账户',
    workbench: harness.render,
  }
  const rendered = render(<AssetQuickReadController {...props} />)
  await prepareStart()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' })))
  act(() => fireEvent.click(screen.getByRole('button', { name: '停止本次资产快读' })))
  rendered.rerender(
    <AssetQuickReadController
      {...props}
      targetAccountId="account-other"
      activeAccountId="account-other"
    />,
  )
  await act(async () => finish({ ...job, state: 'stopped' }))
  expect(harness.read().state).toBe('idle')
  expect(harness.read().hasTask).toBe(false)
  expect(harness.read().busy).toBe(false)
  expect(persistence.prepare).not.toHaveBeenCalled()
})

it('abandons only the candidate while retaining connected tools and discovered historical recovery', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  persistence.readRecovery.mockResolvedValue({
    recoveryKey: 'saved-recovery',
    createdAt: '2026-10-10T00:00:00Z',
    canRestore: true,
  })
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
      workbench={harness.render}
    />,
  )
  await startAndReceive()
  await act(async () => Promise.resolve())
  expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeEnabled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '放弃本次结果' })))
  expect(harness.read().state).toBe('idle')
  expect(harness.read().hasTask).toBe(false)
  expect(harness.read().busy).toBe(false)
  expect(screen.getByLabelText('游戏安装目录')).toHaveValue("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18")
  expect(screen.getByRole('button', { name: '开始读取' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: /准备资产快读|开始读取/ }))
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次资产快读' })).toBeDisabled()
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(persistence.restore).not.toHaveBeenCalled()
})

it('connects an installed tool on explicit click without an account or game directory and aborts an old binding', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  let finish!: (value: BridgeHealth) => void
  client.connect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { rerender } = render(
    <AssetQuickReadController client={client} workbench={harness.render} />,
  )
  expect(screen.getByRole('button', { name: '连接资产快读' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '连接资产快读' }))
  expect(client.connect).toHaveBeenCalledOnce()
  const input = client.connect.mock.calls[0]?.[0]
  if (!input?.signal) throw new Error('Expected cancellable connection options')
  expect(input.launchIfMissing).toBe(true)
  expect(input.signal.aborted).toBe(false)
  expect(harness.read().busy).toBe(true)
  expect(client.start).not.toHaveBeenCalled()
  rerender(
    <AssetQuickReadController
      client={client}
      workbench={harness.render}
      targetAccountId="account-other"
    />,
  )
  expect(input.signal.aborted).toBe(true)
  await act(async () => finish(health))
  expect(screen.getByRole('button', { name: '连接资产快读' })).toBeEnabled()
  expect(harness.read().busy).toBe(false)
  expect(persistence.confirm).not.toHaveBeenCalled()
})
