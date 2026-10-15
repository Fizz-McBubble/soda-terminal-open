import { expect, it, vi } from 'vitest'
import { createScannerAssistantRuntime } from './runtime'
import {
  createNativeFixtureRuntime,
  FakeEventSource,
  helperFetch,
  nativeIdentity,
  readySnapshot,
} from './runtime.testFixture'
export function registerruntimeLifecycleCases1() {
  it('does not let a delayed command response replace newer streamed progress', async () => {
    const normalFetch = helperFetch()
    let complete!: (response: Response) => void
    const runtime = createNativeFixtureRuntime({
      fetchImpl: ((input, init) =>
        String(input).endsWith('/api/start')
          ? new Promise<Response>((resolve) => {
              complete = resolve
            })
          : normalFetch(input, init)) as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await vi.waitFor(() => expect(FakeEventSource.latest?.onmessage).toBeTruthy())
    const pending = runtime.commands.startScan()
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'))
    FakeEventSource.latest!.emit({
      ...readySnapshot,
      state: 'scanning',
      progress: {
        processed: 54,
        total: 374,
        stageLabel: '读取驱动盘详情',
        etaSeconds: null,
      },
    })
    complete(new Response(JSON.stringify({ ...readySnapshot, state: 'checking' })))
    await pending
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'scanning',
        progress: expect.objectContaining({ processed: 54 }),
      }),
    )
    unsubscribe()
  })
  it('launches the protocol in the same click task before awaiting helper requests', async () => {
    const fetchImpl = helperFetch()
    const launchProtocol = vi.fn(() => expect(fetchImpl).not.toHaveBeenCalled())
    const runtime = createNativeFixtureRuntime({
      token: '',
      fetchImpl: fetchImpl as typeof fetch,
      launchProtocol,
      maxReconnectAttempts: 1,
    })
    const reconnect = runtime.commands.openHelper(true)
    expect(launchProtocol).toHaveBeenCalledWith(
      `soda-terminal-scanner://open?origin=${encodeURIComponent(window.location.origin)}`,
    )
    await reconnect
  })
  it('waits for a user action before a deferred page reaches the loopback helper', async () => {
    FakeEventSource.latest = null
    const fetchImpl = helperFetch()
    const runtime = createNativeFixtureRuntime({
      deferInitialConnection: true,
      fetchImpl: fetchImpl as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await Promise.resolve()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(FakeEventSource.latest).toBeNull()

    await runtime.commands.retryConnection()
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:43127/token',
      expect.objectContaining({ method: 'POST' }),
    )
    const stream = FakeEventSource.latest as FakeEventSource | null
    stream?.emit(readySnapshot)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining(readySnapshot))
    unsubscribe()
  })

  it('uses an authorization header for the production status stream and revokes its session', async () => {
    const token = 's'.repeat(48)
    let streamRequest: { url: string; authorization: string | undefined } | null = null
    let revoked = false
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const path = new URL(url).pathname
      if (path === '/') return new Response(JSON.stringify(nativeIdentity))
      if (path === '/token') return new Response(JSON.stringify({ token }))
      if (path === '/api/events') {
        streamRequest = {
          url,
          authorization: (init?.headers as Record<string, string>)['X-Soda-Scanner-Token'],
        }
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(readySnapshot)}\n\n`),
              )
            },
          }),
        )
      }
      if (path === '/api/revoke') {
        revoked = true
        return new Response(JSON.stringify({ revoked: true }))
      }
      throw new Error(`unexpected_request:${path}`)
    })
    const runtime = createScannerAssistantRuntime({ fetchImpl: fetchImpl as typeof fetch })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith(expect.objectContaining(readySnapshot)),
    )
    expect(streamRequest).toEqual({
      url: 'http://127.0.0.1:43127/api/events',
      authorization: token,
    })
    await runtime.commands.revokePairing()
    expect(revoked).toBe(true)
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'unchecked' }))
    const disconnected = listener.mock.calls.at(-1)![0]
    expect(disconnected.error).toBeUndefined()
    expect(disconnected.diagnostics).toBeUndefined()
    expect(disconnected.readiness.helperConnected).toBe(false)
    unsubscribe()
  })

  it.each(['queued', 'pairing'] as const)(
    'does not let a %s event reconnect renew authorization after the user disconnects',
    async (reconnectStage) => {
      vi.useFakeTimers()
      let stream!: ReadableStreamDefaultController<Uint8Array>
      let resolveRenewal: ((response: Response) => void) | undefined
      let tokenRequests = 0
      const fetchImpl = vi.fn<typeof fetch>(async (input) => {
        const path = new URL(String(input)).pathname
        if (path === '/') return new Response(JSON.stringify(nativeIdentity))
        if (path === '/token') {
          tokenRequests += 1
          if (reconnectStage === 'pairing' && tokenRequests === 2)
            return new Promise<Response>((resolve) => {
              resolveRenewal = resolve
            })
          return new Response(JSON.stringify({ token: 's'.repeat(48) }))
        }
        if (path === '/api/revoke') return new Response(JSON.stringify({ revoked: true }))
        if (path === '/api/retry') return new Response(JSON.stringify(readySnapshot))
        if (path === '/api/events')
          return new Response(
            new ReadableStream({
              start(controller) {
                stream = controller
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify(readySnapshot)}\n\n`),
                )
              },
            }),
          )
        throw new Error(`unexpected_request:${path}`)
      })
      const runtime = createScannerAssistantRuntime({ fetchImpl, reconnectDelayMs: 250 })
      const listener = vi.fn()
      const unsubscribe = runtime.subscribe(listener)
      try {
        await vi.advanceTimersByTimeAsync(0)
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'ready' }))
        stream.error(new Error('helper_events_failed_401'))
        await vi.advanceTimersByTimeAsync(0)
        expect(listener).toHaveBeenLastCalledWith(
          expect.objectContaining({ state: 'connection_failed' }),
        )
        if (reconnectStage === 'pairing') {
          await vi.advanceTimersByTimeAsync(250)
          expect(resolveRenewal).toBeTypeOf('function')
        }
        await runtime.commands.revokePairing()
        const callsAfterRevoke = fetchImpl.mock.calls.length
        resolveRenewal?.(new Response(JSON.stringify({ token: 's'.repeat(48) })))
        await vi.advanceTimersByTimeAsync(1000)
        expect(fetchImpl).toHaveBeenCalledTimes(callsAfterRevoke)
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'unchecked' }))
        await runtime.commands.retryConnection()
        await vi.advanceTimersByTimeAsync(0)
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'ready' }))
      } finally {
        unsubscribe()
        vi.useRealTimers()
      }
    },
  )

  it('shows a disconnected native helper without claiming that installation is missing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('offline fixture')
    })
    const runtime = createScannerAssistantRuntime({
      fetchImpl,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            diagnosticCode: 'helper_unavailable',
            userMessage: expect.stringContaining('可重新连接'),
          }),
        }),
      ),
    )
    expect(FakeEventSource.latest).toBeNull()
    unsubscribe()
  })
  it('renews a rejected cached session once after native restart and reconnects the status stream', async () => {
    let restarted = false
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      const accepted = (restarted ? 'n' : 'o').repeat(48)
      if (path === '/token') return new Response(JSON.stringify({ token: accepted }))
      if (path === '/api/retry') {
        const supplied = (init?.headers as Record<string, string>)['X-Soda-Scanner-Token']
        return new Response(JSON.stringify(readySnapshot), {
          status: supplied === accepted ? 200 : 401,
        })
      }
      throw new Error(`unexpected_request:${path}`)
    })
    const runtime = createNativeFixtureRuntime({
      fetchImpl: fetchImpl as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      maxReconnectAttempts: 1,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await vi.waitFor(() => expect(FakeEventSource.latest).not.toBeNull())
    const oldEvents = FakeEventSource.latest!
    restarted = true
    await runtime.commands.openHelper()
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/token',
      '/api/retry',
      '/token',
      '/api/retry',
    ])
    expect(oldEvents.closed).toBe(true)
    const before = listener.mock.calls.length
    oldEvents.onerror?.()
    expect(listener).toHaveBeenCalledTimes(before)
    unsubscribe()
  })

  it('keeps a persistent authentication rejection bounded without starting a scan', async () => {
    let tokenRequests = 0
    let rejectedRequests = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname
      if (path === '/token') {
        tokenRequests++
        return new Response(JSON.stringify({ token: 'x'.repeat(48) }))
      }
      if (path === '/api/retry') {
        rejectedRequests++
        return new Response(null, { status: 401 })
      }
      throw new Error(`unexpected_request:${path}`)
    })
    const runtime = createNativeFixtureRuntime({
      fetchImpl: fetchImpl as typeof fetch,
      maxReconnectAttempts: 20,
      reconnectDelayMs: 0,
    })
    await expect(runtime.commands.retryConnection()).rejects.toThrow('helper_request_failed_401')
    expect(tokenRequests).toBe(2)
    expect(rejectedRequests).toBe(2)
    expect(fetchImpl.mock.calls.every(([url]) => !String(url).includes('/api/start'))).toBe(true)
  })

  it('uses the R10F HTTP/SSE helper without launching the managed ws-child protocol', async () => {
    const fetchImpl = helperFetch()
    const runtime = createNativeFixtureRuntime({
      token: 'a'.repeat(48),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      maxReconnectAttempts: 1,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)

    await vi.waitFor(() =>
      expect(FakeEventSource.latest?.url).toBe('http://127.0.0.1:43127/api/events'),
    )
    expect(FakeEventSource.latest?.authorization).toBe('a'.repeat(48))
    FakeEventSource.latest?.emit(readySnapshot)
    await runtime.commands.openHelper()
    await runtime.commands.startScan()
    await runtime.commands.safeStop()

    expect(listener).toHaveBeenCalledWith(expect.objectContaining(readySnapshot))
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/token',
      '/api/retry',
      '/api/start',
      '/api/stop',
    ])
    unsubscribe()
    expect(FakeEventSource.latest?.closed).toBe(true)
  })

  it('retrieves only the review handle and keeps account writes disabled', async () => {
    const runtime = createNativeFixtureRuntime({
      token: 'a'.repeat(48),
      fetchImpl: helperFetch() as unknown as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
    })
    await expect(runtime.commands.requestResultFile()).resolves.toEqual({
      resultFileHandle: 'scanner-r10c-test',
      resultStatus: 'needs_review',
      accountWriteEnabled: false,
    })
  })
}
