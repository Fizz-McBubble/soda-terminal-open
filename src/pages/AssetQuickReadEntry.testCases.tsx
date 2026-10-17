import type React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssetQuickReadEntry } from './AssetQuickReadEntry'

export function registerAssetQuickReadEntryPreparationCases() {
  it('links full risk information and guards blocked or unavailable compact starts', () => {
    const onStart = vi.fn()
    const props = {
      onStart,
      riskNoticeHref: '#scanner-capture-methods',
      renderParts: (parts: { preparation: React.ReactNode; task: React.ReactNode }) => (
        <>
          {parts.preparation}
          {parts.task}
        </>
      ),
    }
    const view = render(<AssetQuickReadEntry {...props} capability="ready" blocked />)
    expect(screen.getByText('完成游戏更新及首次着色器编译，然后完全退出客户端。')).toBeVisible()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/读取需管理员权限和网络驱动/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一键读取' })).toBeDisabled()
    view.rerender(<AssetQuickReadEntry {...props} capability="unavailable" />)
    expect(screen.getByText('完成游戏更新及首次着色器编译，然后完全退出客户端。')).toBeVisible()
    expect(screen.getByText('点击读取，等页面显示“已就绪”后再启动游戏并登录。')).toBeVisible()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '一键读取' })).not.toBeInTheDocument()
    expect(onStart).not.toHaveBeenCalled()
  })

  it('keeps failed task retry available without repeating idle preparation', async () => {
    const onConnect = vi.fn()
    const onStart = vi.fn()
    const props = {
      onConnect,
      onStart,
      preparationCondensed: true,
      renderParts: (parts: { preparation: React.ReactNode; task: React.ReactNode }) => (
        <>
          {parts.preparation}
          {parts.task}
        </>
      ),
    }
    const view = render(
      <AssetQuickReadEntry {...props} state="error" errorMessage="合成工具错误" />,
    )
    expect(screen.queryByRole('heading', { name: '准备游戏' })).not.toBeInTheDocument()
    expect(screen.queryByText(/资产快读安装包尚未发布，当前不能下载/)).not.toBeInTheDocument()
    expect(screen.getByText('合成工具错误')).toBeVisible()
    expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
    expect(screen.queryByText('重新读取', { selector: 'summary' })).not.toBeInTheDocument()
    const connect = screen.getByRole('button', { name: '连接资产快读' })
    expect(connect).toBeVisible()
    expect(connect).toHaveClass('button--primary')
    await act(async () => fireEvent.click(connect))
    expect(onConnect).toHaveBeenCalledOnce()
    view.rerender(<AssetQuickReadEntry {...props} capability="ready" />)
    const begin = screen.getByRole('button', { name: '一键读取' })
    expect(begin).toHaveClass('button--primary')
    expect(begin.parentElement?.firstElementChild).toBe(begin)
    expect(screen.queryByRole('button', { name: '重新连接资产快读' })).not.toBeInTheDocument()
    fireEvent.click(begin)
    fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '开始读取' })))
    expect(onStart).toHaveBeenCalledOnce()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一键读取' })).toBeEnabled()
  })

  it('returns failed workbench reads to preparation without restarting capture', async () => {
    const onPrepareAgain = vi.fn()
    const onStart = vi.fn()
    render(
      <AssetQuickReadEntry
        state="timed_out"
        capability="ready"
        onPrepareAgain={onPrepareAgain}
        onStart={onStart}
        renderParts={({ preparation, task }) => (
          <>
            {preparation}
            {task}
          </>
        )}
      />,
    )
    expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
    const retry = screen.getByRole('button', { name: '一键读取' })
    const back = screen.getByRole('button', { name: '返回' })
    expect(retry.parentElement).toBe(back.parentElement)
    await act(async () => fireEvent.click(back))
    expect(onPrepareAgain).toHaveBeenCalledOnce()
    expect(onStart).not.toHaveBeenCalled()
  })

  it('keeps game preparation and directory before status and the primary action', () => {
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
    const status = screen.getByText('资产快读已连接')
    const directory = screen.getByLabelText('游戏安装目录')
    expect(
      requirement.compareDocumentPosition(directory) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      directory.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(status.tagName).toBe('STRONG')
  })

  it('keeps download mounted and compact preparation unchanged after connecting', () => {
    const onConnect = vi.fn()
    const onStart = vi.fn()
    const props = {
      onConnect,
      onStart,
      installer: <button>下载资产快读</button>,
      renderParts: (parts: { preparation: React.ReactNode; task: React.ReactNode }) => (
        <>
          {parts.preparation}
          {parts.task}
        </>
      ),
    }
    const { rerender } = render(<AssetQuickReadEntry {...props} />)
    const connect = screen.getByRole('button', { name: '连接资产快读' })
    const download = screen.getByRole('button', { name: '下载资产快读' })
    expect(download.parentElement).toBe(connect.parentElement)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    rerender(<AssetQuickReadEntry {...props} capability="ready" />)
    expect(screen.getByRole('button', { name: '下载资产快读' })).toBe(download)
    expect(download.parentElement).toBe(
      screen.getByRole('button', { name: '一键读取' }).parentElement,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '一键读取' })).toBeEnabled()
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
    const received = screen.getByRole('button', { name: '准备资产快读' })
    expect(received).toBeDisabled()
    fireEvent.click(received)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    view.rerender(
      <AssetQuickReadEntry capability="ready" onConnect={onConnect} onStart={onStart} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '重新连接资产快读' }))
    const pending = screen.getByRole('button', { name: '准备资产快读' })
    expect(pending).toBeDisabled()
    fireEvent.click(pending)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await act(async () => finish())
    expect(pending).toBeEnabled()
    expect(onStart).not.toHaveBeenCalled()
  })

  it('returns completed reads to preparation only when allowed and requires fresh consent', async () => {
    const onPrepareAgain = vi.fn()
    const onStart = vi.fn()
    const props = {
      capability: 'ready' as const,
      onPrepareAgain,
      onStart,
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
    const view = render(<AssetQuickReadEntry {...props} state="completed" blocked />)
    const restart = screen.getByRole('button', { name: '重新读取' })
    expect(restart).toBeDisabled()
    fireEvent.click(restart)
    expect(onPrepareAgain).not.toHaveBeenCalled()
    view.rerender(<AssetQuickReadEntry {...props} state="completed" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '重新读取' })))
    expect(onPrepareAgain).toHaveBeenCalledOnce()
    expect(onStart).not.toHaveBeenCalled()
    view.rerender(<AssetQuickReadEntry {...props} state="idle" />)
    fireEvent.click(screen.getByRole('button', { name: '一键读取' }))
    expect(screen.getByRole('checkbox', { name: /我已阅读上述风险/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: '开始读取' })).toBeDisabled()
    expect(onStart).not.toHaveBeenCalled()
  })
}
