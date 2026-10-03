import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { createHash, webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

const current = 'public-r3-20260928'
const r2 = 'public-r2-20260927'
const r1 = 'public-r1-20260926'
const workerAsset = '/assets/browserCalculationQuery.worker-abcd1234.js'
const assets = [
  '/index.html',
  '/assets/entry-abcd1234.js',
  workerAsset,
  '/assets/lazy-abcd1234.js',
  '/assets/decorative-abcd1234.png',
]
const criticalAssets = assets.slice(0, 4)
const name = (release: string) => `soda-public-shell-${release}`
const manifest = (release: string) => ({
  releaseId: release,
  browserCompute: true,
  computeWorker: workerAsset,
  assets,
  criticalAssets,
  criticalAssetSha256: Object.fromEntries(
    criticalAssets.map((path) => [
      path,
      createHash('sha256').update(`${release}:${path}`).digest('hex'),
    ]),
  ),
})

type Tab = { id: string; release?: string; postMessage: ReturnType<typeof vi.fn> }

function createWorker(
  options: {
    release?: string
    old?: string[]
    fail?: string
    tabs?: Array<{ id: string; release?: string }>
    corrupt?: string
    invalidHash?: boolean
    legacyOld?: boolean
    redirectedIndex?: boolean
  } = {},
) {
  const release = options.release ?? current
  const listeners = new Map<string, (event: Record<string, unknown>) => void>()
  const entries = new Map<string, Map<string, Response>>()
  for (const release of options.old ?? [])
    entries.set(
      name(release),
      new Map([
        [
          '/offline-shell-manifest.json',
          Response.json({
            ...manifest(release),
            ...(options.legacyOld ? { criticalAssetSha256: undefined } : {}),
          }),
        ],
        ...criticalAssets.map((path): [string, Response] => [
          path,
          new Response(`${release}:${path}`),
        ]),
      ]),
    )
  const tabs: Tab[] = (options.tabs ?? []).map((tab) => ({ ...tab, postMessage: vi.fn() }))
  let online = true
  const fetcher = vi.fn(async (request: string | { url: string }) => {
    const path = typeof request === 'string' ? request : new URL(request.url).pathname
    if (!online || path === options.fail) throw new Error('network_unavailable')
    if (path === '/offline-shell-manifest.json')
      return Response.json({
        ...manifest(release),
        ...(options.invalidHash ? { criticalAssetSha256: {} } : {}),
      })
    return new Response(
      path === options.corrupt
        ? '<script src="/assets/new-release.js"></script>'
        : `${release}:${path}`,
    )
  })
  const cacheApi = {
    open: vi.fn(async (cacheName: string) => {
      if (!entries.has(cacheName)) entries.set(cacheName, new Map())
      const contents = entries.get(cacheName)!
      const key = (request: string | { url: string }) =>
        typeof request === 'string' ? request : new URL(request.url).pathname
      return {
        match: async (request: string | { url: string }) => {
          const response = contents.get(key(request))?.clone()
          if (response && options.redirectedIndex && key(request) === '/index.html')
            Object.defineProperty(response, 'redirected', { value: true })
          return response
        },
        put: async (request: string | { url: string }, response: Response) => {
          contents.set(key(request), response.clone())
        },
        addAll: async (paths: string[]) => {
          const responses = await Promise.all(paths.map((path) => fetcher(path)))
          paths.forEach((path, index) => contents.set(path, responses[index].clone()))
        },
      }
    }),
    keys: vi.fn(async () => [...entries.keys()]),
    delete: vi.fn(async (cacheName: string) => entries.delete(cacheName)),
  }
  let claimed = false
  const skipWaiting = vi.fn(async () => undefined)
  runInNewContext(readFileSync(resolve('public/service-worker.js'), 'utf8'), {
    URL,
    Response,
    Map,
    Set,
    Uint8Array,
    crypto: webcrypto,
    caches: cacheApi,
    fetch: fetcher,
    self: {
      location: {
        href: `https://soda.example/service-worker.js?release=${release}`,
        origin: 'https://soda.example',
      },
      addEventListener: (event: string, callback: (value: Record<string, unknown>) => void) =>
        listeners.set(event, callback),
      skipWaiting,
      clients: {
        claim: async () => {
          claimed = true
        },
        matchAll: async () => tabs,
      },
    },
  })
  const dispatch = async (event: string, details: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = []
    let response: Promise<Response> | undefined
    listeners.get(event)?.({
      ...details,
      waitUntil: (value: Promise<unknown>) => waits.push(value),
      respondWith: (value: Promise<Response>) => {
        response = value
      },
    })
    for (let i = 0; i < waits.length; i++) await waits[i]
    return response ? await response : undefined
  }
  const tag = (id: string, release: string) =>
    dispatch('message', {
      source: { id },
      data: { type: 'soda-offline-release-tag', releaseId: release },
    })
  const asset = (path: string, clientId = 'new') =>
    dispatch('fetch', {
      clientId,
      request: { method: 'GET', mode: 'cors', url: `https://soda.example${path}` },
    })
  return {
    dispatch,
    tag,
    asset,
    entries,
    cacheApi,
    tabs,
    fetcher,
    skipWaiting,
    setOnline: (value: boolean) => {
      online = value
    },
    isClaimed: () => claimed,
  }
}

describe('public service worker release cache lifecycle', () => {
  it.each(['interrupted', 'evicted', 'damaged'])(
    'repairs a %s same-release cache before activating',
    async (state) => {
      const worker = createWorker({ old: [current, r2] })
      const cache = worker.entries.get(name(current))!
      const retained = cache.get('/index.html')
      if (state === 'interrupted') cache.delete('/offline-shell-manifest.json')
      if (state === 'damaged') cache.set(workerAsset, new Response('damaged-worker'))
      else cache.delete(workerAsset)
      await worker.dispatch('install')
      expect(worker.skipWaiting).toHaveBeenCalledOnce()
      expect(cache.get('/index.html')).toBe(retained)
      expect(await cache.get(workerAsset)!.clone().text()).toBe(`${current}:${workerAsset}`)
      expect(cache.has('/offline-shell-manifest.json')).toBe(true)
      expect(worker.cacheApi.delete).not.toHaveBeenCalled()
      expect(worker.fetcher).toHaveBeenCalledWith(workerAsset, { cache: 'no-store' })
      expect(worker.fetcher).not.toHaveBeenCalledWith('/index.html', { cache: 'no-store' })
      await worker.tag('new', current)
      worker.setOnline(false)
      expect(await (await worker.asset(workerAsset))!.text()).toBe(`${current}:${workerAsset}`)
    },
  )

  it('never refills an evicted critical asset with bytes from another release', async () => {
    const worker = createWorker()
    await worker.dispatch('install')
    worker.entries.get(name(current))!.delete(workerAsset)
    worker.fetcher.mockResolvedValueOnce(new Response('wrong-release-worker'))
    await expect(worker.asset(workerAsset)).rejects.toThrow('critical_asset_release_mismatch')
    expect(worker.entries.get(name(current))!.has(workerAsset)).toBe(false)
  })

  it.each(['open', 'keys'] as const)(
    'recovers online with checked bytes when Cache Storage %s becomes unavailable',
    async (operation) => {
      const worker = createWorker()
      await worker.dispatch('install')
      worker.cacheApi[operation].mockRejectedValue(
        new DOMException('Cache disabled', 'SecurityError'),
      )
      worker.fetcher.mockClear()
      expect(await (await worker.asset(workerAsset))!.text()).toBe(`${current}:${workerAsset}`)
      expect(await (await worker.asset('/assets/entry-abcd1234.js'))!.text()).toBe(
        `${current}:/assets/entry-abcd1234.js`,
      )
      expect(
        worker.fetcher.mock.calls.filter(([request]) => request === '/offline-shell-manifest.json'),
      ).toHaveLength(1)
      worker.fetcher.mockResolvedValueOnce(new Response('wrong-release-worker'))
      await expect(worker.asset(workerAsset)).rejects.toThrow('critical_asset_release_mismatch')
    },
  )

  it('refuses a different online release when cache access is unavailable', async () => {
    const worker = createWorker()
    await worker.dispatch('install')
    worker.cacheApi.open.mockRejectedValue(new DOMException('Cache disabled', 'SecurityError'))
    worker.fetcher.mockResolvedValueOnce(Response.json(manifest(r2)))
    await expect(worker.asset(workerAsset)).rejects.toThrow('invalid_public_manifest')
    expect(await (await worker.asset(workerAsset))!.text()).toBe(`${current}:${workerAsset}`)
  })

  it.each(['/index.html', workerAsset, '/assets/entry-abcd1234.js'])(
    'rejects a mixed-release critical asset %s without activating or losing the legacy predecessor',
    async (corrupt) => {
      const worker = createWorker({ old: [r2], legacyOld: true, corrupt })
      await expect(worker.dispatch('install')).rejects.toThrow('critical_asset_release_mismatch')
      expect(worker.skipWaiting).not.toHaveBeenCalled()
      expect(worker.entries.has(name(current))).toBe(false)
      expect(await worker.entries.get(name(r2))!.get('/index.html')!.clone().text()).toBe(
        `${r2}:/index.html`,
      )
    },
  )

  it('rejects an unhashed new manifest before touching the release cache', async () => {
    const worker = createWorker({ old: [r2], invalidHash: true })
    await expect(worker.dispatch('install')).rejects.toThrow('invalid_public_manifest')
    expect(worker.skipWaiting).not.toHaveBeenCalled()
    expect(worker.entries.has(name(current))).toBe(false)
    expect(worker.entries.has(name(r2))).toBe(true)
  })

  it('preserves an existing same-release cache when reinstall validation fails', async () => {
    const worker = createWorker({ old: [current, r2], corrupt: workerAsset })
    const cache = worker.entries.get(name(current))!
    cache.set(workerAsset, new Response('mismatched-worker'))
    cache.set('/index.html', new Response('damaged-index'))
    await expect(worker.dispatch('install')).rejects.toThrow('critical_asset_release_mismatch')
    expect(worker.skipWaiting).not.toHaveBeenCalled()
    expect(await cache.get('/index.html')!.clone().text()).toBe('damaged-index')
    expect(await cache.get(workerAsset)!.clone().text()).toBe('mismatched-worker')
    expect(worker.cacheApi.delete).not.toHaveBeenCalled()
  })

  it('installs every execution asset and supports a new calculation after the page goes offline without warming decoration', async () => {
    const worker = createWorker()
    await worker.dispatch('install')
    await worker.dispatch('activate')
    expect(worker.entries.get(name(current))?.has(workerAsset)).toBe(true)
    expect(worker.entries.get(name(current))?.has('/assets/decorative-abcd1234.png')).toBe(false)
    worker.setOnline(false)
    const page = await worker.dispatch('fetch', {
      clientId: 'new',
      request: { method: 'GET', mode: 'navigate', url: 'https://soda.example/account' },
    })
    expect(await page?.text()).toBe(`${current}:/index.html`)
    expect(await (await worker.asset(workerAsset))?.text()).toBe(`${current}:${workerAsset}`)
    expect(await (await worker.asset('/assets/lazy-abcd1234.js'))?.text()).toBe(
      `${current}:/assets/lazy-abcd1234.js`,
    )
    expect(worker.fetcher).not.toHaveBeenCalledWith('/assets/decorative-abcd1234.png')
  })

  it('serves verified HTML offline without the CDN redirect flag rejected by navigation', async () => {
    const worker = createWorker({ redirectedIndex: true })
    await worker.dispatch('install')
    const cached = await (await worker.cacheApi.open(name(current))).match('/index.html')
    expect(cached?.redirected).toBe(true)
    worker.setOnline(false)
    const response = await worker.dispatch('fetch', {
      clientId: 'new',
      request: { method: 'GET', mode: 'navigate', url: 'https://soda.example/account' },
    })
    expect(response?.redirected).toBe(false)
    expect(response?.status).toBe(200)
    expect(response?.headers.get('content-type')).toBe('text/plain;charset=UTF-8')
    expect(await response?.text()).toBe(`${current}:/index.html`)
  })

  it('keeps current, immediate predecessor and an active older tab, then prunes after that tab closes', async () => {
    const worker = createWorker({
      old: [r1, r2],
      tabs: [
        { id: 'old', release: r1 },
        { id: 'new', release: current },
      ],
    })
    await worker.dispatch('install')
    await worker.dispatch('activate')
    expect(worker.isClaimed()).toBe(true)
    expect(worker.tabs[0].postMessage).toHaveBeenCalledWith({ type: 'soda-offline-release-query' })
    expect(worker.cacheApi.delete).not.toHaveBeenCalled()
    await worker.tag('old', r1)
    await worker.tag('new', current)
    expect([...worker.entries.keys()]).toEqual([name(r1), name(r2), name(current)])
    worker.setOnline(false)
    expect(await (await worker.asset('/assets/entry-abcd1234.js', 'old'))?.text()).toBe(
      `${r1}:/assets/entry-abcd1234.js`,
    )
    worker.tabs.shift()
    await worker.tag('new', current)
    expect([...worker.entries.keys()]).toEqual([name(r2), name(current)])
  })

  it('retains every old cache while any tab has an unknown release, then limits current-page fallback', async () => {
    const worker = createWorker({
      old: [r1, r2],
      tabs: [{ id: 'unknown' }, { id: 'new', release: current }],
    })
    await worker.dispatch('install')
    await worker.dispatch('activate')
    await worker.tag('new', current)
    expect([...worker.entries.keys()]).toEqual([name(r1), name(r2), name(current)])
    worker.setOnline(false)
    expect(await (await worker.asset('/assets/entry-abcd1234.js', 'unknown'))?.text()).toBe(
      `${r2}:/assets/entry-abcd1234.js`,
    )
    worker.tabs.shift()
    await worker.tag('new', current)
    expect(worker.entries.has(name(r1))).toBe(false)
  })

  it('discards a failed new install and preserves the last complete release for rollback', async () => {
    const worker = createWorker({ old: [r2], fail: workerAsset })
    await expect(worker.dispatch('install')).rejects.toThrow('network_unavailable')
    expect(worker.entries.has(name(current))).toBe(false)
    expect(worker.entries.has(name(r2))).toBe(true)
    expect(worker.cacheApi.delete).toHaveBeenCalledWith(name(current))
  })

  it('retains the newer release as predecessor when a deployment rolls back', async () => {
    const worker = createWorker({
      release: r2,
      old: [r1, r2, current],
      tabs: [{ id: 'rollback', release: r2 }],
    })
    await worker.dispatch('install')
    await worker.dispatch('activate')
    await worker.tag('rollback', r2)
    expect([...worker.entries.keys()]).toEqual([name(r2), name(current)])
    worker.setOnline(false)
    expect(await (await worker.asset('/assets/entry-abcd1234.js', 'rollback'))?.text()).toBe(
      `${r2}:/assets/entry-abcd1234.js`,
    )
  })
})
