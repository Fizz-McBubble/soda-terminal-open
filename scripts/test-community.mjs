#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { communityTests } from './community-test-manifest.mjs'
import { runAlgorithmQualityTests } from './run-algorithm-quality-tests.mjs'
import {
  resolveBuildStorage,
  prepareDerivedTemporaryEnvironment,
  enterDerivedTemporaryEnvironment,
} from './derived-build-storage.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const storage = resolveBuildStorage(root)
const testEnvironment = prepareDerivedTemporaryEnvironment('community-test', root)
const restoreAlgorithmTemporary = enterDerivedTemporaryEnvironment('community-test')
let algorithmStatus
try {
  algorithmStatus = runAlgorithmQualityTests()
} finally {
  restoreAlgorithmTemporary()
}
const projectionTests = spawnSync(
  process.execPath,
  [
    '--test',
    resolve(root, 'build/communitySourceProjection.node-test.mjs'),
    resolve(root, 'scripts/source-manifest.test.mjs'),
    resolve(root, 'scripts/current-agent-effect-compiler.test.mjs'),
    resolve(root, 'deploy/cloudflare/edge.test.mjs'),
    resolve(root, 'deploy/cloudflare/scan-feedback.test.mjs'),
    resolve(root, 'deploy/cloudflare/scanner-installer.test.mjs'),
    resolve(root, 'deploy/cloudflare/asset-quick-read-installer.test.mjs'),
    resolve(root, 'deploy/cloudflare/prepare.test.mjs'),
  ],
  {
    cwd: root,
    env: testEnvironment,
    stdio: 'inherit',
  },
)
if (projectionTests.status !== 0) process.exit(projectionTests.status ?? 1)
const result = spawnSync(
  process.execPath,
  [
    resolve(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    'vite.config.ts',
    ...communityTests,
  ],
  {
    cwd: root,
    env: {
      ...testEnvironment,
      VITE_SODA_PUBLIC_BUILD: 'false',
      VITE_SODA_COMMUNITY_BUILD: 'true',
      SODA_DERIVED_ROOT: storage.derivedRoot,
    },
    stdio: 'inherit',
  },
)
process.exit((result.status ?? 1) || algorithmStatus)
