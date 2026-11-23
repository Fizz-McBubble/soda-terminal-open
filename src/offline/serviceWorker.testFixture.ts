import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { createHash, webcrypto } from 'node:crypto'
import { vi } from 'vitest'

export const current = 'public-r3-20260928'
export const r2 = 'public-r2-20260927'
export const r1 = 'public-r1-20260926'
export const workerAsset = '/assets/browserCalculationQuery.worker-abcd1234.js'
const assets = [
  '/index.html',
  '/assets/entry-abcd1234.js',
  workerAsset,
  '/assets/lazy-abcd1234.js',
  '/assets/decorative-abcd1234.png',
]
const criticalAssets = assets.slice(0, 4)
export const name = (release: string) => `soda-public-shell-${release}`
export const manifest = (release: string) => ({
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

export function createWorker(
  options: {
    release?: string
    old?: string[]
    fail?: string
    tabs?: Array<{ id: string; release?: string }>
    corrupt?: string
    invalidHash?: boolean
    legacyOld?: boolean
    redirectedIndex?: boolean
    transient?: number | 'network' | 'stall' | 'body-stall'
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
  let transientFailed = false
  const fetcher = vi.fn(async (request: string | { url: string }, requestOptions?: RequestInit) => {
    void requestOptions
    const path = typeof request === 'string' ? request : new URL(request.url).pathname
    if (!online || path === options.fail) throw new TypeError('network_unavailable')
    if (path === workerAsset && options.transient !== undefined && !transientFailed) {
      transientFailed = true
      if (options.transient === 'network') throw new TypeError('temporary_network_failure')
      if (options.transient === 'stall') return new Promise<Response>(() => {})
      if (options.transient === 'body-stall') {
        const response = new Response('stalled body')
        vi.spyOn(response, 'clone').mockReturnValue({
          arrayBuffer: () => new Promise<ArrayBuffer>(() => {}),
        } as Response)
        return response
      }
      return new Response('temporary failure', { status: options.transient })
    }
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
    AbortController,
    setTimeout,
    clearTimeout,
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
