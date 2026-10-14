import { expect, it, vi } from 'vitest'
import {
  createNativeFixtureRuntime,
  FakeEventSource,
  helperFetch,
  nativeIdentity,
  readySnapshot,
} from './runtime.testFixture'
export function registerruntimeLifecycleCases2() {
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

  it('connects a 6s cold-started helper by continuing retries across the full bounded deadline', async () => {
    vi.useFakeTimers()
    const began = Date.now()
    const launch = vi.fn()
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname
      if (path === '/') return new Response(JSON.stringify(nativeIdentity))
      if (Date.now() - began < 6000) throw new TypeError('not yet listening')
      if (path === '/token') return new Response(JSON.stringify({ token: 'k'.repeat(48) }))
      if (path === '/api/retry') return new Response(JSON.stringify(readySnapshot))
      throw new Error(`unexpected:${path}`)
    })
    const runtime = createNativeFixtureRuntime({
      fetchImpl: fetchImpl as typeof fetch,
      launchProtocol: launch,
      deferInitialConnection: true,
    })
    const pending = runtime.commands.openHelper(true)
    await vi.advanceTimersByTimeAsync(4750)
    expect(launch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1500)
    await expect(pending).resolves.toBeUndefined()
    expect(launch).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('fails with timeout when helper remains unavailable beyond the full 30s deadline', async () => {
    vi.useFakeTimers()
    const launch = vi.fn()
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('not yet listening')
    })
    const runtime = createNativeFixtureRuntime({
      fetchImpl: fetchImpl as typeof fetch,
      launchProtocol: launch,
      deferInitialConnection: true,
    })
    const pending = runtime.commands.openHelper(true)
    await vi.advanceTimersByTimeAsync(29000)
    expect(launch).toHaveBeenCalledOnce()
    const rejected = expect(pending).rejects.toMatchObject({ name: 'ScannerHelperTimeoutError' })
    await vi.advanceTimersByTimeAsync(2000)
    await rejected
    expect(launch).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
}
