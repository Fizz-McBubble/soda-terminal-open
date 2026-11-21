import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assetQuickReadInstallerReleasePath,
  createAssetQuickReadInstallerReleaseDownload,
  createAssetQuickReadInstallerDownload,
  assetQuickReadInstallerPath,
} from './asset-quick-read-installer.mjs'
import {
  assetQuickReadInstallerRelease as release,
  assetQuickReadInstallerUrl,
  validAssetQuickReadRelease,
} from './asset-quick-read-release.mjs'
import { createEdge } from './edge.mjs'

const pinned120 = {
  available: true,
  version: '1.2.0',
  bridgeVersion: '1.1.0',
  releaseTag: 'v1.2.0',
  repo: 'Fizz-McBubble/soda-terminal-asset-quick-read',
  fileName: 'SodaTerminal-AssetReader-Setup-1.2.0.exe',
  downloadUrl: '/downloads/Soda-Asset-Quick-Read-Setup.exe',
  size: 100172302,
  sha256: '7ac9c27ba9ad47c72fba214ec8f4209d9803a13d5b8372b579c4bad96c55f435',
}
const pinned121 = {
  ...pinned120,
  version: '1.2.1',
  bridgeVersion: '1.1.1',
  releaseTag: 'v1.2.1',
  fileName: 'SodaTerminal-AssetReader-Setup-1.2.1.exe',
  size: 100259344,
  sha256: '9e4c878f5edb1b96b14e05eb9b1f3a1429718bb3babbf8a7ab83533e4e4e12fd',
}

const bytes = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
const request = (init = {}, query = '') =>
  new Request(`https://sodaterminal.com${assetQuickReadInstallerPath}${query}`, init)
const releaseRequest = (init = {}, query = '') =>
  new Request(`https://sodaterminal.com${assetQuickReadInstallerReleasePath}${query}`, init)
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

test('serves the current deployment manifest without browser caching', async () => {
  const download = createAssetQuickReadInstallerReleaseDownload()
  const response = await download(releaseRequest())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('etag'), `"${release.sha256}"`)
  assert.deepEqual(await response.json(), release)
  const head = await download(releaseRequest({ method: 'HEAD' }))
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.equal((await download(releaseRequest({}, '?version=latest'))).status, 400)
  assert.equal((await download(releaseRequest({ method: 'POST' }))).status, 405)
})

test('invalid quick-read release identity never serves a usable manifest', async () => {
  const download = createAssetQuickReadInstallerReleaseDownload({
    manifest: { ...release, sha256: 'a'.repeat(64) },
  })
  assert.equal((await download(releaseRequest())).status, 503)
})

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
    `attachment; filename="${release.fileName}"`,
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
  for (const range of [`bytes=${release.size}-`, 'bytes=1-0', 'bytes=-0', 'bytes=0-1,3-4'])
    assert.equal((await download(request({ headers: { range } }))).status, 416)
})

test('1.2.1 HEAD and range requests use its exact candidate URL and identity', async () => {
  const calls = []
  const candidateUrl =
    'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.2.1/SodaTerminal-AssetReader-Setup-1.2.1.exe'
  const download = createAssetQuickReadInstallerDownload({
    manifest: pinned121,
    fetcher: async (url, init) => {
      calls.push([url, init])
      const partial = Boolean(init.headers.range)
      return upstream(init.method === 'HEAD' ? null : bytes, {
        status: partial ? 206 : 200,
        'content-length': String(partial ? bytes.length : pinned121.size),
        ...(partial ? { 'content-range': `bytes 0-7/${pinned121.size}` } : {}),
      })
    },
  })
  const head = await download(request({ method: 'HEAD' }))
  assert.deepEqual(
    { status: head.status, requestedUrl: calls[0]?.[0] ?? null },
    { status: 200, requestedUrl: candidateUrl },
  )
  assert.equal(head.headers.get('content-length'), String(pinned121.size))
  assert.equal(head.headers.get('etag'), `"${pinned121.sha256}"`)
  assert.equal(
    head.headers.get('content-disposition'),
    `attachment; filename="${pinned121.fileName}"`,
  )
  assert.equal(await head.text(), '')
  const range = await download(
    request({ headers: { range: 'bytes=0-7', 'if-range': `"${pinned121.sha256}"` } }),
  )
  assert.equal(range.status, 206)
  assert.equal(calls[1][0], candidateUrl)
  assert.equal(calls[1][1].method, 'GET')
  assert.equal(calls[1][1].headers.range, 'bytes=0-7')
  assert.equal(calls[1][1].redirect, 'manual')
  assert.equal(range.headers.get('etag'), `"${pinned121.sha256}"`)
  assert.equal(range.headers.get('content-range'), `bytes 0-7/${pinned121.size}`)
  assert.equal(
    range.headers.get('content-disposition'),
    `attachment; filename="${pinned121.fileName}"`,
  )
  assert.deepEqual(new Uint8Array(await range.arrayBuffer()), bytes)
})

test('only complete pinned 1.2.0 and 1.2.1 identities serve release metadata', async () => {
  for (const manifest of [pinned120, pinned121]) {
    assert.equal(validAssetQuickReadRelease(manifest), true)
    const download = createAssetQuickReadInstallerReleaseDownload({ manifest })
    const response = await download(releaseRequest())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('etag'), `"${manifest.sha256}"`)
    assert.deepEqual(await response.json(), manifest)
    const head = await download(releaseRequest({ method: 'HEAD' }))
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
  }
})

test('mixed pins, unknown releases and forged sources fail before any request', async () => {
  for (const [manifest, other] of [
    [pinned120, pinned121],
    [pinned121, pinned120],
  ]) {
    const mixed = ['version', 'bridgeVersion', 'releaseTag', 'fileName', 'size', 'sha256'].map(
      (key) => ({ ...manifest, [key]: other[key] }),
    )
    const invalid = [
      ...mixed,
      { ...manifest, available: false },
      {
        ...manifest,
        version: '1.2.2',
        releaseTag: 'v1.2.2',
        fileName: 'SodaTerminal-AssetReader-Setup-1.2.2.exe',
      },
      { ...manifest, bridgeVersion: '1.1.2' },
      { ...manifest, repo: 'foreign/repo' },
      { ...manifest, repo: 'Fizz-McBubble/soda-terminal-asset-quick-read/../foreign' },
      { ...manifest, downloadUrl: 'https://foreign.invalid/installer.exe' },
      { ...manifest, downloadUrl: '/downloads/other.exe' },
      { ...manifest, releaseTag: 'latest' },
      { ...manifest, fileName: '../installer.exe' },
      { ...manifest, size: manifest.size + 1 },
      { ...manifest, sha256: 'a'.repeat(64) },
    ]
    for (const candidate of invalid) {
      assert.equal(validAssetQuickReadRelease(candidate), false, JSON.stringify(candidate))
      const metadata = createAssetQuickReadInstallerReleaseDownload({ manifest: candidate })
      assert.equal((await metadata(releaseRequest())).status, 503)
      let fetched = false
      const download = createAssetQuickReadInstallerDownload({
        manifest: candidate,
        fetcher: () => {
          fetched = true
          throw new Error('unexpected_fetch')
        },
      })
      assert.equal((await download(request())).status, 503)
      assert.equal(fetched, false)
    }
  }
})

test('wrong version, repo, asset, release size or checksum fails before fetching', async () => {
  for (const patch of [
    { available: false },
    { version: '999.0.0' },
    { bridgeVersion: '999.0.0' },
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

test('edge serves current quick-read identity before static SPA fallback', async () => {
  const edge = createEdge({
    fetcher: () => {
      throw new Error('manifest must not use upstream package access')
    },
  })
  const env = {
    ASSETS: {
      fetch: () => {
        throw new Error('must not fall back to SPA')
      },
    },
  }
  const response = await edge.fetch(releaseRequest(), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), release)
})
