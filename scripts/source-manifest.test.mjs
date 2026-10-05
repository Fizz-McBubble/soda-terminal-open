import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { refreshSourceManifest, verifySourceManifest } from './source-manifest.mjs'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'soda-source-identity-'))
  try {
    await mkdir(join(root, 'scripts'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'package.json'), '{"name":"soda-terminal-open","type":"module"}\n')
    await writeFile(join(root, 'src/formula.ts'), 'export const critical = 1 + 0.25\n')
    for (const name of ['build-community.mjs', 'source-manifest.mjs'])
      await writeFile(join(root, 'scripts', name), await readFile(new URL(name, import.meta.url)))
    await writeFile(
      join(root, 'scripts/build-community-dist.mjs'),
      'console.log(process.env.VITE_SODA_RELEASE_ID)\n',
    )
    const files = {}
    for (const path of [
      'package.json',
      'src/formula.ts',
      'scripts/build-community.mjs',
      'scripts/source-manifest.mjs',
      'scripts/build-community-dist.mjs',
    ])
      files[path] = hash(await readFile(join(root, path)))
    await writeFile(
      join(root, 'SOURCE-MANIFEST.json'),
      `${JSON.stringify({ schemaVersion: 1, files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) }, null, 2)}\n`,
    )
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('unchanged public source passes and build dispatches its pinned release', async () => {
  await fixture(async (root) => {
    const { releaseId, count } = await verifySourceManifest(root)
    assert.equal(count, 5)
    const result = spawnSync(process.execPath, [join(root, 'scripts/build-community.mjs')], {
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), releaseId)
  })
})

test('modified formula blocks build instead of reusing the old ID; explicit refresh creates a new ID', async () => {
  await fixture(async (root) => {
    const original = await verifySourceManifest(root)
    const previousManifest = await readFile(join(root, 'SOURCE-MANIFEST.json'))
    await writeFile(join(root, 'src/formula.ts'), 'export const critical = 2 + 0.25\n')
    await assert.rejects(verifySourceManifest(root), /source_manifest_drift:src\/formula\.ts/)
    const blocked = spawnSync(process.execPath, [join(root, 'scripts/build-community.mjs')], {
      encoding: 'utf8',
    })
    assert.notEqual(blocked.status, 0)
    assert.equal(blocked.stdout, '')
    assert.deepEqual(await readFile(join(root, 'SOURCE-MANIFEST.json')), previousManifest)
    const refreshed = await refreshSourceManifest({ root })
    assert.deepEqual(refreshed.changed, ['src/formula.ts'])
    assert.notEqual(refreshed.releaseId, original.releaseId)
    assert.equal((await verifySourceManifest(root)).releaseId, refreshed.releaseId)
    const rebuilt = spawnSync(process.execPath, [join(root, 'scripts/build-community.mjs')], {
      encoding: 'utf8',
    })
    assert.equal(rebuilt.status, 0, rebuilt.stderr)
    assert.equal(rebuilt.stdout.trim(), refreshed.releaseId)
  })
})

test('refresh remains stable after review and new files require an explicit named addition', async () => {
  await fixture(async (root) => {
    const unchanged = await verifySourceManifest(root)
    assert.equal((await refreshSourceManifest({ root })).releaseId, unchanged.releaseId)
    const first = await readFile(join(root, 'SOURCE-MANIFEST.json'))
    await writeFile(join(root, 'src/new.ts'), 'export const newValue = 3\n')
    await assert.rejects(refreshSourceManifest({ root }), /source_manifest_unpinned:src\/new\.ts/)
    await assert.rejects(verifySourceManifest(root), /source_manifest_unpinned:src\/new\.ts/)
    assert.deepEqual(await readFile(join(root, 'SOURCE-MANIFEST.json')), first)
    const next = await refreshSourceManifest({ root, add: ['src/new.ts'] })
    assert.deepEqual(next.changed, ['src/new.ts'])
    assert.equal((await verifySourceManifest(root)).releaseId, next.releaseId)
  })
})

test('missing pinned file refuses check and refresh until explicitly removed', async () => {
  await fixture(async (root) => {
    await rm(join(root, 'src/formula.ts'))
    await assert.rejects(verifySourceManifest(root), /source_manifest_drift/)
    await assert.rejects(refreshSourceManifest({ root }), { code: 'ENOENT' })
    await refreshSourceManifest({ root, remove: ['src/formula.ts'] })
    await verifySourceManifest(root)
  })
})

test('new public pins cannot escape root or include private/output paths', async () => {
  await fixture(async (root) => {
    const before = await readFile(join(root, 'SOURCE-MANIFEST.json'))
    for (const path of [
      '../private.json',
      'src/../private.json',
      'src\\private.json',
      '.env',
      'outputs/account.json',
      'tests/private/account.test.mjs',
      'tests/algorithm-quality/private/account.test.mjs',
      'tests/algorithm-quality/account.json',
      'public/sponsor/private.png',
    ])
      await assert.rejects(
        refreshSourceManifest({ root, add: [path] }),
        /source_manifest_unsafe_path/,
      )
    assert.deepEqual(await readFile(join(root, 'SOURCE-MANIFEST.json')), before)
  })
})

test('algorithm regression pins are editable public source and invalidate stale identity', async () => {
  await fixture(async (root) => {
    const path = 'tests/algorithm-quality/core.test.mjs'
    await mkdir(join(root, 'tests/algorithm-quality'), { recursive: true })
    await writeFile(join(root, path), 'export const checked = true\n')
    const refreshed = await refreshSourceManifest({ root, add: [path] })
    assert.ok(refreshed.changed.includes(path))
    assert.equal((await verifySourceManifest(root)).releaseId, refreshed.releaseId)
    const newPath = 'tests/algorithm-quality/new.test.mjs'
    await writeFile(join(root, newPath), 'export const additional = true\n')
    await assert.rejects(verifySourceManifest(root), /source_manifest_unpinned/)
    await refreshSourceManifest({ root, add: [newPath] })
    await writeFile(join(root, path), 'export const checked = false\n')
    await assert.rejects(verifySourceManifest(root), /source_manifest_drift/)
  })
})

test('refresh only signs the explicitly editable public export', async () => {
  await fixture(async (root) => {
    await writeFile(join(root, 'package.json'), '{"name":"soda-terminal","private":true}\n')
    await assert.rejects(
      refreshSourceManifest({ root }),
      /source_manifest_refresh_public_export_only/,
    )
  })
})
