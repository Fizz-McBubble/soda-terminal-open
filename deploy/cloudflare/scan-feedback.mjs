import contract from '../../src/scanner/scanFeedback.contract.json' with { type: 'json' }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RELEASE_PATTERN = new RegExp(contract.releasePattern, 'u')

const versionRegexes = Object.fromEntries(
  Object.entries(contract.versionPatterns).map(([k, p]) => [k, new RegExp(p, 'u')]),
)

const KNOWN_TOP_LEVEL_KEYS = [
  'schema',
  'reportId',
  'release',
  'outcome',
  'stage',
  'code',
  'versions',
  'counts',
  'durationMs',
  'environment',
  'evidence',
]

export function reply(status, body, headers = {}) {
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

export function sanitizeScanFeedbackPayload(payload, expectedRelease) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 400 }
  }

  const keys = Object.keys(payload)
  if (
    keys.length !== KNOWN_TOP_LEVEL_KEYS.length ||
    keys.some((k) => !KNOWN_TOP_LEVEL_KEYS.includes(k))
  ) {
    return { status: 400 }
  }
  for (const k of KNOWN_TOP_LEVEL_KEYS) {
    if (!Object.hasOwn(payload, k)) {
      return { status: 400 }
    }
  }

  if (payload.schema !== 1) {
    return { status: 400 }
  }

  if (typeof payload.reportId !== 'string' || !UUID_PATTERN.test(payload.reportId)) {
    return { status: 400 }
  }

  if (typeof payload.release !== 'string' || !RELEASE_PATTERN.test(payload.release)) {
    return { status: 400 }
  }
  if (expectedRelease !== undefined && payload.release !== expectedRelease) {
    return { status: 409 }
  }

  if (typeof payload.outcome !== 'string' || !contract.outcomes.includes(payload.outcome)) {
    return { status: 400 }
  }

  if (typeof payload.stage !== 'string' || !contract.stages.includes(payload.stage)) {
    return { status: 400 }
  }

  if (typeof payload.code !== 'string' || !contract.codes.includes(payload.code)) {
    return { status: 400 }
  }

  if (
    !payload.versions ||
    typeof payload.versions !== 'object' ||
    Array.isArray(payload.versions)
  ) {
    return { status: 400 }
  }
  const sanitizedVersions = {}
  for (const [k, v] of Object.entries(payload.versions)) {
    if (!Object.hasOwn(contract.versionPatterns, k)) {
      return { status: 400 }
    }
    const rx = versionRegexes[k]
    if (typeof v !== 'string' || !rx.test(v)) {
      return { status: 400 }
    }
    sanitizedVersions[k] = v
  }

  if (!payload.counts || typeof payload.counts !== 'object' || Array.isArray(payload.counts)) {
    return { status: 400 }
  }
  if (!Object.hasOwn(payload.counts, 'processed') || !Object.hasOwn(payload.counts, 'total')) {
    return { status: 400 }
  }
  const sanitizedCounts = {}
  for (const [k, v] of Object.entries(payload.counts)) {
    if (!Object.hasOwn(contract.countLimits, k)) {
      return { status: 400 }
    }
    const max = contract.countLimits[k]
    if (v === null) {
      sanitizedCounts[k] = null
    } else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max) {
      sanitizedCounts[k] = v
    } else {
      return { status: 400 }
    }
  }

  let sanitizedDurationMs = null
  if (payload.durationMs === null) {
    sanitizedDurationMs = null
  } else if (
    typeof payload.durationMs === 'number' &&
    Number.isInteger(payload.durationMs) &&
    payload.durationMs >= 0 &&
    payload.durationMs <= contract.durationMaxMs
  ) {
    sanitizedDurationMs = payload.durationMs
  } else {
    return { status: 400 }
  }

  if (
    !payload.environment ||
    typeof payload.environment !== 'object' ||
    Array.isArray(payload.environment)
  ) {
    return { status: 400 }
  }
  const sanitizedEnvironment = {}
  for (const [k, v] of Object.entries(payload.environment)) {
    if (Object.hasOwn(contract.environmentLimits, k)) {
      const max = contract.environmentLimits[k]
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max) {
        return { status: 400 }
      }
      sanitizedEnvironment[k] = v
    } else if (k === 'captureMode') {
      if (typeof v !== 'string' || !contract.captureModes.includes(v)) {
        return { status: 400 }
      }
      sanitizedEnvironment[k] = v
    } else if (k === 'browser') {
      if (typeof v !== 'string' || !contract.browsers.includes(v)) {
        return { status: 400 }
      }
      sanitizedEnvironment[k] = v
    } else {
      return { status: 400 }
    }
  }

  if (
    !payload.evidence ||
    typeof payload.evidence !== 'object' ||
    Array.isArray(payload.evidence)
  ) {
    return { status: 400 }
  }
  const sanitizedEvidence = {}
  for (const [k, v] of Object.entries(payload.evidence)) {
    if (Object.hasOwn(contract.evidenceLimits, k)) {
      const max = contract.evidenceLimits[k]
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max) {
        return { status: 400 }
      }
      sanitizedEvidence[k] = v
    } else if (contract.evidenceBooleans.includes(k)) {
      if (typeof v !== 'boolean') {
        return { status: 400 }
      }
      sanitizedEvidence[k] = v
    } else if (Object.hasOwn(contract.evidenceEnums, k)) {
      if (typeof v !== 'string' || !contract.evidenceEnums[k].includes(v)) {
        return { status: 400 }
      }
      sanitizedEvidence[k] = v
    } else if (k === 'targetVerificationKind') {
      if (typeof v !== 'string' || !contract.targetVerificationKinds.includes(v)) {
        return { status: 400 }
      }
      sanitizedEvidence[k] = v
    } else if (k === 'firstMissingRoi') {
      if (typeof v !== 'string' || !contract.missingRois.includes(v)) {
        return { status: 400 }
      }
      sanitizedEvidence[k] = v
    } else {
      return { status: 400 }
    }
  }

  const record = {
    schema: 1,
    reportId: payload.reportId,
    release: payload.release,
    outcome: payload.outcome,
    stage: payload.stage,
    code: payload.code,
    versions: sanitizedVersions,
    counts: sanitizedCounts,
    durationMs: sanitizedDurationMs,
    environment: sanitizedEnvironment,
    evidence: sanitizedEvidence,
  }

  const serialized = JSON.stringify(record)
  const bytes = new TextEncoder().encode(serialized)
  if (bytes.length > contract.maxBytes) {
    return { status: 413 }
  }

  return { ok: true, record }
}

export function semanticEqual(a, b) {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      if (!semanticEqual(a[i], b[i])) return false
    }
    return true
  }
  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i += 1) {
    if (aKeys[i] !== bKeys[i]) return false
    if (!semanticEqual(a[aKeys[i]], b[bKeys[i]])) return false
  }
  return true
}

export function recordsEqual(a, b) {
  return semanticEqual(a, b)
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`
}

async function contentStorageKey(record) {
  const bytes = new TextEncoder().encode(canonicalJson(record))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return `${record.reportId}:${hash}`
}

export async function readScanFeedbackBody(request, timeoutMs) {
  const length = request.headers.get('content-length')
  if (length && (!/^\d+$/u.test(length) || Number(length) > contract.maxBytes)) {
    return { status: 413 }
  }
  if (!request.body) return { status: 400 }
  const reader = request.body.getReader()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('feedback_body_timeout')), timeoutMs)
  })
  try {
    const bytes = new Uint8Array(contract.maxBytes)
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
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function withTimeout(promise, ms) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('kv_timeout')), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer)
  })
}

export function createScanFeedbackReceiver({
  now = Date.now,
  timeoutMs = 2_000,
  kvTimeoutMs = 2_000,
  concurrency = 4,
  rateLimitPerMinute = 60,
  feedbackStore = undefined,
} = {}) {
  let active = 0
  let windowStart = now()
  let reservedCount = 0
  const inFlight = new Map()

  return async function handleScanFeedback(request, env) {
    const url = new URL(request.url)
    const origin = url.origin

    if (
      env.SODA_SCAN_FEEDBACK !== 'enabled' ||
      typeof env.SODA_RELEASE_ID !== 'string' ||
      !RELEASE_PATTERN.test(env.SODA_RELEASE_ID ?? '') ||
      !contract.origins.includes(env.SODA_PUBLIC_ORIGIN) ||
      !contract.origins.includes(origin)
    ) {
      return reply(404, 'Not found')
    }

    if (request.method !== 'POST') {
      return reply(405, 'Method not allowed', { allow: 'POST' })
    }
    if (request.url.includes('?')) {
      return reply(400, 'Invalid scan feedback')
    }
    const originHeader = request.headers.get('origin')
    const site = request.headers.get('sec-fetch-site')
    if (originHeader !== origin || (site !== null && site !== 'same-origin')) {
      return reply(403, 'Forbidden')
    }
    if (
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(
        request.headers.get('content-type') ?? '',
      )
    ) {
      return reply(400, 'Invalid scan feedback')
    }

    const kv = feedbackStore ?? env[contract.storageBinding]
    if (!kv || typeof kv.put !== 'function' || typeof kv.get !== 'function') {
      return reply(503, 'Persistence unavailable')
    }

    const time = now()
    if (time < windowStart || time - windowStart >= 60_000) {
      windowStart = time
      reservedCount = 0
    }
    if (active >= concurrency || reservedCount >= rateLimitPerMinute) {
      return reply(429, 'Feedback collection busy', { 'retry-after': '60' })
    }

    active += 1
    const budgetWindow = windowStart
    reservedCount += 1
    try {
      const body = await readScanFeedbackBody(request, timeoutMs)
      if (body.status) {
        if (windowStart === budgetWindow) reservedCount = Math.max(0, reservedCount - 1)
        return reply(
          body.status,
          body.status === 413 ? 'Payload too large' : 'Invalid scan feedback',
        )
      }

      // A cached page or the Help page can submit a previous release's failure.
      // The bounded release is diagnostic evidence, never an authorization token.
      const validation = sanitizeScanFeedbackPayload(body.payload)
      if (!validation.ok) {
        if (windowStart === budgetWindow) reservedCount = Math.max(0, reservedCount - 1)
        if (validation.status === 409) return reply(409, 'Feedback release mismatch')
        if (validation.status === 413) return reply(413, 'Payload too large')
        return reply(400, 'Invalid scan feedback')
      }
      const record = validation.record
      // Content addressing protects different reports with a colliding ID even
      // when independent isolates both observe a KV cache miss.
      const key = await contentStorageKey(record)

      if (inFlight.has(key)) {
        const current = inFlight.get(key)
        if (!recordsEqual(current.record, record)) {
          return reply(409, 'Feedback conflict')
        }
        try {
          const outcome = await current.promise
          if (outcome.status === 200) {
            return reply(200, JSON.stringify(outcome.receipt), {
              'content-type': 'application/json; charset=utf-8',
            })
          }
          if (outcome.status === 409) return reply(409, 'Feedback conflict')
          return reply(503, 'Persistence unavailable')
        } catch {
          return reply(503, 'Persistence unavailable')
        }
      }

      let resolveInflight
      const inflightPromise = new Promise((res) => {
        resolveInflight = res
      })
      inFlight.set(key, { promise: inflightPromise, record })

      try {
        let existingRaw = null
        try {
          // Bare reportId keys are legacy records. Keep their original receipt
          // or conflict behavior; never migrate or overwrite them.
          existingRaw = await withTimeout(kv.get(record.reportId), kvTimeoutMs)
          if (existingRaw === null || existingRaw === undefined) {
            existingRaw = await withTimeout(kv.get(key), kvTimeoutMs)
          }
        } catch {
          resolveInflight({ status: 503 })
          return reply(503, 'Persistence unavailable')
        }

        if (existingRaw !== null && existingRaw !== undefined) {
          try {
            const existing = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw
            if (
              !existing ||
              typeof existing !== 'object' ||
              Array.isArray(existing) ||
              typeof existing.receivedAt !== 'string' ||
              !Number.isFinite(Date.parse(existing.receivedAt))
            ) {
              resolveInflight({ status: 503 })
              return reply(503, 'Persistence unavailable')
            }

            const { receivedAt: existingReceivedAt, ...existingRecord } = existing
            const existingValidation = sanitizeScanFeedbackPayload(existingRecord)
            if (!existingValidation.ok) {
              resolveInflight({ status: 503 })
              return reply(503, 'Persistence unavailable')
            }

            if (recordsEqual(existingValidation.record, record)) {
              const receipt = {
                status: 'received',
                reportId: record.reportId,
                receivedAt: existingReceivedAt,
              }
              resolveInflight({ status: 200, receipt })
              return reply(200, JSON.stringify(receipt), {
                'content-type': 'application/json; charset=utf-8',
              })
            } else {
              resolveInflight({ status: 409 })
              return reply(409, 'Feedback conflict')
            }
          } catch {
            resolveInflight({ status: 503 })
            return reply(503, 'Persistence unavailable')
          }
        }

        const receivedAt = new Date(now()).toISOString()
        const storedValue = JSON.stringify({ ...record, receivedAt })
        try {
          await withTimeout(
            kv.put(key, storedValue, {
              expirationTtl: contract.retentionDays * 86400,
            }),
            kvTimeoutMs,
          )
        } catch {
          resolveInflight({ status: 503 })
          return reply(503, 'Persistence unavailable')
        }

        const receipt = {
          status: 'received',
          reportId: record.reportId,
          receivedAt,
        }
        resolveInflight({ status: 200, receipt })
        return reply(200, JSON.stringify(receipt), {
          'content-type': 'application/json; charset=utf-8',
        })
      } finally {
        inFlight.delete(key)
      }
    } catch {
      return reply(503, 'Persistence unavailable')
    } finally {
      active -= 1
    }
  }
}
