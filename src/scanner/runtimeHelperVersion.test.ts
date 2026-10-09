import { describe, expect, it, vi } from 'vitest'
import { createScannerAssistantRuntime } from './runtime'
import { scannerDistributionManifest } from './distribution'
import { FakeEventSource, helperFetch, nativeIdentity, readySnapshot } from './runtime.testFixture'

describe('scanner Helper version and update policy', () => {
  it.each([
    { ...nativeIdentity, version: '2.2.0' },
    { ...nativeIdentity, version: '99.0.0' },
    { ...nativeIdentity, version: '2.3.0' },
    { ...nativeIdentity, version: '2.3.999' },
    { ...nativeIdentity, version: '2.4.1' },
    { ...nativeIdentity, version: ['2.3.9'] },
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

  it.each([
    '2.3.4',
    '2.3.5',
    '2.3.6',
    '2.3.7',
    '2.3.8',
    '2.3.9',
    scannerDistributionManifest.helper.version,
  ])('connects to published Helper %s for updating and result recovery', async (version) => {
    const otherRequests = helperFetch()
    const fetchImpl = vi.fn<typeof fetch>((input, init) =>
      new URL(String(input)).pathname === '/'
        ? Promise.resolve(new Response(JSON.stringify({ ...nativeIdentity, version })))
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

  it.each(['2.3.1', '2.3.8', '2.3.9'])(
    'requires Helper %s to update before a new scan, while keeping result recovery',
    async (version) => {
      const otherRequests = helperFetch()
      const fetchImpl = vi.fn<typeof fetch>((input, init) =>
        new URL(String(input)).pathname === '/'
          ? Promise.resolve(new Response(JSON.stringify({ ...nativeIdentity, version })))
          : otherRequests(input, init),
      )
      const runtime = createScannerAssistantRuntime({ fetchImpl, maxReconnectAttempts: 1 })
      await expect(runtime.commands.startScan()).rejects.toThrow('请更新扫描助手后再扫描')
      expect(otherRequests).not.toHaveBeenCalled()
      await expect(runtime.commands.requestResultFile()).resolves.toEqual(
        expect.objectContaining({ resultFileHandle: 'scanner-r10c-test' }),
      )
      expect(
        fetchImpl.mock.calls.some(([url]) => new URL(String(url)).pathname === '/api/start'),
      ).toBe(false)
    },
  )

  it('shows an update even if an old Helper reports the current component as ready', async () => {
    FakeEventSource.latest = null
    const otherRequests = helperFetch()
    const fetchImpl = vi.fn<typeof fetch>((input, init) =>
      new URL(String(input)).pathname === '/'
        ? Promise.resolve(new Response(JSON.stringify({ ...nativeIdentity, version: '2.3.9' })))
        : otherRequests(input, init),
    )
    const runtime = createScannerAssistantRuntime({
      fetchImpl,
      EventSourceImpl: FakeEventSource as unknown as typeof EventSource,
    })
    const listener = vi.fn()
    const unsubscribe = runtime.subscribe(listener)
    await vi.waitFor(() => expect(FakeEventSource.latest).not.toBeNull())
    const stream = FakeEventSource.latest as FakeEventSource | null
    stream?.emit(readySnapshot)
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'ready',
        readiness: expect.objectContaining({ helperConnected: true }),
        distribution: expect.objectContaining({ state: 'update_available', action: 'update' }),
      }),
    )
    unsubscribe()
  })

  it('does not retry a scan if the restarted Helper requires updating', async () => {
    let identities = 0
    let scanRequests = 0
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      switch (new URL(String(input)).pathname) {
        case '/':
          return new Response(
            JSON.stringify({
              ...nativeIdentity,
              version: ++identities === 1 ? scannerDistributionManifest.helper.version : '2.3.9',
            }),
          )
        case '/token':
          return new Response(JSON.stringify({ token: 's'.repeat(48) }))
        case '/api/start':
          scanRequests += 1
          return new Response(null, { status: 401 })
        default:
          throw new Error('unexpected request')
      }
    })
    const runtime = createScannerAssistantRuntime({ fetchImpl })
    await expect(runtime.commands.startScan()).rejects.toThrow('请更新扫描助手后再扫描')
    expect(identities).toBe(2)
    expect(scanRequests).toBe(1)
  })
})
