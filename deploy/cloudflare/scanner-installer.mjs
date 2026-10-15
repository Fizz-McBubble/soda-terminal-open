import release from '../../public/downloads/scanner-installer-release.v1.json' with { type: 'json' }
import {
  acquireInstallerChunkBuffer,
  installerChunkKey,
  matchInstallerChunk,
  putInstallerChunk,
  readInstallerChunk,
} from './installer-chunk-cache.mjs'

export const installerPath = '/downloads/Soda-Scanner-Setup.exe'
const unavailable = () =>
  new Response('下载暂时不可用，请稍后重试。', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })

function rangeFor(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false }
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header)
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start < 0 ||
    start >= size ||
    (!match[1] && Number(match[2]) <= 0)
  )
    return null
  return { start, end, partial: true }
}

function validScannerManifest(manifest) {
  return !(
    manifest.releaseState !== 'published' ||
    !Number.isSafeInteger(manifest.size) ||
    manifest.size <= 0 ||
    !/^[a-f0-9]{64}$/u.test(manifest.sha256 ?? '') ||
    !/^\d+\.\d+\.\d+$/u.test(manifest.version ?? '') ||
    manifest.releaseTag !== `scanner-installer-v${manifest.version}` ||
    manifest.assetName !== 'Soda-Scanner-Setup.exe' ||
    manifest.assetUrl !==
      `https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/${manifest.releaseTag}/${manifest.assetName}`
  )
}

/** Stream the one pinned release asset. Never buffer the complete offline package in an isolate. */
export function createPinnedInstallerDownload({
  fetcher = globalThis.fetch,
  manifest,
  validateManifest,
  fileName,
  downloadName = fileName,
  timeoutMs = 600_000,
  concurrency = 32,
  cache,
  cacheWriteTimeoutMs = 5000,
} = {}) {
  let active = 0
  return async (request, ctx) => {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
    if (new URL(request.url).search) return new Response(null, { status: 400 })
    if (
      !validateManifest(manifest) ||
      !/^[A-Za-z0-9._-]+\.exe$/u.test(fileName) ||
      !/^[\p{L}\p{N}._-]+\.exe$/u.test(downloadName)
    )
      return unavailable()
    const ifRange = request.headers.get('if-range')
    const range = rangeFor(
      !ifRange || ifRange === `"${manifest.sha256}"` ? request.headers.get('range') : null,
      manifest.size,
    )
    if (!range)
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${manifest.size}` },
      })
    if (active >= concurrency)
      return new Response(null, { status: 429, headers: { 'retry-after': '3' } })
    active += 1
    let reader,
      upstream,
      releaseChunkBuffer,
      cacheAbort,
      finished = false
    const finish = () => {
      if (!finished) {
        finished = true
        active -= 1
      }
    }
    try {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)])
      const length = range.end - range.start + 1
      const contentRange = `bytes ${range.start}-${range.end}/${manifest.size}`
      const headers = {
        'content-type': 'application/vnd.microsoft.portable-executable',
        'content-length': String(length),
        'content-disposition':
          `attachment; filename="${fileName}"` +
          (downloadName !== fileName
            ? `; filename*=UTF-8''${encodeURIComponent(downloadName)}`
            : ''),
        'cache-control': 'public, max-age=0, must-revalidate',
        etag: `"${manifest.sha256}"`,
        'accept-ranges': 'bytes',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        ...(range.partial ? { 'content-range': contentRange } : {}),
      }
      let chunkCache, chunkKey
      try {
        chunkCache =
          typeof ctx?.waitUntil === 'function' ? (cache ?? globalThis.caches?.default) : null
        chunkKey =
          chunkCache &&
          typeof chunkCache.match === 'function' &&
          typeof chunkCache.put === 'function'
            ? installerChunkKey(request, manifest, range)
            : null
      } catch {
        chunkKey = null
      }
      if (chunkKey) {
        releaseChunkBuffer = acquireInstallerChunkBuffer()
        if (!releaseChunkBuffer) chunkKey = null
      }
      if (chunkKey) {
        const bytes = await matchInstallerChunk(chunkCache, chunkKey, length, signal)
        if (signal.aborted) throw new Error('installer_aborted')
        if (bytes) {
          finish()
          return new Response(bytes, { status: 206, headers })
        }
      }
      let url = new URL(manifest.assetUrl)
      for (let hop = 0; hop <= 3; hop += 1) {
        upstream = await fetcher(url.href, {
          method: request.method,
          redirect: 'manual',
          signal,
          headers: range.partial ? { range: `bytes=${range.start}-${range.end}` } : {},
        })
        if (![301, 302, 303, 307, 308].includes(upstream.status)) break
        const location = upstream.headers.get('location')
        await upstream.body?.cancel()
        if (!location || hop === 3) throw new Error('installer_redirect')
        url = new URL(location, url)
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          url.port ||
          url.hostname !== 'release-assets.githubusercontent.com'
        )
          throw new Error('installer_redirect')
      }
      if (
        upstream.status !== (range.partial ? 206 : 200) ||
        Number(upstream.headers.get('content-length')) !== length ||
        (range.partial && upstream.headers.get('content-range') !== contentRange) ||
        ![
          'application/octet-stream',
          'application/x-msdownload',
          'application/vnd.microsoft.portable-executable',
        ].includes((upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase())
      )
        throw new Error('installer_upstream')
      if (request.method === 'HEAD') {
        finish()
        return new Response(null, { status: range.partial ? 206 : 200, headers })
      }
      if (!upstream.body) throw new Error('installer_body')
      if (chunkKey) {
        const [clientBody, cacheBody] = upstream.body.tee()
        cacheAbort = new AbortController()
        // A native tee branch cannot use workerd's inter-transform pipeTo fast
        // path into FixedLengthStream. A pull bridge preserves backpressure and
        // the native fixed-length response without buffering the client chunk.
        const clientReader = clientBody.getReader()
        const bridgedBody = new ReadableStream({
          async pull(controller) {
            try {
              const { done, value } = await clientReader.read()
              if (done) {
                clientReader.releaseLock()
                controller.close()
              } else controller.enqueue(value)
            } catch (error) {
              cacheAbort.abort()
              controller.error(error)
              void clientReader.cancel().catch(() => {})
            }
          },
          async cancel(reason) {
            cacheAbort.abort()
            try {
              await clientReader.cancel(reason)
            } finally {
              clientReader.releaseLock()
            }
          },
        })
        upstream = new Response(bridgedBody, upstream)
        const cacheSignal = AbortSignal.any([
          signal,
          cacheAbort.signal,
          AbortSignal.timeout(60_000),
        ])
        const release = releaseChunkBuffer
        const cacheTask = (async () => {
          try {
            const bytes = await readInstallerChunk(cacheBody, length, cacheSignal)
            await putInstallerChunk(chunkCache, ctx, chunkKey, bytes, release, cacheWriteTimeoutMs)
          } catch {
            // Cache failure cannot break the independently streamed client branch.
          } finally {
            release()
          }
        })()
        releaseChunkBuffer = null // The bounded background read/write now owns the lease.
        try {
          ctx.waitUntil(cacheTask)
        } catch {
          cacheAbort.abort()
        }
      }
      // Workers determines Content-Length from the body, ignoring a manually
      // supplied header on ordinary streams. Its native pipe also avoids a JS
      // pull for every chunk of a large package.
      if (typeof globalThis.FixedLengthStream === 'function') {
        const { readable, writable } = new globalThis.FixedLengthStream(length)
        void upstream.body
          .pipeTo(writable)
          .catch(() => {
            cacheAbort?.abort()
          })
          .finally(finish)
        return new Response(readable, { status: range.partial ? 206 : 200, headers })
      }
      reader = upstream.body.getReader()
      let size = 0
      const body = new ReadableStream({
        async pull(controller) {
          try {
            const { done, value } = await reader.read()
            if (done) {
              if (size !== length) throw new Error('installer_truncated')
              controller.close()
              reader.releaseLock()
              finish()
            } else {
              size += value.byteLength
              if (size > length) throw new Error('installer_oversized')
              controller.enqueue(value)
            }
          } catch {
            cacheAbort?.abort()
            controller.error(new Error('installer_stream_failed'))
            void reader.cancel().catch(() => {})
            finish()
          }
        },
        async cancel() {
          cacheAbort?.abort()
          try {
            await reader.cancel()
          } finally {
            reader.releaseLock()
            finish()
          }
        },
      })
      return new Response(body, { status: range.partial ? 206 : 200, headers })
    } catch {
      cacheAbort?.abort()
      finish()
      if (reader) await reader.cancel().catch(() => {})
      else await upstream?.body?.cancel().catch(() => {})
      return unavailable()
    } finally {
      releaseChunkBuffer?.()
    }
  }
}

/** Keep the reviewed OCR API and release policy unchanged. */
export function createInstallerDownload({ manifest = release, ...options } = {}) {
  return createPinnedInstallerDownload({
    ...options,
    manifest,
    validateManifest: validScannerManifest,
    fileName: !/^1\.0\.[0-8]$/u.test(manifest.version)
      ? `SodaTerminal-Scanner-Setup-${manifest.version}.exe`
      : `Soda-Scanner-Setup-${manifest.version}.exe`,
    downloadName: !/^1\.0\.[0-8]$/u.test(manifest.version)
      ? `SodaTerminal-Scanner-Setup-${manifest.version}.exe`
      : `Soda-画面扫描-${manifest.version}.exe`,
  })
}
