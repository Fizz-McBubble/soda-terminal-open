import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssetQuickReadEntry, type AssetQuickReadPreview } from './AssetQuickReadEntry'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))

function openDisclosure() {
  fireEvent.click(screen.getByRole('button', { name: /查看风险并准备快读|开始读取/ }))
}

it('defaults to unavailable without starting any tool', () => {
  const onStart = vi.fn()
  render(<AssetQuickReadEntry onStart={onStart} />)
  expect(screen.getByRole('status')).toHaveTextContent('独立工具尚未接通')
  expect(screen.getByRole('button', { name: /查看风险并准备快读|开始读取/ })).toBeEnabled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  openDisclosure()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '开始本次快读' }))
  expect(onStart).not.toHaveBeenCalled()
})

it('requires a fresh active risk acknowledgement before starting', async () => {
  const onStart = vi.fn()
  render(<AssetQuickReadEntry capability="ready" onStart={onStart} />)
  openDisclosure()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  const start = screen.getByRole('button', { name: '开始本次快读' })
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
  rerender(<AssetQuickReadEntry capability="ready" state="received" onStart={onStart} />)
  expect(screen.getByRole('status')).toHaveTextContent('已收到数据，待核对')
  expect(screen.getByRole('status')).toHaveTextContent('尚未导入 Soda 账户')
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
  fireEvent.click(screen.getByRole('button', { name: '开始本次快读' }))
  fireEvent.click(screen.getByRole('button', { name: '开始本次快读' }))
  expect(onStart).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
  rerender(<AssetQuickReadEntry capability="ready" state="capturing" onStart={onStart} />)
  await act(async () => resolve())
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
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
  fireEvent.click(screen.getByRole('button', { name: '开始本次快读' }))
  expect(screen.getByRole('checkbox')).toBeDisabled()
  await act(async () => reject(new Error('tool unavailable')))
  expect(screen.getByRole('status')).toHaveTextContent('启动请求未完成')
  expect(screen.getByRole('status')).not.toHaveTextContent('正在提交')
  expect(screen.getByRole('checkbox')).toBeEnabled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次快读' })))
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
  fireEvent.click(screen.getByRole('button', { name: '继续使用扫描' }))
  expect(onContinueScanning).toHaveBeenCalledOnce()
  expect(onStart).not.toHaveBeenCalled()
  rerender(
    <AssetQuickReadEntry capability="ready" state="capturing" onStart={onStart} onStop={onStop} />,
  )
  fireEvent.click(screen.getByRole('button', { name: '停止本次快读' }))
  expect(onStop).toHaveBeenCalledOnce()
  expect(onStart).not.toHaveBeenCalled()
})

const preview: AssetQuickReadPreview = {
  snapshotId: 'synthetic-sha-a',
  counts: { agents: 3, discs: 12 },
  validSummary: ['代理人养成与 S 级驱动盘已完成候选检查'],
  issues: ['潜能和最终面板未采集'],
  agents: [
    {
      agentId: 'synthetic-agent',
      name: '合成代理人',
      level: 40,
      mindscape: 2,
      skills: '核心技 4',
      wEngine: '合成音擎 40 级',
    },
  ],
}

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
  fireEvent.click(screen.getByRole('button', { name: '连接独立工具' }))
  fireEvent.click(screen.getByRole('button', { name: '连接检查中…' }))
  expect(onConnect).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('不请求管理员权限')
  await act(async () => resolve())
  expect(screen.getByRole('status')).toHaveTextContent('独立工具尚未接通')
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
  expect(screen.getByText('合成代理人')).toBeVisible()
})

it('requires both import capability and explicit account/count confirmation, which resets on account or snapshot changes', async () => {
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
  const button = screen.getByRole('button', { name: '确认导入本次快读结果' })
  expect(button).toBeDisabled()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  rerender(<AssetQuickReadEntry {...props} canImport />)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(button).toBeEnabled()
  rerender(<AssetQuickReadEntry {...props} canImport targetAccountId="account-b" />)
  expect(button).toBeDisabled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  fireEvent.click(screen.getByRole('checkbox'))
  rerender(
    <AssetQuickReadEntry
      {...props}
      canImport
      targetAccountId="account-b"
      preview={{ ...preview, snapshotId: 'synthetic-sha-b' }}
    />,
  )
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => fireEvent.click(button))
  expect(onImport).toHaveBeenCalledOnce()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '导出本次读取结果' })))
  expect(onExport).toHaveBeenCalledOnce()
})

it('guards async import, restores controls on failure and requires fresh account/count confirmation', async () => {
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
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '确认导入本次快读结果' }))
  fireEvent.click(screen.getByRole('button', { name: '导入中…' }))
  expect(onImport).toHaveBeenCalledOnce()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  await act(async () => reject(new Error('transaction rejected')))
  expect(screen.getByRole('status')).toHaveTextContent('导入请求未完成')
  expect(screen.getByRole('checkbox')).toBeEnabled()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: '确认导入本次快读结果' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '确认导入本次快读结果' })),
  )
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
  const confirm = screen.getByRole('checkbox')
  const button = screen.getByRole('button', { name: '确认导入本次快读结果' })
  expect(confirm).toBeEnabled()
  expect(confirm).not.toBeChecked()
  expect(button).toBeDisabled()
  fireEvent.click(confirm)
  await act(async () => fireEvent.click(button))
  expect(onImport).toHaveBeenCalledOnce()
  expect(onConnect).not.toHaveBeenCalled()
  expect(onStart).not.toHaveBeenCalled()
  expect(confirm).not.toBeChecked()
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
  fireEvent.click(screen.getByRole('button', { name: '开始本次快读' }))
  fireEvent.click(screen.getByRole('button', { name: '停止本次快读' }))
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
    fireEvent.click(screen.getByRole('button', { name: '检查独立快读 JSON 候选' })),
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

it('keeps compact preparation concise with a native guide and fresh risk consent beside start', async () => {
  const onStart = vi.fn()
  render(
    <AssetQuickReadEntry
      capability="ready"
      onStart={onStart}
      renderParts={({ preparation, task }) => (
        <>
          {preparation}
          {task}
        </>
      )}
    />,
  )
  expect(screen.getByRole('heading', { name: '资产快读（实验）' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '连接独立工具' })).not.toBeInTheDocument()
  expect(screen.queryByText('独立工具 · 默认关闭')).not.toBeInTheDocument()
  const guide = screen.getByText('快读指南').closest('details')
  expect(guide).not.toHaveAttribute('open')
  expect(screen.getByText('代理人养成与 S 级驱动盘 · 需重启登录')).toBeInTheDocument()
  expect(screen.getByText(/最长等待 180 秒/)).toBeInTheDocument()
  openDisclosure()
  const consent = screen.getByRole('checkbox', { name: /我已阅读上述风险/ })
  const start = screen.getByRole('button', { name: '开始本次快读' })
  expect(consent.closest('.asset-quick-read__disclosure')).toContainElement(start)
  expect(start).toBeDisabled()
  fireEvent.click(consent)
  await act(async () => fireEvent.click(start))
  expect(onStart).toHaveBeenCalledOnce()
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
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
    renderParts: parts,
  }
  const view = render(<AssetQuickReadEntry {...props} state="capturing" />)
  view.rerender(<AssetQuickReadEntry {...props} state="received" preview={preview} />)
  expect(screen.getByRole('heading', { name: '检查本次读取结果' })).toHaveFocus()
  const details = screen.getByText(/代理人读取详情/)
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
  expect(screen.getByRole('heading', { name: '检查本次读取结果' })).toHaveFocus()
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
  const discard = screen.getByRole('button', { name: '放弃本次结果' })
  const actions = discard.closest('.asset-quick-read__actions')
  expect(actions).toContainElement(screen.getByRole('button', { name: '确认导入本次快读结果' }))
  expect(actions).toContainElement(screen.getByRole('button', { name: '导出本次读取结果' }))
  expect(screen.getAllByRole('button', { name: '放弃本次结果' })).toHaveLength(1)
  view.rerender(<AssetQuickReadEntry state="received" onDiscard={onDiscard} />)
  const noPreviewDiscard = screen.getByRole('button', { name: '放弃本次结果' })
  expect(noPreviewDiscard).toBeEnabled()
  expect(noPreviewDiscard.closest('.asset-quick-read__actions')).not.toBeNull()
  await act(async () => fireEvent.click(noPreviewDiscard))
  expect(onDiscard).toHaveBeenCalledOnce()
})

it('condenses preparation only for a task, keeping mounted directory and reachable guides stable', async () => {
  const renderParts = ({
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
    installationDirectory: "soda-source-ref:ee09b7b910b89ca3d044849bf8cbb524",
    onDirectoryChange: vi.fn(),
    onStart: vi.fn(),
    renderParts,
  }
  const view = render(<AssetQuickReadEntry {...props} />)
  const tools = screen.getByText('快读准备与工具').closest('details')!
  expect(screen.getByText('快读准备与工具')).not.toBeVisible()
  expect(tools).toHaveAttribute('open')
  fireEvent.click(screen.getByRole('button', { name: '修改游戏目录' }))
  const directory = screen.getByLabelText('游戏安装目录')
  directory.focus()
  view.rerender(<AssetQuickReadEntry {...props} />)
  expect(screen.getByLabelText('游戏安装目录')).toBe(directory)
  expect(directory).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '收起目录编辑' }))
  expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
  view.rerender(<AssetQuickReadEntry {...props} preparationCondensed />)
  expect(tools).not.toHaveAttribute('open')
  expect(screen.getByText('快读准备与工具')).toBeVisible()
  await act(async () => {
    tools.open = true
    fireEvent(tools, new Event('toggle'))
  })
  expect(screen.getByRole('button', { name: '修改游戏目录' })).toBeVisible()
  expect(screen.getByText('快读指南')).toBeVisible()
  openDisclosure()
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
  view.rerender(
    <AssetQuickReadEntry {...props} preparationCondensed transactionNotice="普通刷新" />,
  )
  expect(tools).toHaveAttribute('open')
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).toBeChecked()
  view.rerender(
    <AssetQuickReadEntry {...props} state="capturing" preparationCondensed onStop={vi.fn()} />,
  )
  expect(screen.getByRole('button', { name: '停止本次快读' })).toBeEnabled()
  expect(screen.getByRole('heading', { name: '读取登录数据' }).closest('details')).toBeNull()
  expect(screen.queryByRole('button', { name: '开始本次快读' })).not.toBeInTheDocument()
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
  const tools = screen.getByText('快读准备与工具').closest('details')!
  expect(tools).not.toHaveAttribute('open')
  const viewAssets = screen.getByRole('button', { name: '查看我的资产' })
  const exportResult = screen.getByRole('button', { name: '导出本次读取结果' })
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

it('provides one compact guide and linked short risk acknowledgement while guarding blocked and unavailable starts', () => {
  const onStart = vi.fn()
  const props = {
    onStart,
    riskNoticeHref: '#scanner-capture-methods',
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
  const view = render(<AssetQuickReadEntry {...props} capability="ready" blocked />)
  expect(screen.getAllByText('快读指南')).toHaveLength(1)
  expect(screen.queryByText('快读准备指南')).not.toBeInTheDocument()
  expect(screen.queryByText(/当前已装备音擎详情用于现有配装/)).not.toBeInTheDocument()
  const guide = screen.getByText('快读指南').closest('details')!
  guide.open = true
  expect(screen.getByText(/先完成游戏更新及首次着色器编译（Shader）/)).toBeVisible()
  expect(screen.getByText(/工具实际就绪后，才完整启动游戏并登录/)).toBeVisible()
  expect(screen.getByText(/游戏安装目录是包含 ZenlessZoneZero_Data/)).toBeVisible()
  expect(screen.getByRole('button', { name: '开始读取' })).toBeDisabled()
  openDisclosure()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  view.rerender(<AssetQuickReadEntry {...props} capability="ready" />)
  openDisclosure()
  view.rerender(<AssetQuickReadEntry {...props} capability="ready" blocked />)
  expect(screen.getByRole('link', { name: '阅读完整采集方式与风险说明' })).toHaveAttribute(
    'href',
    '#scanner-capture-methods',
  )
  expect(screen.getByText(/非官方实验方式；存在服务受限或账号封禁风险/)).toBeVisible()
  expect(screen.queryByText(/采集可停止，但已发出的配置请求不能撤回/)).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
  view.rerender(<AssetQuickReadEntry {...props} capability="unavailable" />)
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '开始本次快读' }))
  expect(onStart).not.toHaveBeenCalled()
})

it('shows success-critical game preparation and real package instructions directly with ordered primary actions', async () => {
  const onConnect = vi.fn()
  const onStart = vi.fn()
  const props = {
    onConnect,
    onStart,
    preparationCondensed: true,
    riskNoticeHref: '#scanner-capture-methods',
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
  const view = render(<AssetQuickReadEntry {...props} state="error" errorMessage="合成工具错误" />)
  expect(screen.getByText('快读准备与工具').closest('details')).not.toHaveAttribute('open')
  const requirement = screen.getByText('等待页面显示工具就绪，再完整启动游戏并登录。')
  expect(requirement).toBeVisible()
  expect(requirement.closest('details')).toBeNull()
  expect(screen.getAllByText('提前完成游戏更新与首次着色器编译。')).toHaveLength(1)
  expect(screen.getByText(/独立安装包尚未发布，当前不能下载/)).toBeVisible()
  expect(screen.getByText('合成工具错误')).toBeVisible()
  const connect = screen.getByRole('button', { name: '连接独立工具' })
  expect(connect).toHaveClass('button--primary')
  expect(connect.parentElement?.firstElementChild).toBe(connect)
  await act(async () => fireEvent.click(connect))
  expect(onConnect).toHaveBeenCalledOnce()
  view.rerender(<AssetQuickReadEntry {...props} capability="ready" />)
  const begin = screen.getByRole('button', { name: '开始读取' })
  expect(begin).toHaveClass('button--primary')
  expect(begin.parentElement?.firstElementChild).toBe(begin)
  expect(screen.queryByRole('button', { name: '重新检查连接' })).not.toBeInTheDocument()
  fireEvent.click(begin)
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始本次快读' })))
  expect(onStart).toHaveBeenCalledOnce()
  expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
})

it('orders compact preparation before real tool status and directory settings', () => {
  render(
    <AssetQuickReadEntry
      capability="ready"
      renderParts={({ preparation, task }) => (
        <>
          {preparation}
          {task}
        </>
      )}
    />,
  )
  const requirement = screen.getByRole('heading', { name: '准备游戏' }).parentElement!
  const status = screen.getByText('独立工具已连接')
  const directory = screen.getByLabelText('游戏安装目录')
  expect(
    requirement.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(status.compareDocumentPosition(directory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(status.tagName).toBe('STRONG')
})

it('aligns compact connection and download actions, then reveals risk only after the ready start action', () => {
  const onConnect = vi.fn()
  const onStart = vi.fn()
  const props = {
    onConnect,
    onStart,
    installer: <button className="button button--quiet">下载独立工具</button>,
    renderParts: (parts: { preparation: React.ReactNode; task: React.ReactNode }) => (
      <>
        {parts.preparation}
        {parts.task}
      </>
    ),
  }
  const { rerender } = render(<AssetQuickReadEntry {...props} />)
  const connect = screen.getByRole('button', { name: '连接独立工具' })
  const download = screen.getByRole('button', { name: '下载独立工具' })
  expect(connect).toHaveClass('button--primary')
  expect(download.parentElement).toBe(connect.parentElement)
  expect(screen.queryByRole('button', { name: '查看风险并准备快读' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  rerender(<AssetQuickReadEntry {...props} capability="ready" />)
  expect(screen.getByRole('button', { name: '开始读取' })).toHaveClass('button--primary')
  expect(screen.getByRole('button', { name: '下载独立工具' }).parentElement).toBe(
    screen.getByRole('button', { name: '开始读取' }).parentElement,
  )
  fireEvent.click(screen.getByRole('button', { name: '开始读取' }))
  expect(screen.getByRole('button', { name: '下载独立工具' })).toBe(download)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: '开始本次快读' })).toBeDisabled()
  expect(onStart).not.toHaveBeenCalled()
})

it('blocks preparation entry for a received candidate and in-flight connection without reopening risk', async () => {
  let finish!: () => void
  const onConnect = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const onStart = vi.fn()
  const view = render(
    <AssetQuickReadEntry
      capability="ready"
      state="received"
      onConnect={onConnect}
      onStart={onStart}
    />,
  )
  const received = screen.getByRole('button', { name: '查看风险并准备快读' })
  expect(received).toBeDisabled()
  fireEvent.click(received)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  view.rerender(<AssetQuickReadEntry capability="ready" onConnect={onConnect} onStart={onStart} />)
  fireEvent.click(screen.getByRole('button', { name: '重新检查连接' }))
  const pending = screen.getByRole('button', { name: '查看风险并准备快读' })
  expect(pending).toBeDisabled()
  fireEvent.click(pending)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  await act(async () => finish())
  expect(pending).toBeEnabled()
  expect(onStart).not.toHaveBeenCalled()
})
