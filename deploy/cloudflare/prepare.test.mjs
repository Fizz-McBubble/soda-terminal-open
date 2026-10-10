import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { prepare } from './prepare.mjs'

const origin = 'https://sodaterminal.com'

test('quick-read proxy is packaged and routed before assets without a static executable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-quick-read-package-'))
  try {
    const dist = await fixture(root),
      out = join(root, 'candidate')
    const report = await prepare({ dist, out, origin })
    const config = JSON.parse(await readFile(join(out, 'wrangler.json'), 'utf8'))
    assert(config.assets.run_worker_first.includes('/downloads/Soda-Asset-Quick-Read-Setup.exe'))
    assert(config.assets.run_worker_first.includes('/downloads/Soda-Scanner-Setup.exe'))
    assert.equal(report.assetQuickReadInstallerProxy.size, 117896485)
    for (const path of [
      'deploy/cloudflare/asset-quick-read-installer.mjs',
      'deploy/cloudflare/asset-quick-read-release.mjs',
      'src/assetQuickRead/releaseManifest.json',
    ])
      assert((await readFile(join(out, path))).length > 0)
    const { createEdge } = await import(pathToFileURL(join(out, 'deploy/cloudflare/edge.mjs')).href)
    let fetched
    const edge = createEdge({
      fetcher: async (url) => {
        fetched = url
        return new Response(null, {
          headers: { 'content-type': 'application/octet-stream', 'content-length': '117896485' },
        })
      },
    })
    const response = await edge.fetch(
      new Request(`${origin}/downloads/Soda-Asset-Quick-Read-Setup.exe`, { method: 'HEAD' }),
      {
        ASSETS: {
          fetch: () => {
            throw new Error('must not fall back to assets')
          },
        },
      },
    )
    assert.equal(response.status, 200)
    assert.equal(fetched, report.assetQuickReadInstallerProxy.url)
    assert(!report.files.some((file) => file.path.endsWith('.exe')))
    await mkdir(join(dist, 'downloads'))
    const bytes = new Uint8Array([0x4d, 0x5a, 1, 2, 3, 4, 5, 6])
    await writeFile(join(dist, 'downloads/Soda-Asset-Quick-Read-Setup.exe'), bytes)
    await assert.rejects(
      prepare({ dist, out: join(root, 'invalid'), origin }),
      /asset_quick_read_installer_size_mismatch/,
    )
    assert.deepEqual(
      new Uint8Array(await readFile(join(dist, 'downloads/Soda-Asset-Quick-Read-Setup.exe'))),
      bytes,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
async function fixture(root) {
  const dist = join(root, 'dist')
  await mkdir(join(dist, 'assets'), { recursive: true })
  const files = {
    '/index.html':
      '<meta name="soda-bundle-entry" content="browser-compute"><meta name="soda-compute-mode" content="browser">',
    '/assets/app.js': 'new Worker("/assets/query-worker.js")',
    '/assets/query-worker.js': 'self.onmessage = () => {}',
  }
  for (const [path, source] of Object.entries(files))
    await writeFile(join(dist, path.slice(1)), source)
  await writeFile(
    join(dist, 'offline-shell-manifest.json'),
    JSON.stringify({
      releaseId: 'statistics-package-test',
      browserCompute: true,
      computeWorker: '/assets/query-worker.js',
      assets: Object.keys(files),
      criticalAssets: Object.keys(files),
      criticalAssetSha256: Object.fromEntries(
        Object.entries(files).map(([path, source]) => [
          path,
          createHash('sha256').update(source).digest('hex'),
        ]),
      ),
    }),
  )
  return dist
}

test('explicit production switch enables custom logs without invocation logs/traces or CSP expansion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-usage-package-'))
  try {
    const dist = await fixture(root)
    const out = join(root, 'enabled')
    await prepare({ dist, out, origin, usageStatistics: true })
    const config = JSON.parse(await readFile(join(out, 'wrangler.json'), 'utf8'))
    assert.deepEqual(config.vars, {
      SODA_RELEASE_ID: 'statistics-package-test',
      SODA_USAGE_STATISTICS: 'enabled',
      SODA_PUBLIC_ORIGIN: origin,
    })
    assert.deepEqual(config.observability, {
      enabled: true,
      logs: { enabled: true, invocation_logs: false, head_sampling_rate: 1 },
      traces: { enabled: false },
    })
    assert(config.assets.run_worker_first.includes('/_soda/*'))
    const headers = await readFile(join(out, 'web/_headers'), 'utf8')
    assert.equal(headers.match(/script-src ([^;]+)/u)?.[1], "'self'")
    assert.equal(
      headers.match(/connect-src ([^;]+)/u)?.[1],
      "'self' http://127.0.0.1:43127 http://127.0.0.1:50609",
    )
    assert.equal(config.analytics_engine_datasets, undefined)
    assert.equal(config.d1_databases, undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('default and explicit disabled recovery packages cannot inherit collection env', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-usage-recovery-'))
  try {
    const dist = await fixture(root)
    for (const [name, options] of [
      ['default', {}],
      ['recovery', { usageStatistics: false, origin }],
    ]) {
      const out = join(root, name)
      await prepare({ dist, out, ...options })
      const config = JSON.parse(await readFile(join(out, 'wrangler.json'), 'utf8'))
      assert.deepEqual(config.vars, { SODA_RELEASE_ID: 'statistics-package-test' })
      assert.deepEqual(config.observability, {
        enabled: false,
        logs: { enabled: false, invocation_logs: false, head_sampling_rate: 1 },
        traces: { enabled: false },
      })
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the owned domain is the sole public route and workers.dev stays disabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-owned-domain-'))
  try {
    const dist = await fixture(root)
    const out = join(root, 'enabled')
    await prepare({
      dist,
      out,
      origin: 'https://sodaterminal.com',
      usageStatistics: true,
      customDomain: 'sodaterminal.com',
    })
    const config = JSON.parse(await readFile(join(out, 'wrangler.json'), 'utf8'))
    assert.deepEqual(config.routes, [{ pattern: 'sodaterminal.com', custom_domain: true }])
    assert.equal(config.workers_dev, false)
    assert.equal(config.preview_urls, false)
    assert.equal(config.vars.SODA_PUBLIC_ORIGIN, 'https://sodaterminal.com')
    assert.equal(config.vars.SODA_USAGE_STATISTICS, 'enabled')
    for (const [customDomain, entry] of [
      ['preview.invalid', 'https://preview.invalid'],
      ['*.sodaterminal.com', 'https://sodaterminal.com'],
      ['sodaterminal.com', 'https://other.invalid'],
    ]) {
      await assert.rejects(
        prepare({ dist, out: join(root, 'invalid'), customDomain, origin: entry }),
        /custom_domain_requires_approved_origin/u,
      )
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('enabled packaging rejects missing/local/preview origin and nonboolean flags before writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-usage-origin-'))
  try {
    const dist = await fixture(root)
    for (const usageStatistics of [false, true]) {
      await assert.rejects(
        prepare({
          dist,
          out: join(root, 'retired'),
          origin: 'https://app.sodaterminal.workers.dev',
          usageStatistics,
        }),
        /public_origin_retired/u,
      )
    }
    for (const value of [
      undefined,
      'http://127.0.0.1:8787',
      'https://preview.invalid',
      `${origin}/`,
    ]) {
      await assert.rejects(
        prepare({ dist, out: join(root, 'invalid'), origin: value, usageStatistics: true }),
        /usage_statistics_requires_production_origin/u,
      )
    }
    await assert.rejects(
      prepare({ dist, out: join(root, 'invalid'), origin, usageStatistics: 'enabled' }),
      /usage_statistics_flag_invalid/u,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('CLI --usage-statistics switch is explicit and value-free', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-usage-cli-'))
  try {
    const dist = await fixture(root)
    const out = join(root, 'enabled')
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare.mjs', import.meta.url)),
        '--dist',
        dist,
        '--out',
        out,
        '--usage-statistics',
        '--origin',
        origin,
      ],
      { encoding: 'utf8' },
    )
    assert.equal(result.status, 0, result.stderr)
    const config = JSON.parse(await readFile(join(out, 'wrangler.json'), 'utf8'))
    assert.equal(config.vars.SODA_USAGE_STATISTICS, 'enabled')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('scan-feedback packaging configures KV binding and copies handler/contract for the sole origin', async () => {
  const validNamespace = '0123456789abcdef0123456789abcdef'
  for (const allowedOrigin of [origin]) {
    const root = await mkdtemp(join(tmpdir(), 'soda-feedback-package-'))
    try {
      const dist = await fixture(root)
      const out = join(root, 'feedback-candidate')
      await prepare({
        dist,
        out,
        origin: allowedOrigin,
        scanFeedback: true,
        scanFeedbackNamespaceId: validNamespace,
      })
      const config = JSON.parse(await readFile(join(out, 'wrangler.json'), 'utf8'))
      assert.deepEqual(config.vars, {
        SODA_RELEASE_ID: 'statistics-package-test',
        SODA_SCAN_FEEDBACK: 'enabled',
        SODA_PUBLIC_ORIGIN: allowedOrigin,
      })
      assert.deepEqual(config.kv_namespaces, [
        {
          binding: 'SODA_SCAN_FEEDBACK_STORE',
          id: validNamespace,
        },
      ])
      // Observability remains disabled without usage statistics
      assert.deepEqual(config.observability, {
        enabled: false,
        logs: { enabled: false, invocation_logs: false, head_sampling_rate: 1 },
        traces: { enabled: false },
      })
      assert(config.assets.run_worker_first.includes('/_soda/*'))

      // Packaged dependencies must include edge handler, feedback handler and contract
      const edgeContent = await readFile(join(out, 'deploy/cloudflare/edge.mjs'), 'utf8')
      assert(edgeContent.includes('createScanFeedbackReceiver'))
      const feedbackContent = await readFile(
        join(out, 'deploy/cloudflare/scan-feedback.mjs'),
        'utf8',
      )
      assert(feedbackContent.includes('createScanFeedbackReceiver'))
      const contractContent = await readFile(
        join(out, 'src/scanner/scanFeedback.contract.json'),
        'utf8',
      )
      const contractJson = JSON.parse(contractContent)
      assert.equal(contractJson.endpoint, '/_soda/scan-feedback')
      assert.equal(contractJson.storageBinding, 'SODA_SCAN_FEEDBACK_STORE')
      const mediaContent = await readFile(
        join(out, 'src/assets/reviewed32-media-urls.json'),
        'utf8',
      )
      assert(mediaContent.length > 0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
})

test('scan-feedback packaging rejects invalid origins, invalid namespace IDs and incomplete setups without writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-feedback-invalid-'))
  const validNamespace = '0123456789abcdef0123456789abcdef'
  try {
    const dist = await fixture(root)

    // Invalid origins
    for (const badOrigin of [
      undefined,
      'http://127.0.0.1:8787',
      'https://preview.invalid',
      `${origin}/`,
    ]) {
      const out = join(root, 'bad-origin')
      await assert.rejects(
        prepare({
          dist,
          out,
          origin: badOrigin,
          scanFeedback: true,
          scanFeedbackNamespaceId: validNamespace,
        }),
        /scan_feedback_requires_allowed_origin/u,
      )
      await assert.rejects(readFile(join(out, 'wrangler.json')), { code: 'ENOENT' })
    }

    // Invalid namespace IDs
    for (const badId of [
      undefined,
      'short',
      '0123456789abcdef0123456789abcde',
      '0123456789abcdef0123456789abcdef0',
      'NOT-HEX-0123456789abcdef01234567',
    ]) {
      const out = join(root, 'bad-namespace')
      await assert.rejects(
        prepare({ dist, out, origin, scanFeedback: true, scanFeedbackNamespaceId: badId }),
        /scan_feedback_namespace_id_invalid/u,
      )
      await assert.rejects(readFile(join(out, 'wrangler.json')), { code: 'ENOENT' })
    }

    // Non-boolean scanFeedback flag
    await assert.rejects(
      prepare({
        dist,
        out: join(root, 'bad-flag'),
        origin,
        scanFeedback: 'enabled',
        scanFeedbackNamespaceId: validNamespace,
      }),
      /scan_feedback_flag_invalid/u,
    )

    // Namespace provided without scanFeedback flag
    await assert.rejects(
      prepare({
        dist,
        out: join(root, 'missing-flag'),
        origin,
        scanFeedback: false,
        scanFeedbackNamespaceId: validNamespace,
      }),
      /scan_feedback_flag_required_with_namespace_id/u,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('CLI --scan-feedback and --scan-feedback-namespace-id flags configure candidate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-feedback-cli-'))
  const validNamespace = '0123456789abcdef0123456789abcdef'
  try {
    const dist = await fixture(root)
    const out = join(root, 'cli-candidate')
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare.mjs', import.meta.url)),
        '--dist',
        dist,
        '--out',
        out,
        '--origin',
        origin,
        '--scan-feedback',
        '--scan-feedback-namespace-id',
        validNamespace,
      ],
      { encoding: 'utf8' },
    )
    assert.equal(result.status, 0, result.stderr)
    const config = JSON.parse(await readFile(join(out, 'wrangler.json'), 'utf8'))
    assert.equal(config.vars.SODA_SCAN_FEEDBACK, 'enabled')
    assert.deepEqual(config.kv_namespaces, [
      {
        binding: 'SODA_SCAN_FEEDBACK_STORE',
        id: validNamespace,
      },
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
