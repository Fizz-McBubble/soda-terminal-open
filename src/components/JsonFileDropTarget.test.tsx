import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { JsonFileDropTarget } from './JsonFileDropTarget'

const json = () => new File(['{}'], 'backup.JSON', { type: 'application/json' })
const transfer = (files: File[]) => ({ files, types: ['Files'], dropEffect: 'none' })

it('passes one local JSON file to inspection and clears the drag highlight', () => {
  const onFile = vi.fn()
  const onRejected = vi.fn()
  render(<JsonFileDropTarget aria-label="文件入口" onFile={onFile} onRejected={onRejected} />)
  const target = screen.getByRole('region', { name: '文件入口' })
  const file = json()
  fireEvent.dragEnter(target, { dataTransfer: transfer([file]) })
  expect(target).toHaveAttribute('data-file-dragging', 'true')
  fireEvent.drop(target, { dataTransfer: transfer([file]) })
  expect(onFile).toHaveBeenCalledExactlyOnceWith(file)
  expect(onRejected).not.toHaveBeenCalled()
  expect(target).not.toHaveAttribute('data-file-dragging')
})

it.each([
  { kind: 'empty', files: [] },
  { kind: 'multiple', files: [json(), json()] },
  { kind: 'non-JSON', files: [new File(['image'], 'image.png', { type: 'image/png' })] },
])('rejects $kind selection instead of taking the first file', ({ files }) => {
  const onFile = vi.fn()
  const onRejected = vi.fn()
  render(<JsonFileDropTarget aria-label="文件入口" onFile={onFile} onRejected={onRejected} />)
  fireEvent.drop(screen.getByRole('region'), { dataTransfer: transfer(files) })
  expect(onFile).not.toHaveBeenCalled()
  expect(onRejected).toHaveBeenCalledOnce()
})

it('ignores drops during an owned task and prevents browser navigation', () => {
  const onFile = vi.fn()
  const onRejected = vi.fn()
  render(
    <JsonFileDropTarget disabled aria-label="文件入口" onFile={onFile} onRejected={onRejected} />,
  )
  const accepted = fireEvent.drop(screen.getByRole('region'), { dataTransfer: transfer([json()]) })
  expect(accepted).toBe(false)
  expect(onFile).not.toHaveBeenCalled()
  expect(onRejected).not.toHaveBeenCalled()
})

it('keeps the highlight while moving between nested elements and clears it when leaving', () => {
  render(
    <JsonFileDropTarget aria-label="文件入口" onFile={vi.fn()} onRejected={vi.fn()}>
      <span>选择文件</span>
    </JsonFileDropTarget>,
  )
  const target = screen.getByRole('region')
  const child = screen.getByText('选择文件')
  fireEvent.dragEnter(target, { dataTransfer: transfer([json()]) })
  fireEvent.dragEnter(child, { dataTransfer: transfer([json()]) })
  fireEvent.dragLeave(child)
  expect(target).toHaveAttribute('data-file-dragging', 'true')
  fireEvent.dragLeave(target)
  expect(target).not.toHaveAttribute('data-file-dragging')
})
