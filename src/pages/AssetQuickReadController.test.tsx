import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  persistence,
  converted,
  targetAccountId,
  jobId,
  job,
  health,
  bridge,
  prepareStart,
  startAndReceive,
  type BridgeHealth,
} from './assetQuickReadControllerTestFixture'
import {
  AssetQuickReadController,
  type AssetQuickReadWorkbenchView,
} from './AssetQuickReadController'
import type { AssetBridgeJob } from '../assetQuickRead/bridgeClient'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))

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
    if (workbench) {
      expect(screen.queryByText(/恢复副本保留，不能直接覆盖/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
    } else {
      expect(screen.getByText(/恢复副本保留，不能直接覆盖/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeDisabled()
    }
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

it('shows a named recovery blocker inside the current confirmation and permits retry after adjustment', async () => {
  const harness = workbenchHarness()
  const refresh = vi.fn()
  render(
    <AssetQuickReadController
      client={bridge()}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      onImported={refresh}
      targetAccountName="合成账户"
      workbench={harness.render}
    />,
  )
  await startAndReceive()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导入' })))
  const reason =
    '规划“合成周末队”引用了本次恢复将移除或回滚属性的驱动盘。请先调整这些规划的用盘，再尝试恢复；当前资产、规划和恢复副本均保留。'
  persistence.restore.mockRejectedValueOnce(new Error(reason))
  fireEvent.click(screen.getByRole('button', { name: '恢复本次导入' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '确认恢复到导入前' })))
  const confirmation = screen
    .getByRole('button', { name: '确认恢复到导入前' })
    .closest('div')!.parentElement!
  expect(confirmation).toBe(screen.getByRole('dialog', { name: '恢复到本次导入前？' }))
  expect(within(confirmation).getByRole('alert')).toHaveTextContent(reason)
  expect(screen.getAllByText(reason)).toHaveLength(1)
  expect(screen.getByTestId('task')).toContainElement(confirmation)
  expect(screen.getByTestId('recovery')).toBeEmptyDOMElement()
  expect(screen.getByRole('button', { name: '确认恢复到导入前' })).toBeEnabled()
  expect(refresh).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '取消恢复' }))
  expect(screen.queryByText(reason)).not.toBeInTheDocument()
  expect(persistence.restore).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '恢复本次导入' }))
  expect(screen.queryByText(reason)).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '确认恢复到导入前' })))
  expect(persistence.restore).toHaveBeenCalledTimes(2)
  expect(refresh).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('button', { name: '确认恢复到导入前' })).not.toBeInTheDocument()
})

it('ignores a late recovery failure after changing the receiving account', async () => {
  const harness = workbenchHarness()
  const client = bridge()
  const props = {
    client,
    targetAccountId,
    activeAccountId: targetAccountId,
    targetAccountName: '合成账户',
    workbench: harness.render,
  }
  const view = render(<AssetQuickReadController {...props} />)
  await startAndReceive()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导入' })))
  let reject!: (failure: Error) => void
  persistence.restore.mockImplementationOnce(
    () =>
      new Promise((_, rejectRestore) => {
        reject = rejectRestore
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '恢复本次导入' }))
  fireEvent.click(screen.getByRole('button', { name: '确认恢复到导入前' }))
  expect(screen.getByRole('button', { name: '恢复中…' })).toBeDisabled()
  view.rerender(
    <AssetQuickReadController
      {...props}
      targetAccountId="other-account"
      activeAccountId="other-account"
    />,
  )
  await act(async () => reject(new Error('规划“上一账户合成队”阻止恢复。')))
  expect(screen.queryByText(/上一账户合成队/)).not.toBeInTheDocument()
  expect(screen.getByTestId('task')).toBeEmptyDOMElement()
  expect(screen.getByTestId('recovery')).toBeEmptyDOMElement()
})

it('keeps failed planning read-only and ignores a late plan after the account changes', async () => {
  const props = {
    client: bridge(),
    targetAccountId,
    activeAccountId: targetAccountId,
    targetAccountName: '合成账户',
  }
  persistence.prepare.mockRejectedValueOnce(
    new Error('本次读取早于代理人后续手动修改，请重新读取，未写入账户。'),
  )
  const view = render(<AssetQuickReadController {...props} />)
  await startAndReceive()
  expect(screen.getByText(/本次读取早于代理人后续手动修改/)).toBeVisible()
  expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
  expect(persistence.confirm).not.toHaveBeenCalled()
  view.rerender(
    <AssetQuickReadController
      {...props}
      targetAccountId="account-other"
      activeAccountId="account-other"
    />,
  )
  expect(screen.queryByRole('heading', { name: '本次读取结果' })).not.toBeInTheDocument()
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(persistence.restore).not.toHaveBeenCalled()
})

it('reports connection in flight as busy without making it a task, and historical recovery stays internal without a workspace entry', async () => {
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
  expect(harness.read().recovery).toBeNull()
  expect(screen.getByTestId('recovery')).toBeEmptyDOMElement()
  expect(screen.queryByText('上次导入')).not.toBeInTheDocument()
  expect(screen.queryByText(/已保存 .*资产快读导入恢复副本/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
  expect(harness.read().hasTask).toBe(false)
  act(() => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  expect(harness.read().busy).toBe(true)
  expect(harness.read().hasTask).toBe(false)
  expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
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
  rendered.rerender(<AssetQuickReadController {...props} blocked />)
  expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
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
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
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
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /^(开始本次资产快读|开始读取)$/ })),
  )
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

it('abandons only the candidate while retaining connected tools and internal historical recovery without displaying it', async () => {
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
  expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '放弃' })))
  expect(harness.read().state).toBe('idle')
  expect(harness.read().hasTask).toBe(false)
  expect(harness.read().busy).toBe(false)
  expect(screen.getByLabelText('游戏安装目录')).toHaveValue("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18")
  expect(screen.getByRole('button', { name: '一键读取' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '一键读取' }))
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始读取' })).toBeDisabled()
  expect(persistence.confirm).not.toHaveBeenCalled()
  expect(persistence.readRecovery).toHaveBeenCalledWith(targetAccountId)
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

it('prepares a second completed read without reconnecting, starting or importing until confirmed', async () => {
  const client = bridge()
  client.connect.mockResolvedValue({ ...health, version: '1.0.2' })
  const harness = workbenchHarness()
  const refresh = vi.fn()
  render(
    <AssetQuickReadController
      client={client}
      targetAccountId={targetAccountId}
      activeAccountId={targetAccountId}
      targetAccountName="合成账户"
      workbench={harness.render}
      onImported={refresh}
    />,
  )
  await startAndReceive()
  const firstImport = screen.getByRole('button', { name: '导入' })
  await act(async () => {
    fireEvent.click(firstImport)
    fireEvent.click(firstImport)
  })
  expect(persistence.confirm).toHaveBeenCalledOnce()
  persistence.readRecovery.mockResolvedValue({
    recoveryKey: 'synthetic-recovery',
    createdAt: '2026-10-10T00:00:00Z',
    canRestore: true,
  })
  const restart = screen.getByRole('button', { name: '重新读取' })
  await act(async () => {
    fireEvent.click(restart)
    fireEvent.click(restart)
  })
  expect(harness.read().state).toBe('idle')
  expect(harness.read().busy).toBe(false)
  expect(harness.read().hasTask).toBe(false)
  expect(screen.getByLabelText('游戏安装目录')).toHaveValue("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18")
  expect(screen.getByRole('button', { name: '一键读取' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '更新资产快读' })).toBeVisible()
  expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
  expect(client.connect).toHaveBeenCalledOnce()
  expect(client.start).toHaveBeenCalledOnce()
  expect(client.cancel).not.toHaveBeenCalled()
  expect(persistence.confirm).toHaveBeenCalledOnce()
  expect(persistence.restore).not.toHaveBeenCalled()
  expect(refresh).toHaveBeenCalledOnce()

  fireEvent.click(screen.getByRole('button', { name: '一键读取' }))
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).not.toBeChecked()
  const secondStart = screen.getByRole('button', { name: '开始读取' })
  expect(secondStart).toBeDisabled()
  fireEvent.click(secondStart)
  expect(client.start).toHaveBeenCalledOnce()
  converted.candidate = { ...converted.candidate, snapshotSha256: 'b'.repeat(64) }
  client.result.mockResolvedValue({
    jobId,
    targetAccountId,
    snapshot: { synthetic: true },
    sha256: 'b'.repeat(64),
    capturedAt: '2026-10-10T00:01:00Z',
  })
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
  await act(async () => fireEvent.click(secondStart))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(client.start).toHaveBeenCalledTimes(2)
  expect(client.connect).toHaveBeenCalledOnce()
  expect(persistence.confirm).toHaveBeenCalledOnce()
  const secondImport = screen.getByRole('button', { name: '导入' })
  await act(async () => {
    fireEvent.click(secondImport)
    fireEvent.click(secondImport)
  })
  expect(persistence.confirm).toHaveBeenCalledTimes(2)
  expect(persistence.confirm.mock.calls[1][2].snapshotSha256).toBe('b'.repeat(64))
  expect(harness.read().state).toBe('completed')
  expect(screen.getByRole('button', { name: '恢复本次导入' })).toBeEnabled()
  expect(refresh).toHaveBeenCalledTimes(2)
})
