export const installerChunkSize = 4 * 1024 * 1024
let bufferedChunks = 0

/** Shared by both installer handlers in this isolate; streaming slots remain independent. */
export function acquireInstallerChunkBuffer() {
  if (bufferedChunks >= 4) return null
  bufferedChunks++
  let released = false
  return () => {
    if (!released) {
      released = true
      bufferedChunks--
    }
  }
}

// Only the finite, manifest-sized chunk grid is cacheable, never arbitrary ranges.
export function installerChunkKey(request, manifest, range) {
  if (
    request.method !== 'GET' ||
    !range.partial ||
    range.start % installerChunkSize !== 0 ||
    range.end !== Math.min(range.start + installerChunkSize, manifest.size) - 1
  )
    return null
  const url = new URL(request.url)
  url.pathname = `/__soda-installer-chunks/v1${url.pathname}/${manifest.size}/${manifest.sha256}/${range.start}-${range.end}`
  url.search = ''
  return new Request(url.href)
}

/** Bounded even when an upstream advertises a short length but sends a giant body. */
export async function readInstallerChunk(body, length, signal) {
  if (!body || length > installerChunkSize) throw new Error('installer_chunk_body')
  const reader = body.getReader()
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  signal?.addEventListener('abort', cancel, { once: true })
  const bytes = new Uint8Array(length)
  let size = 0
  try {
    if (signal?.aborted) throw new Error('installer_chunk_aborted')
    while (true) {
      const { done, value } = await reader.read()
      if (signal?.aborted) throw new Error('installer_chunk_aborted')
      if (done) break
      size += value.byteLength
      if (size > length) throw new Error('installer_chunk_oversized')
      bytes.set(value, size - value.byteLength)
    }
    if (size !== length) throw new Error('installer_chunk_truncated')
    return bytes
  } catch (error) {
    cancel()
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

export async function matchInstallerChunk(cache, key, length, signal) {
  let timer,
    expired = false,
    abort
  const timeout = new AbortController()
  const matchSignal = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal
  try {
    const pending = Promise.resolve()
      .then(() => cache.match(key))
      .then((response) => {
        if (expired) {
          void response?.body?.cancel().catch(() => {})
          return null
        }
        return response
      })
    const cutoff = new Promise((resolve) => {
      abort = () => {
        expired = true
        timeout.abort()
        resolve(null)
      }
      timer = setTimeout(abort, 1000)
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
    const response = await Promise.race([pending, cutoff])
    if (!response) return null
    if (response.status !== 200 || Number(response.headers.get('content-length')) !== length) {
      void response.body?.cancel().catch(() => {})
      return null
    }
    return await readInstallerChunk(response.body, length, matchSignal)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function putInstallerChunk(cache, ctx, key, bytes, release = () => {}, timeoutMs = 5000) {
  // Cache API rejects 206. Store only a verified, bounded internal 200 object.
  let timer, response
  const write = Promise.resolve()
    .then(() => {
      response = new Response(bytes, {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(bytes.byteLength),
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
      return cache.put(key, response)
    })
    .catch(() => {})
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      // Cache API has no AbortSignal option. Cancel an unconsumed body if possible;
      // the background write must never retain a logical buffer slot indefinitely.
      void response?.body?.cancel().catch(() => {})
      resolve()
    }, timeoutMs)
  })
  const settled = Promise.race([write, deadline]).finally(() => {
    clearTimeout(timer)
    release()
  })
  try {
    ctx.waitUntil(settled)
  } catch {
    // Best effort only; runtime cache/ctx failures cannot prevent the download.
  }
  return settled
}
