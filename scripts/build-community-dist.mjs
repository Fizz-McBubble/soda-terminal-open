#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareCommunityShell } from './prepare-community-shell.mjs'
import { materializeAssetQuickReadInstaller } from './materialize-asset-quick-read-installer.mjs'
import { verifyInstalledTeamRatingRelease } from './verify-team-rating-release.mjs'
import { verifyBoxTeamReferences } from './generate-box-team-references.mjs'
import {
  assertBuildIdentityOverrides,
  deriveBuildReleaseIdentityFromEnvironment,
  resolveBuildSourceAuthority,
} from './build-release-identity.mjs'
import {
  resolveBuildStorage,
  prepareDerivedTemporaryEnvironment,
} from './derived-build-storage.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const storage = resolveBuildStorage(appRoot)
const authority = await resolveBuildSourceAuthority(appRoot, process.env, {
  privateLabel: process.env.SODA_PRIVATE_SOURCE_LABEL,
})
await verifyInstalledTeamRatingRelease({ sourceKind: authority.sourceKind })
await verifyBoxTeamReferences()
const { sourceReleaseId } = authority
const identity = deriveBuildReleaseIdentityFromEnvironment(sourceReleaseId, process.env, {
  sourceVerified: authority.sourceVerified,
})
assertBuildIdentityOverrides(identity, process.env)
const releaseId = identity.releaseId
const dist = resolve(storage.communityDist)
const result = spawnSync(
  process.execPath,
  [resolve(appRoot, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir'],
  {
    cwd: appRoot,
    env: {
      ...prepareDerivedTemporaryEnvironment('community-build', appRoot),
      VITE_SODA_PUBLIC_BUILD: 'false',
      VITE_SODA_COMMUNITY_BUILD: 'true',
      SODA_FILTER_PUBLIC_DOWNLOADS: 'true',
      VITE_SODA_RELEASE_ID: releaseId,
      SODA_SOURCE_RELEASE_ID: sourceReleaseId,
      SODA_SOURCE_VERIFIED: String(authority.sourceVerified),
      SODA_DERIVED_ROOT: storage.derivedRoot,
    },
    stdio: 'inherit',
  },
)
if (result.status !== 0) process.exit(result.status ?? 1)
// The Worker owns the installer route. A local static preview can include an
// explicitly supplied copy after verifying it against the same pinned release.
const installerPath = 'downloads/Soda-Asset-Quick-Read-Setup.exe'
const publicRoot = resolve(appRoot, 'public')
await cp(publicRoot, dist, {
  recursive: true,
  filter: (path) => resolve(path) !== resolve(publicRoot, installerPath),
})
if (process.env.SODA_ASSET_QUICK_READ_INSTALLER)
  await materializeAssetQuickReadInstaller({ output: resolve(dist, installerPath) })
// Workers Static Assets handles SPA fallback itself. The old host's wildcard rewrite must not
// accompany this candidate, where it could change static and protected-route behavior.
const legacyRedirects = join(dist, '_redirects')
if (existsSync(legacyRedirects)) unlinkSync(legacyRedirects)
const manifest = prepareCommunityShell({ dist, releaseId })
console.log(
  JSON.stringify({
    ok: true,
    dist,
    sourceReleaseId,
    sourceKind: authority.sourceKind,
    sourceVerified: authority.sourceVerified,
    releaseId,
    recoveryMode: identity.recoveryMode,
    usageStatistics: identity.usageStatistics,
    computeWorker: manifest.computeWorker,
  }),
)
