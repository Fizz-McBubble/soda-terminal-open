import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScannerAssistantRuntime } from './runtime'
import { helperFetch, nativeIdentity, readySnapshot } from './runtime.testFixture'

describe('scanner connection recovery', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['/', '/token', '/api/retry'])(
    'settles a stalled connection at %s and cancels its transport',
    async (stalledPath) => {
      let stalledSignal: AbortSignal | null = null
      const other = helperFetch()
      const fetchImpl = vi.fn<typeof fetch>((input, init) => {
        const path = new URL(String(input)).pathname
        if (path === stalledPath) {
          stalledSignal = init?.signal ?? null
          return new Promise(() => {})
        }
        return path === '/'
          ? Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
          : other(input, init)
      })
      const runtime = createScannerAssistantRuntime({ fetchImpl, helperRequestTimeoutMs: 25 })
      await expect(runtime.commands.retryConnection()).rejects.toMatchObject({
        name: 'ScannerHelperTimeoutError',
      })
      expect((stalledSignal as AbortSignal | null)?.aborted).toBe(true)
      expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('/api/start'))).toBe(false)
    },
  )

  it('cancels a token renewal during result reading without continuing with a late token', async () => {
    let completeToken!: (value: Response) => void
    let tokenSignal: AbortSignal | null = null
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      if (new URL(String(input)).pathname === '/')
        return Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
      tokenSignal = init?.signal ?? null
      return new Promise((resolve) => {
        completeToken = resolve
      })
    })
    const runtime = createScannerAssistantRuntime({ fetchImpl, resultRequestTimeoutMs: 25 })
    await expect(runtime.commands.requestResultFile()).rejects.toMatchObject({
      name: 'ScannerResultTimeoutError',
    })
    expect((tokenSignal as AbortSignal | null)?.aborted).toBe(true)
    completeToken(new Response(JSON.stringify({ token: 'x'.repeat(48) })))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/',
      '/token',
    ])
  })

  it('decodes split CRLF frames and ignores keepalive comments', async () => {
    const other = helperFetch()
    const data = `: keepalive\r\n\r\ndata: ${JSON.stringify(readySnapshot)}\r\n\r\n`
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      const path = new URL(String(input)).pathname
      if (path === '/') return Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
      if (path !== '/api/events') return other(input, init)
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(data.slice(0, -1)))
              controller.enqueue(new TextEncoder().encode(data.slice(-1)))
            },
          }),
        ),
      )
    })
    const runtime = createScannerAssistantRuntime({ fetchImpl })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    try {
      await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(readySnapshot))
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
    }
  })

  it('reconnects a stream that closed while hidden when the page becomes visible', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    let streamCount = 0
    const other = helperFetch()
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      const path = new URL(String(input)).pathname
      if (path === '/') return Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
      if (path !== '/api/events') return other(input, init)
      streamCount += 1
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              if (streamCount === 1) controller.close()
              else
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify(readySnapshot)}\n\n`),
                )
            },
          }),
        ),
      )
    })
    const runtime = createScannerAssistantRuntime({ fetchImpl })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    try {
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(streamCount).toBe(1)
      expect(listener).not.toHaveBeenCalled()
      hidden.mockReturnValue(false)
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(readySnapshot))
      expect(streamCount).toBe(2)
    } finally {
      unsubscribe()
    }
  })

  it('publishes command responses even before the status stream produces a frame', async () => {
    const other = helperFetch()
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      const path = new URL(String(input)).pathname
      if (path === '/') return Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
      if (path === '/api/events') return Promise.resolve(new Response(new ReadableStream()))
      return other(input, init)
    })
    const runtime = createScannerAssistantRuntime({ fetchImpl, deferInitialConnection: true })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    try {
      await runtime.commands.retryConnection()
      expect(listener).toHaveBeenLastCalledWith(readySnapshot)
      await runtime.commands.startScan()
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'scanning' }))
      await runtime.commands.safeStop()
      expect(listener).toHaveBeenLastCalledWith(readySnapshot)
    } finally {
      unsubscribe()
    }
  })
  it.each(['headers', 'body'])(
    'reconnects after a status stream stalls in its %s',
    async (stall) => {
      const other = helperFetch()
      let streamCount = 0
      const fetchImpl = vi.fn<typeof fetch>((input, init) => {
        const path = new URL(String(input)).pathname
        if (path === '/') return Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
        if (path !== '/api/events') return other(input, init)
        streamCount += 1
        if (streamCount === 1 && stall === 'headers') return new Promise(() => {})
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                if (streamCount > 1)
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify(readySnapshot)}\n\n`),
                  )
              },
            }),
          ),
        )
      })
      const runtime = createScannerAssistantRuntime({
        fetchImpl,
        helperRequestTimeoutMs: 25,
        streamIdleTimeoutMs: 25,
        reconnectDelayMs: 0,
      })
      const listener = vi.fn()
      const unsubscribe = runtime.subscribe(listener)
      try {
        await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(readySnapshot))
        expect(streamCount).toBeGreaterThanOrEqual(2)
        const initialEventsRequest = fetchImpl.mock.calls.find(([url]) =>
          String(url).endsWith('/api/events'),
        )
        expect(initialEventsRequest?.[1]?.signal?.aborted).toBe(true)
      } finally {
        unsubscribe()
      }
    },
  )

  it('refuses to forward the helper token to an evidence URL outside the helper', async () => {
    const other = helperFetch()
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      const path = new URL(String(input)).pathname
      if (path === '/') return Promise.resolve(new Response(JSON.stringify(nativeIdentity)))
      if (path.endsWith('/evidence/item'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              availability: 'available',
              detailSrc: 'https://invalid.example/image.png',
              cardSrc: '/api/result/handle/card',
              visualDetailHash: 'hash',
            }),
          ),
        )
      return other(input, init)
    })
    const runtime = createScannerAssistantRuntime({ fetchImpl })
    await expect(runtime.commands.requestResultEvidence('handle', 'item')).rejects.toThrow(
      'helper_evidence_origin_invalid',
    )
    expect(
      fetchImpl.mock.calls.every(
        ([url]) => new URL(String(url)).origin === 'http://127.0.0.1:43127',
      ),
    ).toBe(true)
  })
})
