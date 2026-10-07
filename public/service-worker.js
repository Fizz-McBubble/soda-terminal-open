/* The public build audit writes offline-shell-manifest.json beside this file. */
const releaseId = new URL(self.location.href).searchParams.get('release')
const cachePrefix = 'soda-public-shell-'
const cacheName = `${cachePrefix}${releaseId}`
const installBatchSize = 6
const navigationNetworkTimeoutMs = 8000
const clientReleases = new Map()
const completeReleases = new Set()
let networkManifest

function validRelease(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{8,80}$/.test(value)
}

function allowedAsset(pathname) {
  return (
    pathname === '/index.html' ||
    pathname === '/favicon.svg' ||
    /^\/assets\/[a-zA-Z0-9._~/-]+\.(?:avif|css|gif|jpe?g|js|json|png|svg|wasm|webp|woff2?)$/.test(
      pathname,
    )
  )
}

async function checkedManifest() {
  if (!validRelease(releaseId)) throw new Error('invalid_release')
  const response = await fetch('/offline-shell-manifest.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('manifest_unavailable')
  const manifest = await response.clone().json()
  if (
    manifest.releaseId !== releaseId ||
    !Array.isArray(manifest.assets) ||
    !Array.isArray(manifest.criticalAssets) ||
    (manifest.browserCompute === true
      ? !/^\/assets\/browserCalculationQuery\.worker-[a-zA-Z0-9_-]+\.js$/.test(
          manifest.computeWorker,
        ) || !manifest.criticalAssets.includes(manifest.computeWorker)
      : manifest.publicCoreSeparated !== true) ||
    manifest.assets.length === 0 ||
    !manifest.assets.includes('/index.html') ||
    !manifest.criticalAssets.includes('/index.html') ||
    manifest.assets.some((asset) => typeof asset !== 'string' || !allowedAsset(asset)) ||
    manifest.criticalAssets.some((asset) => !manifest.assets.includes(asset)) ||
    manifest.criticalAssets.some(
      (asset) => !/^[a-f0-9]{64}$/.test(manifest.criticalAssetSha256?.[asset] ?? ''),
    )
  ) {
    throw new Error('invalid_public_manifest')
  }
  return { manifest, response }
}

async function releaseCaches() {
  return (await caches.keys()).filter((name) => name.startsWith(cachePrefix))
}

async function verifyAsset(response, expected) {
  if (!response?.ok) throw new Error('critical_asset_unavailable')
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer())
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (actual !== expected) throw new Error('critical_asset_release_mismatch')
  return response
}

async function fetchNavigation(request) {
  const controller = new AbortController()
  let timer
  try {
    return await Promise.race([
      fetch(request, { signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('navigation_network_timeout'))
        }, navigationNetworkTimeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function cachedNavigation() {
  const cache = await caches.open(cacheName)
  const stored = await cache.match('/offline-shell-manifest.json')
  const manifest = await stored?.json()
  const expected = manifest?.criticalAssetSha256?.['/index.html']
  if (manifest?.releaseId !== releaseId || !/^[a-f0-9]{64}$/.test(expected ?? '')) return
  const cached = await cache.match('/index.html')
  if (!cached) return
  await verifyAsset(cached, expected)
  // Static Assets redirects /index.html to /. The verified bytes can answer a
  // navigation, but the cached redirect flag cannot be carried into that response.
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers: cached.headers,
  })
}

function manifestWithoutCache() {
  // Cache Storage can become unavailable after installation. Recover online using
  // this worker's checked release manifest, never by skipping critical-byte checks.
  if (!networkManifest)
    networkManifest = checkedManifest().then(
      ({ manifest }) => manifest,
      (error) => {
        networkManifest = undefined
        throw error
      },
    )
  return networkManifest
}

// A previous release is usable only if its install finished and its required assets remain.
async function installedRelease(name) {
  if (completeReleases.has(name)) return true
  const id = name.slice(cachePrefix.length)
  if (!validRelease(id)) return false
  const cache = await caches.open(name)
  const stored = await cache.match('/offline-shell-manifest.json')
  if (!stored) return false
  try {
    const manifest = await stored.json()
    if (manifest.releaseId !== id || !Array.isArray(manifest.criticalAssets)) return false
    for (const asset of manifest.criticalAssets) if (!(await cache.match(asset))) return false
    completeReleases.add(name)
    return true
  } catch {
    return false
  }
}

async function retainedReleaseCaches() {
  const names = await releaseCaches()
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const active = new Set()
  let unknown = false
  for (const client of clients) {
    const id = clientReleases.get(client.id)
    if (validRelease(id)) active.add(`${cachePrefix}${id}`)
    else unknown = true
  }
  let previous
  for (const name of [...names].reverse()) {
    if (name !== cacheName && (await installedRelease(name))) {
      previous = name
      break
    }
  }
  // An unrecognised tab may be using any old release. Keep all until it closes.
  if (unknown) return { names, keep: new Set(names), previous }
  return { names, keep: new Set([cacheName, previous, ...active].filter(Boolean)), previous }
}

async function pruneReleaseCaches() {
  const { names, keep } = await retainedReleaseCaches()
  for (const name of names) if (!keep.has(name)) await caches.delete(name)
}

async function matchingOldAsset(request, clientId) {
  const { names, keep, previous } = await retainedReleaseCaches()
  const tagged = clientReleases.get(clientId)
  const ordered =
    validRelease(tagged) && tagged !== releaseId
      ? [`${cachePrefix}${tagged}`]
      : tagged === releaseId
        ? [previous]
        : names.slice().reverse()
  for (const name of ordered) {
    if (!name || name === cacheName || !keep.has(name) || !(await installedRelease(name))) continue
    const response = await (await caches.open(name)).match(request)
    if (response) return response
  }
  return undefined
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const { manifest, response } = await checkedManifest()
      const existed = (await caches.keys()).includes(cacheName)
      try {
        const cache = await caches.open(cacheName)
        const repairs = []
        for (let offset = 0; offset < manifest.criticalAssets.length; offset += installBatchSize) {
          const assets = manifest.criticalAssets.slice(offset, offset + installBatchSize)
          const responses = await Promise.all(
            assets.map(async (asset) => {
              const expected = manifest.criticalAssetSha256[asset]
              if (existed) {
                try {
                  return await verifyAsset(await cache.match(asset), expected)
                } catch {
                  // Interrupted installs and browser eviction can leave missing/damaged entries.
                  // Collect verified replacements, but do not mutate until the entire set passes.
                }
              }
              const fetched = await verifyAsset(await fetch(asset, { cache: 'no-store' }), expected)
              if (existed) repairs.push([asset, fetched])
              return fetched
            }),
          )
          if (!existed)
            for (let index = 0; index < assets.length; index += 1)
              await cache.put(assets[index], responses[index])
        }
        for (const [asset, repaired] of repairs) await cache.put(asset, repaired)
        await cache.put('/offline-shell-manifest.json', response)
        await self.skipWaiting()
      } catch (error) {
        if (!existed) await caches.delete(cacheName)
        throw error
      }
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) client.postMessage({ type: 'soda-offline-release-query' })
      await pruneReleaseCaches()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'soda-offline-release-tag' || !validRelease(event.data.releaseId)) return
  if (!event.source?.id) return
  clientReleases.set(event.source.id, event.data.releaseId)
  event.waitUntil(pruneReleaseCaches())
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
    event.respondWith(
      (async () => {
        let network
        try {
          network = await fetchNavigation(request)
          if (network.status < 500 && network.status !== 408 && network.status !== 429)
            return network
        } catch {
          // Offline and stalled networks can both reuse the installed release.
        }
        try {
          return (await cachedNavigation()) ?? network ?? Response.error()
        } catch {
          return network ?? Response.error()
        }
      })(),
    )
    return
  }
  if (!allowedAsset(url.pathname)) return
  event.respondWith(
    (async () => {
      let cache
      let manifest
      try {
        if (clientReleases.get(event.clientId) !== releaseId) {
          const old = await matchingOldAsset(request, event.clientId)
          if (old) return old
        }
        cache = await caches.open(cacheName)
        const cached = await cache.match(request)
        if (cached) return cached
        if (clientReleases.get(event.clientId) === releaseId) {
          const previous = await matchingOldAsset(request, event.clientId)
          if (previous) return previous
        }
        const stored = await cache.match('/offline-shell-manifest.json')
        manifest = await stored?.json()
      } catch {
        cache = undefined
        manifest = await manifestWithoutCache()
      }
      const network = await fetch(request)
      if (network.ok) {
        if (manifest?.criticalAssetSha256?.[url.pathname])
          await verifyAsset(network, manifest.criticalAssetSha256[url.pathname])
        if (cache && manifest?.assets.includes(url.pathname))
          event.waitUntil(cache.put(request, network.clone()).catch(() => {}))
      }
      return network
    })(),
  )
})
