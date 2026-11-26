import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssetQuickReadEntry } from './AssetQuickReadEntry'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))

it('starts only on explicit action and keeps pending inspection in the same stage', async () => {
  const onStart = vi.fn()
  const props = {
    capability: 'ready' as const,
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
  const view = render(<AssetQuickReadEntry {...props} />)
  const start = screen.getByRole('button', { name: '一键读取' })
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(onStart).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '准备游戏' })).toBeVisible()
  expect(start).toBeEnabled()
  await act(async () => fireEvent.click(start))
  expect(onStart).toHaveBeenCalledOnce()
  expect(screen.getByRole('heading', { name: '准备游戏' })).toBeVisible()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  view.rerender(<AssetQuickReadEntry {...props} pendingInspection />)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '准备游戏' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('正在检查本机资产快读文件')
  expect(onStart).toHaveBeenCalledOnce()
})
