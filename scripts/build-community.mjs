#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertBuildIdentityOverrides,
  deriveBuildReleaseIdentityFromEnvironment,
  resolveBuildSourceAuthority,
} from './build-release-identity.mjs'
import {
  resolveBuildStorage,
  prepareDerivedTemporaryEnvironment,
} from './derived-build-storage.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const storage = resolveBuildStorage(root)
const authority = await resolveBuildSourceAuthority(root, process.env, {
  privateLabel: process.env.VITE_SODA_RELEASE_ID,
})
const { sourceReleaseId } = authority
const identity = deriveBuildReleaseIdentityFromEnvironment(sourceReleaseId, process.env, {
  sourceVerified: authority.sourceVerified,
})
if (authority.sourceVerified) assertBuildIdentityOverrides(identity, process.env)
if (identity.recoveryMode !== 'normal') throw new Error('build_recovery_requires_explicit_builder')
const result = spawnSync(process.execPath, [resolve(root, 'scripts/build-community-dist.mjs')], {
  cwd: root,
  env: {
    ...prepareDerivedTemporaryEnvironment('community-build', root),
    VITE_SODA_RELEASE_ID: identity.releaseId,
    SODA_SOURCE_RELEASE_ID: sourceReleaseId,
    SODA_SOURCE_VERIFIED: String(authority.sourceVerified),
    ...(authority.sourceKind === 'private' ? { SODA_PRIVATE_SOURCE_LABEL: sourceReleaseId } : {}),
    SODA_COMMUNITY_DIST: storage.communityDist,
    SODA_DERIVED_ROOT: storage.derivedRoot,
  },
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
