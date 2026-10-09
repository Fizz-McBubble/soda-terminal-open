import assert from 'node:assert/strict'
import test from 'node:test'
import contract from '../../src/scanner/scanFeedback.contract.json' with { type: 'json' }
import { createScanFeedbackReceiver, sanitizeScanFeedbackPayload } from './scan-feedback.mjs'

const origin = 'https://sodaterminal.com'
const releaseId = 'soda-release-20261007'

function createFakeKv({ getDelay = 0, putDelay = 0, failGet = false, failPut = false } = {}) {
  const store = new Map()
  let putCount = 0
  let getCount = 0
  return {
    store,
    getPutCount: () => putCount,
    getGetCount: () => getCount,
    async get(key) {
      getCount += 1
      if (getDelay > 0) await new Promise((r) => setTimeout(r, getDelay))
      if (failGet) throw new Error('simulated_kv_get_failure')
      return store.get(key)?.value ?? null
    },
    async put(key, value, options) {
      putCount += 1
      if (putDelay > 0) await new Promise((r) => setTimeout(r, putDelay))
      if (failPut) throw new Error('simulated_kv_put_failure')
      store.set(key, { value, options })
    },
  }
}

const validReport = {
  schema: 1,
  reportId: 'c7b28014-9ff5-4e3a-96e0-20f781df03aa',
  release: releaseId,
  outcome: 'failed',
  stage: 'capture',
  code: 'panel_capture_timeout',
  versions: {
    helper: '1.0.49',
    protocol: '1',
    scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r1',
    runtime: 'soda-scanner-windows-x64-v1',
    ocr: 'PP-OCRv6',
  },
  counts: {
    processed: 12,
    total: 200,
    visited: 15,
    queued: 5,
    failed: 1,
  },
  durationMs: 45000,
  environment: {
    width: 1920,
    height: 1080,
    dpi: 96,
    browserMajor: 120,
    captureMode: 'dxgi',
    browser: 'chrome',
  },
  evidence: {
    logicalRow: 3,
    visualRow: 2,
    column: 4,
    maxColumns: 6,
    visibleRois: 20,
    totalRois: 24,
    stableFrames: 5,
    requiredStableFrames: 3,
    attempts: 2,
    exitCode: 0,
    sawPanelChange: true,
    selectionChanged: false,
    warehouseHeaderDetected: true,
    inventoryCountDetected: true,
    firstMissingRoi: 'mainStatValue',
  },
}

function storedFor(kv, reportId) {
  const matches = [...kv.store.entries()].filter(([key]) => key.startsWith(reportId + ':'))
  assert.equal(matches.length, 1)
  assert.match(matches[0][0], new RegExp(`^${reportId}:[0-9a-f]{64}$`))
  assert.equal(kv.store.has(reportId), false)
  return matches[0][1]
}

function makeEnv(overrides = {}, kv = createFakeKv()) {
  return {
    env: {
      SODA_SCAN_FEEDBACK: 'enabled',
      SODA_PUBLIC_ORIGIN: origin,
      SODA_RELEASE_ID: releaseId,
      [contract.storageBinding]: kv,
      ...overrides,
    },
    kv,
  }
}

function makeRequest(
  payload = validReport,
  init = {},
  targetOrigin = origin,
  path = contract.endpoint,
) {
  return new Request(`${targetOrigin}${path}`, {
    method: 'POST',
    ...init,
    headers: {
      origin: targetOrigin,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...init.headers,
    },
    body: init.body ?? JSON.stringify(payload),
  })
}

test('preserves duplicate guard safe browser projection and concrete stop evidence in durable storage', async () => {
  const { env, kv } = makeEnv()
  const handler = createScanFeedbackReceiver()
  for (const targetVerificationKind of contract.targetVerificationKinds) {
    const report = {
      ...validReport,
      reportId: crypto.randomUUID(),
      code: 'duplicate_guard',
      stage: 'ocr',
      counts: { processed: 507, total: 2566, visited: 509, queued: 508, failed: 0 },
      evidence: { itemIndex: 508, targetVerificationKind },
    }
    const response = await handler(makeRequest(report), env)
    assert.equal(response.status, 200)
    const stored = JSON.parse(storedFor(kv, report.reportId).value)
    const { receivedAt, ...record } = stored
    assert.equal(typeof receivedAt, 'string')
    assert.deepEqual(record, report)
    const legacy = { ...report, reportId: crypto.randomUUID(), evidence: {} }
    assert.equal((await handler(makeRequest(legacy), env)).status, 200)
    assert.deepEqual(JSON.parse(storedFor(kv, legacy.reportId).value).evidence, {})
  }
})

test('rejects untrusted duplicate codes, item indices, verification types and extra free text without storing', async () => {
  const { env, kv } = makeEnv()
  const handler = createScanFeedbackReceiver()
  const report = { ...validReport, code: 'duplicate_guard', stage: 'ocr' }
  for (const mutation of [
    { code: 'duplicate_guard private/path' },
    { code: 42 },
    ...[-1, 100001, 508.5, '508', null, {}].map((itemIndex) => ({ evidence: { itemIndex } })),
    ...['private/path', 'ChangedText.private', 42, null, {}].map((targetVerificationKind) => ({
      evidence: { targetVerificationKind },
    })),
    { evidence: { itemIndex: 508, targetVerificationKind: 'ChangedText', rawLog: 'private' } },
  ]) {
    const response = await handler(makeRequest({ ...report, ...mutation }), env)
    assert.equal(response.status, 400)
  }
  assert.equal(kv.getPutCount(), 0)
})

test('disabled, unbound and nonproduction collectors return 404 without reading bodies', async () => {
  const handler = createScanFeedbackReceiver()
  const { kv } = makeEnv()
  for (const overrides of [
    { SODA_SCAN_FEEDBACK: undefined },
    { SODA_SCAN_FEEDBACK: 'false' },
    { SODA_SCAN_FEEDBACK: 'disabled' },
    { SODA_RELEASE_ID: undefined },
    { SODA_RELEASE_ID: 'short' },
    { SODA_RELEASE_ID: 'invalid space in release' },
    { SODA_PUBLIC_ORIGIN: undefined },
    { SODA_PUBLIC_ORIGIN: `${origin}/` },
    { SODA_PUBLIC_ORIGIN: 'http://127.0.0.1:8787' },
    { SODA_PUBLIC_ORIGIN: 'https://preview.invalid' },
    { SODA_PUBLIC_ORIGIN: 'https://app.sodaterminal.workers.dev' },
  ]) {
    const { env } = makeEnv(overrides, kv)
    const req = makeRequest()
    const res = await handler(req, env)
    assert.equal(res.status, 404)
    assert.equal(req.bodyUsed, false)
  }
  for (const host of [
    'http://127.0.0.1:8787',
    'https://preview.invalid',
    'https://app.sodaterminal.workers.dev',
  ]) {
    const { env } = makeEnv({}, kv)
    const req = new Request(`${host}${contract.endpoint}`, makeRequest())
    const res = await handler(req, env)
    assert.equal(res.status, 404)
    assert.equal(req.bodyUsed, false)
  }
  assert.equal(kv.getPutCount(), 0)
})

test('the sole production origin supports expected headers and durable KV storage', async () => {
  for (const publicOrigin of [origin]) {
    const kv = createFakeKv()
    const { env } = makeEnv({ SODA_PUBLIC_ORIGIN: origin }, kv)
    const handler = createScanFeedbackReceiver()
    const report = { ...validReport, reportId: crypto.randomUUID() }
    const req = makeRequest(report, {}, publicOrigin)
    const res = await handler(req, env)

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8')
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('access-control-allow-origin'), null)

    const ack = await res.json()
    assert.equal(ack.status, 'received')
    assert.equal(ack.reportId, report.reportId)
    assert.equal(typeof ack.receivedAt, 'string')
    assert(Number.isFinite(Date.parse(ack.receivedAt)))

    assert.equal(kv.getPutCount(), 1)
    const stored = storedFor(kv, report.reportId)
    assert(stored)
    assert.equal(stored.options.expirationTtl, 30 * 86400)
    const parsed = JSON.parse(stored.value)
    assert.equal(parsed.reportId, report.reportId)
    assert.equal(parsed.receivedAt, ack.receivedAt)
  }
})

test('rejects queries, non-POST methods, cross-origin and malformed media types without body consumption', async () => {
  const handler = createScanFeedbackReceiver()
  const { env, kv } = makeEnv()

  for (const path of [`${contract.endpoint}?uid=12345`, `${contract.endpoint}?`]) {
    const req = makeRequest(validReport, {}, origin, path)
    assert.equal((await handler(req, env)).status, 400)
    assert.equal(req.bodyUsed, false)
  }

  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
    const req = new Request(`${origin}${contract.endpoint}`, { method })
    const res = await handler(req, env)
    assert.equal(res.status, 405)
    assert.equal(res.headers.get('allow'), 'POST')
  }

  for (const headers of [
    { origin: 'https://evil.invalid' },
    { origin: `${origin}/` },
    { origin: 'null' },
    { 'sec-fetch-site': 'same-site' },
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'none' },
  ]) {
    const req = makeRequest(validReport, { headers })
    assert.equal((await handler(req, env)).status, 403)
    assert.equal(req.bodyUsed, false)
  }

  const missingOrigin = makeRequest()
  missingOrigin.headers.delete('origin')
  assert.equal((await handler(missingOrigin, env)).status, 403)

  for (const type of [
    'text/plain',
    'application/x-www-form-urlencoded',
    'application/json; charset=latin1',
  ]) {
    const req = makeRequest(validReport, { headers: { 'content-type': type } })
    assert.equal((await handler(req, env)).status, 400)
    assert.equal(req.bodyUsed, false)
  }

  const nonBrowser = makeRequest(validReport, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
  nonBrowser.headers.delete('sec-fetch-site')
  assert.equal((await handler(nonBrowser, env)).status, 200)

  assert.equal(kv.getPutCount(), 1)
})

test('top-level schema and unknown/sensitive fields strictly rejected without logging or writing', async () => {
  const handler = createScanFeedbackReceiver()
  const { env, kv } = makeEnv()

  const invalidPayloads = [
    null,
    [],
    'hello',
    123,
    {},
    { ...validReport, schema: 2 },
    { ...validReport, schema: '1' },
    { ...validReport, schema: 0 },
    ...[
      'account',
      'token',
      'disc',
      'uid',
      'message',
      'path',
      'headers',
      'userAgent',
      '__proto__',
    ].map((extraKey) => ({ ...validReport, [extraKey]: 'sensitive-data' })),
  ]

  // Missing each required top-level key
  for (const key of Object.keys(validReport)) {
    const missing = { ...validReport }
    delete missing[key]
    invalidPayloads.push(missing)
  }

  for (const payload of invalidPayloads) {
    const req = makeRequest(payload)
    const res = await handler(req, env)
    assert.equal(res.status, 400, JSON.stringify(payload))
  }

  for (const badBody of ['not JSON', '{', new Uint8Array([0xff])]) {
    const req = makeRequest(validReport, { body: badBody })
    assert.equal((await handler(req, env)).status, 400)
  }

  assert.equal(kv.getPutCount(), 0)
})

test('validates and sanitizes nested fields (enums, limits, formats, nullables)', async () => {
  const handler = createScanFeedbackReceiver()
  const { env, kv } = makeEnv()

  const invalidCases = [
    // reportId
    { ...validReport, reportId: 'not-a-uuid' },
    { ...validReport, reportId: '12345678-1234-1234-1234-12345678901z' },
    // release syntax
    { ...validReport, release: 'short' },
    { ...validReport, release: 'has space' },
    // outcome
    { ...validReport, outcome: 'invalid_outcome' },
    // stage
    { ...validReport, stage: 'invalid_stage' },
    // code
    { ...validReport, code: 'invalid_code' },
    // versions
    { ...validReport, versions: { unknownVersion: '1.0' } },
    { ...validReport, versions: { helper: 'invalid.version.format' } },
    { ...validReport, versions: { helper: 123 } },
    { ...validReport, versions: { scanner: 'wrong-scanner-prefix' } },
    { ...validReport, versions: { runtime: 'soda-scanner-INVALID_UPPERCASE' } },
    { ...validReport, versions: { ocr: 'Tesseract' } },
    // counts
    { ...validReport, counts: { unknownCount: 1 } },
    { ...validReport, counts: { processed: 1 } }, // missing total
    { ...validReport, counts: { total: 1 } }, // missing processed
    { ...validReport, counts: { processed: 1.5, total: 10 } }, // float
    { ...validReport, counts: { processed: -1, total: 10 } }, // negative
    { ...validReport, counts: { processed: 100001, total: 10 } }, // out of range
    { ...validReport, counts: { processed: '10', total: 10 } }, // string
    // durationMs
    { ...validReport, durationMs: -1 },
    { ...validReport, durationMs: 3600001 },
    { ...validReport, durationMs: 12.5 },
    { ...validReport, durationMs: '100' },
    // environment
    { ...validReport, environment: { unknownEnv: 123 } },
    { ...validReport, environment: { width: 20001 } },
    { ...validReport, environment: { width: -1 } },
    { ...validReport, environment: { width: 1.5 } },
    { ...validReport, environment: { captureMode: 'obs' } },
    { ...validReport, environment: { browser: 'opera' } },
    // evidence
    { ...validReport, evidence: { unknownEvidence: true } },
    { ...validReport, evidence: { visualRow: 101 } },
    { ...validReport, evidence: { exitCode: 4294967296 } },
    { ...validReport, evidence: { sawPanelChange: 'true' } },
    { ...validReport, evidence: { firstMissingRoi: 'notAnRoi' } },
  ]

  for (const payload of invalidCases) {
    const res = await handler(makeRequest(payload), env)
    assert.equal(res.status, 400, JSON.stringify(payload))
  }

  // Valid nullable cases
  const nullableCases = [
    {
      ...validReport,
      reportId: crypto.randomUUID(),
      durationMs: null,
      counts: { processed: null, total: null },
    },
    {
      ...validReport,
      reportId: crypto.randomUUID(),
      counts: { processed: 0, total: 0, visited: null, queued: null, failed: null },
    },
    {
      ...validReport,
      reportId: crypto.randomUUID(),
      versions: {},
      environment: {},
      evidence: {},
    },
  ]

  for (const payload of nullableCases) {
    const res = await handler(makeRequest(payload), env)
    assert.equal(res.status, 200)
    const stored = JSON.parse(storedFor(kv, payload.reportId).value)
    assert.equal(stored.durationMs, payload.durationMs)
    assert.equal(stored.counts.processed, payload.counts.processed)
    assert.equal(stored.counts.total, payload.counts.total)
  }
})

test('cached pages and saved failures remain submitable after a release update', async () => {
  const handler = createScanFeedbackReceiver()
  const { env, kv } = makeEnv()
  const stale = { ...validReport, release: 'old-release-20260901' }
  const res = await handler(makeRequest(stale), env)
  assert.equal(res.status, 200)
  const receipt = await res.json()
  assert.equal(JSON.parse(storedFor(kv, stale.reportId).value).release, stale.release)
  const retry = await handler(makeRequest(stale), {
    ...env,
    SODA_RELEASE_ID: 'new-release-20261008',
  })
  assert.equal(retry.status, 200)
  assert.deepEqual(await retry.json(), receipt)
  assert.equal(kv.getPutCount(), 1)
})

test('stream bounds: 4096 byte boundary, oversized stream and hostile slow stream', async () => {
  const handler = createScanFeedbackReceiver({ timeoutMs: 25, concurrency: 1 })
  const { env, kv } = makeEnv()

  // 1. Content-Length > 4096 returns 413 without reading body
  const oversizedLengthReq = makeRequest(validReport, { headers: { 'content-length': '4097' } })
  assert.equal((await handler(oversizedLengthReq, env)).status, 413)
  assert.equal(oversizedLengthReq.bodyUsed, false)

  // 2. Stream exceeding 4096 bytes returns 413
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(2500).fill(32))
      controller.enqueue(new Uint8Array(2500).fill(32))
      controller.close()
    },
  })
  const streamReq = makeRequest(validReport, { body: stream, duplex: 'half' })
  assert.equal((await handler(streamReq, env)).status, 413)

  // 3. Slow/hostile stream times out and releases concurrency slot
  const hangingStream = new ReadableStream({ cancel: () => new Promise(() => {}) })
  const slowPromise = handler(
    makeRequest(validReport, { body: hangingStream, duplex: 'half' }),
    env,
  )
  // Concurrency is 1, so immediate next request while slow is in flight returns 429
  assert.equal(
    (await handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env)).status,
    429,
  )
  assert.equal((await slowPromise).status, 400)
  // After slow finishes/times out, slot is freed
  const recovered = await handler(
    makeRequest({ ...validReport, reportId: crypto.randomUUID() }),
    env,
  )
  assert.equal(recovered.status, 200)

  assert.equal(kv.getPutCount(), 1)
})

test('persistence failure, missing binding and timeouts fail closed with 503; no false success', async () => {
  const { env: baseEnv } = makeEnv()

  // 1. Missing binding in env
  const missingBindingEnv = { ...baseEnv, [contract.storageBinding]: undefined }
  const handler = createScanFeedbackReceiver()
  assert.equal((await handler(makeRequest(), missingBindingEnv)).status, 503)

  // 2. KV.put throws error
  const failPutKv = createFakeKv({ failPut: true })
  const failPutEnv = { ...baseEnv, [contract.storageBinding]: failPutKv }
  assert.equal((await handler(makeRequest(), failPutEnv)).status, 503)
  assert.equal(failPutKv.store.size, 0)

  // 3. KV.put times out
  const timeoutPutKv = createFakeKv({ putDelay: 100 })
  const timeoutPutEnv = { ...baseEnv, [contract.storageBinding]: timeoutPutKv }
  const timeoutHandler = createScanFeedbackReceiver({ kvTimeoutMs: 20 })
  assert.equal((await timeoutHandler(makeRequest(), timeoutPutEnv)).status, 503)

  // 4. KV.get throws error
  const failGetKv = createFakeKv({ failGet: true })
  const failGetEnv = { ...baseEnv, [contract.storageBinding]: failGetKv }
  assert.equal((await handler(makeRequest(), failGetEnv)).status, 503)

  // 5. KV.get times out
  const timeoutGetKv = createFakeKv({ getDelay: 100 })
  const timeoutGetEnv = { ...baseEnv, [contract.storageBinding]: timeoutGetKv }
  assert.equal((await timeoutHandler(makeRequest(), timeoutGetEnv)).status, 503)
})

test('idempotent same payload retry returns original receipt; different content has its own record', async () => {
  const kv = createFakeKv()
  const { env } = makeEnv({}, kv)
  let time = 1700000000000
  const handler = createScanFeedbackReceiver({ now: () => time })

  const reportId = crypto.randomUUID()
  const report = { ...validReport, reportId }

  // Initial submission
  const firstRes = await handler(makeRequest(report), env)
  assert.equal(firstRes.status, 200)
  const firstAck = await firstRes.json()
  assert.equal(firstAck.status, 'received')
  assert.equal(firstAck.reportId, reportId)
  assert.equal(firstAck.receivedAt, new Date(time).toISOString())
  assert.equal(kv.getPutCount(), 1)

  // Advance time and use a fresh isolate: retry must reuse durable evidence.
  time += 5000
  const retryRes = await createScanFeedbackReceiver({ now: () => time })(makeRequest(report), env)
  assert.equal(retryRes.status, 200)
  const retryAck = await retryRes.json()
  assert.equal(retryAck.status, 'received')
  assert.equal(retryAck.reportId, reportId)
  // Must return original receivedAt, not new time!
  assert.equal(retryAck.receivedAt, firstAck.receivedAt)
  // Must NOT have written to KV again!
  assert.equal(kv.getPutCount(), 1)

  // Different content with the same reportId must not overwrite the first report
  const conflictingReport = { ...report, outcome: 'completed' }
  const conflictRes = await handler(makeRequest(conflictingReport), env)
  assert.equal(conflictRes.status, 200)
  assert.equal(kv.getPutCount(), 2)
  assert.deepEqual([...kv.store.values()].map(({ value }) => JSON.parse(value).outcome).sort(), [
    'completed',
    'failed',
  ])
})

test('concurrent in-flight requests share identical receipts and preserve differing content', async () => {
  const kv = createFakeKv({ putDelay: 30 })
  const { env } = makeEnv({}, kv)
  const handler = createScanFeedbackReceiver()

  const reportId = crypto.randomUUID()
  const report = { ...validReport, reportId }

  // Launch two concurrent requests with identical payload
  const [res1, res2] = await Promise.all([
    handler(makeRequest(report), env),
    handler(makeRequest(report), env),
  ])

  assert.equal(res1.status, 200)
  assert.equal(res2.status, 200)
  const ack1 = await res1.json()
  const ack2 = await res2.json()
  assert.equal(ack1.receivedAt, ack2.receivedAt)
  // Only one durable put performed!
  assert.equal(kv.getPutCount(), 1)

  // Launch concurrent conflict
  const conflictId = crypto.randomUUID()
  const [cRes1, cRes2] = await Promise.all([
    handler(makeRequest({ ...validReport, reportId: conflictId, outcome: 'failed' }), env),
    handler(makeRequest({ ...validReport, reportId: conflictId, outcome: 'completed' }), env),
  ])
  const statuses = [cRes1.status, cRes2.status].sort()
  assert.deepEqual(statuses, [200, 200])
  assert.equal(kv.store.size, 3)
})

test('per-isolate rate limit window is bounded and resets', async () => {
  let time = 1000
  const kv = createFakeKv()
  const { env } = makeEnv({}, kv)
  const handler = createScanFeedbackReceiver({
    rateLimitPerMinute: 2,
    now: () => time,
  })

  const req1 = makeRequest({ ...validReport, reportId: crypto.randomUUID() })
  const req2 = makeRequest({ ...validReport, reportId: crypto.randomUUID() })
  const req3 = makeRequest({ ...validReport, reportId: crypto.randomUUID() })

  assert.equal((await handler(req1, env)).status, 200)
  assert.equal((await handler(req2, env)).status, 200)
  assert.equal((await handler(req3, env)).status, 429)

  // Advance time past 60s
  time += 60000
  const req4 = makeRequest({ ...validReport, reportId: crypto.randomUUID() })
  assert.equal((await handler(req4, env)).status, 200)
})

test('unknown __proto__/constructor/toString in top-level, versions, counts, environment, evidence return 400 and never 503', async () => {
  const handler = createScanFeedbackReceiver()
  const { env, kv } = makeEnv()
  const protoKeys = ['__proto__', 'constructor', 'toString']

  for (const key of protoKeys) {
    // Top-level
    const topBody = JSON.stringify(validReport).replace('{', `{"${key}": "malicious", `)
    const resTop = await handler(makeRequest(validReport, { body: topBody }), env)
    assert.equal(resTop.status, 400, `Top-level ${key} must return 400`)

    // versions
    const verBody = JSON.stringify(validReport).replace(
      '"versions":{',
      `"versions":{"${key}": "1.0.0", `,
    )
    const resVer = await handler(makeRequest(validReport, { body: verBody }), env)
    assert.equal(resVer.status, 400, `versions.${key} must return 400`)

    // counts
    const countsBody = JSON.stringify(validReport).replace('"counts":{', `"counts":{"${key}": 10, `)
    const resCounts = await handler(makeRequest(validReport, { body: countsBody }), env)
    assert.equal(resCounts.status, 400, `counts.${key} must return 400`)

    // environment
    const envBody = JSON.stringify(validReport).replace(
      '"environment":{',
      `"environment":{"${key}": 10, `,
    )
    const resEnv = await handler(makeRequest(validReport, { body: envBody }), env)
    assert.equal(resEnv.status, 400, `environment.${key} must return 400`)

    // evidence
    const evBody = JSON.stringify(validReport).replace('"evidence":{', `"evidence":{"${key}": 10, `)
    const resEv = await handler(makeRequest(validReport, { body: evBody }), env)
    assert.equal(resEv.status, 400, `evidence.${key} must return 400`)
  }
  assert.equal(kv.getPutCount(), 0)
})

test('recordsEqual reuses receipt when fields are permuted across top-level and nested objects', async () => {
  const kv = createFakeKv()
  const { env } = makeEnv({}, kv)
  let time = 1700000000000
  const handler = createScanFeedbackReceiver({ now: () => time })

  const reportId = crypto.randomUUID()
  const reportA = { ...validReport, reportId }

  // Permute keys in reportB at all levels
  const reportB = {
    evidence: { ...validReport.evidence },
    counts: { total: 200, processed: 12, failed: 1, queued: 5, visited: 15 },
    environment: { ...validReport.environment },
    versions: {
      ocr: 'PP-OCRv6',
      runtime: 'soda-scanner-windows-x64-v1',
      scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r1',
      protocol: '1',
      helper: '1.0.49',
    },
    durationMs: 45000,
    code: 'panel_capture_timeout',
    stage: 'capture',
    outcome: 'failed',
    release: releaseId,
    reportId,
    schema: 1,
  }

  const res1 = await handler(makeRequest(reportA), env)
  assert.equal(res1.status, 200)
  const ack1 = await res1.json()
  assert.equal(kv.getPutCount(), 1)

  time += 10000
  const res2 = await handler(makeRequest(reportB), env)
  assert.equal(res2.status, 200)
  const ack2 = await res2.json()
  assert.equal(ack2.receivedAt, ack1.receivedAt)
  // Put count must remain 1 (no extra write)
  assert.equal(kv.getPutCount(), 1)
})

test('damaged KV records return 503 and never emit received receipt', async () => {
  const corruptedRecords = [
    'not-json',
    'null',
    '123',
    JSON.stringify({ ...validReport, receivedAt: 'invalid-date' }),
    JSON.stringify({ ...validReport, receivedAt: 12345 }),
    JSON.stringify({ ...validReport, receivedAt: null }),
    JSON.stringify({ receivedAt: new Date().toISOString() }),
    JSON.stringify({ ...validReport, schema: 2, receivedAt: new Date().toISOString() }),
    JSON.stringify({ ...validReport, outcome: 'corrupted', receivedAt: new Date().toISOString() }),
  ]

  for (const badRecord of corruptedRecords) {
    const kv = createFakeKv()
    const reportId = crypto.randomUUID()
    kv.store.set(reportId, { value: badRecord, options: {} })
    const { env } = makeEnv({}, kv)
    const handler = createScanFeedbackReceiver()

    const req = makeRequest({ ...validReport, reportId })
    const res = await handler(req, env)
    assert.equal(res.status, 503, `Damaged record should return 503: ${badRecord}`)
    const text = await res.text()
    assert(!text.includes('received'))
  }
})

test('per-isolate rate limit pre-reserves budget: at most 1 admitted when 1 budget remains and 4 puts are suspended', async () => {
  const kv = createFakeKv({ putDelay: 60 })
  const { env } = makeEnv({}, kv)
  const handler = createScanFeedbackReceiver({ rateLimitPerMinute: 3, concurrency: 4 })

  // Consume 2 out of 3 budget
  const res1 = await handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env)
  assert.equal(res1.status, 200)
  const res2 = await handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env)
  assert.equal(res2.status, 200)

  // Exactly 1 budget remains. Launch 4 concurrent requests while puts are suspended.
  const concurrent = await Promise.all([
    handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env),
    handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env),
    handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env),
    handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env),
  ])

  const statuses = concurrent.map((r) => r.status).sort()
  assert.deepEqual(statuses, [200, 429, 429, 429])
  assert.equal(kv.getPutCount(), 3)
})

test('a rejected body from an old minute cannot release the new minute budget', async () => {
  let now = 0
  let streamController
  const { env } = makeEnv({}, createFakeKv())
  const handler = createScanFeedbackReceiver({ now: () => now, rateLimitPerMinute: 1 })
  const pending = handler(
    new Request(`${origin}/_soda/scan-feedback`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      duplex: 'half',
      body: new ReadableStream({
        start(controller) {
          streamController = controller
        },
      }),
    }),
    env,
  )
  now = 60000
  assert.equal(
    (await handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env)).status,
    200,
  )
  streamController.enqueue(new TextEncoder().encode('{}'))
  streamController.close()
  assert.equal((await pending).status, 400)
  assert.equal(
    (await handler(makeRequest({ ...validReport, reportId: crypto.randomUUID() }), env)).status,
    429,
  )
})

test('terminal details reach durable KV and return the complete lookup ID', async () => {
  const evidence = {
    diagnosticSource: 'terminal_details',
    phase: 'row_scroll',
    reason: 'unexpected_scroll_during_row',
    expectedThumbStart: 120,
    actualThumbStart: 180,
    positionFound: true,
    elapsedMs: 4000,
  }
  const report = { ...validReport, code: 'scan_navigation_failed', stage: 'scroll', evidence }
  const { env, kv } = makeEnv()
  const response = await createScanFeedbackReceiver()(makeRequest(report), env)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).reportId, report.reportId)
  assert.deepEqual(JSON.parse(storedFor(kv, report.reportId).value).evidence, evidence)
})
test('strictly rejects unknown fields, unbounded numbers and path-like enum values', () => {
  for (const evidence of [
    { privatePath: '/synthetic/private' },
    { phase: '/synthetic/private' },
    { reason: 'scrollbar_position_missing/path' },
    { diagnosticSource: 'raw_log' },
    { acceptGateReason: 'required_core_missing UID=42' },
    { actualThumbStart: 20001 },
    { elapsedMs: -1 },
    { tick: 0.5 },
    { positionFound: 'true' },
  ])
    assert.equal(sanitizeScanFeedbackPayload({ ...validReport, evidence }).status, 400)
})
test('schema 1 reports with empty or old evidence remain accepted', () => {
  for (const evidence of [{}, validReport.evidence])
    assert.equal(sanitizeScanFeedbackPayload({ ...validReport, evidence }).ok, true)
})

test('independent isolates with simultaneous misses preserve colliding IDs across spaced writes', async () => {
  const store = new Map()
  let contentReads = 0
  let releaseReads
  const bothMissed = new Promise((resolve) => {
    releaseReads = resolve
  })
  let writes = 0
  let firstWritten
  const firstPut = new Promise((resolve) => {
    firstWritten = resolve
  })
  const writeTimes = []
  const kv = {
    async get(key) {
      if (!key.includes(':')) return null
      // Hold both content reads until both isolates have observed no record.
      const existing = store.get(key)?.value ?? null
      contentReads += 1
      if (contentReads === 2) releaseReads()
      await bothMissed
      return existing
    },
    async put(key, value, options) {
      writes += 1
      if (writes === 2) {
        await firstPut
        await new Promise((resolve) => setTimeout(resolve, 1100))
      }
      writeTimes.push(Date.now())
      store.set(key, { value, options })
      firstWritten()
    },
  }
  const { env } = makeEnv({}, kv)
  const reports = [
    validReport,
    { ...validReport, environment: { ...validReport.environment, browser: 'edge' } },
  ]
  const receivers = reports.map(() => createScanFeedbackReceiver({ kvTimeoutMs: 4000 }))
  const responses = await Promise.all(
    reports.map((report, i) => receivers[i](makeRequest(report), env)),
  )
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200],
  )
  assert.equal(contentReads, 2)
  assert.equal(writes, 2)
  assert(writeTimes[1] - writeTimes[0] > 1000)
  assert.equal(store.size, 2)
  assert.equal(store.has(validReport.reportId), false)
  const records = [...store.entries()].map(([key, { value, options }]) => {
    assert.match(key, new RegExp(`^${validReport.reportId}:[0-9a-f]{64}$`))
    assert.equal(options.expirationTtl, 30 * 86400)
    const { receivedAt, ...record } = JSON.parse(value)
    assert(Number.isFinite(Date.parse(receivedAt)))
    return record
  })
  assert.deepEqual(
    records.sort((a, b) => a.environment.browser.localeCompare(b.environment.browser)),
    reports,
  )
})

test('legacy bare keys preserve original receipts and reject different content without writes', async () => {
  const kv = createFakeKv()
  const { env } = makeEnv({}, kv)
  const receivedAt = '2026-10-08T00:00:00.000Z'
  const value = JSON.stringify({ ...validReport, receivedAt })
  kv.store.set(validReport.reportId, { value, options: {} })
  const handler = createScanFeedbackReceiver()
  const response = await handler(makeRequest(validReport), env)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'received',
    reportId: validReport.reportId,
    receivedAt,
  })
  assert.equal(
    (await handler(makeRequest({ ...validReport, outcome: 'completed' }), env)).status,
    409,
  )
  assert.equal(kv.getPutCount(), 0)
  assert.equal(kv.store.size, 1)
  assert.equal(kv.store.get(validReport.reportId).value, value)
})

test('damaged content keys and second read errors fail closed without overwriting storage', async () => {
  const kv = createFakeKv()
  const { env } = makeEnv({}, kv)
  const handler = createScanFeedbackReceiver()
  assert.equal((await handler(makeRequest(validReport), env)).status, 200)
  const [key] = kv.store.keys()
  for (const value of [
    'not-json',
    JSON.stringify({ ...validReport, receivedAt: 'invalid-date' }),
    JSON.stringify({ ...validReport, outcome: 'invalid', receivedAt: new Date().toISOString() }),
  ]) {
    kv.store.set(key, { value, options: {} })
    assert.equal((await handler(makeRequest(validReport), env)).status, 503)
    assert.equal(kv.store.get(key).value, value)
    assert.equal(kv.getPutCount(), 1)
  }
  const badReadKv = {
    get: async (key) => {
      if (key.includes(':')) throw new Error('content_read_failed')
      return null
    },
    put: async () => assert.fail('must not write after failed content read'),
  }
  assert.equal((await handler(makeRequest(), makeEnv({}, badReadKv).env)).status, 503)
})

test('asynchronous content digest errors return 503 and release the concurrency slot', async (t) => {
  const kv = createFakeKv()
  const { env } = makeEnv({}, kv)
  const handler = createScanFeedbackReceiver({ concurrency: 1 })
  const digestMock = t.mock.method(crypto.subtle, 'digest', async () => {
    throw new Error('digest_unavailable')
  })
  assert.equal((await handler(makeRequest(), env)).status, 503)
  assert.equal(kv.getGetCount(), 0)
  assert.equal(kv.getPutCount(), 0)
  digestMock.mock.restore()
  assert.equal((await handler(makeRequest(), env)).status, 200)
})
