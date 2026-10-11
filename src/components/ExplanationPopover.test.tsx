import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExplanationPopover } from './ExplanationPopover'

afterEach(() => vi.unstubAllGlobals())

it('keeps the CSS height cap stable across repeated rounded scroll measurements', () => {
  let resize = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  render(<ExplanationPopover label="更新日志">可滚动的多条日志</ExplanationPopover>)
  const trigger = screen.getByRole('button', { name: '更新日志' })
  const panel = screen.getByRole('dialog', { hidden: true })
  const measuredHeight = () =>
    panel.style.maxHeight ? Math.max(72, Number.parseFloat(panel.style.maxHeight) - 1) : 480
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
    top: 24,
    bottom: 58,
    left: 765,
    right: 848,
  } as DOMRect)
  vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(
    () => ({ width: 448, height: measuredHeight() }) as DOMRect,
  )
  Object.defineProperties(panel, {
    clientHeight: { get: () => measuredHeight() - 2 },
    scrollHeight: { get: () => measuredHeight() - 2 },
  })
  const toggle = new Event('toggle')
  Object.defineProperty(toggle, 'newState', { value: 'open' })
  fireEvent(panel, toggle)
  expect(panel.style.maxHeight).toBe('480px')
  for (let index = 0; index < 8; index += 1) {
    act(() => resize())
    fireEvent.scroll(window)
  }
  expect(panel.style.maxHeight).toBe('480px')
})
