#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = readFileSync(resolve(root, 'SOURCE-MANIFEST.json'))
const releaseId = `soda-open-${createHash('sha256').update(manifest).digest('hex').slice(0, 16)}`
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
