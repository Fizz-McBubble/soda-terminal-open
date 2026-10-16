import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
// Keep fixture mock registration ahead of the controller's module evaluation.
import {
  bridge,
  converted,
  health,
  job,
  jobId,
  persistence,
  prepareStart,
  startAndReceive,
  targetAccountId,
  type BridgeHealth,
} from './assetQuickReadControllerTestFixture'
import type { AssetBridgeJob } from '../assetQuickRead/bridgeClient'
import { AssetQuickReadController } from './AssetQuickReadController'

import { syntheticFile, workbenchHarness } from './assetQuickReadControllerWorkbenchFixture'
export function registerAssetQuickReadControllerIdentityCases() {
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
    expect(screen.getByText(/本次读取早于代理人后续手动修改/)).not.toBeVisible()
    fireEvent.click(screen.getByText(/暂时不能导入 · 1 项需核对/))
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

  it('keeps historical recovery inside preparation and disables it during connection without making it a task', async () => {
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
    expect(screen.getByText(/已保存 .*资产快读导入恢复副本/)).toBeVisible()
    const restore = screen.getByRole('button', { name: '恢复上次资产快读导入' })
    expect(screen.getByTestId('preparation')).toContainElement(restore)
    expect(restore).toBeEnabled()
    fireEvent.click(restore)
    expect(persistence.restore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消恢复' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(persistence.restore).not.toHaveBeenCalled()
    expect(harness.read().hasTask).toBe(false)
    act(() => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
    expect(harness.read().busy).toBe(true)
    expect(harness.read().hasTask).toBe(false)
    expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeDisabled()
    await act(async () => finish())
    expect(harness.read().busy).toBe(false)
    expect(harness.read().hasTask).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '恢复上次资产快读导入' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '确认恢复到导入前' })))
    expect(persistence.restore).toHaveBeenCalledExactlyOnceWith(
      targetAccountId,
      'saved-recovery',
      'restore_asset_quick_read',
    )
  })

  it('removes a historical recovery confirmation when the selected account changes', async () => {
    const harness = workbenchHarness()
    persistence.readRecovery.mockImplementation(async (accountId: string) =>
      accountId === targetAccountId
        ? { recoveryKey: 'saved-recovery', createdAt: '2026-10-10T00:00:00Z', canRestore: true }
        : null,
    )
    const props = {
      client: bridge(),
      targetAccountId,
      activeAccountId: targetAccountId,
      workbench: harness.render,
    }
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(<AssetQuickReadController {...props} />)
    })
    fireEvent.click(screen.getByRole('button', { name: '恢复上次资产快读导入' }))
    await act(async () => {
      view.rerender(
        <AssetQuickReadController
          {...props}
          targetAccountId="other-account"
          activeAccountId="other-account"
        />,
      )
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '恢复上次资产快读导入' })).not.toBeInTheDocument()
    expect(persistence.restore).not.toHaveBeenCalled()
    expect(persistence.readRecovery).toHaveBeenLastCalledWith('other-account')
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

  it('abandons only the candidate while retaining connected tools and historical recovery in preparation', async () => {
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
    expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeEnabled()
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
    expect(screen.getByRole('button', { name: '恢复上次资产快读导入' })).toBeEnabled()
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
}
