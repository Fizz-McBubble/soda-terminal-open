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

it('refits nested disclosures against the CSS cap and preserves native body scrolling', () => {
  const observed: Element[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(element: Element) {
        observed.push(element)
      }
      disconnect() {}
    },
  )
  render(
    <ExplanationPopover label="使用说明">
      <dl>
        <dd>
          <details>
            <summary>排查故障</summary>
            <p>完整排查内容</p>
          </details>
        </dd>
      </dl>
    </ExplanationPopover>,
  )
  const trigger = screen.getByRole('button', { name: '使用说明' })
  const panel = screen.getByRole('dialog', { hidden: true })
  const body = panel.querySelector<HTMLElement>('.explanation-popover__body')!
  const details = panel.querySelector('details')!
  let height = 180
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
    top: 30,
    bottom: 60,
    left: 100,
    right: 200,
  } as DOMRect)
  const measure = vi
    .spyOn(panel, 'getBoundingClientRect')
    .mockImplementation(() => ({ width: 400, height }) as DOMRect)
  Object.defineProperty(panel, 'scrollHeight', { get: () => 1600 })
  const toggle = new Event('toggle')
  Object.defineProperty(toggle, 'newState', { value: 'open' })
  fireEvent(panel, toggle)
  expect(panel.style.maxHeight).toBe('180px')
  expect(observed).toContain(body.firstElementChild)

  body.scrollTop = 170
  const measurementsBeforeScroll = measure.mock.calls.length
  fireEvent.scroll(body)
  expect(measure.mock.calls.length).toBe(measurementsBeforeScroll)
  expect(body.scrollTop).toBe(170)

  height = 420
  fireEvent(details, new Event('toggle'))
  expect(panel.style.maxHeight).toBe('420px')
  expect(body.scrollTop).toBe(170)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  fireEvent(details, new Event('toggle'))
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
})

it('uses the existing quiet button for a toolbar disclosure while keeping body explanations as text', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  render(
    <>
      <ExplanationPopover label="推荐说明" variant="button" showIndicator={false}>
        工具栏说明
      </ExplanationPopover>
      {['更多', '适用条件', '参考'].map((label) => (
        <ExplanationPopover key={label} label={label}>
          {label}正文
        </ExplanationPopover>
      ))}
    </>,
  )
  const toolbarTrigger = screen.getByRole('button', { name: '推荐说明' })
  expect(toolbarTrigger).toHaveClass('button', 'button--quiet')
  expect(toolbarTrigger.querySelector('[aria-hidden]')).toBeNull()
  expect(toolbarTrigger).toHaveAttribute('aria-haspopup', 'dialog')
  expect(toolbarTrigger).toHaveAttribute('popovertarget')
  for (const label of ['更多', '适用条件', '参考']) {
    const trigger = screen.getByRole('button', { name: label })
    expect(trigger).not.toHaveClass('button')
    expect(trigger.querySelector('.explanation__label')).toHaveTextContent(label)
    expect(trigger.querySelector('[aria-hidden]')).not.toBeNull()
  }
  const panel = document.getElementById(toolbarTrigger.getAttribute('popovertarget')!)!
  const open = new Event('toggle')
  Object.defineProperty(open, 'newState', { value: 'open' })
  fireEvent(panel, open)
  expect(toolbarTrigger).toHaveAttribute('aria-expanded', 'true')
  const close = new Event('toggle')
  Object.defineProperty(close, 'newState', { value: 'closed' })
  fireEvent(panel, close)
  expect(toolbarTrigger).toHaveAttribute('aria-expanded', 'false')
})
