import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssetQuickReadBridgeClient, assetQuickReadBridgeUrl } from './bridgeClient'

const jobId = '1e80b26d-39fa-41a5-afbf-fca374acb6ee'
const health = {
  service: 'soda-asset-quick-read',
  version: '1.0.0',
  protocolVersion: 1,
  capabilities: ['asset_snapshot', 'explicit_uac_start', 'cancel'],
  state: 'idle',
}
const job = {
  jobId,
  targetAccountId: 'account-synthetic',
  state: 'starting',
  phase: 'awaiting_elevation',
  code: null,
  startedAt: '2026-10-10T00:00:00Z',
  readyAt: null,
  deadline: null,
  remainingSeconds: null,
  counts: { discs: 0, engines: 0, agents: 0 },
  candidateAvailable: false,
}
function transport(responses: Array<{ status?: number; body: unknown }>) {
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const item = responses.shift()
    if (!item) throw new Error('Unexpected request')
    return new Response(JSON.stringify(item.body), { status: item.status ?? 200 })
  })
}
const session = {
  token: ['synthetic', 'session', 'value', '000000000000000000000'].join('-'),
  version: '1.0.0',
  expiresAt: '2026-10-10T01:00:00Z',
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('independent asset bridge client', () => {
  it('binds the native browser fetch receiver when using the default transport', async () => {
    const responses = [health, session]
    vi.stubGlobal('fetch', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response(JSON.stringify(responses.shift()), { status: 200 }))
    })
    await expect(new AssetQuickReadBridgeClient().connect()).resolves.toEqual(health)
  })
  it('cannot start without a RAM session and never makes a protected request', async () => {
    const fetcher = transport([])
    await expect(
      new AssetQuickReadBridgeClient(fetcher).start("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18", 'account-synthetic'),
    ).rejects.toThrow('先连接')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('validates health and carries RAM authorization only in a header', async () => {
    const fetcher = transport([{ body: health }, { body: session }, { status: 202, body: job }])
    const client = new AssetQuickReadBridgeClient(fetcher)
    await client.connect()
    expect(await client.start("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18", 'account-synthetic')).toEqual(job)
    const [url, request] = fetcher.mock.calls[2]!
    expect(url).toBe(`${assetQuickReadBridgeUrl}/jobs`)
    expect(url).not.toContain(session.token)
    expect(request?.headers).toMatchObject({ Authorization: `Bearer ${session.token}` })
    expect(JSON.parse(request!.body as string)).toEqual({
      clientDirectory: "soda-source-ref:24d5780e541a1a1ad1393e8962be6e18",
      targetAccountId: 'account-synthetic',
      riskAcknowledged: true,
    })
    expect(request).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' })
  })
  it('rejects incompatible health before pairing or any start', async () => {
    const fetcher = transport([{ body: { ...health, protocolVersion: 9 } }])
    await expect(new AssetQuickReadBridgeClient(fetcher).connect()).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('does not silently retry a rejected start or expose arbitrary server errors', async () => {
    const fetcher = transport([
      { body: health },
      { body: session },
      { status: 409, body: { error: { code: 'game_running', privateBody: 'not exposed' } } },
    ])
    const client = new AssetQuickReadBridgeClient(fetcher)
    await client.connect()
    await expect(client.start("soda-source-ref:24d5780e541a1a1ad1393e8962be6e18", 'account-synthetic')).rejects.toThrow(
      '完全退出',
    )
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it('stops a specific owned job and rejects a path-shaped identifier', async () => {
    const fetcher = transport([
      { body: health },
      { body: session },
      { body: { ...job, state: 'stopped' } },
    ])
    const client = new AssetQuickReadBridgeClient(fetcher)
    await client.connect()
    expect((await client.cancel(jobId)).state).toBe('stopped')
    await expect(client.cancel('../../other')).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})

it('launches only from explicit connect after probing, then pairs without starting a capture', async () => {
  vi.useFakeTimers()
  const fetcher = transport([{ body: health }, { body: session }])
  fetcher.mockRejectedValueOnce(new TypeError('service not running'))
  const launch = vi.fn()
  const pending = new AssetQuickReadBridgeClient(fetcher, launch).connect({ launchIfMissing: true })
  await vi.advanceTimersByTimeAsync(350)
  await expect(pending).resolves.toEqual(health)
  expect(launch).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    `${assetQuickReadBridgeUrl}/health`,
    `${assetQuickReadBridgeUrl}/health`,
    `${assetQuickReadBridgeUrl}/connect`,
  ])
})
it('bounds even a non-settling transport and aborts a launch wait without pairing', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn<typeof fetch>().mockReturnValue(new Promise(() => {}))
  const launch = vi.fn()
  const abort = new AbortController()
  const pending = new AssetQuickReadBridgeClient(fetcher, launch).connect({
    launchIfMissing: true,
    signal: abort.signal,
  })
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(1000)
  expect(launch).toHaveBeenCalledOnce()
  abort.abort()
  await rejected
  await vi.advanceTimersByTimeAsync(4000)
  expect(fetcher).toHaveBeenCalledOnce()
})
