import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { focusScannerWorkspaceTarget, navigateScannerWorkspace } from './scannerWorkbenchNavigation'

it('moves only the workspace frame and focuses the requested section under shell zoom', () => {
  render(
    <main className="f5v-page-frame" data-testid="frame">
      <section onClick={navigateScannerWorkspace}>
        <a href="#workspace-guide">使用指南</a>
        <section id="workspace-guide" data-testid="guide">
          指南正文
        </section>
      </section>
    </main>,
  )
  const frame = screen.getByTestId('frame')
  const guide = screen.getByTestId('guide')
  Object.defineProperty(frame, 'offsetHeight', { value: 600 })
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 900 } as DOMRect)
  vi.spyOn(guide, 'getBoundingClientRect').mockReturnValue({ top: 600 } as DOMRect)
  frame.scrollTop = 150
  document.documentElement.scrollTop = 74
  const focus = vi.spyOn(guide, 'focus')
  fireEvent.click(screen.getByRole('link', { name: '使用指南' }))
  expect(frame.scrollTop).toBeCloseTo(463.333)
  expect(document.documentElement.scrollTop).toBe(0)
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(guide).toHaveFocus()
  expect(window.location.hash).toBe('#workspace-guide')
  window.history.replaceState(null, '', '/')
})

it('leaves modified clicks and links outside the workspace to the browser', () => {
  render(
    <main className="f5v-page-frame" data-testid="frame">
      <section onClick={navigateScannerWorkspace}>
        <a href="#outside">页外链接</a>
        <a href="#workspace-guide">使用指南</a>
        <section id="workspace-guide">指南正文</section>
      </section>
    </main>,
  )
  const frame = screen.getByTestId('frame')
  frame.scrollTop = 120
  fireEvent.click(screen.getByRole('link', { name: '页外链接' }))
  fireEvent.click(screen.getByRole('link', { name: '使用指南' }), { ctrlKey: true })
  expect(frame.scrollTop).toBe(120)
})

it('focuses a visible result without moving the workspace header out of view', () => {
  render(
    <main className="f5v-page-frame" data-testid="frame">
      <h3 data-testid="result">读取结果</h3>
    </main>,
  )
  const frame = screen.getByTestId('frame')
  const result = screen.getByTestId('result')
  Object.defineProperty(frame, 'offsetHeight', { value: 600 })
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
    top: 100,
    bottom: 1000,
    height: 900,
  } as DOMRect)
  const bounds = vi
    .spyOn(result, 'getBoundingClientRect')
    .mockReturnValue({ top: 400, bottom: 440 } as DOMRect)
  frame.scrollTop = 0
  focusScannerWorkspaceTarget(result, true)
  expect(frame.scrollTop).toBe(0)
  expect(result).toHaveFocus()
  bounds.mockReturnValue({ top: 1100, bottom: 1140 } as DOMRect)
  focusScannerWorkspaceTarget(result, true)
  expect(frame.scrollTop).toBeCloseTo(113.333)
})
