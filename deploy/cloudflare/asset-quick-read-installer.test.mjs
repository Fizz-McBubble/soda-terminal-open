import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAssetQuickReadInstallerDownload,
  assetQuickReadInstallerPath,
} from './asset-quick-read-installer.mjs'
import {
  assetQuickReadInstallerRelease as release,
  assetQuickReadInstallerUrl,
} from './asset-quick-read-release.mjs'
import { createEdge } from './edge.mjs'

const bytes = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const request = (init = {}, query = '') =>
  new Request(`https://sodaterminal.com${assetQuickReadInstallerPath}${query}`, init)
function upstream(body, { status = 200, partial = false, ...headers } = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/octet-stream',
      'content-length': String(partial ? bytes.length : release.size),
      ...(partial ? { 'content-range': `bytes 0-7/${release.size}` } : {}),
      ...headers,
    },
  })
}

test('GET streams a pinned large package without buffering and cancellation releases its slot', async () => {
  let cancelled = 0
  const download = createAssetQuickReadInstallerDownload({
    concurrency: 1,
    fetcher: async () =>
      upstream(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes)
          },
          cancel() {
            cancelled++
          },
        }),
      ),
  })
  const response = await download(request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-length'), String(release.size))
  assert.equal(response.headers.get('etag'), `"${release.sha256}"`)
  assert.equal(
    response.headers.get('content-disposition'),
    `attachment; filename="${release.fileName}"; filename*=UTF-8''${encodeURIComponent(`Soda-资产快读-${release.version}.exe`)}`,
  )
  assert.equal((await download(request())).status, 429)
  const reader = response.body.getReader()
  assert.deepEqual((await reader.read()).value, bytes)
  await reader.cancel()
  assert.equal(cancelled, 1)
  const retry = await download(request())
  assert.equal(retry.status, 200)
  await retry.body.cancel()
})

test('HEAD and a small range retain exact release size, digest and range metadata', async () => {
  const calls = []
  const download = createAssetQuickReadInstallerDownload({
    fetcher: async (url, init) => {
      calls.push([url, init])
      return upstream(
        init.method === 'HEAD' ? null : bytes,
        init.headers.range ? { status: 206, partial: true } : {},
      )
    },
  })
  const head = await download(request({ method: 'HEAD' }))
  assert.equal(await head.text(), '')
  assert.equal(head.headers.get('content-length'), String(release.size))
  assert.equal(calls[0][0], assetQuickReadInstallerUrl)
  const range = await download(
    request({ headers: { range: 'bytes=0-7', 'if-range': `"${release.sha256}"` } }),
  )
  assert.equal(range.status, 206)
  assert.deepEqual(new Uint8Array(await range.arrayBuffer()), bytes)
  assert.equal(range.headers.get('content-range'), `bytes 0-7/${release.size}`)
  assert.equal(calls[1][1].headers.range, 'bytes=0-7')
  for (const range of ['bytes=117896485-', 'bytes=1-0', 'bytes=-0', 'bytes=0-1,3-4'])
    assert.equal((await download(request({ headers: { range } }))).status, 416)
})

test('wrong version, repo, asset, release size or checksum fails before fetching', async () => {
  for (const patch of [
    { available: false },
    { version: '1.0.1' },
    { repo: 'foreign/repo' },
    { releaseTag: 'latest' },
    { fileName: 'other.exe' },
    { downloadUrl: '/other.exe' },
    { size: 8 },
    { sha256: 'a'.repeat(64) },
  ]) {
    let fetched = false
    const download = createAssetQuickReadInstallerDownload({
      manifest: { ...release, ...patch },
      fetcher: () => {
        fetched = true
        throw new Error('unexpected')
      },
    })
    assert.equal((await download(request())).status, 503)
    assert.equal(fetched, false)
  }
})

test('only the pinned GitHub asset and permitted release-assets redirect host are requested', async () => {
  const calls = []
  const download = createAssetQuickReadInstallerDownload({
    fetcher: async (url, init) => {
      calls.push([url, init])
      return calls.length === 1
        ? new Response(null, {
            status: 302,
            headers: {
              location:
                'https://release-assets.githubusercontent.com/synthetic/asset?signature=synthetic',
            },
          })
        : upstream(null)
    },
  })
  assert.equal((await download(request({ method: 'HEAD' }))).status, 200)
  assert.equal(calls[0][0], assetQuickReadInstallerUrl)
  assert.equal(calls[1][1].method, 'HEAD')
  assert.equal(calls[1][1].redirect, 'manual')
  for (const location of [
    'https://foreign.invalid/file',
    'http://release-assets.githubusercontent.com/file',
    'https://user:pass@release-assets.githubusercontent.com/file',
    'https://release-assets.githubusercontent.com:444/file',
  ]) {
    let calls = 0
    const rejected = createAssetQuickReadInstallerDownload({
      fetcher: async () => {
        calls++
        return new Response(null, { status: 302, headers: { location } })
      },
    })
    assert.equal((await rejected(request())).status, 503)
    assert.equal(calls, 1)
  }
})

test('upstream errors, HTML, wrong length/range and redirects fail safely and remain retryable', async () => {
  for (const options of [
    { status: 404 },
    { 'content-type': 'text/html' },
    { 'content-length': '9' },
    { 'content-range': `bytes 1-8/${release.size}` },
  ]) {
    const download = createAssetQuickReadInstallerDownload({
      fetcher: async () => upstream(bytes, { status: 206, partial: true, ...options }),
    })
    assert.equal((await download(request({ headers: { range: 'bytes=0-7' } }))).status, 503)
  }
  let calls = 0
  const download = createAssetQuickReadInstallerDownload({
    concurrency: 1,
    fetcher: async () => {
      if (++calls === 1) throw new Error('synthetic offline')
      return upstream(null)
    },
  })
  assert.equal((await download(request({ method: 'HEAD' }))).status, 503)
  assert.equal((await download(request({ method: 'HEAD' }))).status, 200)
})

test('a truncated range fails its stream rather than presenting a complete executable', async () => {
  const download = createAssetQuickReadInstallerDownload({
    fetcher: async () => upstream(bytes.subarray(0, 4), { status: 206, partial: true }),
  })
  const response = await download(request({ headers: { range: 'bytes=0-7' } }))
  assert.equal(response.status, 206)
  await assert.rejects(response.arrayBuffer(), /installer_stream_failed/)
})

test('request cancellation aborts the upstream and releases capacity without fetching a capture endpoint', async () => {
  const abort = new AbortController()
  let started
  const ready = new Promise((resolve) => {
    started = resolve
  })
  let signal
  const download = createAssetQuickReadInstallerDownload({
    concurrency: 1,
    fetcher: (_, init) => {
      signal = init.signal
      started()
      return new Promise((_, reject) =>
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }),
      )
    },
  })
  const pending = download(request({ signal: abort.signal }))
  await ready
  abort.abort()
  assert.equal((await pending).status, 503)
  assert.equal(signal.aborted, true)
})

test('edge dispatches the exact quick-read endpoint before static assets and preserves OCR routing', async () => {
  const calls = []
  const edge = createEdge({
    fetcher: async (url) => {
      calls.push(url)
      return upstream(null)
    },
  })
  const env = {
    ASSETS: {
      fetch: () => {
        throw new Error('must not fall back to SPA')
      },
    },
  }
  const response = await edge.fetch(request({ method: 'HEAD' }), env)
  assert.equal(response.status, 200)
  assert.deepEqual(calls, [assetQuickReadInstallerUrl])
  assert.equal((await edge.fetch(request({}, '?version=other'), env)).status, 400)
  assert.equal((await edge.fetch(request({ method: 'POST' }), env)).status, 405)
})
