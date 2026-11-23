import releases from './installer-mirrors.json' with { type: 'json' }
import { installerChunkSize, readInstallerChunk } from './installer-chunk-cache.mjs'

const redirects = {
  cnb: 'https://asset.cnb.cool',
  atomgit: 'https://file-cdn.gitcode.com',
}
const origins = {
  cnb: 'https://cnb.cool',
  atomgit: 'https://atomgit.com',
}

export function installerMirrorRelease(manifest) {
  return releases.find(
    (release) => release.sha256 === manifest?.sha256 && release.size === manifest?.size,
  )
}

export function installerMirrorChunkPin(release, range, size) {
  if (
    !release ||
    !range.partial ||
    range.start % installerChunkSize !== 0 ||
    range.end !== Math.min(range.start + installerChunkSize, size) - 1
  )
    return undefined
  return release.chunks[range.start / installerChunkSize]
}

export async function matchesInstallerChunk(bytes, pin) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return (
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') ===
    pin
  )
}

/** Check a complete aligned slice against the digest of the published local installer. */
export async function readVerifiedInstallerMirror({
  release,
  range,
  size,
  sha256,
  fetcher,
  signal,
  cooldowns,
}) {
  const length = range.end - range.start + 1
  for (const source of release.sources) {
    if (signal.aborted) signal.throwIfAborted()
    if ((cooldowns.get(source.url) ?? 0) > Date.now()) continue
    let response
    let verified = false
    try {
      if (!Object.hasOwn(origins, source.provider)) continue
      const url = new URL(source.url)
      if (
        url.origin !== origins[source.provider] ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        continue
      const attempt = AbortSignal.any([signal, AbortSignal.timeout(12_000)])
      const init = {
        method: 'GET',
        redirect: 'manual',
        signal: attempt,
        headers: { range: `bytes=${range.start}-${range.end}` },
      }
      response = await fetcher(url.href, init)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (response.body) void response.body.cancel().catch(() => {})
        if (!location) continue
        const target = new URL(location, url)
        if (
          target.origin !== redirects[source.provider] ||
          target.username ||
          target.password ||
          target.hash
        )
          continue
        response = await fetcher(target.href, init)
      }
      if (
        response.status !== 206 ||
        Number(response.headers.get('content-length')) !== length ||
        response.headers.get('content-range') !== `bytes ${range.start}-${range.end}/${size}`
      )
        continue
      const bytes = await readInstallerChunk(response.body, length, attempt)
      if (await matchesInstallerChunk(bytes, sha256)) {
        verified = true
        cooldowns.delete(source.url)
        return { bytes, source: source.provider }
      }
    } catch {
      signal.throwIfAborted()
    } finally {
      if (!verified && !signal.aborted) cooldowns.set(source.url, Date.now() + 30_000)
      if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {})
    }
  }
  return null
}
