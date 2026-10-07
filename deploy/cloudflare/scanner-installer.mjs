import release from '../../public/downloads/scanner-installer-release.v1.json' with { type: 'json' }

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

/** Stream the one pinned release asset. Never buffer the complete offline package in an isolate. */
export function createInstallerDownload({
  fetcher = globalThis.fetch,
  manifest = release,
  timeoutMs = 600_000,
  concurrency = 32,
} = {}) {
  let active = 0
  return async (request) => {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
    if (new URL(request.url).search) return new Response(null, { status: 400 })
    if (
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
      finished = false
    const finish = () => {
      if (!finished) {
        finished = true
        active -= 1
      }
    }
    try {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)])
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
      const length = range.end - range.start + 1
      const contentRange = `bytes ${range.start}-${range.end}/${manifest.size}`
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
      const headers = {
        'content-type': 'application/vnd.microsoft.portable-executable',
        'content-length': String(length),
        'content-disposition': 'attachment; filename="Soda-Scanner-Setup.exe"',
        'cache-control': 'public, max-age=0, must-revalidate',
        etag: `"${manifest.sha256}"`,
        'accept-ranges': 'bytes',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        ...(range.partial ? { 'content-range': contentRange } : {}),
      }
      if (request.method === 'HEAD') {
        finish()
        return new Response(null, { status: range.partial ? 206 : 200, headers })
      }
      if (!upstream.body) throw new Error('installer_body')
      // Workers determines Content-Length from the body, ignoring a manually
      // supplied header on ordinary streams. Its native pipe also avoids a JS
      // pull for every chunk of a large package.
      if (typeof globalThis.FixedLengthStream === 'function') {
        const { readable, writable } = new globalThis.FixedLengthStream(length)
        void upstream.body
          .pipeTo(writable)
          .catch(() => {})
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
            controller.error(new Error('installer_stream_failed'))
            void reader.cancel().catch(() => {})
            finish()
          }
        },
        async cancel() {
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
      finish()
      if (reader) await reader.cancel().catch(() => {})
      else await upstream?.body?.cancel().catch(() => {})
      return unavailable()
    }
  }
}
