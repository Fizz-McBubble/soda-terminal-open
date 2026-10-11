import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssetQuickReadEntry } from './AssetQuickReadEntry'

vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))

it('replaces preparation for consent and pending inspection inside the workspace, with fresh consent on return', () => {
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
  fireEvent.click(screen.getByRole('button', { name: '一键读取' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '准备游戏' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('游戏安装目录')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '返回' }))
  expect(screen.getByRole('heading', { name: '准备游戏' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '一键读取' }))
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  view.rerender(<AssetQuickReadEntry {...props} pendingInspection />)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '准备游戏' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('正在检查本机资产快读文件')
  expect(onStart).not.toHaveBeenCalled()
})
