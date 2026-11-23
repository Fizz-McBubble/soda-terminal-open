import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { refreshSourceManifest, verifySourceManifest } from './source-manifest.mjs'
import {
  materializationChunkPath,
  parseSourceMaterializationRecipeDocument,
  sourceMaterializationRecipeDocument,
  sourceMaterializationRecipeFile,
  sourceMaterializationTargets,
  splitSourceMaterializationInput,
} from './source-input-recipes.mjs'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'soda-source-identity-'))
  try {
    await mkdir(join(root, 'scripts'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'package.json'), '{"name":"soda-terminal-open","type":"module"}\n')
    await writeFile(join(root, 'src/formula.ts'), 'export const critical = 1 + 0.25\n')
    for (const name of [
      'build-release-identity.mjs',
      'build-community.mjs',
      'source-manifest.mjs',
      'source-input-recipes.mjs',
      'derived-build-storage.mjs',
    ])
      await writeFile(join(root, 'scripts', name), await readFile(new URL(name, import.meta.url)))
    await writeFile(
      join(root, 'scripts/build-community-dist.mjs'),
      'console.log(process.env.VITE_SODA_RELEASE_ID)\n',
    )
    const files = {}
    for (const path of [
      'package.json',
      'src/formula.ts',
      'scripts/build-release-identity.mjs',
      'scripts/build-community.mjs',
      'scripts/source-manifest.mjs',
      'scripts/source-input-recipes.mjs',
      'scripts/derived-build-storage.mjs',
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

async function recipeFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'soda-source-recipe-'))
  try {
    await mkdir(join(root, 'scripts'))
    await mkdir(join(root, 'src/gameDataPacks/generated'), { recursive: true })
    await writeFile(join(root, 'package.json'), '{"name":"soda-terminal-open","type":"module"}\n')
    for (const name of [
      'build-release-identity.mjs',
      'build-community.mjs',
      'source-manifest.mjs',
      'source-input-recipes.mjs',
      'derived-build-storage.mjs',
    ])
      await writeFile(join(root, 'scripts', name), await readFile(new URL(name, import.meta.url)))
    await writeFile(
      join(root, 'scripts/build-community-dist.mjs'),
      'console.log(process.env.VITE_SODA_RELEASE_ID)\n',
    )
    const targetBytes = Buffer.from('{"contract":"chunked-fixture","rows":[1,2,3]}\n')
    const recipe = splitSourceMaterializationInput(
      targetBytes,
      sourceMaterializationTargets[0].target,
    )
    for (const [index, chunk] of recipe.chunks.entries())
      await writeFile(
        join(root, chunk.path),
        targetBytes.subarray(
          recipe.chunks.slice(0, index).reduce((sum, entry) => sum + entry.bytes, 0),
          recipe.chunks.slice(0, index + 1).reduce((sum, entry) => sum + entry.bytes, 0),
        ),
      )
    const recipeBytes = Buffer.from(
      `${JSON.stringify(sourceMaterializationRecipeDocument([recipe]), null, 2)}\n`,
    )
    await writeFile(join(root, sourceMaterializationRecipeFile), recipeBytes)
    const files = {}
    for (const path of [
      'package.json',
      'scripts/build-release-identity.mjs',
      'scripts/build-community.mjs',
      'scripts/build-community-dist.mjs',
      'scripts/source-manifest.mjs',
      'scripts/source-input-recipes.mjs',
      'scripts/derived-build-storage.mjs',
      sourceMaterializationRecipeFile,
      ...recipe.chunks.map((chunk) => chunk.path),
    ])
      files[path] = hash(await readFile(join(root, path)))
    files[recipe.target] = recipe.targetSha256
    await writeFile(
      join(root, 'SOURCE-MANIFEST.json'),
      `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`,
    )
    await run(root, { recipe, recipeBytes, targetBytes })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('unchanged public source passes and build dispatches its pinned release', async () => {
  await fixture(async (root) => {
    const { releaseId, count } = await verifySourceManifest(root)
    assert.equal(count, 8)
    const result = spawnSync(process.execPath, [join(root, 'scripts/build-community.mjs')], {
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), releaseId)
  })
})

test('verified chunk recipe materializes the exact ignored target before build', async () => {
  await recipeFixture(async (root, { recipe, targetBytes }) => {
    await assert.rejects(readFile(join(root, recipe.target)), { code: 'ENOENT' })
    const first = await verifySourceManifest(root)
    assert.deepEqual(first.materialized, [recipe.target])
    assert.deepEqual(await readFile(join(root, recipe.target)), targetBytes)
    const second = await verifySourceManifest(root)
    assert.deepEqual(second.materialized, [])
    assert.equal(second.releaseId, first.releaseId)
    const built = spawnSync(process.execPath, [join(root, 'scripts/build-community.mjs')], {
      encoding: 'utf8',
    })
    assert.equal(built.status, 0, built.stderr)
    assert.equal(built.stdout.trim(), first.releaseId)
  })
})

test('an existing bad materialized target is rejected without being overwritten', async () => {
  await recipeFixture(async (root, { recipe }) => {
    const bad = Buffer.from('already-present-but-not-canonical\n')
    await writeFile(join(root, recipe.target), bad)
    await assert.rejects(
      verifySourceManifest(root),
      /source_manifest_recipe_target_changed:.*rerun prepare-open-source\.mjs/,
    )
    assert.deepEqual(await readFile(join(root, recipe.target)), bad)
  })
})

test('chunk recipes reject tampering, missing fragments, symlinks, path escape and reordered parts', async () => {
  await recipeFixture(async (root, { recipe }) => {
    await writeFile(join(root, recipe.chunks[0].path), 'tampered')
    await assert.rejects(verifySourceManifest(root), /source_manifest_recipe_chunk_mismatch/)
    await assert.rejects(readFile(join(root, recipe.target)), { code: 'ENOENT' })
  })

  await recipeFixture(async (root, { recipe }) => {
    await rm(join(root, recipe.chunks[0].path))
    await assert.rejects(verifySourceManifest(root), /source_manifest_recipe_chunk_missing/)
    await assert.rejects(readFile(join(root, recipe.target)), { code: 'ENOENT' })
  })

  await recipeFixture(async (root, { recipe }) => {
    const outside = await mkdtemp(join(tmpdir(), 'soda-source-recipe-outside-'))
    try {
      await rm(join(root, recipe.chunks[0].path))
      await symlink(outside, join(root, recipe.chunks[0].path), 'junction')
      await assert.rejects(verifySourceManifest(root), /source_manifest_non_regular/)
      await assert.rejects(readFile(join(root, recipe.target)), { code: 'ENOENT' })
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })

  await recipeFixture(async (root, { recipeBytes }) => {
    const escaped = JSON.parse(recipeBytes)
    escaped.files[0].chunks[0].path = '../escape.part-000'
    assert.throws(
      () => parseSourceMaterializationRecipeDocument(JSON.stringify(escaped)),
      /source_materialization_recipe_invalid/,
    )
    const reordered = JSON.parse(recipeBytes)
    const definition = sourceMaterializationTargets[0]
    reordered.files[0].targetBytes = definition.chunkSizeBytes + 1
    reordered.files[0].chunks = [
      {
        path: materializationChunkPath(definition.target, 1),
        bytes: 1,
        sha256: 'a'.repeat(64),
      },
      {
        path: materializationChunkPath(definition.target, 0),
        bytes: definition.chunkSizeBytes,
        sha256: 'b'.repeat(64),
      },
    ]
    assert.throws(
      () => parseSourceMaterializationRecipeDocument(JSON.stringify(reordered)),
      /source_materialization_recipe_chunk_order/,
    )
  })
})

test('refresh materializes a valid recipe and refuses a changed canonical target', async () => {
  await recipeFixture(async (root, { recipe, targetBytes }) => {
    const refreshed = await refreshSourceManifest({ root })
    assert.deepEqual(await readFile(join(root, recipe.target)), targetBytes)
    assert.equal((await verifySourceManifest(root)).releaseId, refreshed.releaseId)
    const previousManifest = await readFile(join(root, 'SOURCE-MANIFEST.json'))
    await writeFile(join(root, recipe.target), Buffer.concat([targetBytes, Buffer.from(' ')]))
    await assert.rejects(
      refreshSourceManifest({ root }),
      /source_manifest_recipe_target_changed:.*rerun prepare-open-source\.mjs/,
    )
    assert.deepEqual(await readFile(join(root, 'SOURCE-MANIFEST.json')), previousManifest)
  })
})

test('refresh cannot sign a recipe whose pinned fragments no longer reconstruct the target', async () => {
  await recipeFixture(async (root, { recipe }) => {
    await verifySourceManifest(root)
    const previousManifest = await readFile(join(root, 'SOURCE-MANIFEST.json'))
    await writeFile(join(root, recipe.chunks[0].path), 'tampered-after-materialization')
    await assert.rejects(refreshSourceManifest({ root }), /source_manifest_recipe_chunk_changed/)
    assert.deepEqual(await readFile(join(root, 'SOURCE-MANIFEST.json')), previousManifest)
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
