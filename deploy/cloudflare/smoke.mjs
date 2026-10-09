/** Standalone deployment-tool smoke checks; never counted as the full product release suite. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, mkdir, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createEdge, allowedImage } from './edge.mjs'
import { inspectDist, prepare } from './prepare.mjs'
import reviewed32MediaUrls from '../../src/assets/reviewed32-media-urls.json' with { type: 'json' }
import visualManifest from '../../src/assets/visual-assets-display.v1.json' with { type: 'json' }

const checks = []
const check = (name, run) => checks.push({ name, run })
const imageUrl = 'https://act-upload.mihoyo.com/nap-obc-indep/example.png'
const req = (path, init) => new Request(`https://unit.invalid${path}`, init)
const assetReq = () => req(`/official-catalog-cache?source=${encodeURIComponent(imageUrl)}`)
const env = {
  SODA_RELEASE_ID: 'synthetic-local-1',
  ASSETS: { fetch: async () => new Response('ASSET') },
}
const temp = await mkdtemp(join(tmpdir(), 'soda-cf-preflight-'))
const scannerTemplate = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/downloads')
const scannerOrigin = 'https://sodaterminal.com'
let seq = 0
async function fixture() {
  const root = join(temp, `dist-${seq++}`)
  await mkdir(join(root, 'assets'), { recursive: true })
  await writeFile(
    join(root, 'index.html'),
    '<html><head><meta name="soda-bundle-entry" content="browser-compute"><meta name="soda-compute-mode" content="browser"></head><script src="/assets/app.js"></script></html>',
  )
  await writeFile(join(root, 'assets', 'app.js'), 'new Worker("/assets/query-worker.js")')
  await writeFile(join(root, 'assets', 'query-worker.js'), 'self.onmessage = () => {}')
  const criticalAssets = ['/index.html', '/assets/app.js', '/assets/query-worker.js']
  const criticalAssetSha256 = Object.fromEntries(
    await Promise.all(
      criticalAssets.map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(join(root, path.slice(1))))
          .digest('hex'),
      ]),
    ),
  )
  await writeFile(
    join(root, 'offline-shell-manifest.json'),
    JSON.stringify({
      releaseId: 'synthetic-local-1',
      browserCompute: true,
      computeWorker: '/assets/query-worker.js',
      assets: ['/index.html', '/assets/app.js', '/assets/query-worker.js'],
      criticalAssets,
      criticalAssetSha256,
    }),
  )
  await writeFile(join(root, 'service-worker.js'), '// synthetic SW, not product evidence')
  return root
}
const fakeImage = (bytes = Uint8Array.from([1, 2, 3])) =>
  new Response(bytes, {
    headers: { 'content-type': 'image/png', 'set-cookie': 'must-not-forward=yes' },
  })
check('static requests delegated; no network', async () => {
  const edge = createEdge({
    fetcher: () => {
      throw new Error('unexpected network')
    },
  })
  assert.equal(await (await edge.fetch(req('/assets/code.js'), env)).text(), 'ASSET')
})
check('all legacy calculation methods rejected without network/body consumption', async () => {
  let calls = 0
  const edge = createEdge({
    fetcher: () => {
      calls += 1
    },
  })
  for (const method of ['GET', 'POST', 'DELETE'])
    assert.equal((await edge.fetch(req('/api/calculation/tasks', { method }), env)).status, 410)
  assert.equal(calls, 0)
})
check('health is edge-only, not a product acceptance assertion', async () => {
  const response = await createEdge().fetch(req('/_soda/health'), env)
  const health = await response.json()
  assert.equal(health.runtime, 'cloudflare-static/v1')
  assert.equal(health.releaseId, 'synthetic-local-1')
  assert.deepEqual(health.checks, ['edge_router_only'])
})
check('reserved/private paths are not SPA successes', async () => {
  for (const path of [
    '/.env',
    '/.git/config',
    '/private/start.mjs',
    '/src/main.tsx',
    '/_soda/runtime-config',
    '/assets/app.js.map',
  ])
    assert.equal((await createEdge().fetch(req(path), env)).status, 404)
})
check('non-image POST is refused', async () => {
  assert.equal(
    (await createEdge().fetch(req('/loadouts/team', { method: 'POST' }), env)).status,
    405,
  )
})
check('allowed source requires exact host/path, HTTPS and no credentials', () => {
  assert.equal(allowedImage(new URL(imageUrl)), true)
  for (const value of [
    'http://act-upload.mihoyo.com/nap-obc-indep/a.png',
    'https://evil.invalid/a.png',
    'https://act-upload.mihoyo.com.evil.invalid/nap-obc-indep/a.png',
    'https://act-upload.mihoyo.com/other/a.png',
    'https://user:pass@act-upload.mihoyo.com/nap-obc-indep/a.png',
    'https://127.0.0.1/a.png',
  ])
    assert.equal(allowedImage(new URL(value)), false)
})
check('missing/duplicate source rejected', async () => {
  for (const path of ['/official-catalog-cache', '/official-catalog-cache?source=a&source=b'])
    assert.equal((await createEdge().fetch(req(path), env)).status, 400)
})
check('every downloadable catalog source is accepted by the production edge', async () => {
  const requested = []
  const edge = createEdge({
    fetcher: async (url) => {
      requested.push(url)
      return fakeImage()
    },
  })
  const urls = visualManifest.assets
    .filter(
      (asset) =>
        asset.status === 'verified' &&
        asset.cachePolicy === 'explicit-personal-cache' &&
        asset.remoteUrl,
    )
    .map((asset) => asset.remoteUrl)
  for (const url of urls) {
    const response = await edge.fetch(
      req(`/official-catalog-cache?source=${encodeURIComponent(url)}`),
      env,
    )
    assert.equal(response.status, 200, url)
    assert.equal(response.headers.get('x-soda-asset-error'), null, url)
  }
  assert.deepEqual(requested, urls)
  for (const url of Object.values(reviewed32MediaUrls)) assert(urls.includes(url), url)
})
check(
  'reviewed image pins reject alternate paths, queries, credentials and redirects',
  async () => {
    const source = reviewed32MediaUrls['wengine-14161']
    let requests = 0
    const edge = createEdge({
      fetcher: async () => {
        requests += 1
        return new Response(null, { status: 302, headers: { location: imageUrl } })
      },
    })
    for (const invalid of [
      source + '?raw=1',
      source + '#x',
      source.replace('3456cd0f6f5bea10e168074502460dac2fcd6df4', 'main'),
      source.replace('CrimsonThirst/icon.png', 'CrimsonThirst/../CrimsonThirst/icon.png'),
      source.replace('CrimsonThirst/icon.png', 'CrimsonThirst/%2e%2e/CrimsonThirst/icon.png'),
      source.replace('https://', 'https://user@'),
      source.replace('CrimsonThirst', 'Anything'),
    ])
      assert.equal(
        (
          await edge.fetch(
            req(`/official-catalog-cache?source=${encodeURIComponent(invalid)}`),
            env,
          )
        ).status,
        403,
      )
    assert.equal(requests, 0)
    const response = await edge.fetch(
      req(`/official-catalog-cache?source=${encodeURIComponent(source)}`),
      env,
    )
    assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
    assert.equal(requests, 1, 'A reviewed immutable source must not follow a redirect')
  },
)
check('image bytes preserved; upstream cookies not forwarded', async () => {
  const response = await createEdge({ fetcher: async () => fakeImage() }).fetch(assetReq(), env)
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3])
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('content-security-policy'), 'sandbox')
})
check('redirect outside allowed boundary is never fetched', async () => {
  const calls = []
  const response = await createEdge({
    fetcher: async (url) => {
      calls.push(url)
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } })
    },
  }).fetch(assetReq(), env)
  assert.equal(calls.length, 1)
  assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
})
check('allowed redirect is followed and stays manual', async () => {
  let calls = 0
  const response = await createEdge({
    fetcher: async (_url, options) => {
      assert.equal(options.redirect, 'manual')
      return ++calls === 1
        ? new Response(null, { status: 302, headers: { location: '/nap-obc-indep/b.png' } })
        : fakeImage()
    },
  }).fetch(assetReq(), env)
  assert.equal(calls, 2)
  assert.equal(response.headers.get('content-type'), 'image/png')
})
check('redirect loop is bounded', async () => {
  let calls = 0
  await createEdge({
    fetcher: async () => {
      calls += 1
      return new Response(null, { status: 302, headers: { location: imageUrl } })
    },
  }).fetch(assetReq(), env)
  assert.equal(calls, 4)
})
check('non-image upstream response rejected', async () => {
  const response = await createEdge({
    fetcher: async () =>
      new Response('<html>bad</html>', {
        headers: { 'content-type': 'text/html' },
      }),
  }).fetch(assetReq(), env)
  assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
})
check('empty image response is not treated as a loaded image', async () => {
  const response = await createEdge({ fetcher: async () => fakeImage(new Uint8Array()) }).fetch(
    assetReq(),
    env,
  )
  assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
})
check('stream bytes are bounded even without content-length', async () => {
  const response = await createEdge({ fetcher: async () => fakeImage(), byteLimit: 2 }).fetch(
    assetReq(),
    env,
  )
  assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
})
check('announced excessive bytes rejected', async () => {
  const response = await createEdge({
    fetcher: async () =>
      new Response(null, {
        headers: { 'content-type': 'image/png', 'content-length': '999' },
      }),
    byteLimit: 2,
  }).fetch(assetReq(), env)
  assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
})
check('concurrency limit enforced and released', async () => {
  let resume
  const edge = createEdge({
    concurrency: 1,
    fetcher: async () =>
      new Promise((r) => {
        resume = r
      }),
  })
  const first = edge.fetch(assetReq(), env)
  assert.equal((await edge.fetch(assetReq(), env)).status, 429)
  resume(fakeImage())
  await first
  const third = edge.fetch(assetReq(), env)
  resume(fakeImage())
  assert.equal((await third).status, 200)
})
check('fetch failure uses existing retry envelope', async () => {
  const response = await createEdge({
    fetcher: async () => {
      throw new Error('network')
    },
  }).fetch(assetReq(), env)
  assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
})
check('HEAD image response has no body', async () => {
  const response = await createEdge({ fetcher: async () => fakeImage() }).fetch(
    new Request(assetReq(), { method: 'HEAD' }),
    env,
  )
  assert.equal(await response.text(), '')
})
check('HEAD image failure has no body', async () => {
  const response = await createEdge({
    fetcher: async () => {
      throw new Error('network')
    },
  }).fetch(new Request(assetReq(), { method: 'HEAD' }), env)
  assert.equal(await response.text(), '')
  assert.equal(response.headers.get('x-soda-asset-error'), 'upstream-unavailable')
})
check('structural browser candidate accepted', async () => {
  const report = await inspectDist(await fixture())
  assert.equal(report.fileCount, 5)
  assert.equal(
    report.scope,
    'browser_bundle_file_closure_and_reference_audit_not_runtime_acceptance',
  )
})
check('old R17/public marker alone cannot pass', async () => {
  const root = await fixture()
  await writeFile(join(root, 'index.html'), '<meta name="soda-bundle-entry" content="public">')
  await assert.rejects(inspectDist(root), /browser_compute_marker_required/)
})
check('browser marker without compute Worker proof cannot pass', async () => {
  const root = await fixture()
  const path = join(root, 'offline-shell-manifest.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  delete manifest.browserCompute
  await writeFile(path, JSON.stringify(manifest))
  await assert.rejects(inspectDist(root), /browser_compute_manifest_required/)
})
check('missing or unlisted Worker resources cannot pass', async () => {
  const root = await fixture()
  const path = join(root, 'offline-shell-manifest.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  manifest.assets.pop()
  await writeFile(path, JSON.stringify(manifest))
  await assert.rejects(inspectDist(root), /offline_asset_manifest_invalid/)
  manifest.assets.push('/assets/query-worker.js')
  await writeFile(path, JSON.stringify(manifest))
  await writeFile(join(root, 'assets', 'extra.js'), 'export {}')
  await assert.rejects(inspectDist(root), /offline_asset_unlisted/)
})
check('declared Worker must be referenced by application script', async () => {
  const root = await fixture()
  await writeFile(join(root, 'assets', 'app.js'), 'const local = true')
  await assert.rejects(inspectDist(root), /compute_worker_not_referenced/)
})
check('critical asset digests reject incomplete or mixed releases before packaging', async () => {
  const missing = await fixture()
  const path = join(missing, 'offline-shell-manifest.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  delete manifest.criticalAssetSha256
  await writeFile(path, JSON.stringify(manifest))
  await assert.rejects(inspectDist(missing), /critical_asset_digest_missing/)
  for (const file of ['index.html', 'assets/query-worker.js']) {
    const root = await fixture()
    await writeFile(
      join(root, file),
      `${await readFile(join(root, file), 'utf8')} /* changed release */`,
    )
    await assert.rejects(inspectDist(root), /critical_asset_digest_mismatch/)
  }
})
check('release identity required', async () => {
  const root = await fixture()
  await writeFile(join(root, 'offline-shell-manifest.json'), '{}')
  await assert.rejects(inspectDist(root), /release_id_missing/)
})
check('private artifacts and real-backup names rejected', async () => {
  for (const file of [
    '.env',
    '_redirects',
    'private/start.mjs',
    'app.js.map',
    'isolated-account-backup.json',
    'package.json',
    'private-dump.sqlite',
  ]) {
    const root = await fixture()
    if (file.startsWith('private/')) await mkdir(join(root, 'private'))
    await writeFile(join(root, file), 'synthetic')
    await assert.rejects(inspectDist(root), /non_distribution_file/)
  }
})
check('ordinary backup feature chunk is not incorrectly banned', async () => {
  const root = await fixture()
  await writeFile(join(root, 'assets', 'backup-Abc123.js'), '// product backup feature')
  const path = join(root, 'offline-shell-manifest.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  manifest.assets.push('/assets/backup-Abc123.js')
  await writeFile(path, JSON.stringify(manifest))
  assert.equal((await inspectDist(root)).fileCount, 6)
})
check('symlinks rejected', async () => {
  const root = await fixture()
  await symlink(root, join(root, 'link-dir'), 'junction')
  await assert.rejects(inspectDist(root), /asset_not_regular/)
})
check('25MiB individual limit enforced', async () => {
  const root = await fixture(),
    path = join(root, 'oversize.wasm')
  await writeFile(path, '')
  await truncate(path, 25 * 1024 * 1024 + 1)
  await assert.rejects(inspectDist(root), /asset_over_25MiB/)
})
check('old Origin reference is rejected from new browser artifact', async () => {
  const root = await fixture()
  await writeFile(
    join(root, 'assets', 'app.js'),
    'new Worker("/assets/query-worker.js"); const old="https://soda-terminal-production.up.' +
      'railway.app"',
  )
  await assert.rejects(inspectDist(root), /private_or_remote_reference/)
})
check('local maintainer path and old calculation API strings are rejected', async () => {
  for (const text of [
    'C:' + '/Us' + 'ers/example/research/locator.json',
    'E:' + '/Codex/research/file.json',
    '/api/calculation/tasks',
  ]) {
    const root = await fixture()
    await writeFile(
      join(root, 'assets', 'app.js'),
      `new Worker("/assets/query-worker.js"); const leak=${JSON.stringify(text)}`,
    )
    await assert.rejects(inspectDist(root), /private_or_remote_reference/)
  }
})
check('output cannot overwrite or overlap input', async () => {
  const root = await fixture()
  await assert.rejects(prepare({ dist: root, out: root }), /output_overlaps/)
  await assert.rejects(prepare({ dist: root, out: join(root, 'out') }), /output_overlaps/)
})
check('prepared config is assets-first and pinned; no automatic deployment', async () => {
  const root = await fixture(),
    out = join(temp, `prepared-${seq++}`)
  const report = await prepare({ dist: root, out, accountId: 'a'.repeat(32) })
  const headers = await readFile(join(out, 'web', '_headers'), 'utf8')
  assert.match(headers, /Content-Security-Policy:/u)
  assert.match(headers, /worker-src 'self'/u)
  assert.match(headers, /connect-src 'self' http:\/\/127\.0\.0\.1:43127/u)
  assert.equal(headers.match(/script-src ([^;]+)/u)?.[1], "'self'")
  assert.equal(headers.match(/connect-src ([^;]+)/u)?.[1], "'self' http://127.0.0.1:43127")
  assert.match(headers, /img-src 'self' blob: data: http:\/\/127\.0\.0\.1:43127/u)
  assert.match(headers, /font-src 'self'/u)
  assert.doesNotMatch(headers, /(?:https?:\/\/\*|\*\.\w|connect-src[^;]*\*)/u)
  assert.match(headers, /X-Content-Type-Options: nosniff/u)
  assert.equal(report.fileCount, 6)
  assert.equal(report.sourceInventorySha256.length, 64)
  assert.equal(report.staticHeadersSha256.length, 64)
  const config = JSON.parse(await readFile(join(out, 'wrangler.json')))
  assert.equal(config.main, './deploy/cloudflare/edge.mjs')
  assert.deepEqual(config.vars, { SODA_RELEASE_ID: 'synthetic-local-1' })
  assert.equal(config.observability.enabled, false)
  assert.equal(config.observability.logs.enabled, false)
  assert.equal(config.observability.logs.invocation_logs, false)
  assert.equal(config.observability.traces.enabled, false)
  assert.deepEqual(
    JSON.parse(await readFile(join(out, 'src/assets/reviewed32-media-urls.json'))),
    reviewed32MediaUrls,
  )
  const packagedEdge = await import(new URL(config.main, pathToFileURL(join(out, 'wrangler.json'))))
  assert.equal(packagedEdge.allowedImage(new URL(reviewed32MediaUrls['agent-claret'])), true)
  assert.equal(config.assets.directory, './web')
  assert(Array.isArray(config.assets.run_worker_first))
  assert(!config.assets.run_worker_first.includes('/*'))
  assert(config.assets.run_worker_first.includes('/api/*'))
  assert.equal(config.account_id, 'a'.repeat(32))
  const pkg = JSON.parse(await readFile(join(out, 'package.json')))
  assert.equal(pkg.devDependencies.wrangler, '4.141.0')
  assert.equal(Object.hasOwn(pkg.scripts, 'postinstall'), false)
  await assert.rejects(prepare({ dist: root, out }), /EEXIST/)
})
check('Scanner download is materialized and pinned to its HTTPS origin', async () => {
  const root = await fixture(),
    out = join(temp, `scanner-prepared-${seq++}`)
  await cp(scannerTemplate, join(root, 'downloads'), { recursive: true })
  await assert.rejects(inspectDist(root), /scanner_template_unresolved/)
  await assert.rejects(prepare({ dist: root, out }), /scanner_public_origin_required/)
  const report = await prepare({ dist: root, out, origin: scannerOrigin })
  const command = await readFile(join(out, 'web/downloads/Soda-Scanner-Bootstrap.cmd'), 'utf8')
  assert.match(command, /set "ORIGIN=https:\/\/sodaterminal\.com"/u)
  assert.match(command, /if not "%ORIGIN:~0,8%"=="https:\/\/"/u)
  assert.doesNotMatch(command, /__SODA_[A-Z0-9_]+__/u)
  assert.equal(
    report.files.find((item) => item.path === 'downloads/Soda-Scanner-Bootstrap.cmd')?.sha256
      .length,
    64,
  )
  await assert.rejects(
    inspectDist(join(out, 'web'), { origin: 'https://wrong.example' }),
    /scanner_public_origin_mismatch/,
  )
})
check('invalid account/name refused before output', async () => {
  const root = await fixture()
  await assert.rejects(
    prepare({ dist: root, out: join(temp, 'bad'), accountId: 'token' }),
    /account_id_invalid/,
  )
  await assert.rejects(
    prepare({ dist: root, out: join(temp, 'bad'), name: 'Name / invalid' }),
    /worker_name_invalid/,
  )
})
let passed = 0
try {
  for (const { name, run } of checks) {
    await run()
    passed += 1
    console.log(`PASS ${name}`)
  }
  console.log(
    JSON.stringify({
      passed,
      failed: 0,
      scope: 'node-contract-smoke-only',
      cloudflareRuntimeTested: false,
      fullProductTested: false,
      deployed: false,
    }),
  )
} finally {
  await rm(temp, { recursive: true, force: true })
}
