import assert from 'node:assert/strict'
import test from 'node:test'
import { createInstallerDownload, installerPath } from './scanner-installer.mjs'
import { installerChunkSize } from './installer-chunk-cache.mjs'

const bytes = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const manifest = {
  releaseState: 'published',
  version: '1.0.0',
  releaseTag: 'scanner-installer-v1.0.0',
  assetName: 'Soda-Scanner-Setup.exe',
  size: bytes.length,
  sha256: 'a'.repeat(64),
  assetUrl:
    'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-installer-v1.0.0/Soda-Scanner-Setup.exe',
}
const request = (init = {}, query = '') =>
  new Request(`https://sodaterminal.com${installerPath}${query}`, init)
const upstream = (body = bytes, overrides = {}) =>
  new Response(body, {
    status: overrides.status ?? 200,
    headers: {
      'content-type': 'application/octet-stream',
      'content-length': String(bytes.length),
      ...overrides.headers,
    },
  })

test('streams the exact pinned asset and forwards no user credentials or source parameter', async () => {
  const calls = []
  const download = createInstallerDownload({
    manifest,
    fetcher: async (url, init) => {
      calls.push({ url, init })
      return upstream()
    },
  })
  const response = await download(
    request({ headers: { cookie: 'private', authorization: 'private' } }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  assert.equal(
    response.headers.get('content-disposition'),
    `attachment; filename="Soda-Scanner-Setup-1.0.0.exe"; filename*=UTF-8''${encodeURIComponent('Soda-画面扫描-1.0.0.exe')}`,
  )
  assert.equal(calls[0].url, manifest.assetUrl)
  assert.deepEqual(calls[0].init.headers, {})
  assert.equal((await download(request({}, '?source=https://foreign.invalid'))).status, 400)
  assert.equal(calls.length, 1)
})

test('a new pinned installer version changes the save name while preserving the stable route', async () => {
  const version = '1.0.6'
  const releaseTag = `scanner-installer-v${version}`
  const download = createInstallerDownload({
    manifest: {
      ...manifest,
      version,
      releaseTag,
      assetUrl: `https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/${releaseTag}/${manifest.assetName}`,
    },
    fetcher: async () => upstream(),
  })
  assert.equal(installerPath, '/downloads/Soda-Scanner-Setup.exe')
  const response = await download(request())
  assert.equal(response.status, 200)
  assert.equal(
    response.headers.get('content-disposition'),
    `attachment; filename="Soda-Scanner-Setup-1.0.6.exe"; filename*=UTF-8''${encodeURIComponent('Soda-画面扫描-1.0.6.exe')}`,
  )
  await response.arrayBuffer()
})

test('HEAD and valid byte ranges preserve download metadata without reading a full package', async () => {
  const calls = []
  const download = createInstallerDownload({
    manifest,
    fetcher: async (_, init) => {
      calls.push(init)
      const body = init.method === 'HEAD' ? null : bytes.subarray(4)
      return upstream(
        body,
        init.headers.range
          ? {
              status: 206,
              headers: {
                'content-length': '4',
                'content-range': 'bytes 4-7/8',
              },
            }
          : {},
      )
    },
  })
  const head = await download(request({ method: 'HEAD' }))
  assert.equal(head.headers.get('content-length'), '8')
  assert.equal(await head.text(), '')
  assert.equal(calls[0].method, 'HEAD')
  const range = await download(request({ headers: { range: 'bytes=-4' } }))
  assert.equal(range.status, 206)
  assert.deepEqual(new Uint8Array(await range.arrayBuffer()), bytes.subarray(4))
  assert.equal(calls[1].headers.range, 'bytes=4-7')
  for (const header of ['bytes=8-', 'bytes=1-0', 'bytes=-0', 'bytes=0-2,4-6', 'anything'])
    assert.equal((await download(request({ headers: { range: header } }))).status, 416)
})

test('rejects unpublished, malformed and foreign manifests before a network request', async () => {
  for (const patch of [
    { releaseState: 'not_published' },
    { size: 0 },
    { size: NaN },
    { sha256: 'bad' },
    { version: 'latest' },
    { version: '1.0.0\r\nX-Injected: yes' },
    { version: '1.0.0\n' },
    { releaseTag: 'latest' },
    { assetName: 'other.exe' },
    { assetUrl: 'https://foreign.invalid/file.exe' },
  ]) {
    const download = createInstallerDownload({
      manifest: { ...manifest, ...patch },
      fetcher: () => {
        throw new Error('must not fetch')
      },
    })
    assert.equal((await download(request())).status, 503)
  }
})

test('a changed installer ETag restarts the whole download instead of mixing old and new bytes', async () => {
  let headers
  const download = createInstallerDownload({
    manifest,
    fetcher: async (_, init) => {
      headers = init.headers
      return upstream()
    },
  })
  const response = await download(
    request({ headers: { range: 'bytes=4-', 'if-range': '"older-package"' } }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(headers, {})
  await response.arrayBuffer()
})

test('allows only GitHub release-asset redirects and rejects HTML or changed size', async () => {
  let calls = 0
  const download = createInstallerDownload({
    manifest,
    fetcher: async () =>
      ++calls === 1
        ? new Response(null, {
            status: 302,
            headers: {
              location:
                'https://release-assets.githubusercontent.com/github-production-release-asset/file',
            },
          })
        : upstream(),
  })
  assert.deepEqual(new Uint8Array(await (await download(request())).arrayBuffer()), bytes)
  for (const response of [
    new Response(null, { status: 302, headers: { location: 'https://foreign.invalid/file' } }),
    upstream(bytes, { headers: { 'content-type': 'text/html' } }),
    upstream(bytes, { headers: { 'content-length': '9' } }),
  ]) {
    const handler = createInstallerDownload({ manifest, fetcher: async () => response })
    assert.equal((await handler(request())).status, 503)
  }
})

test('an incomplete or oversized stream fails and releases its slot for retry', async () => {
  for (const bad of [bytes.subarray(0, 7), new Uint8Array(9)]) {
    let calls = 0
    const download = createInstallerDownload({
      manifest,
      concurrency: 1,
      fetcher: async () => upstream(calls++ ? bytes : bad),
    })
    const broken = await download(request())
    await assert.rejects(broken.arrayBuffer(), /installer_stream_failed/u)
    const retry = await download(request())
    assert.equal(retry.status, 200)
    await retry.arrayBuffer()
  }
})

test('cancellation releases the stream slot, while unsupported methods make no upstream request', async () => {
  const download = createInstallerDownload({
    manifest,
    concurrency: 1,
    fetcher: async () =>
      upstream(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(0, 2))
          },
        }),
      ),
  })
  assert.equal((await download(request({ method: 'POST' }))).status, 405)
  const first = await download(request())
  assert.equal((await download(request())).status, 429)
  await first.body.cancel()
  const retry = await download(request())
  assert.equal(retry.status, 200)
  await retry.body.cancel()
})

function chunkFixture() {
  const entries = new Map(),
    keys = [],
    writes = [],
    pending = []
  const cache = {
    async match(key) {
      keys.push(key)
      return entries.get(key.url)?.clone()
    },
    async put(key, response) {
      assert.equal(response.status, 200)
      assert.equal(key.method, 'GET')
      assert.equal([...key.headers].length, 0)
      writes.push(key.url)
      entries.set(key.url, new Response(await response.arrayBuffer(), response))
    },
  }
  const ctx = {
    waitUntil(promise) {
      pending.push(promise)
    },
  }
  return { cache, ctx, entries, keys, writes, flush: () => Promise.all(pending) }
}
const chunkRequest = (range = 'bytes=0-7', headers = {}) =>
  request({ headers: { range, ...headers } })
const partial = (body = bytes, headers = {}) =>
  upstream(body, {
    status: 206,
    headers: { 'content-range': 'bytes 0-7/8', ...headers },
  })

test('verified final chunk misses then hits an internal 200 cache with unchanged external 206 metadata', async () => {
  const f = chunkFixture()
  let calls = 0
  const download = createInstallerDownload({
    manifest,
    cache: f.cache,
    fetcher: async () => {
      calls++
      return partial()
    },
  })
  const first = await download(
    chunkRequest(undefined, { cookie: 'private', authorization: 'private' }),
    f.ctx,
  )
  assert.equal(first.status, 206)
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), bytes)
  await f.flush()
  const second = await download(chunkRequest(), f.ctx)
  assert.equal(second.status, 206)
  assert.deepEqual(new Uint8Array(await second.arrayBuffer()), bytes)
  for (const header of [
    'content-range',
    'content-length',
    'etag',
    'content-disposition',
    'accept-ranges',
  ])
    assert.equal(second.headers.get(header), first.headers.get(header))
  assert.equal(calls, 1)
  assert.equal(f.writes.length, 1)
  assert.ok(f.writes[0].includes(`/${manifest.size}/${manifest.sha256}/0-7`))
  assert.ok(f.writes[0].includes(installerPath))
  const changed = createInstallerDownload({
    manifest: { ...manifest, sha256: 'b'.repeat(64) },
    cache: f.cache,
    fetcher: async () => {
      calls++
      return partial()
    },
  })
  assert.equal((await changed(chunkRequest(), f.ctx)).status, 206)
  await f.flush()
  assert.equal(calls, 2)
  assert.equal(new Set(f.writes).size, 2)
})

test('only aligned 4MiB grid chunks and the final short chunk enter cache', async () => {
  const f = chunkFixture(),
    size = installerChunkSize + 5
  const download = createInstallerDownload({
    manifest: { ...manifest, size },
    cache: f.cache,
    fetcher: async (_, init) => {
      const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(init.headers.range)
      const start = Number(a),
        end = Number(b)
      return upstream(new Uint8Array(end - start + 1), {
        status: 206,
        headers: {
          'content-length': String(end - start + 1),
          'content-range': `bytes ${start}-${end}/${size}`,
        },
      })
    },
  })
  for (const range of [
    `bytes=0-${installerChunkSize - 1}`,
    `bytes=${installerChunkSize}-${size - 1}`,
  ])
    await (await download(chunkRequest(range), f.ctx)).arrayBuffer()
  await f.flush()
  assert.equal(f.writes.length, 2)
  for (const range of ['bytes=1-7', 'bytes=0-7', `bytes=0-${size - 1}`])
    await (await download(chunkRequest(range), f.ctx)).arrayBuffer()
  await f.flush()
  assert.equal(f.writes.length, 2)
  assert.equal(f.keys.length, 2)
})

test('bad partial lengths, types and redirects never poison a cache and release retry slots', async () => {
  for (const response of [
    partial(bytes.subarray(0, 7)),
    partial(new Uint8Array(9)),
    partial(bytes, { 'content-type': 'text/html' }),
    partial(bytes, { 'content-length': '9' }),
    new Response(null, { status: 302, headers: { location: 'https://foreign.invalid/file' } }),
  ]) {
    const f = chunkFixture()
    let calls = 0
    const download = createInstallerDownload({
      manifest,
      cache: f.cache,
      concurrency: 1,
      fetcher: async () => (calls++ ? partial() : response),
    })
    const broken = await download(chunkRequest(), f.ctx)
    if (
      response.status === 206 &&
      response.headers.get('content-length') === '8' &&
      response.headers.get('content-type') === 'application/octet-stream'
    ) {
      assert.equal(broken.status, 206)
      await assert.rejects(broken.arrayBuffer(), /installer_stream_failed/)
    } else assert.equal(broken.status, 503)
    await f.flush()
    assert.equal(f.writes.length, 0)
    await (await download(chunkRequest(), f.ctx)).arrayBuffer()
    await f.flush()
    assert.equal(f.writes.length, 1)
  }
})

test('cache read/write failures and absent ctx safely fall back to the download', async () => {
  for (const mode of ['read', 'write', 'ctx', 'missing']) {
    let calls = 0,
      writes = 0
    const cache = {
      async match() {
        if (mode === 'read') throw new Error('cache unavailable')
      },
      async put() {
        writes++
        throw new Error('cache full')
      },
    }
    const ctx =
      mode === 'missing'
        ? undefined
        : {
            waitUntil(p) {
              if (mode === 'ctx') throw new Error('ctx unavailable')
              return p
            },
          }
    const download = createInstallerDownload({
      manifest,
      cache,
      fetcher: async () => {
        calls++
        return partial()
      },
    })
    for (let n = 0; n < 2; n++) {
      const response = await download(chunkRequest(), ctx)
      assert.equal(response.status, 206)
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
    }
    assert.equal(calls, 2)
    if (mode === 'missing') assert.equal(writes, 0)
  }
})

test('cached paths still reject queries and stale If-Range restarts uncached full streaming', async () => {
  const f = chunkFixture()
  let calls = 0
  const download = createInstallerDownload({
    manifest,
    cache: f.cache,
    fetcher: async (_, init) => {
      calls++
      return init.headers.range ? partial() : upstream()
    },
  })
  await (await download(chunkRequest(), f.ctx)).arrayBuffer()
  await f.flush()
  assert.equal((await download(request({}, '?source=https://foreign.invalid'), f.ctx)).status, 400)
  const restarted = await download(chunkRequest(undefined, { 'if-range': '"older"' }), f.ctx)
  assert.equal(restarted.status, 200)
  await restarted.arrayBuffer()
  assert.equal(calls, 2)
  assert.equal(f.writes.length, 1)
})

test('aborting a pending cacheable chunk cancels upstream, stores nothing and releases concurrency', async () => {
  const f = chunkFixture(),
    abort = new AbortController()
  let started,
    cancelled = 0
  const ready = new Promise((resolve) => {
    started = resolve
  })
  const download = createInstallerDownload({
    manifest,
    concurrency: 1,
    cache: f.cache,
    fetcher: async () =>
      partial(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(0, 2))
            started()
          },
          cancel() {
            cancelled++
          },
        }),
      ),
  })
  const pending = download(
    new Request(`https://sodaterminal.com${installerPath}`, {
      headers: { range: 'bytes=0-7' },
      signal: abort.signal,
    }),
    f.ctx,
  )
  await ready
  assert.equal((await download(chunkRequest(), f.ctx)).status, 429)
  const response = await pending
  abort.abort()
  await response.body.cancel()
  await f.flush()
  assert.equal(cancelled, 1)
  assert.equal(f.writes.length, 0)
  assert.equal((await download(request({ method: 'POST' }), f.ctx)).status, 405)
})

test('a slow cache miss returns headers and first bytes before its fixed chunk completes', async () => {
  const f = chunkFixture()
  let source
  const download = createInstallerDownload({
    manifest,
    cache: f.cache,
    fetcher: async () =>
      partial(
        new ReadableStream({
          start(controller) {
            source = controller
            controller.enqueue(bytes.subarray(0, 2))
          },
        }),
      ),
  })
  const response = await download(chunkRequest(), f.ctx)
  assert.equal(response.status, 206)
  const reader = response.body.getReader()
  assert.deepEqual((await reader.read()).value, bytes.subarray(0, 2))
  assert.equal(f.writes.length, 0)
  source.enqueue(bytes.subarray(2))
  source.close()
  assert.deepEqual((await reader.read()).value, bytes.subarray(2))
  assert.equal((await reader.read()).done, true)
  await f.flush()
  assert.equal(f.writes.length, 1)
})

test('four cache buffers are shared across handler instances; fifth streams uncached and cancellation restores capacity', async () => {
  const f = chunkFixture()
  const make = () =>
    createInstallerDownload({
      manifest,
      cache: f.cache,
      fetcher: async () =>
        partial(
          new ReadableStream({
            start(controller) {
              controller.enqueue(bytes.subarray(0, 2))
            },
          }),
        ),
    })
  const one = make(),
    two = make(),
    responses = []
  for (let n = 0; n < 5; n++) responses.push(await (n % 2 ? one : two)(chunkRequest(), f.ctx))
  assert.equal(f.keys.length, 4)
  const fifthReader = responses[4].body.getReader()
  assert.deepEqual((await fifthReader.read()).value, bytes.subarray(0, 2))
  await fifthReader.cancel()
  await responses[0].body.cancel()
  await new Promise((resolve) => setImmediate(resolve))
  responses.push(await two(chunkRequest(), f.ctx))
  assert.equal(f.keys.length, 5)
  await Promise.all(
    responses
      .slice(1, 4)
      .concat(responses.slice(5))
      .map((response) => response.body.cancel()),
  )
  await f.flush()
  assert.equal(f.writes.length, 0)
})

test('nonsettling cache writes expire their buffer leases without blocking client bytes', async () => {
  let matches = 0
  const pending = []
  const cache = {
    async match() {
      matches++
    },
    put() {
      return new Promise(() => {})
    },
  }
  const ctx = {
    waitUntil(p) {
      pending.push(p)
    },
  }
  const download = createInstallerDownload({
    manifest,
    cache,
    cacheWriteTimeoutMs: 10,
    fetcher: async () => partial(),
  })
  for (let n = 0; n < 4; n++) await (await download(chunkRequest(), ctx)).arrayBuffer()
  assert.equal(matches, 4)
  await (await download(chunkRequest(), ctx)).arrayBuffer()
  assert.equal(matches, 4)
  await Promise.all(pending)
  await (await download(chunkRequest(), ctx)).arrayBuffer()
  assert.equal(matches, 5)
  await Promise.all(pending)
})

test('nonsettling cache lookup falls back within its deadline instead of blocking the upstream', async () => {
  let calls = 0
  const pending = []
  const cache = {
    match() {
      return new Promise(() => {})
    },
    async put() {},
  }
  const download = createInstallerDownload({
    manifest,
    cache,
    fetcher: async () => {
      calls++
      return partial()
    },
  })
  const response = await download(chunkRequest(), {
    waitUntil(p) {
      pending.push(p)
    },
  })
  assert.equal(response.status, 206)
  assert.equal(calls, 1)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  await Promise.all(pending)
})

test('invalid cached headers cannot block fallback when cache-body cancellation never settles', async () => {
  let calls = 0,
    cancelled = 0
  const pending = []
  const cache = {
    async match() {
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled++
            return new Promise(() => {})
          },
        }),
        {
          status: 200,
          headers: { 'content-length': '9' },
        },
      )
    },
    async put() {},
  }
  const download = createInstallerDownload({
    manifest,
    cache,
    fetcher: async () => {
      calls++
      return partial()
    },
  })
  const response = await download(chunkRequest(), {
    waitUntil(p) {
      pending.push(p)
    },
  })
  assert.equal(response.status, 206)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
  await Promise.all(pending)
  assert.equal(cancelled, 1)
  assert.equal(calls, 1)
})
