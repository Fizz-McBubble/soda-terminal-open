/* The public build audit writes offline-shell-manifest.json beside this file. */
const releaseId = new URL(self.location.href).searchParams.get('release')
const cachePrefix = 'soda-public-shell-'
const cacheName = `${cachePrefix}${releaseId}`
const backgroundBatchSize = 6
let warmPromise
let fullyWarmed = false

function allowedAsset(pathname) {
  return (
    pathname === '/index.html' ||
    pathname === '/favicon.svg' ||
    /^\/assets\/[a-zA-Z0-9._~/-]+\.(?:avif|css|gif|jpe?g|js|json|png|svg|wasm|webp|woff2?)$/.test(pathname)
  )
}

async function checkedManifest() {
  if (!releaseId || !/^[a-zA-Z0-9._-]{8,80}$/.test(releaseId)) throw new Error('invalid_release')
  const response = await fetch('/offline-shell-manifest.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('manifest_unavailable')
  const manifest = await response.clone().json()
  if (
    manifest.releaseId !== releaseId ||
    (manifest.browserCompute === true
      ? !/^\/assets\/browserCalculationQuery\.worker-[a-zA-Z0-9_-]+\.js$/.test(
          manifest.computeWorker,
        ) || !manifest.criticalAssets.includes(manifest.computeWorker)
      : manifest.publicCoreSeparated !== true) ||
    !Array.isArray(manifest.assets) ||
    !Array.isArray(manifest.criticalAssets) ||
    manifest.assets.length === 0 ||
    !manifest.assets.includes('/index.html') ||
    !manifest.criticalAssets.includes('/index.html') ||
    manifest.assets.some((asset) => typeof asset !== 'string' || !allowedAsset(asset)) ||
    manifest.criticalAssets.some((asset) => !manifest.assets.includes(asset))
  ) {
    throw new Error('invalid_public_manifest')
  }
  return { manifest, response }
}

function warmRemaining() {
  if (fullyWarmed) return Promise.resolve()
  if (warmPromise) return warmPromise
  warmPromise = (async () => {
    const cache = await caches.open(cacheName)
    const stored = await cache.match('/offline-shell-manifest.json')
    if (!stored) return
    const manifest = await stored.json()
    if (manifest.releaseId !== releaseId) return
    for (let offset = 0; offset < manifest.assets.length; offset += backgroundBatchSize) {
      const batch = manifest.assets.slice(offset, offset + backgroundBatchSize)
      const missing = []
      for (const asset of batch) if (!(await cache.match(asset))) missing.push(asset)
      if (missing.length) await cache.addAll(missing)
    }
    fullyWarmed = true
  })().finally(() => {
    warmPromise = undefined
  })
  return warmPromise
}

function retryWarm(event) {
  event.waitUntil(
    warmRemaining().catch(() => {
      // A later same-origin request retries the unfinished batch.
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const { manifest, response } = await checkedManifest()
      const cache = await caches.open(cacheName)
      for (let offset = 0; offset < manifest.criticalAssets.length; offset += backgroundBatchSize)
        await cache.addAll(manifest.criticalAssets.slice(offset, offset + backgroundBatchSize))
      await cache.put('/offline-shell-manifest.json', response)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_soda/') ||
    url.pathname.startsWith('/downloads/') ||
    url.pathname === '/official-catalog-cache' ||
    url.pathname === '/offline-shell-manifest.json' ||
    url.pathname === '/service-worker.js'
  )
    return

  if (request.mode === 'navigate') {
    retryWarm(event)
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cache = await caches.open(cacheName)
          return (await cache.match('/index.html')) ?? Response.error()
        }
      })(),
    )
    return
  }
  if (!allowedAsset(url.pathname)) return
  retryWarm(event)
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName)
      const cached = await cache.match(request)
      if (cached) return cached
      for (const name of await caches.keys()) {
        if (!name.startsWith(cachePrefix) || name === cacheName) continue
        const previous = await (await caches.open(name)).match(request)
        if (previous) return previous
      }
      const network = await fetch(request)
      if (network.ok) {
        const stored = await cache.match('/offline-shell-manifest.json')
        const manifest = await stored?.json()
        if (manifest?.assets.includes(url.pathname))
          event.waitUntil(cache.put(request, network.clone()).catch(() => {}))
      }
      return network
    })(),
  )
})
