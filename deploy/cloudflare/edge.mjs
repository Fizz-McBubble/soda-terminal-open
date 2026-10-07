/** Cloudflare edge only. No solver, player storage, or Railway fallback. */
import reviewed32MediaUrls from '../../src/assets/reviewed32-media-urls.json' with { type: 'json' }
import { createScanFeedbackReceiver } from './scan-feedback.mjs'

const reviewedImageUrls = new Set(Object.values(reviewed32MediaUrls))
const sources = [
  ['act-upload.mihoyo.com', '/nap-obc-indep/'],
  ['fastcdn.hoyoverse.com', '/content-v2/nap/'],
  ['webstatic.hoyoverse.com', '/upload/op-public/'],
  ['img.gachabase.net', '/conv/zzz/assets/'],
  ['i.gachabase.net', '/'],
  ['static.nanoka.cc', '/assets/zzz/IconRoleCrop'],
]
// Share the reviewed immutable URLs with the browser and local image proxy.
// Compare the original string so URL normalization cannot admit unreviewed paths.
export function allowedImage(url, original = url.href) {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    (reviewedImageUrls.has(original) ||
      sources.some(([host, prefix]) => url.hostname === host && url.pathname.startsWith(prefix)))
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
const usageOrigins = new Set(['https://app.sodaterminal.workers.dev', 'https://sodaterminal.com'])
const usagePageCategories = new Set([
  'home',
  'assets',
  'development',
  'loadouts',
  'warehouse',
  'scanner',
  'help',
])
const usageOperationCategories = new Set([
  'scanner_connection',
  'disc_import',
  'team_loadout',
  'plan_save',
])
const usageOutcomes = new Set(['success', 'failure', 'cancelled', 'incomplete'])
function usageRecord(payload, release) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (
    Object.keys(payload).some(
      (key) => !['schema', 'event', 'category', 'outcome', 'durationMs', 'release'].includes(key),
    ) ||
    payload.schema !== 1 ||
    typeof payload.release !== 'string' ||
    !/^[A-Za-z0-9._-]{8,80}$/u.test(payload.release)
  )
    return null
  const hasDuration = Object.hasOwn(payload, 'durationMs')
  const hasOutcome = Object.hasOwn(payload, 'outcome')
  if (
    hasDuration &&
    (!Number.isInteger(payload.durationMs) ||
      payload.durationMs < 0 ||
      payload.durationMs > 3_600_000)
  )
    return null
  if (payload.event === 'page_view') {
    if (!usagePageCategories.has(payload.category) || hasOutcome || hasDuration) return null
  } else if (payload.event === 'operation') {
    if (
      !usageOperationCategories.has(payload.category) ||
      !usageOutcomes.has(payload.outcome) ||
      !hasDuration
    )
      return null
  } else if (payload.event === 'performance') {
    if (payload.category !== 'startup' || !hasDuration || hasOutcome) return null
  } else return null
  if (payload.release !== release) return { status: 409 }
  // Reconstruct the log. Never log the original body, URL, headers, IP, or errors.
  return {
    dataset: 'soda_usage',
    schema: 1,
    event: payload.event,
    category: payload.category,
    ...(hasOutcome ? { outcome: payload.outcome } : {}),
    ...(hasDuration ? { durationMs: payload.durationMs } : {}),
    release,
  }
}
async function readUsageBody(request, timeoutMs) {
  const length = request.headers.get('content-length')
  if (length && (!/^\d+$/u.test(length) || Number(length) > 512)) return { status: 413 }
  if (!request.body) return { status: 400 }
  const reader = request.body.getReader()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('usage_body_timeout')), timeoutMs)
  })
  try {
    const bytes = new Uint8Array(512)
    let size = 0
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout])
      if (done) break
      if (size + value.byteLength > bytes.length) return { status: 413 }
      bytes.set(value, size)
      size += value.byteLength
    }
    return {
      payload: JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)),
      ),
    }
  } catch {
    return { status: 400 }
  } finally {
    clearTimeout(timer)
    // A hostile stream's cancel promise must not delay this response or retain an in-flight slot.
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
export function createEdge({
  fetcher = globalThis.fetch,
  byteLimit = 8 * 1024 * 1024,
  timeoutMs = 10_000,
  concurrency = 4,
  usageTimeoutMs = 2_000,
  usageConcurrency = 4,
  usageLogsPerMinute = 120,
  usageLogger = (record) => console.log(record),
  now = Date.now,
  feedbackTimeoutMs = 2_000,
  feedbackKvTimeoutMs = 2_000,
  feedbackConcurrency = 4,
  feedbackPerMinute = 60,
  feedbackStore = undefined,
} = {}) {
  // Per-isolate bound, NOT a global rate limit. At most 4 buffered images in this isolate.
  let active = 0
  let usageActive = 0
  let usageWindowStart = now()
  let usageLogs = 0
  const feedbackReceiver = createScanFeedbackReceiver({
    now,
    timeoutMs: feedbackTimeoutMs,
    kvTimeoutMs: feedbackKvTimeoutMs,
    concurrency: feedbackConcurrency,
    rateLimitPerMinute: feedbackPerMinute,
    feedbackStore,
  })
  return {
    async fetch(request, env) {
      const url = new URL(request.url)
      if (url.pathname === '/api' || url.pathname.startsWith('/api/'))
        return reply(410, '此站仅提供本机计算，不提供或转发在线计算 API。')
      if (url.pathname === '/_soda/usage') {
        if (
          env.SODA_USAGE_STATISTICS !== 'enabled' ||
          typeof env.SODA_RELEASE_ID !== 'string' ||
          !/^[A-Za-z0-9._-]{8,80}$/u.test(env.SODA_RELEASE_ID ?? '') ||
          !usageOrigins.has(env.SODA_PUBLIC_ORIGIN) ||
          !usageOrigins.has(url.origin)
        )
          return reply(404, 'Not found')
        if (request.method !== 'POST') return reply(405, 'Method not allowed', { allow: 'POST' })
        if (request.url.includes('?')) return reply(400, 'Invalid usage event')
        const site = request.headers.get('sec-fetch-site')
        if (
          request.headers.get('origin') !== url.origin ||
          (site !== null && site !== 'same-origin')
        )
          return reply(403, 'Forbidden')
        if (
          !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(
            request.headers.get('content-type') ?? '',
          )
        )
          return reply(400, 'Invalid usage event')
        const time = now()
        if (time < usageWindowStart || time - usageWindowStart >= 60_000) {
          usageWindowStart = time
          usageLogs = 0
        }
        // These bounds apply to this isolate only, never a global abuse or quota guarantee.
        if (usageActive >= usageConcurrency || usageLogs >= usageLogsPerMinute)
          return reply(429, 'Usage collection busy', { 'retry-after': '60' })
        usageActive += 1
        try {
          const body = await readUsageBody(request, usageTimeoutMs)
          if (body.status) return reply(body.status, 'Invalid usage event')
          const record = usageRecord(body.payload, env.SODA_RELEASE_ID)
          if (!record) return reply(400, 'Invalid usage event')
          if (record.status) return reply(record.status, 'Usage release mismatch')
          if (usageLogs >= usageLogsPerMinute)
            return reply(429, 'Usage collection busy', { 'retry-after': '60' })
          usageLogs += 1
          usageLogger(record)
          return reply(204, null)
        } catch {
          return reply(204, null)
        } finally {
          usageActive -= 1
        }
      }
      if (url.pathname === '/_soda/scan-feedback') {
        return feedbackReceiver(request, env)
      }
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
      if (!allowedImage(remote, values[0])) return reply(403, '素材地址不在允许范围内')
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
          if (reviewedImageUrls.has(remote.href)) return unavailable(request.method)
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
