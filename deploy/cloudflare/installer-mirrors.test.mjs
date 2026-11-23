import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createPinnedInstallerDownload } from './scanner-installer.mjs'

const url = 'https://sodaterminal.com/downloads/Soda-Scanner-Setup.exe'
const cnb = 'https://cnb.cool/soda-terminal/tool-downloads/-/releases/download/v1/test.exe'
const cnbStorage = 'https://asset.cnb.cool/release/path/test.exe'
const atomgit = 'https://atomgit.com/soda-terminal/tool-downloads/releases/download/v1/test.exe'
const github =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/v1/test.exe'
const fixture = new Uint8Array([0x4d, 0x5a, 0x00, 0x0a])
const pin = createHash('sha256').update(fixture).digest('hex')
const manifest = {
  version: '1.0.0',
  sha256: pin,
  size: fixture.length,
  assetUrl: github,
}
const mirrorRelease = {
  chunks: [pin],
  sources: [
    { provider: 'cnb', url: cnb },
    { provider: 'atomgit', url: atomgit },
  ],
}
const request = (range = 'bytes=0-3') => new Request(url, { headers: { range } })
const payload = (bytes = fixture) =>
  new Response(bytes, {
    status: 206,
    headers: {
      'content-range': 'bytes 0-3/4',
      'content-length': '4',
      'content-type': 'application/octet-stream',
    },
  })
const worker = (fetcher, options = {}) =>
  createPinnedInstallerDownload({
    fetcher,
    manifest,
    mirrorRelease,
    validateManifest: () => true,
    fileName: 'test.exe',
    ...options,
  })

test('an approved CNB redirect serves the verified chunk before GitHub', async () => {
  const calls = []
  const handler = worker(async (target, init) => {
    calls.push(target)
    assert.equal(init.headers.range, 'bytes=0-3')
    assert.equal(init.redirect, 'manual')
    if (target === cnb) return Response.redirect(cnbStorage)
    assert.equal(target, cnbStorage)
    return payload()
  })
  const response = await handler(request())
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('etag'), `"${pin}"`)
  assert.equal(response.headers.get('x-soda-download-source'), 'cnb')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), fixture)
  assert.deepEqual(calls, [cnb, cnbStorage])
})

test('rejects same-size changed bytes and serves the next verified mirror', async () => {
  const calls = []
  const handler = worker(async (target) => {
    calls.push(target)
    return target === cnb ? payload(new Uint8Array([0x4d, 0x5a, 0, 0])) : payload()
  })
  const response = await handler(request())
  assert.equal(response.headers.get('x-soda-download-source'), 'atomgit')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), fixture)
  assert.deepEqual(calls, [cnb, atomgit])
})

test('a foreign redirect and a failing mirror preserve GitHub fallback', async () => {
  const calls = []
  const handler = worker(async (target) => {
    calls.push(target)
    if (target === cnb) return Response.redirect('https://foreign.invalid/test.exe')
    if (target === atomgit) return new Response(null, { status: 503 })
    return payload()
  })
  const response = await handler(request())
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('x-soda-download-source'), null)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), fixture)
  assert.deepEqual(calls, [cnb, atomgit, github])
})

test('validates cached chunks and preserves independent cache namespace', async () => {
  const cache = new Map()
  const keys = []
  const pending = []
  const ctx = { waitUntil: (task) => pending.push(task) }
  const handler = worker(async () => payload(), {
    cache: {
      match(key) {
        keys.push(key.url)
        return cache.get(key.url)?.clone()
      },
      put(key, response) {
        cache.set(key.url, response.clone())
        return response.arrayBuffer()
      },
    },
  })
  await (await handler(request(), ctx)).arrayBuffer()
  await Promise.all(pending)
  assert.equal(
    (await handler(request(), ctx)).headers.get('x-soda-download-source'),
    'verified-cache',
  )
  assert(keys.every((key) => key.includes('/__soda-installer-chunks/v2/')))
})

test('non-aligned legacy range keeps the original response contract', async () => {
  const calls = []
  const handler = worker(async (target) => {
    calls.push(target)
    return new Response(fixture.slice(0, 2), {
      status: 206,
      headers: {
        'content-range': 'bytes 0-1/4',
        'content-length': '2',
        'content-type': 'application/octet-stream',
      },
    })
  })
  const response = await handler(request('bytes=0-1'))
  assert.equal(response.status, 206)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), fixture.slice(0, 2))
  assert.deepEqual(calls, [github])
})
