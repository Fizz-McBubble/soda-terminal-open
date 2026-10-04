import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { prepare } from './prepare.mjs'

const origin = 'https://app.sodaterminal.workers.dev'
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
    assert.equal(headers.match(/connect-src ([^;]+)/u)?.[1], "'self' http://127.0.0.1:43127")
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

test('enabled packaging rejects missing/local/preview origin and nonboolean flags before writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'soda-usage-origin-'))
  try {
    const dist = await fixture(root)
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
