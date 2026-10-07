import { registerRuntimeResultTests } from './runtimeResultTests'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createScannerAssistantRuntime } from './runtime'
import {
  createNativeFixtureRuntime,
  FakeEventSource,
  helperFetch,
  nativeIdentity,
  readySnapshot,
} from './runtime.testFixture'

describe('direct upstream scanner runtime', () => {
  registerRuntimeResultTests()
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
  it('waits for a user action before an HTTPS page reaches the loopback helper', async () => {
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
    expect(listener).toHaveBeenCalledWith(readySnapshot)
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
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(readySnapshot))
    expect(streamRequest).toEqual({
      url: 'http://127.0.0.1:43127/api/events',
      authorization: token,
    })
    await runtime.commands.revokePairing()
    expect(revoked).toBe(true)
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'connection_failed' }),
    )
    unsubscribe()
  })

  it.each([
    { ...nativeIdentity, version: '2.2.0' },
    { ...nativeIdentity, transport: 'node-compatibility' },
    { ...nativeIdentity, protocolVersion: 4 },
    { ...nativeIdentity, accountWriteEnabled: true },
    { ...nativeIdentity, importAccess: true },
    { ok: true },
  ])(
    'rejects incompatible helper capabilities before token or scan access: %j',
    async (identity) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(identity)))
      const runtime = createScannerAssistantRuntime({ fetchImpl, maxReconnectAttempts: 1 })
      await expect(runtime.commands.retryConnection()).rejects.toThrow('扫描助手未就绪')
      await expect(runtime.commands.startScan()).rejects.toThrow('扫描助手未就绪')
      expect(fetchImpl.mock.calls).toHaveLength(2)
      expect(fetchImpl.mock.calls.every(([url]) => new URL(String(url)).pathname === '/')).toBe(
        true,
      )
    },
  )

  it('connects to the RC8 Helper without treating version 2.3.4 as an old installation', async () => {
    const otherRequests = helperFetch()
    const fetchImpl = vi.fn<typeof fetch>((input, init) =>
      new URL(String(input)).pathname === '/'
        ? Promise.resolve(new Response(JSON.stringify({ ...nativeIdentity, version: '2.3.4' })))
        : otherRequests(input, init),
    )
    const runtime = createScannerAssistantRuntime({ fetchImpl, maxReconnectAttempts: 1 })
    await expect(runtime.commands.retryConnection()).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/',
      '/token',
      '/api/retry',
    ])
  })

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
  beforeEach(() => {
    FakeEventSource.latest = null
    FakeEventSource.instances = []
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

    expect(listener).toHaveBeenCalledWith(readySnapshot)
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

  it('loads both evidence images through authenticated helper fetches and releases their Blob URLs', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      const authenticated =
        (init?.headers as Record<string, string>)?.['X-Soda-Scanner-Token'] === 'a'.repeat(48)
      if (path.endsWith('/evidence/item-1'))
        return {
          ok: authenticated,
          status: 200,
          json: async () => ({
            availability: 'available',
            detailSrc: '/api/result/handle/evidence/item-1/detail',
            cardSrc: '/api/result/handle/evidence/item-1/card',
            visualDetailHash: 'sha256:detail',
          }),
        } as Response
      return {
        ok: authenticated,
        status: 200,
        headers: { get: () => 'image/png' },
        blob: async () => new Blob(['image']),
      } as unknown as Response
    })
    const createObjectURL = vi.fn((blob: Blob) => `blob:test-${blob.size}`)
    const revokeObjectURL = vi.fn()
    const runtime = createNativeFixtureRuntime({
      token: 'a'.repeat(48),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      createObjectURL,
      revokeObjectURL,
    })

    const evidence = await runtime.commands.requestResultEvidence('handle', 'item-1')

    expect(evidence.detailSrc).toBe('blob:test-5')
    expect(evidence.cardSrc).toBe('blob:test-5')
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:43127/token',
      'http://127.0.0.1:43127/api/result/handle/evidence/item-1',
      'http://127.0.0.1:43127/api/result/handle/evidence/item-1/detail',
      'http://127.0.0.1:43127/api/result/handle/evidence/item-1/card',
    ])
    evidence.revoke()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-5')
  })

  it('rejects non-image evidence without creating a Blob URL', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith('/evidence/item-1'))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            availability: 'available',
            detailSrc: '/api/result/handle/evidence/item-1/detail',
            cardSrc: '/api/result/handle/evidence/item-1/card',
            visualDetailHash: 'sha256:detail',
          }),
        } as Response
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        blob: async () => new Blob(['not-image']),
      } as unknown as Response
    })
    const createObjectURL = vi.fn()
    const runtime = createNativeFixtureRuntime({
      token: 'a'.repeat(48),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      createObjectURL,
    })

    await expect(runtime.commands.requestResultEvidence('handle', 'item-1')).rejects.toThrow(
      'helper_evidence_content_type_invalid',
    )
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('does not forge a disconnect while the browser is hidden', async () => {
    const runtime = createNativeFixtureRuntime({
      token: 'a'.repeat(48),
      fetchImpl: helperFetch() as unknown as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await vi.waitFor(() => expect(FakeEventSource.latest).not.toBeNull())
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)

    FakeEventSource.latest?.onerror?.()
    expect(listener).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'connection_failed' }),
    )

    hidden.mockRestore()
    unsubscribe()
  })

  it('acquires a session token directly from the loopback helper', async () => {
    const fetchImpl = helperFetch()
    const runtime = createNativeFixtureRuntime({
      token: '',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      maxReconnectAttempts: 1,
    })
    await expect(runtime.commands.openHelper()).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/token',
      '/api/retry',
    ])
  })

  it('prefers a native token before opening the initial live status stream', async () => {
    const staleToken = 's'.repeat(48)
    const nativeToken = 'n'.repeat(48)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      const supplied = (init?.headers as Record<string, string> | undefined)?.[
        'X-Soda-Scanner-Token'
      ]
      if (path === '/token')
        return new Response(JSON.stringify({ token: nativeToken }), { status: 200 })
      if (path === '/api/retry')
        return new Response(JSON.stringify(readySnapshot), {
          status: supplied === nativeToken ? 200 : 401,
        })
      throw new Error(`unexpected_request:${path}`)
    })
    const runtime = createNativeFixtureRuntime({
      token: staleToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      maxReconnectAttempts: 1,
    })
    const unsubscribe = runtime.subscribe(vi.fn())

    await vi.waitFor(() =>
      expect(FakeEventSource.latest?.url).toBe('http://127.0.0.1:43127/api/events'),
    )
    expect(FakeEventSource.latest?.authorization).toBe(nativeToken)
    expect(FakeEventSource.instances).toHaveLength(1)
    await runtime.commands.retryConnection()
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/token',
      '/api/retry',
    ])
    unsubscribe()
  })

  it('keeps a supplied session when the verified native token route is temporarily unavailable', async () => {
    const launcherToken = 'l'.repeat(48)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      if (path === '/token') return new Response(null, { status: 401 })
      if (path === '/api/retry')
        return new Response(JSON.stringify(readySnapshot), {
          status:
            (init?.headers as Record<string, string> | undefined)?.['X-Soda-Scanner-Token'] ===
            launcherToken
              ? 200
              : 401,
        })
      throw new Error(`unexpected_request:${path}`)
    })
    const runtime = createNativeFixtureRuntime({
      token: launcherToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxReconnectAttempts: 1,
    })

    await expect(runtime.commands.openHelper()).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/token',
      '/api/retry',
    ])
  })

  it('uses the same-origin token only after verifying the native helper', async () => {
    const fetchImpl = helperFetch()
    fetchImpl.mockImplementationOnce(async () => {
      throw new TypeError('helper offline')
    })
    const runtime = createNativeFixtureRuntime({
      token: '',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
      maxReconnectAttempts: 1,
    })
    await expect(runtime.commands.openHelper()).resolves.toBeUndefined()
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/token',
      '/_soda/runtime-config',
      '/api/retry',
    ])
  })
})
