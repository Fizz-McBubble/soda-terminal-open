import assert from 'node:assert/strict'
import test from 'node:test'
import { createEdge } from './edge.mjs'

const origin = 'https://app.sodaterminal.workers.dev'
const env = {
  SODA_USAGE_STATISTICS: 'enabled',
  SODA_PUBLIC_ORIGIN: origin,
  SODA_RELEASE_ID: 'usage-test-release',
  ASSETS: {
    fetch: () => {
      throw new Error('usage must not reach assets')
    },
  },
}
const page = { schema: 1, event: 'page_view', category: 'home', release: env.SODA_RELEASE_ID }
function request(payload = page, init = {}, path = '/_soda/usage') {
  return new Request(`${origin}${path}`, {
    method: 'POST',
    ...init,
    headers: {
      origin,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...init.headers,
    },
    body: init.body ?? JSON.stringify(payload),
  })
}
function fixture(options = {}) {
  const logs = []
  const edge = createEdge({
    usageLogger: (record) => logs.push(record),
    fetcher: () => {
      throw new Error('usage must not make network calls')
    },
    ...options,
  })
  return { edge, logs }
}

test('both approved entry points collect only same-origin requests with either production binding', async () => {
  const { edge, logs } = fixture()
  const approved = [origin, 'https://sodaterminal.com']
  for (const configured of approved) {
    for (const entry of approved) {
      const req = new Request(`${entry}/_soda/usage`, {
        method: 'POST',
        headers: {
          origin: entry,
          'content-type': 'application/json',
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify(page),
      })
      const response = await edge.fetch(req, { ...env, SODA_PUBLIC_ORIGIN: configured })
      assert.equal(response.status, 204)
      assert.equal(response.headers.get('access-control-allow-origin'), null)
      const foreign = new Request(`${entry}/_soda/usage`, {
        method: 'POST',
        headers: {
          origin: approved.find((value) => value !== entry),
          'content-type': 'application/json',
        },
        body: JSON.stringify(page),
      })
      assert.equal(
        (await edge.fetch(foreign, { ...env, SODA_PUBLIC_ORIGIN: configured })).status,
        403,
      )
      assert.equal(foreign.bodyUsed, false)
    }
  }
  assert.equal(logs.length, 4)
})

test('disabled, unbound and nonproduction collectors return 404 without reading bodies', async () => {
  const { edge, logs } = fixture()
  for (const overrides of [
    { SODA_USAGE_STATISTICS: undefined },
    { SODA_USAGE_STATISTICS: 'true' },
    { SODA_RELEASE_ID: undefined },
    { SODA_RELEASE_ID: 'invalid private release!' },
    { SODA_RELEASE_ID: ['usage-test-release'] },
    { SODA_PUBLIC_ORIGIN: undefined },
    { SODA_PUBLIC_ORIGIN: `${origin}/` },
    { SODA_PUBLIC_ORIGIN: 'https://preview.invalid' },
  ]) {
    const req = request()
    assert.equal((await edge.fetch(req, { ...env, ...overrides })).status, 404)
    assert.equal(req.bodyUsed, false)
  }
  for (const host of [
    'http://127.0.0.1:8787',
    'https://preview.invalid',
    'http://app.sodaterminal.workers.dev',
    'http://sodaterminal.com',
    'https://sodaterminal.com.evil.invalid',
  ]) {
    const req = new Request(`${host}/_soda/usage`, request())
    assert.equal((await edge.fetch(req, env)).status, 404)
    assert.equal(req.bodyUsed, false)
  }
  assert.deepEqual(logs, [])
})

test('accepts only finite page/operation/performance categories and reconstructs logs', async () => {
  const { edge, logs } = fixture()
  const accepted = [
    ...['home', 'assets', 'development', 'loadouts', 'warehouse', 'scanner', 'help'].map(
      (category) => ({ schema: 1, event: 'page_view', category }),
    ),
    ...['scanner_connection', 'disc_import', 'team_loadout', 'plan_save'].flatMap((category) =>
      ['success', 'failure', 'cancelled', 'incomplete'].map((outcome) => ({
        schema: 1,
        event: 'operation',
        category,
        outcome,
        durationMs: 100,
      })),
    ),
    { schema: 1, event: 'performance', category: 'startup', durationMs: 0 },
    { schema: 1, event: 'performance', category: 'startup', durationMs: 3_600_000 },
  ].map((payload) => ({ ...payload, release: env.SODA_RELEASE_ID }))
  for (const payload of accepted) {
    const response = await edge.fetch(request(payload), env)
    assert.equal(response.status, 204)
    assert.equal(await response.text(), '')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('access-control-allow-origin'), null)
  }
  assert.deepEqual(
    logs,
    accepted.map((payload) => ({
      dataset: 'soda_usage',
      ...payload,
      release: env.SODA_RELEASE_ID,
    })),
  )
})

test('rejects queries, methods, cross-origin and malformed media types before reading', async () => {
  const { edge, logs } = fixture()
  for (const path of ['/_soda/usage?account=private', '/_soda/usage?']) {
    const req = request(page, {}, path)
    assert.equal((await edge.fetch(req, env)).status, 400)
    assert.equal(req.bodyUsed, false)
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
    const req = new Request(`${origin}/_soda/usage`, { method })
    const response = await edge.fetch(req, env)
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('allow'), 'POST')
  }
  for (const headers of [
    { origin: 'https://evil.invalid' },
    { origin: `${origin}/` },
    { origin: 'null' },
    { 'sec-fetch-site': 'same-site' },
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'none' },
  ]) {
    const req = request(page, { headers })
    assert.equal((await edge.fetch(req, env)).status, 403)
    assert.equal(req.bodyUsed, false)
  }
  const missingOrigin = request()
  missingOrigin.headers.delete('origin')
  assert.equal((await edge.fetch(missingOrigin, env)).status, 403)
  for (const type of ['text/plain', 'application/jsonp', 'application/json; charset=latin1']) {
    const req = request(page, { headers: { 'content-type': type } })
    assert.equal((await edge.fetch(req, env)).status, 400)
    assert.equal(req.bodyUsed, false)
  }
  assert.deepEqual(logs, [])
  const nonBrowser = request(page, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
  nonBrowser.headers.delete('sec-fetch-site')
  assert.equal((await edge.fetch(nonBrowser, env)).status, 204)
})

test('rejects unknown fields, malformed JSON, category mixing and invalid durations without logging', async () => {
  const { edge, logs } = fixture()
  const operation = {
    schema: 1,
    event: 'operation',
    category: 'plan_save',
    outcome: 'success',
    durationMs: 100,
    release: env.SODA_RELEASE_ID,
  }
  const invalid = [
    null,
    [],
    'home',
    1,
    {},
    { ...page, schema: 2 },
    { ...page, schema: '1' },
    ...['account', 'url', 'query', 'dataset', '__proto__', 'error'].map((key) =>
      Object.fromEntries([...Object.entries(page), [key, 'private-value']]),
    ),
    { ...page, category: 'plan_save' },
    { ...page, outcome: 'success' },
    { ...page, durationMs: 0 },
    { ...operation, event: 'identify' },
    { ...operation, category: 'home' },
    { ...operation, outcome: 'private-error' },
    { ...operation, outcome: null },
    { schema: 1, event: 'operation', category: 'plan_save' },
    { schema: 1, event: 'operation', category: 'plan_save', outcome: 'success' },
    ...[-1, 3_600_001, 0.5, '100', null, true].map((durationMs) => ({ ...operation, durationMs })),
    { schema: 1, event: 'performance', category: 'startup' },
    { schema: 1, event: 'performance', category: 'home', durationMs: 100 },
    { schema: 1, event: 'performance', category: 'startup', durationMs: 100, outcome: 'success' },
  ].map((payload) =>
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { release: env.SODA_RELEASE_ID, ...payload }
      : payload,
  )
  for (const payload of invalid)
    assert.equal((await edge.fetch(request(payload), env)).status, 400, JSON.stringify(payload))
  for (const body of ['not JSON', '{', new Uint8Array([0xff])])
    assert.equal((await edge.fetch(request(page, { body }), env)).status, 400)
  assert.deepEqual(logs, [])
})

test('missing/invalid client releases are rejected and old tabs return 409 without logging', async () => {
  const { edge, logs } = fixture()
  const missing = { ...page }
  delete missing.release
  assert.equal((await edge.fetch(request(missing), env)).status, 400)
  for (const release of ['', 'short', 'invalid private release!', null, 1, ['usage-test-release']])
    assert.equal((await edge.fetch(request({ ...page, release }), env)).status, 400)
  const response = await edge.fetch(request({ ...page, release: 'previous-valid-release' }), env)
  assert.equal(response.status, 409)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(logs, [])
})

test('512 byte body boundary applies to actual stream bytes and content length', async () => {
  const { edge, logs } = fixture()
  const padded = JSON.stringify(page).padEnd(512, ' ')
  assert.equal((await edge.fetch(request(page, { body: padded }), env)).status, 204)
  for (const body of [padded + ' ', JSON.stringify(page) + '汉'.repeat(200)])
    assert.equal((await edge.fetch(request(page, { body }), env)).status, 413)
  const oversizedLength = request(page, { headers: { 'content-length': '513' } })
  assert.equal((await edge.fetch(oversizedLength, env)).status, 413)
  assert.equal(oversizedLength.bodyUsed, false)
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(300).fill(32))
      controller.enqueue(new Uint8Array(300).fill(32))
      controller.close()
    },
  })
  assert.equal((await edge.fetch(request(page, { body: stream, duplex: 'half' }), env)).status, 413)
  assert.equal(logs.length, 1)
})

test('slow body times out, releases its slot and never logs its body or error', async () => {
  const { edge, logs } = fixture({ usageTimeoutMs: 15, usageConcurrency: 1 })
  const stream = new ReadableStream({ cancel: () => new Promise(() => {}) })
  const first = edge.fetch(request(page, { body: stream, duplex: 'half' }), env)
  assert.equal((await edge.fetch(request(), env)).status, 429)
  assert.equal((await first).status, 400)
  assert.equal((await edge.fetch(request(), env)).status, 204)
  assert.equal(logs.length, 1)
})

test('per-isolate log window is bounded and resets; inflight requests cannot exceed it', async () => {
  let time = 0
  const { edge, logs } = fixture({ usageLogsPerMinute: 2, now: () => time })
  const results = await Promise.all(Array.from({ length: 4 }, () => edge.fetch(request(), env)))
  assert.deepEqual(results.map((response) => response.status).sort(), [204, 204, 429, 429])
  assert.equal(logs.length, 2)
  assert.equal((await edge.fetch(request(), env)).status, 429)
  time = 60_000
  assert.equal((await edge.fetch(request(), env)).status, 204)
  assert.equal(logs.length, 3)
})

test('old computation APIs remain 410 with collection enabled and no body consumption', async () => {
  const { edge, logs } = fixture()
  const req = request({ account: 'private' }, {}, '/api/calculation/tasks')
  assert.equal((await edge.fetch(req, env)).status, 410)
  assert.equal(req.bodyUsed, false)
  assert.deepEqual(logs, [])
  for (const path of ['/_soda/usage/', '/_soda/%75sage', '/_soda/other'])
    assert.equal((await edge.fetch(request(page, {}, path), env)).status, 404)
})

test('scan-feedback edge route integrates before generic /_soda 404 and preserves existing routes', async () => {
  const store = new Map()
  const fakeKv = {
    async get(key) {
      return store.get(key) ?? null
    },
    async put(key, value) {
      store.set(key, value)
    },
  }

  const { edge } = fixture({ feedbackStore: fakeKv })
  const feedbackReport = {
    schema: 1,
    reportId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    release: env.SODA_RELEASE_ID,
    outcome: 'failed',
    stage: 'ocr',
    code: 'ocr_worker_failed',
    versions: {
      helper: '1.0.49',
      protocol: '1',
      scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r1',
      runtime: 'soda-scanner-windows-x64-v1',
      ocr: 'PP-OCRv6',
    },
    counts: { processed: 5, total: 100 },
    durationMs: 12000,
    environment: { browser: 'chrome', captureMode: 'dxgi' },
    evidence: { attempts: 1, firstMissingRoi: 'subStat1' },
  }

  const feedbackEnv = {
    ...env,
    SODA_SCAN_FEEDBACK: 'enabled',
    SODA_SCAN_FEEDBACK_STORE: fakeKv,
  }

  // 1. Success through edge route
  const feedbackReq = new Request(`${origin}/_soda/scan-feedback`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify(feedbackReport),
  })
  const res = await edge.fetch(feedbackReq, feedbackEnv)
  assert.equal(res.status, 200)
  const ack = await res.json()
  assert.equal(ack.status, 'received')
  assert.equal(ack.reportId, feedbackReport.reportId)
  assert(store.has(feedbackReport.reportId))

  // 2. Disabled feedback returns 404
  const disabledReq = new Request(`${origin}/_soda/scan-feedback`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify(feedbackReport),
  })
  assert.equal(
    (await edge.fetch(disabledReq, { ...feedbackEnv, SODA_SCAN_FEEDBACK: undefined })).status,
    404,
  )

  // 3. Other routes remain intact
  const healthRes = await edge.fetch(new Request(`${origin}/_soda/health`), feedbackEnv)
  assert.equal(healthRes.status, 200)
  const healthJson = await healthRes.json()
  assert.equal(healthJson.status, 'edge_ready')

  const apiRes = await edge.fetch(new Request(`${origin}/api/calculation`), feedbackEnv)
  assert.equal(apiRes.status, 410)

  const usageRes = await edge.fetch(request(), feedbackEnv)
  assert.equal(usageRes.status, 204)

  const generic404 = await edge.fetch(new Request(`${origin}/_soda/unknown`), feedbackEnv)
  assert.equal(generic404.status, 404)
})
