import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
// Install the fixture's Vitest module mocks before loading the controller.
import {
  bridge,
  converted,
  job,
  jobId,
  persistence,
  prepareStart,
  startAndReceive,
  targetAccountId,
} from './assetQuickReadControllerTestFixture'
import type { AssetBridgeJob } from '../assetQuickRead/bridgeClient'
import { syntheticAssetSnapshot } from '../assetQuickRead/syntheticAssetSnapshotTestFixture'
import { AssetQuickReadController } from './AssetQuickReadController'
import { registerAssetQuickReadControllerIdentityCases } from './AssetQuickReadController.testCases'

import { syntheticFile, workbenchHarness } from './assetQuickReadControllerWorkbenchFixture'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))

it('exports a rejected manual pending snapshot without reparsing the strict import schema', async () => {
  const client = bridge()
  const harness = workbenchHarness()
  const snapshot = syntheticAssetSnapshot()
  snapshot.source.protocol_version = '3.3'
  Object.assign(snapshot, { credentials: 'private-secret' })
  client.result.mockResolvedValue({ jobId, targetAccountId, snapshot, sha256: 'a'.repeat(64) })
  converted.candidate = {
    ...converted.candidate,
    importable: false,
    issues: [{ code: 'invalid_snapshot', message: '版本不符' }],
  }
  const create = vi.fn(() => 'blob:synthetic')
  const revoke = vi.fn()
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  vi.stubGlobal('crypto', {
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
    subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) },
  })
  URL.createObjectURL = create
  URL.revokeObjectURL = revoke
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  try {
    render(
      <AssetQuickReadController
        client={client}
        targetAccountId={targetAccountId}
        activeAccountId={targetAccountId}
        workbench={harness.render}
      />,
    )
    const file = new File([JSON.stringify(snapshot)], 'pending.json', { type: 'application/json' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode(JSON.stringify(snapshot)).buffer,
    })
    await act(async () => harness.read().inspectFile(file))
    fireEvent.click(screen.getByText(/暂时不能导入/))
    expect(screen.getByText(/请等待适配更新后重新检查/)).toBeVisible()
    expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '导出' })))
    expect(create).toHaveBeenCalledOnce()
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
      'soda-asset-quick-read-pending-update.json',
    )
    expect(persistence.prepare).not.toHaveBeenCalled()
    expect(persistence.confirm).not.toHaveBeenCalled()
    expect(client.start).not.toHaveBeenCalled()
  } finally {
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    click.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('does not enable export for an unvalidated result structure', async () => {
  const client = bridge()
  client.result.mockResolvedValue({
    jobId,
    targetAccountId,
    snapshot: { raw_traffic: 'private' },
    sha256: 'a'.repeat(64),
  })
  converted.candidate = {
    ...converted.candidate,
    importable: false,
    issues: [{ code: 'invalid_snapshot', message: '结构不符' }],
  }
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
    />,
  )
  await startAndReceive()
  expect(screen.getByRole('button', { name: '导出' })).toBeDisabled()
  expect(persistence.confirm).not.toHaveBeenCalled()
})

it('shows the wait-for-update message for the native client compatibility rejection', async () => {
  const client = bridge()
  client.status.mockResolvedValue({
    ...job,
    state: 'error',
    code: 'client_dispatch_version_or_seed_shape_rejected',
  })
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
    />,
  )
  await startAndReceive()
  expect(screen.getByText(/请等待资产快读适配更新后再试/)).toBeVisible()
  expect(client.result).not.toHaveBeenCalled()
  expect(persistence.confirm).not.toHaveBeenCalled()
})

it('remembers the device directory across account changes and remounts without starting work', () => {
  const client = bridge()
  const props = { client, targetAccountId, activeAccountId: targetAccountId }
  const view = render(<AssetQuickReadController {...props} />)
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:24d5780e541a1a1ad1393e8962be6e18" },
  })
  view.rerender(
    <AssetQuickReadController
      {...props}
      targetAccountId="other-account"
      activeAccountId="other-account"
    />,
  )
  expect(screen.getByLabelText('游戏安装目录')).toHaveValue("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18")
  view.unmount()
  const reopened = render(<AssetQuickReadController {...props} />)
  expect(screen.getByLabelText('游戏安装目录')).toHaveValue("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18")
  reopened.unmount()
  expect(client.connect).not.toHaveBeenCalled()
  expect(client.start).not.toHaveBeenCalled()
  expect(persistence.confirm).not.toHaveBeenCalled()
})

it('replaces the remembered directory on edit and respects explicitly clearing it', () => {
  const client = bridge()
  const view = render(<AssetQuickReadController client={client} />)
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:24d5780e541a1a1ad1393e8962be6e18" },
  })
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:27abc6baafa1a7f0d9dc3274811b30fb" },
  })
  view.unmount()
  const reopened = render(<AssetQuickReadController client={client} />)
  expect(screen.getByLabelText('游戏安装目录')).toHaveValue("soda-source-ref:27abc6baafa1a7f0d9dc3274811b30fb")
  fireEvent.change(screen.getByLabelText('游戏安装目录'), { target: { value: '' } })
  reopened.unmount()
  render(<AssetQuickReadController client={client} />)
  expect(screen.getByLabelText('游戏安装目录')).toHaveValue('')
})

it('keeps manual directory input usable when browser storage is unavailable', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Storage unavailable', 'SecurityError')
  })
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage unavailable', 'SecurityError')
  })
  try {
    render(<AssetQuickReadController client={bridge()} />)
    expect(screen.getByLabelText('游戏安装目录')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('游戏安装目录'), {
      target: { value: "soda-source-ref:24d5780e541a1a1ad1393e8962be6e18" },
    })
    expect(screen.getByLabelText('游戏安装目录')).toHaveValue("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18")
  } finally {
    get.mockRestore()
    set.mockRestore()
  }
})

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
  expect(screen.getByRole('status')).toHaveTextContent('已收到数据，尚未导入当前账户。')
  expect(client.result).toHaveBeenCalledOnce()
  expect(persistence.prepare).toHaveBeenCalledWith(targetAccountId, converted.candidate)
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(persistence.activate).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '导入' })).toBeEnabled()
  expect(
    screen.queryByRole('checkbox', { name: /我确认这是同一个游戏账户/ }),
  ).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(180000))
  expect(client.status).toHaveBeenCalledOnce()
  expect(persistence.confirm).not.toHaveBeenCalled()
})

it('imports only after the explicit import click and offers guarded recovery', async () => {
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
  expect(persistence.confirm).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导入' })))
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
  act(() => fireEvent.click(screen.getByRole('button', { name: /^(开始本次资产快读|开始读取)$/ })))
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
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /^(开始本次资产快读|开始读取)$/ })),
  )
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

it('rechecks failed imports without retrying writes automatically', async () => {
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
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导入' })))
  expect(persistence.confirm).toHaveBeenCalledOnce()
  expect(persistence.prepare).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: '导入' })).toBeEnabled()
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

it.each([false, true])(
  'keeps a retained receipt protected from later changes (workbench=%s)',
  async (workbench) => {
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
          workbench={workbench ? workbenchHarness().render : undefined}
        />,
      ),
    )
    expect(screen.getByText(/恢复副本保留，不能直接覆盖/)).toBeVisible()
    expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeDisabled()
    expect(persistence.restore).not.toHaveBeenCalled()
  },
)

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

it('renders workbench parts without duplicate steps or file buttons and inspects a unified file offline', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  vi.stubGlobal('crypto', {
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
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
    expect(screen.getByTestId('task')).toHaveTextContent('本次读取结果')
    expect(screen.getByTestId('task')).toHaveTextContent('合成账户')
    expect(screen.getByText('1 位')).toBeVisible()
    expect(screen.getByText('0 张')).toBeVisible()
    expect(screen.queryByRole('region', { name: '代理人读取详情' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '代理人读取预览' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
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
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /^(开始本次资产快读|开始读取)$/ })),
  )
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

it('imports the observed candidate directly once without a manual synchronization choice', async () => {
  const client = bridge()
  const harness = workbenchHarness()
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
  const impact = screen.getByText(
    '导入会更新本次读到的代理人养成与驱动盘，之后仍可自行修改。导入前自动保存恢复副本；未读取的资产与盘标签保留。',
  )
  expect(impact).toBeVisible()
  expect(screen.getByTestId('task')).toContainElement(impact)
  expect(screen.queryByRole('region', { name: '同步手动养成' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: /同时用本次读取值/ })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('checkbox', { name: /我确认这是同一个游戏账户/ }),
  ).not.toBeInTheDocument()
  expect(persistence.confirm).not.toHaveBeenCalled()
  let finish!: (value: unknown) => void
  persistence.confirm.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const button = screen.getByRole('button', { name: '导入' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(persistence.confirm).toHaveBeenCalledOnce()
  expect(persistence.confirm.mock.calls[0][2]).toEqual({
    accountId: targetAccountId,
    snapshotSha256: 'a'.repeat(64),
    sameGameAccountAndCounts: true,
  })
  expect(screen.getByRole('button', { name: '导入中…' })).toBeDisabled()
  await act(async () =>
    finish({
      observedAgents: 1,
      observedDiscs: 0,
      totalDiscs: 0,
      recoveryKey: 'synthetic-recovery',
    }),
  )
  expect(screen.getByRole('heading', { name: '导入完成' })).toBeVisible()
  expect(harness.read().recovery).toBeNull()
  const restore = screen.getByRole('button', { name: '恢复本次导入' })
  expect(restore.closest('.asset-quick-read__actions')).toContainElement(
    screen.getByRole('button', { name: '导出' }),
  )
  expect(screen.getByTestId('task')).toContainElement(restore)
  fireEvent.click(restore)
  expect(persistence.restore).not.toHaveBeenCalled()
  const confirmRestore = screen.getByRole('button', { name: '确认恢复到导入前' })
  await act(async () => {
    fireEvent.click(confirmRestore)
    fireEvent.click(confirmRestore)
  })
  expect(persistence.restore).toHaveBeenCalledExactlyOnceWith(
    targetAccountId,
    'synthetic-recovery',
    'restore_asset_quick_read',
  )
})

registerAssetQuickReadControllerIdentityCases()
