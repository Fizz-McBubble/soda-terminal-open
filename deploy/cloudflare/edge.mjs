/** Cloudflare edge only. No solver, player storage, or Railway fallback. */
const sources = [
  ['act-upload.mihoyo.com', '/nap-obc-indep/'],
  ['fastcdn.hoyoverse.com', '/content-v2/nap/'],
  ['webstatic.hoyoverse.com', '/upload/op-public/'],
  ['img.gachabase.net', '/conv/zzz/assets/'],
  ['i.gachabase.net', '/'],
  ['static.nanoka.cc', '/assets/zzz/IconRoleCrop'],
]
// Same URL boundary as R17 production-static-server; the retired runtime stays unchanged.
export function allowedImage(url) {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    sources.some(([host, prefix]) => url.hostname === host && url.pathname.startsWith(prefix))
  )
}
function reply(status, body, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      ...headers,
    },
  })
}
function unavailable(method = 'GET') {
  // Existing image client understands this envelope and retains its retry/fallback UI.
  return reply(200, method === 'HEAD' ? null : '官方图鉴素材暂时无法获取', {
    'x-soda-asset-error': 'upstream-unavailable',
    'x-soda-upstream-status': '502',
  })
}
function reserved(path) {
  try {
    const decoded = decodeURIComponent(decodeURIComponent(path))
    return (
      decoded.split(/[\\/]/u).some((part) => part.startsWith('.')) ||
      /^\/(?:src|private|deploy|scripts|node_modules|outputs|tests|build|docs)(?:\/|$)/iu.test(
        decoded,
      ) ||
      /\.(?:map|ts|tsx|mjs|env|log|pem|key)$/iu.test(decoded)
    )
  } catch {
    return true
  }
}
export function createEdge({
  fetcher = globalThis.fetch,
  byteLimit = 8 * 1024 * 1024,
  timeoutMs = 10_000,
  concurrency = 4,
} = {}) {
  // Per-isolate bound, NOT a global rate limit. At most 4 buffered images in this isolate.
  let active = 0
  return {
    async fetch(request, env) {
      const url = new URL(request.url)
      if (url.pathname === '/api' || url.pathname.startsWith('/api/'))
        return reply(410, '此站仅提供本机计算，不提供或转发在线计算 API。')
      if (url.pathname === '/_soda/health') {
        if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Method not allowed')
        return reply(
          200,
          request.method === 'HEAD'
            ? null
            : JSON.stringify({
                status: 'edge_ready',
                runtime: 'cloudflare-static/v1',
                releaseId: env.SODA_RELEASE_ID ?? 'unbound',
                calculationApi: 'disabled',
                checks: ['edge_router_only'],
              }),
          { 'content-type': 'application/json; charset=utf-8' },
        )
      }
      if (url.pathname.startsWith('/_soda/') || reserved(url.pathname))
        return reply(404, 'Not found')
      if (!['GET', 'HEAD'].includes(request.method))
        return reply(405, 'Method not allowed', { allow: 'GET, HEAD' })
      if (url.pathname !== '/official-catalog-cache') return env.ASSETS.fetch(request)
      const values = url.searchParams.getAll('source')
      if (values.length !== 1 || values[0].length > 4096) return reply(400, '素材参数无效')
      let remote
      try {
        remote = new URL(values[0])
      } catch {
        return reply(400, '素材地址无效')
      }
      if (!allowedImage(remote)) return reply(403, '素材地址不在允许范围内')
      if (active >= concurrency) return reply(429, '素材请求繁忙', { 'retry-after': '1' })
      active += 1
      try {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)])
        let upstream
        for (let hop = 0; hop <= 3; hop += 1) {
          upstream = await fetcher(remote.href, { redirect: 'manual', signal })
          if (![301, 302, 303, 307, 308].includes(upstream.status)) break
          const location = upstream.headers.get('location')
          await upstream.body?.cancel()
          if (!location || hop === 3) return unavailable(request.method)
          remote = new URL(location, remote)
          if (!allowedImage(remote)) return unavailable(request.method)
        }
        const mime = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
        if (!upstream.ok || !/^image\/(?:png|jpeg|webp|gif|avif|svg\+xml|x-icon)$/u.test(mime)) {
          await upstream.body?.cancel()
          return unavailable(request.method)
        }
        const length = Number(upstream.headers.get('content-length'))
        if (Number.isFinite(length) && length > byteLimit) {
          await upstream.body?.cancel()
          return unavailable(request.method)
        }
        const chunks = []
        let size = 0
        if (upstream.body) {
          const reader = upstream.body.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              size += value.byteLength
              if (size > byteLimit) {
                await reader.cancel()
                return unavailable(request.method)
              }
              chunks.push(value)
            }
          } finally {
            reader.releaseLock()
          }
        }
        if (size === 0) return unavailable(request.method)
        const bytes = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
          bytes.set(chunk, offset)
          offset += chunk.byteLength
        }
        return new Response(request.method === 'HEAD' ? null : bytes, {
          headers: {
            'content-type': mime,
            'content-length': String(size),
            'cache-control': 'private, max-age=0, must-revalidate',
            'content-security-policy': 'sandbox',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'no-referrer',
          },
        })
      } catch {
        return unavailable(request.method)
      } finally {
        active -= 1
      }
    },
  }
}
export default createEdge()
