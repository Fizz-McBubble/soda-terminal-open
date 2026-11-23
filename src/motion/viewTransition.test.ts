import { afterEach, describe, expect, it, vi } from 'vitest'
import { runViewTransition } from './viewTransition'

describe('progressive View Transitions wrapper', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('executes synchronously and routes focus when startViewTransition is unavailable', () => {
    const heading = document.createElement('h2')
    heading.tabIndex = -1
    document.body.append(heading)
    const update = vi.fn()
    runViewTransition(update, { focusTarget: heading })
    expect(update).toHaveBeenCalledTimes(1)
    expect(heading).toHaveFocus()
    heading.remove()
  })

  it('wraps updates in document.startViewTransition when supported and motion is allowed', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    const heading = document.createElement('h2')
    heading.tabIndex = -1
    document.body.append(heading)
    const startViewTransition = vi.fn((cb: () => void) => {
      cb()
      return { finished: Promise.resolve() }
    })
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })

    const update = vi.fn()
    runViewTransition(update, { focusTarget: heading })
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(heading).toHaveFocus()
    heading.remove()
  })

  it('bypasses startViewTransition when system prefers reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    const startViewTransition = vi.fn()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: startViewTransition })

    const update = vi.fn()
    runViewTransition(update)
    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
