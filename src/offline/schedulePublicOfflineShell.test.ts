import { afterEach, describe, expect, it, vi } from 'vitest'
import { schedulePublicOfflineShell } from './schedulePublicOfflineShell'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function frames() {
  const pending: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending.push(callback)
    return pending.length
  })
  return () => pending.shift()?.(0)
}

describe('public offline installation scheduling', () => {
  it('remembers an online recovery arriving before the failed manifest request settles', async () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    vi.stubGlobal('requestIdleCallback', undefined)
    const nextFrame = frames()
    let fail: (() => void) | undefined
    const register = vi
      .fn<(options?: { onRecoverableFailure?: () => void }) => Promise<unknown>>()
      .mockImplementationOnce(
        (options) =>
          new Promise((resolve) => {
            fail = () => {
              options?.onRecoverableFailure?.()
              resolve(false)
            }
          }),
      )
      .mockResolvedValueOnce(true)
    const cancel = schedulePublicOfflineShell(register)
    nextFrame()
    nextFrame()
    await vi.advanceTimersByTimeAsync(1000)
    window.dispatchEvent(new Event('online'))
    expect(register).toHaveBeenCalledTimes(1)
    fail?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(register).toHaveBeenCalledTimes(2)
    cancel()
  })

  it('retries a recoverable failure on online only once and deduplicates concurrent events', async () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    vi.stubGlobal('requestIdleCallback', undefined)
    const nextFrame = frames()
    let finishRetry: (() => void) | undefined
    const register = vi
      .fn<(options?: { onRecoverableFailure?: () => void }) => Promise<unknown>>()
      .mockImplementationOnce(async (options) => {
        options?.onRecoverableFailure?.()
        return false
      })
      .mockImplementationOnce(
        (options) =>
          new Promise((resolve) => {
            finishRetry = () => {
              options?.onRecoverableFailure?.()
              resolve(false)
            }
          }),
      )
    const cancel = schedulePublicOfflineShell(register)
    window.dispatchEvent(new Event('online'))
    expect(register).not.toHaveBeenCalled()
    nextFrame()
    nextFrame()
    await vi.advanceTimersByTimeAsync(1000)
    expect(register).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('online'))
    expect(register).toHaveBeenCalledTimes(2)
    finishRetry?.()
    await vi.advanceTimersByTimeAsync(0)
    window.dispatchEvent(new Event('online'))
    expect(register).toHaveBeenCalledTimes(2)
    cancel()
  })

  it.each(['success', 'invalid', 'cancelled'])('does not retry online after %s', async (state) => {
    vi.useFakeTimers()
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    vi.stubGlobal('requestIdleCallback', undefined)
    const nextFrame = frames()
    const register = vi.fn(async (options?: { onRecoverableFailure?: () => void }) => {
      if (state === 'cancelled') options?.onRecoverableFailure?.()
      return state === 'success'
    })
    const cancel = schedulePublicOfflineShell(register)
    nextFrame()
    nextFrame()
    await vi.advanceTimersByTimeAsync(1000)
    if (state === 'cancelled') cancel()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(register).toHaveBeenCalledTimes(1)
    cancel()
  })

  it('waits for load and two paint frames, then runs in idle with a finite timeout', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const nextFrame = frames()
    let idleCallback: IdleRequestCallback | undefined
    const idle = vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback
      return 1
    })
    vi.stubGlobal('requestIdleCallback', idle)
    const register = vi.fn().mockResolvedValue(true)
    const cancel = schedulePublicOfflineShell(register)
    expect(register).not.toHaveBeenCalled()
    expect(idle).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('load'))
    nextFrame()
    expect(idle).not.toHaveBeenCalled()
    nextFrame()
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 5000 })
    expect(register).not.toHaveBeenCalled()
    idleCallback?.({ didTimeout: false, timeRemaining: () => 25 })
    expect(register).toHaveBeenCalledTimes(1)
    cancel()
  })

  it('uses a delayed fallback after an already loaded page when idle callbacks are unavailable', () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    vi.stubGlobal('requestIdleCallback', undefined)
    const nextFrame = frames()
    const register = vi.fn().mockResolvedValue(true)
    const cancel = schedulePublicOfflineShell(register)
    nextFrame()
    nextFrame()
    vi.advanceTimersByTime(999)
    expect(register).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(register).toHaveBeenCalledTimes(1)
    cancel()
  })

  it('cancels a pending idle install and keeps offline failures non-blocking', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    const nextFrame = frames()
    let idleCallback: IdleRequestCallback | undefined
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      idleCallback = callback
      return 7
    })
    const cancelIdle = vi.fn()
    vi.stubGlobal('cancelIdleCallback', cancelIdle)
    const register = vi.fn().mockRejectedValue(new Error('offline install unavailable'))
    const cancel = schedulePublicOfflineShell(register)
    nextFrame()
    nextFrame()
    cancel()
    expect(cancelIdle).toHaveBeenCalledWith(7)
    idleCallback?.({ didTimeout: true, timeRemaining: () => 0 })
    expect(register).not.toHaveBeenCalled()
    const cancelSecond = schedulePublicOfflineShell(register)
    nextFrame()
    nextFrame()
    idleCallback?.({ didTimeout: true, timeRemaining: () => 0 })
    await Promise.resolve()
    expect(register).toHaveBeenCalledTimes(1)
    cancelSecond()
  })
})
