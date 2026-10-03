#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifySourceManifest } from './source-manifest.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { releaseId } = await verifySourceManifest(root)
const result = spawnSync(process.execPath, [resolve(root, 'scripts/build-community-dist.mjs')], {
  cwd: root,
  env: {
    ...process.env,
    VITE_SODA_RELEASE_ID: releaseId,
    SODA_COMMUNITY_DIST: resolve(root, 'dist'),
    SODA_DERIVED_ROOT: resolve(root, 'node_modules/.tmp/soda-derived'),
  },
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
