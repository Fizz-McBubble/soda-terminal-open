import assert from 'node:assert/strict'
import test from 'node:test'
import { createEdge } from './edge.mjs'
import scannerRelease from '../../public/downloads/scanner-installer-release.v1.json' with { type: 'json' }
import {
  assetQuickReadInstallerRelease,
  assetQuickReadInstallerPath,
} from './asset-quick-read-release.mjs'
import { installerChunkSize } from './installer-chunk-cache.mjs'

const origin = 'https://sodaterminal.com'

test('edge forwards waitUntil for both pinned installer chunk caches', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'caches')
  const entries = new Map(),
    pending = []
  const ctx = {
    waitUntil(p) {
      pending.push(p)
    },
  }
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      default: {
        async match(key) {
          return entries.get(key.url)?.clone()
        },
        async put(key, response) {
          assert.equal(response.status, 200)
          entries.set(key.url, new Response(await response.arrayBuffer(), response))
        },
      },
    },
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'caches', previous)
    else delete globalThis.caches
  })
  for (const [path, release] of [
    ['/downloads/Soda-Scanner-Setup.exe', scannerRelease],
    [assetQuickReadInstallerPath, assetQuickReadInstallerRelease],
  ]) {
    let calls = 0
    const start = Math.floor((release.size - 1) / installerChunkSize) * installerChunkSize
    const data = new Uint8Array(release.size - start)
    const edge = createEdge({
      fetcher: async () => {
        calls++
        return new Response(data, {
          status: 206,
          headers: {
            'content-length': String(data.length),
            'content-range': `bytes ${start}-${release.size - 1}/${release.size}`,
            'content-type': 'application/octet-stream',
          },
        })
      },
    })
    for (let n = 0; n < 2; n++) {
      const response = await edge.fetch(
        new Request(`${origin}${path}`, {
          headers: {
            range: `bytes=${start}-${release.size - 1}`,
            'if-range': `"${release.sha256}"`,
          },
        }),
        env,
        ctx,
      )
      assert.equal(response.status, 206)
      assert.equal((await response.arrayBuffer()).byteLength, data.length)
      await Promise.all(pending)
    }
    assert.equal(calls, 1)
  }
  assert.equal(entries.size, 2)
})
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
    { SODA_PUBLIC_ORIGIN: 'https://app.sodaterminal.workers.dev' },
  ]) {
    const req = request()
    assert.equal((await edge.fetch(req, { ...env, ...overrides })).status, 404)
    assert.equal(req.bodyUsed, false)
  }
  for (const host of [
    'http://127.0.0.1:8787',
    'https://preview.invalid',
    'http://app.sodaterminal.workers.dev',
    'https://app.sodaterminal.workers.dev',
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
  const storedKeys = [...store.keys()]
  assert.equal(storedKeys.length, 1)
  assert.match(storedKeys[0], new RegExp(`^${feedbackReport.reportId}:[a-f0-9]{64}$`, 'u'))
  assert.equal(JSON.parse(store.get(storedKeys[0])).reportId, feedbackReport.reportId)

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

test('source usage budget allows normal bursts, blocks before logging/body read and isolates sources', async () => {
  let time = 0
  const { edge, logs } = fixture({ now: () => time })
  const from = (ip) => request(page, { headers: { 'cf-connecting-ip': ip } })
  for (let i = 0; i < 60; i += 1)
    assert.equal((await edge.fetch(from('192.0.2.1'), env)).status, 204)
  time = 10_000
  const blocked = from('192.0.2.1')
  const response = await edge.fetch(blocked, env)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '50')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(blocked.bodyUsed, false)
  assert.equal(logs.length, 60)
  assert.equal((await edge.fetch(from('192.0.2.2'), env)).status, 204)
  time = 60_000
  assert.equal((await edge.fetch(from('192.0.2.1'), env)).status, 204)
  assert.equal(logs.length, 62)
  assert.ok(logs.every((record) => !JSON.stringify(record).includes('192.0.2.')))
})

test('missing CF IP shares a budget regardless of spoofed forwarded headers', async () => {
  const { edge, logs } = fixture({ sourceLimits: { usage: 2 } })
  for (let i = 0; i < 3; i += 1) {
    const req = request(page, {
      headers: { 'x-forwarded-for': `192.0.2.${i}`, 'x-real-ip': `198.51.100.${i}` },
    })
    assert.equal((await edge.fetch(req, env)).status, i < 2 ? 204 : 429)
  }
  assert.equal(logs.length, 2)
})

test('bounded source table rejects new keys without evicting budgets and recovers on expiry/clock rollback', async () => {
  let time = 0
  const { edge } = fixture({ sourceMaxEntries: 2, sourceLimits: { usage: 2 }, now: () => time })
  const from = (ip) => request(page, { headers: { 'cf-connecting-ip': ip } })
  for (const ip of ['192.0.2.1', '192.0.2.2'])
    assert.equal((await edge.fetch(from(ip), env)).status, 204)
  for (let i = 3; i < 20; i += 1)
    assert.equal((await edge.fetch(from(`192.0.2.${i}`), env)).status, 429)
  assert.equal((await edge.fetch(from('192.0.2.1'), env)).status, 204)
  assert.equal((await edge.fetch(from('192.0.2.1'), env)).status, 429)
  time = 60_000
  assert.equal((await edge.fetch(from('192.0.2.3'), env)).status, 204)
  time = 0
  assert.equal((await edge.fetch(from('192.0.2.4'), env)).status, 204)
})

const imagePath = `/official-catalog-cache?source=${encodeURIComponent('https://act-upload.mihoyo.com/nap-obc-indep/test.png')}`
test('image budget permits a full page burst and blocks excess before upstream fetch', async () => {
  let calls = 0
  const { edge } = fixture({
    fetcher: async () => {
      calls += 1
      return new Response('image', { headers: { 'content-type': 'image/png' } })
    },
  })
  for (let i = 0; i < 600; i += 1)
    assert.equal((await edge.fetch(new Request(`${origin}${imagePath}`), env)).status, 200)
  assert.equal((await edge.fetch(new Request(`${origin}${imagePath}`), env)).status, 429)
  assert.equal(calls, 600)
  assert.equal(
    (
      await edge.fetch(
        new Request(`${origin}/official-catalog-cache?source=https://evil.invalid/a.png`),
        env,
      )
    ).status,
    403,
  )
})

test('installer budget preserves Range downloads and is shared by both installer entries', async () => {
  let calls = 0
  const { edge } = fixture({
    fetcher: async (url, init) => {
      calls += 1
      assert.equal(init.headers.range, 'bytes=0-0')
      const size = url.includes('asset-quick-read')
        ? assetQuickReadInstallerRelease.size
        : scannerRelease.size
      return new Response('x', {
        status: 206,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': '1',
          'content-range': `bytes 0-0/${size}`,
        },
      })
    },
  })
  const paths = ['/downloads/Soda-Scanner-Setup.exe', '/downloads/Soda-Asset-Quick-Read-Setup.exe']
  for (let i = 0; i < 60; i += 1) {
    const response = await edge.fetch(
      new Request(`${origin}${paths[i % 2]}`, { headers: { range: 'bytes=0-0' } }),
      env,
    )
    assert.equal(response.status, 206)
    assert.equal(await response.text(), 'x')
  }
  for (const path of paths) {
    const response = await edge.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }), env)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  assert.equal(calls, 60)
})

test('feedback permits normal retries then blocks before any KV access, independently for another source', async () => {
  let gets = 0
  let puts = 0
  const stored = new Map()
  const { edge } = fixture({
    feedbackStore: {
      async get(key) {
        gets += 1
        return stored.get(key) ?? null
      },
      async put(key, value) {
        puts += 1
        stored.set(key, value)
      },
    },
  })
  const report = {
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
  const feedbackEnv = { ...env, SODA_SCAN_FEEDBACK: 'enabled' }
  const from = (ip) =>
    request(report, { headers: { 'cf-connecting-ip': ip } }, '/_soda/scan-feedback')
  for (let i = 0; i < 12; i += 1)
    assert.equal((await edge.fetch(from('192.0.2.1'), feedbackEnv)).status, 200)
  assert.equal(puts, 1)
  const before = gets
  const blocked = from('192.0.2.1')
  assert.equal((await edge.fetch(blocked, feedbackEnv)).status, 429)
  assert.equal(blocked.bodyUsed, false)
  assert.equal(gets, before)
  assert.equal(puts, 1)
  assert.equal((await edge.fetch(from('192.0.2.2'), feedbackEnv)).status, 200)
  assert.equal(puts, 1)
  assert.ok([...stored.values()].every((value) => !value.includes('192.0.2.')))
})

test('feedback source budget blocks storage calls and body reads; routes, static and health are independent', async () => {
  let gets = 0
  let puts = 0
  const { edge, logs } = fixture({
    sourceLimits: { usage: 1, feedback: 2, image: 1, download: 1 },
    feedbackStore: {
      async get() {
        gets += 1
        return null
      },
      async put() {
        puts += 1
      },
    },
    fetcher: async () => new Response('image', { headers: { 'content-type': 'image/png' } }),
  })
  const feedbackEnv = { ...env, SODA_SCAN_FEEDBACK: 'enabled' }
  // Invalid bodies consume the source request budget too, so malformed traffic
  // cannot bypass it; existing payload validation still prevents persistence.
  for (let i = 0; i < 2; i += 1)
    assert.equal(
      (await edge.fetch(request(page, {}, '/_soda/scan-feedback'), feedbackEnv)).status,
      400,
    )
  const blocked = request(page, {}, '/_soda/scan-feedback')
  assert.equal((await edge.fetch(blocked, feedbackEnv)).status, 429)
  assert.equal(blocked.bodyUsed, false)
  assert.equal(gets, 0)
  assert.equal(puts, 0)
  assert.equal((await edge.fetch(request(), feedbackEnv)).status, 204)
  assert.equal((await edge.fetch(request(), feedbackEnv)).status, 429)
  assert.equal(logs.length, 1)
  assert.equal((await edge.fetch(new Request(`${origin}${imagePath}`), feedbackEnv)).status, 200)
  assert.equal((await edge.fetch(new Request(`${origin}${imagePath}`), feedbackEnv)).status, 429)
  const staticEnv = { ...feedbackEnv, ASSETS: { fetch: () => new Response('static') } }
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await edge.fetch(new Request(`${origin}/assets/app.js`), staticEnv)).status, 200)
    assert.equal((await edge.fetch(new Request(`${origin}/_soda/health`), staticEnv)).status, 200)
    assert.equal(
      (await edge.fetch(new Request(`${origin}/api/calculation`), staticEnv)).status,
      410,
    )
  }
})
