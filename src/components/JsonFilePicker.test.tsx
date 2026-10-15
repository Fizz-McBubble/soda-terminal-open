import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { expect, it, vi } from 'vitest'
import { JsonFilePicker } from './JsonFilePicker'

it('shares the keyboard button and resets the input for another selection of the same file', () => {
  const onFile = vi.fn()
  const buttonRef = createRef<HTMLButtonElement>()
  render(<JsonFilePicker onFile={onFile} buttonRef={buttonRef} />)
  const button = screen.getByRole('button', { name: '选择或拖入 JSON' })
  const input = screen.getByLabelText('选择本机文件（JSON）') as HTMLInputElement
  const click = vi.spyOn(input, 'click')
  fireEvent.click(button)
  expect(click).toHaveBeenCalledOnce()
  buttonRef.current?.focus()
  expect(button).toHaveFocus()
  const file = new File(['{}'], 'local.json')
  fireEvent.change(input, { target: { files: [file] } })
  fireEvent.change(input, { target: { files: [file] } })
  expect(onFile).toHaveBeenCalledTimes(2)
  expect(onFile).toHaveBeenCalledWith(file)
  expect(input.value).toBe('')
})

it('keeps selection disabled during an active operation and allows replacing a checking file', () => {
  const onFile = vi.fn()
  const view = render(<JsonFilePicker onFile={onFile} disabled />)
  expect(screen.getByRole('button')).toBeDisabled()
  expect(screen.getByLabelText('选择本机文件（JSON）')).toBeDisabled()
  view.rerender(<JsonFilePicker onFile={onFile} checking />)
  expect(screen.getByRole('button', { name: '正在检查…' })).toBeEnabled()
  fireEvent.change(screen.getByLabelText('选择本机文件（JSON）'), { target: { files: [] } })
  expect(onFile).not.toHaveBeenCalled()
})
