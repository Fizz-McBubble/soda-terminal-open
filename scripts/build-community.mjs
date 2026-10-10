#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifySourceManifest } from './source-manifest.mjs'
import {
  resolveBuildStorage,
  prepareDerivedTemporaryEnvironment,
} from './derived-build-storage.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const storage = resolveBuildStorage(root)
const { releaseId } = await verifySourceManifest(root)
const result = spawnSync(process.execPath, [resolve(root, 'scripts/build-community-dist.mjs')], {
  cwd: root,
  env: {
    ...prepareDerivedTemporaryEnvironment('community-build', root),
    VITE_SODA_RELEASE_ID: releaseId,
    SODA_COMMUNITY_DIST: storage.communityDist,
    SODA_DERIVED_ROOT: storage.derivedRoot,
  },
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
