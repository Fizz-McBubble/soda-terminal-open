#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareCommunityShell } from './prepare-community-shell.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseId = process.env.VITE_SODA_RELEASE_ID
if (!/^[A-Za-z0-9._-]{8,80}$/u.test(releaseId ?? ''))
  throw new Error('VITE_SODA_RELEASE_ID must identify this browser-compute candidate')
const dist = resolve(process.env.SODA_COMMUNITY_DIST ?? resolve(appRoot, 'node_modules/.tmp/soda-community-dist'))
const result = spawnSync(
  process.execPath,
  [resolve(appRoot, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir'],
  {
    cwd: appRoot,
    env: {
      ...process.env,
      VITE_SODA_PUBLIC_BUILD: 'false',
      VITE_SODA_COMMUNITY_BUILD: 'true',
      SODA_DERIVED_ROOT: process.env.SODA_DERIVED_ROOT ?? resolve(appRoot, 'node_modules/.tmp/soda-community'),
    },
    stdio: 'inherit',
  },
)
if (result.status !== 0) process.exit(result.status ?? 1)
// Workers Static Assets handles SPA fallback itself. The old host's wildcard rewrite must not
// accompany this candidate, where it could change static and protected-route behavior.
const legacyRedirects = join(dist, '_redirects')
if (existsSync(legacyRedirects)) unlinkSync(legacyRedirects)
const manifest = prepareCommunityShell({ dist, releaseId })
console.log(JSON.stringify({ ok: true, dist, releaseId, computeWorker: manifest.computeWorker }))
