import assert from 'node:assert/strict'
import test from 'node:test'
import { createInstallerDownload, installerPath } from './scanner-installer.mjs'

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
