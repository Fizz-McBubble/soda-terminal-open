import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { waapiMotion } from './waapiRuntime'
import { useChangedValueHighlight } from './useChangedValueHighlight'

describe('changed value highlight motion', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('highlights only rows whose value changed and cancels cleanly when reduced motion turns on', () => {
    let reduced = false
    let notify = () => {}
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return reduced
        },
        addEventListener: (_type: string, cb: () => void) => {
          notify = cb
        },
        removeEventListener: vi.fn(),
      })),
    )

    const scope = document.createElement('table')
    const atk = document.createElement('tr')
    atk.dataset.motionValueKey = 'atk'
    const crit = document.createElement('tr')
    crit.dataset.motionValueKey = 'crit'
    scope.append(atk, crit)

    const spy = vi.spyOn(waapiMotion, 'fromTo')
    const { rerender, unmount } = renderHook(
      ({ values }) => useChangedValueHighlight({ scope: { current: scope }, values }),
      { initialProps: { values: { atk: 2800, crit: 72 } } },
    )

    expect(spy).not.toHaveBeenCalled()

    rerender({ values: { atk: 3050, crit: 72 } })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toEqual([atk])
    expect(waapiMotion.getActive(atk)).toHaveLength(1)
    expect(waapiMotion.getActive(crit)).toHaveLength(0)

    act(() => {
      reduced = true
      notify()
    })
    expect(waapiMotion.getActive(atk)).toHaveLength(0)
    unmount()
  })
})
