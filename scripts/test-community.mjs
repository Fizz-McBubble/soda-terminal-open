#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { communityTests } from './community-test-manifest.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectionTests = spawnSync(
  process.execPath,
  [
    '--test',
    resolve(root, 'build/communitySourceProjection.node-test.mjs'),
    resolve(root, 'scripts/source-manifest.test.mjs'),
  ],
  {
    cwd: root,
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
      ...process.env,
      VITE_SODA_PUBLIC_BUILD: 'false',
      VITE_SODA_COMMUNITY_BUILD: 'true',
      SODA_DERIVED_ROOT: resolve(root, 'node_modules/.tmp/soda-derived'),
    },
    stdio: 'inherit',
  },
)
process.exit(result.status ?? 1)
