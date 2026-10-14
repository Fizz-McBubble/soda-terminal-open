import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssetQuickReadEntry } from './AssetQuickReadEntry'
import { registerAssetQuickReadEntryPreparationCases } from './AssetQuickReadEntry.testCases'
import { preview } from './assetQuickReadEntryTestFixture'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))

it('keeps blocked import disabled while preserving every issue in a collapsed disclosure', () => {
  const issues = ['词条需要核对', '词条需要核对', '代理人数需要核对']
  const onImport = vi.fn()
  render(
    <AssetQuickReadEntry
      capability="ready"
      state="received"
      preview={{ ...preview, issues }}
      canImport={false}
      onImport={onImport}
    />,
  )
  const summary = screen.getByText('暂时不能导入 · 3 项需核对')
  const details = summary.closest('details')!
  expect(details).not.toHaveAttribute('open')
  expect(details.querySelectorAll('li')).toHaveLength(3)
  expect(Array.from(details.querySelectorAll('li'), (item) => item.textContent)).toEqual(issues)
  details.open = true
  expect(screen.getAllByText('词条需要核对')[0]).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '导入' }))
  expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
  expect(onImport).not.toHaveBeenCalled()
})

function openDisclosure() {
  fireEvent.click(screen.getByRole('button', { name: /准备资产快读|开始读取/ }))
}

it('keeps failure details collapsed while the existing retry and return actions remain available', () => {
  const restart = vi.fn()
  render(
    <AssetQuickReadEntry
      state="error"
      capability="ready"
      errorMessage="合成启动失败细项"
      targetAccountId="synthetic"
      targetAccountName="合成账户"
      onPrepareAgain={restart}
      onStart={vi.fn()}
      workbenchExtras={() => <div />}
      renderParts={({ preparation, task }) => (
        <>
          {preparation}
          {task}
        </>
      )}
    />,
  )
  const details = screen.getByText('读取未完成 · 可重试').closest('details')!
  expect(details).not.toHaveAttribute('open')
  expect(details).toHaveTextContent('合成启动失败细项')
  expect(screen.getByRole('button', { name: '一键读取' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '返回' }))
  expect(restart).toHaveBeenCalledOnce()
})

it('defaults to unavailable without starting any tool', () => {
  const onStart = vi.fn()
  render(<AssetQuickReadEntry onStart={onStart} />)
  expect(screen.getByRole('status')).toHaveTextContent('资产快读尚未接通')
  expect(screen.getByRole('button', { name: /准备资产快读|开始读取/ })).toBeEnabled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  openDisclosure()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次资产快读' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' }))
  expect(onStart).not.toHaveBeenCalled()
})

it('requires a fresh active risk acknowledgement before starting', async () => {
  const onStart = vi.fn()
  render(<AssetQuickReadEntry capability="ready" onStart={onStart} />)
  openDisclosure()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  const start = screen.getByRole('button', { name: '开始本次资产快读' })
  expect(start).toBeDisabled()
  fireEvent.click(start)
  expect(onStart).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => fireEvent.click(start))
  expect(onStart).toHaveBeenCalledOnce()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

it('presents received data immediately from the adapter, without waiting for a deadline', () => {
  const onStart = vi.fn()
  const { rerender } = render(
    <AssetQuickReadEntry capability="ready" state="capturing" onStart={onStart} />,
  )
  expect(screen.getByRole('status')).toHaveTextContent('最长等待 3 分钟')
  expect(screen.queryByText(/不必等满/)).not.toBeInTheDocument()
  rerender(<AssetQuickReadEntry capability="ready" state="received" onStart={onStart} />)
  expect(screen.getByRole('status')).toHaveTextContent('已收到数据，尚未导入当前账户')
  expect(screen.getByRole('status')).not.toHaveTextContent('核对')
  expect(screen.getByRole('status')).not.toHaveTextContent('最长等待')
  expect(onStart).not.toHaveBeenCalled()
})

it('prevents repeated starts while a request is pending or capture is running', async () => {
  let resolve!: () => void
  const onStart = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done
      }),
  )
  const { rerender } = render(<AssetQuickReadEntry capability="ready" onStart={onStart} />)
  openDisclosure()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' }))
  fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' }))
  expect(onStart).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '开始本次资产快读' })).toBeDisabled()
  rerender(<AssetQuickReadEntry capability="ready" state="capturing" onStart={onStart} />)
  await act(async () => resolve())
  expect(screen.getByRole('button', { name: '开始本次资产快读' })).toBeDisabled()
  expect(screen.getByRole('checkbox')).toBeDisabled()
})

it('closing clears acknowledgement and never requests capture', () => {
  const onStart = vi.fn()
  const onClose = vi.fn()
  render(<AssetQuickReadEntry capability="ready" onStart={onStart} onClose={onClose} />)
  openDisclosure()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '关闭风险告知' }))
  expect(onClose).toHaveBeenCalledOnce()
  expect(onStart).not.toHaveBeenCalled()
  openDisclosure()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

it('releases pending after a rejected start and requires a fresh acknowledgement to retry', async () => {
  let reject!: (reason: Error) => void
  const onStart = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail
        }),
    )
    .mockResolvedValueOnce(undefined)
  render(<AssetQuickReadEntry capability="ready" onStart={onStart} />)
  openDisclosure()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' }))
  expect(screen.getByRole('checkbox')).toBeDisabled()
  await act(async () => reject(new Error('tool unavailable')))
  expect(screen.getByRole('status')).toHaveTextContent('启动请求未完成')
  expect(screen.getByRole('status')).not.toHaveTextContent('正在提交')
  expect(screen.getByRole('checkbox')).toBeEnabled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次资产快读' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' })))
  expect(onStart).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('status')).not.toHaveTextContent('启动请求未完成')
})

it('continuing scanning and stopping use only their explicit callbacks', () => {
  const onStart = vi.fn()
  const onContinueScanning = vi.fn()
  const onStop = vi.fn()
  const { rerender } = render(
    <AssetQuickReadEntry
      capability="ready"
      onStart={onStart}
      onContinueScanning={onContinueScanning}
      onStop={onStop}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '改用画面扫描' }))
  expect(onContinueScanning).toHaveBeenCalledOnce()
  expect(onStart).not.toHaveBeenCalled()
  rerender(
    <AssetQuickReadEntry capability="ready" state="capturing" onStart={onStart} onStop={onStop} />,
  )
  fireEvent.click(screen.getByRole('button', { name: '停止本次资产快读' }))
  expect(onStop).toHaveBeenCalledOnce()
  expect(onStart).not.toHaveBeenCalled()
})

it('connection is a guarded probe and never grants readiness or starts capture itself', async () => {
  let resolve!: () => void
  const onConnect = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done
      }),
  )
  const onStart = vi.fn()
  const onDirectoryChange = vi.fn()
  render(
    <AssetQuickReadEntry
      onConnect={onConnect}
      onStart={onStart}
      installationDirectory="soda-source-ref:6d5fa512b5fca823e3cd0d8999810676"
      onDirectoryChange={onDirectoryChange}
    />,
  )
  fireEvent.change(screen.getByRole('textbox', { name: '游戏安装目录' }), {
    target: { value: "soda-source-ref:16dfa6bd3bf689677b9ad670b46317a1" },
  })
  expect(onDirectoryChange).toHaveBeenCalledWith("soda-source-ref:16dfa6bd3bf689677b9ad670b46317a1")
  fireEvent.click(screen.getByRole('button', { name: '连接资产快读' }))
  fireEvent.click(screen.getByRole('button', { name: '正在连接资产快读' }))
  expect(onConnect).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('不请求管理员权限')
  await act(async () => resolve())
  expect(screen.getByRole('status')).toHaveTextContent('资产快读尚未接通')
  openDisclosure()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(onStart).not.toHaveBeenCalled()
})

it('uses only supplied elapsed and remaining values, and advances to checking immediately', () => {
  const { rerender } = render(
    <AssetQuickReadEntry
      capability="ready"
      state="capturing"
      elapsedSeconds={14}
      remainingSeconds={166}
    />,
  )
  expect(screen.getByText('已等待 14 秒')).toBeVisible()
  expect(screen.getByText('剩余 166 秒')).toBeVisible()
  expect(screen.getByText('读取').closest('li')).toHaveAttribute('aria-current', 'step')
  rerender(<AssetQuickReadEntry capability="ready" state="received" preview={preview} />)
  expect(screen.queryByText('剩余 166 秒')).not.toBeInTheDocument()
  expect(screen.getByText('检查').closest('li')).toHaveAttribute('aria-current', 'step')
  expect(screen.getByText('3 位')).toBeVisible()
  expect(screen.getByText('12 张')).toBeVisible()
  expect(screen.queryByText('合成代理人')).not.toBeInTheDocument()
  expect(screen.queryByText(/代理人读取详情/)).not.toBeInTheDocument()
})

it('requires a current import capability and an explicit click on the selected account', async () => {
  const onImport = vi.fn()
  const onExport = vi.fn()
  const props = {
    capability: 'ready' as const,
    state: 'received' as const,
    preview,
    targetAccountName: '同名账户',
    targetAccountId: 'account-a',
    onImport,
    onExport,
  }
  const { rerender } = render(<AssetQuickReadEntry {...props} />)
  const button = screen.getByRole('button', { name: '导入' })
  expect(button).toBeDisabled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(onImport).not.toHaveBeenCalled()
  rerender(<AssetQuickReadEntry {...props} canImport />)
  expect(button).toBeEnabled()
  expect(onImport).not.toHaveBeenCalled()
  rerender(<AssetQuickReadEntry {...props} canImport targetAccountId={undefined} />)
  expect(button).toBeDisabled()
  rerender(<AssetQuickReadEntry {...props} canImport preview={{ ...preview, snapshotId: '' }} />)
  expect(button).toBeDisabled()
  rerender(<AssetQuickReadEntry {...props} canImport={false} targetAccountId="account-b" />)
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(onImport).not.toHaveBeenCalled()
  rerender(
    <AssetQuickReadEntry
      {...props}
      canImport
      targetAccountId="account-b"
      preview={{ ...preview, snapshotId: 'synthetic-sha-b' }}
    />,
  )
  expect(button).toBeEnabled()
  await act(async () => fireEvent.click(button))
  expect(onImport).toHaveBeenCalledOnce()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导出' })))
  expect(onExport).toHaveBeenCalledOnce()
})

it('guards async import and retries a failed write only after another explicit click', async () => {
  let reject!: (reason: Error) => void
  const onImport = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail
        }),
    )
    .mockResolvedValueOnce(undefined)
  render(
    <AssetQuickReadEntry
      capability="ready"
      state="received"
      preview={preview}
      targetAccountId="account-a"
      targetAccountName="合成账户"
      canImport
      onImport={onImport}
      transactionNotice="只更新已核对的字段，保留现有人工设置。"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '导入' }))
  fireEvent.click(screen.getByRole('button', { name: '导入中…' }))
  expect(onImport).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '导入中…' })).toBeDisabled()
  await act(async () => reject(new Error('transaction rejected')))
  expect(screen.getByRole('status')).toHaveTextContent('导入请求未完成')
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '导入' })).toBeEnabled()
  expect(onImport).toHaveBeenCalledOnce()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导入' })))
  expect(onImport).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('status')).not.toHaveTextContent('导入请求未完成')
})

it('allows a valid offline candidate to be explicitly imported without connecting the capture tool', async () => {
  const onImport = vi.fn()
  const onConnect = vi.fn()
  const onStart = vi.fn()
  render(
    <AssetQuickReadEntry
      capability="unavailable"
      state="received"
      preview={preview}
      targetAccountId="offline-target"
      targetAccountName="离线核对账户"
      canImport
      onImport={onImport}
      onConnect={onConnect}
      onStart={onStart}
    />,
  )
  const button = screen.getByRole('button', { name: '导入' })
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(button).toBeEnabled()
  expect(onImport).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(button))
  expect(onImport).toHaveBeenCalledOnce()
  expect(onConnect).not.toHaveBeenCalled()
  expect(onStart).not.toHaveBeenCalled()
})

it('allows a guarded stop while the initial start request is still pending', async () => {
  let finishStart!: () => void
  let finishStop!: () => void
  const onStart = vi.fn(
    () =>
      new Promise<void>((done) => {
        finishStart = done
      }),
  )
  const onStop = vi.fn(
    () =>
      new Promise<void>((done) => {
        finishStop = done
      }),
  )
  render(<AssetQuickReadEntry capability="ready" onStart={onStart} onStop={onStop} />)
  openDisclosure()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '开始本次资产快读' }))
  fireEvent.click(screen.getByRole('button', { name: '停止本次资产快读' }))
  fireEvent.click(screen.getByRole('button', { name: '正在停止…' }))
  expect(onStop).toHaveBeenCalledOnce()
  expect(onStart).toHaveBeenCalledOnce()
  await act(async () => {
    finishStop()
    finishStart()
  })
})

it('shows completion only when the adapter reports completed and exposes offline inspection without starting capture', async () => {
  const onInspectFile = vi.fn()
  const onStart = vi.fn()
  const { rerender } = render(
    <AssetQuickReadEntry onInspectFile={onInspectFile} onStart={onStart} />,
  )
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '检查资产快读 JSON 候选' })),
  )
  expect(onInspectFile).toHaveBeenCalledOnce()
  expect(onStart).not.toHaveBeenCalled()
  rerender(
    <AssetQuickReadEntry
      state="completed"
      targetAccountName="合成账户"
      completionMessage="3 位代理人和 12 张驱动盘已更新。"
    />,
  )
  expect(screen.getByRole('heading', { name: '导入完成' })).toBeVisible()
  expect(screen.getByText('完成').closest('li')).toHaveAttribute('aria-current', 'step')
  expect(screen.getByRole('status')).toHaveTextContent('3 位代理人和 12 张驱动盘已更新')
})

it('opens risk consent only on an explicit compact read and clears it after starting', async () => {
  const onStart = vi.fn()
  render(
    <AssetQuickReadEntry
      capability="ready"
      onStart={onStart}
      renderParts={(parts) => (
        <>
          {parts.preparation}
          {parts.task}
        </>
      )}
    />,
  )
  expect(screen.getByRole('heading', { name: /资产快读.*测试版/ })).toBeVisible()
  expect(screen.getByLabelText('测试版')).toHaveTextContent('Beta')
  expect(screen.queryByRole('button', { name: '开始读取' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '开始本次资产快读' })).not.toBeInTheDocument()
  const start = screen.getByRole('button', { name: '一键读取' })
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(start).toBeEnabled()
  fireEvent.click(start)
  expect(onStart).not.toHaveBeenCalled()
  const consent = screen.getByRole('checkbox', { name: /我已阅读上述风险/ })
  expect(screen.getByRole('region', { name: '读取前确认' })).toBeVisible()
  const confirm = screen.getByRole('button', { name: '开始读取' })
  const back = screen.getByRole('button', { name: '返回' })
  expect(confirm.parentElement).toBe(back.parentElement)
  expect(confirm.parentElement).toHaveClass('asset-quick-read__actions')
  expect(confirm).toHaveClass('button--primary')
  expect(back).toHaveClass('button--quiet')
  expect(confirm).toBeDisabled()
  fireEvent.click(consent)
  await act(async () => fireEvent.click(confirm))
  expect(onStart).toHaveBeenCalledOnce()
  expect(screen.queryByRole('region', { name: '读取前确认' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '一键读取' }))
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始读取' })).toBeDisabled()
})

it('focuses received results when file inspection finishes after the candidate arrives', () => {
  const props = {
    state: 'received' as const,
    preview,
    onExport: vi.fn(),
    renderParts: ({ task }: { task: React.ReactNode }) => task,
  }
  const view = render(<AssetQuickReadEntry {...props} pendingInspection />)
  expect(screen.queryByRole('heading', { name: '本次读取结果' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('正在检查本机资产快读文件')

  view.rerender(<AssetQuickReadEntry {...props} pendingInspection={false} />)
  expect(screen.getByRole('heading', { name: '本次读取结果' })).toHaveFocus()

  const details = screen.getByRole('button', { name: '导出' })
  details.focus()
  view.rerender(
    <AssetQuickReadEntry {...props} pendingInspection={false} transactionNotice="普通状态更新" />,
  )
  expect(details).toHaveFocus()
})

it('focuses a new received candidate once without stealing focus on ordinary rerenders', () => {
  const parts = ({
    preparation,
    task,
  }: {
    preparation: React.ReactNode
    task: React.ReactNode
  }) => (
    <>
      {preparation}
      {task}
    </>
  )
  const props = {
    capability: 'ready' as const,
    targetAccountId: 'account-synthetic',
    targetAccountName: '合成账户',
    onExport: vi.fn(),
    renderParts: parts,
  }
  const view = render(<AssetQuickReadEntry {...props} state="capturing" />)
  view.rerender(<AssetQuickReadEntry {...props} state="received" preview={preview} />)
  expect(screen.getByRole('heading', { name: '本次读取结果' })).toHaveFocus()
  const details = screen.getByRole('button', { name: '导出' })
  details.focus()
  expect(details).toHaveFocus()
  view.rerender(
    <AssetQuickReadEntry
      {...props}
      state="received"
      preview={{ ...preview }}
      transactionNotice="普通状态更新"
    />,
  )
  expect(details).toHaveFocus()
  view.rerender(
    <AssetQuickReadEntry
      {...props}
      state="received"
      preview={{ ...preview, snapshotId: 'synthetic-sha-b' }}
    />,
  )
  expect(screen.getByRole('heading', { name: '本次读取结果' })).toHaveFocus()
  view.rerender(<AssetQuickReadEntry {...props} state="idle" />)
  const directory = screen.getByLabelText('游戏安装目录')
  directory.focus()
  view.rerender(<AssetQuickReadEntry {...props} state="idle" targetAccountId="account-other" />)
  expect(directory).toHaveFocus()
})

it('groups import, export and discard together while retaining discard without a preview', async () => {
  const onDiscard = vi.fn()
  const view = render(
    <AssetQuickReadEntry state="received" preview={preview} onDiscard={onDiscard} />,
  )
  const discard = screen.getByRole('button', { name: '放弃' })
  const actions = discard.closest('.asset-quick-read__actions')
  expect(actions?.parentElement).toHaveClass('asset-quick-read__result-panel')
  expect(actions).toContainElement(screen.getByRole('button', { name: '导入' }))
  expect(actions).toContainElement(screen.getByRole('button', { name: '导出' }))
  expect(screen.getAllByRole('button', { name: '放弃' })).toHaveLength(1)
  view.rerender(<AssetQuickReadEntry state="received" onDiscard={onDiscard} />)
  const noPreviewDiscard = screen.getByRole('button', { name: '放弃' })
  expect(noPreviewDiscard).toBeEnabled()
  expect(noPreviewDiscard.closest('.asset-quick-read__actions')).not.toBeNull()
  await act(async () => fireEvent.click(noPreviewDiscard))
  expect(onDiscard).toHaveBeenCalledOnce()
})

it('keeps idle preparation stable but removes unrelated controls once the inline task runs', () => {
  const props = {
    capability: 'ready' as const,
    installationDirectory: "soda-source-ref:ee09b7b910b89ca3d044849bf8cbb524",
    onDirectoryChange: vi.fn(),
    onStart: vi.fn(),
    renderParts: (parts: { preparation: React.ReactNode; task: React.ReactNode }) => (
      <>
        {parts.preparation}
        {parts.task}
      </>
    ),
  }
  const view = render(<AssetQuickReadEntry {...props} />)
  const directory = screen.getByLabelText('游戏安装目录')
  expect(directory).toBeVisible()
  expect(directory.closest('details')).toBeNull()
  directory.focus()
  view.rerender(<AssetQuickReadEntry {...props} preparationCondensed />)
  expect(screen.getByLabelText('游戏安装目录')).toBe(directory)
  expect(directory).toHaveFocus()
  view.rerender(
    <AssetQuickReadEntry {...props} preparationCondensed state="capturing" onStop={vi.fn()} />,
  )
  expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '准备游戏' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '一键读取' })).not.toBeInTheDocument()
  expect(screen.queryByText('查看本次读取任务')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '停止本次资产快读' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('资产快读已就绪')
})

it('shows only counts for sixty agents and keeps explicit import and current undo', () => {
  const onImport = vi.fn()
  const props = {
    capability: 'ready' as const,
    targetAccountId: 'account-a',
    targetAccountName: '合成账户',
    canImport: true,
    onImport,
    onExport: vi.fn(),
    onDiscard: vi.fn(),
    renderParts: ({
      preparation,
      task,
    }: {
      preparation: React.ReactNode
      task: React.ReactNode
    }) => (
      <>
        {preparation}
        {task}
      </>
    ),
  }
  const view = render(
    <AssetQuickReadEntry
      {...props}
      state="received"
      preview={{
        ...preview,
        counts: { agents: 60, discs: 12 },
        agents: Array.from({ length: 60 }, (_, i) => ({
          ...preview.agents[0]!,
          agentId: `synthetic-${i}`,
        })),
      }}
      transactionNotice="重复的长事务说明"
    />,
  )
  expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
  expect(screen.queryByText('重复的长事务说明')).not.toBeInTheDocument()
  expect(screen.getByText('60 位')).toBeVisible()
  expect(screen.getByText('12 张')).toBeVisible()
  expect(screen.queryByText('合成代理人')).not.toBeInTheDocument()
  expect(screen.queryByText(/代理人读取详情/)).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByText('潜能和最终面板未采集')).not.toBeInTheDocument()
  const importButton = screen.getByRole('button', { name: '导入' })
  expect(importButton).toBeEnabled()
  expect(screen.getByRole('button', { name: '导出' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '放弃' })).toBeEnabled()
  view.rerender(
    <AssetQuickReadEntry
      {...props}
      state="received"
      preview={preview}
      targetAccountId="account-b"
      canImport={false}
    />,
  )
  expect(importButton).toBeDisabled()
  expect(onImport).not.toHaveBeenCalled()
  view.rerender(
    <AssetQuickReadEntry
      {...props}
      state="completed"
      completionActions={<button>撤销本次导入</button>}
    />,
  )
  expect(screen.getByRole('button', { name: '撤销本次导入' })).toBeVisible()
  expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
})

it('shows completion navigation and export with visible retryable export failure outside condensed tools', async () => {
  const onViewAssets = vi.fn()
  const onExport = vi
    .fn()
    .mockRejectedValueOnce(new Error('synthetic export failed'))
    .mockResolvedValue(undefined)
  render(
    <AssetQuickReadEntry
      state="completed"
      onViewAssets={onViewAssets}
      onExport={onExport}
      renderParts={({ preparation, task }) => (
        <>
          {preparation}
          {task}
        </>
      )}
    />,
  )
  const viewAssets = screen.getByRole('button', { name: '查看我的资产' })
  const exportResult = screen.getByRole('button', { name: '导出' })
  expect(viewAssets.closest('details')).toBeNull()
  expect(exportResult.closest('details')).toBeNull()
  fireEvent.click(viewAssets)
  expect(onViewAssets).toHaveBeenCalledOnce()
  await act(async () => fireEvent.click(exportResult))
  expect(screen.getByText('导出请求未完成，请重试。')).toBeVisible()
  expect(exportResult).toBeEnabled()
  await act(async () => fireEvent.click(exportResult))
  expect(onExport).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('导出请求未完成，请重试。')).not.toBeInTheDocument()
})

registerAssetQuickReadEntryPreparationCases()
