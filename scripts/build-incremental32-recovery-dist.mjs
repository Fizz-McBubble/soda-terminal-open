import { spawnSync } from 'node:child_process'
import { resolve, relative, isAbsolute, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync, realpathSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolveBuildStorage } from './derived-build-storage.mjs'
import {
  assertBuildIdentityOverrides,
  deriveBuildReleaseIdentityFromEnvironment,
  resolveBuildSourceAuthority,
} from './build-release-identity.mjs'

const app = fileURLToPath(new URL('../', import.meta.url))

export function recoveryBuildOptions(env = process.env, appRoot = app) {
  const gameVersion = env.SODA_RECOVERY_GAME_VERSION ?? '3.2'
  if (!['3.2', '3.3'].includes(gameVersion)) throw Error('Unsupported recovery game version')
  if (
    env.VITE_SODA_INCREMENTAL32_RECOVERY === 'true' &&
    env.VITE_SODA_INCREMENTAL33_RECOVERY === 'true'
  )
    throw Error('Recovery modes cannot both be enabled')
  const allowed = resolve(
    resolveBuildStorage(appRoot, env).derivedRoot,
    `recovery/${gameVersion}-update`,
  )
  const output = env.SODA_COMMUNITY_DIST && resolve(env.SODA_COMMUNITY_DIST)
  if (!output) throw Error('An explicit isolated SODA_COMMUNITY_DIST is required')
  const inside = (base, target) => {
    const path = relative(base, target)
    return (
      path &&
      !isAbsolute(path) &&
      path !== '..' &&
      !path.startsWith('..\\') &&
      !path.startsWith('../')
    )
  }
  if (!inside(allowed, output)) throw Error(`Recovery output must be a child of ${allowed}`)
  let ancestor = output
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  let allowedAncestor = allowed
  while (!existsSync(allowedAncestor)) allowedAncestor = dirname(allowedAncestor)
  const actualAllowed = resolve(realpathSync(allowedAncestor), relative(allowedAncestor, allowed))
  const actualOutput = resolve(realpathSync(ancestor), relative(ancestor, output))
  if (!inside(actualAllowed, actualOutput))
    throw Error('Resolved recovery output escapes the intended workspace directory')
  if (existsSync(output))
    throw Error('Recovery output already exists; use a fresh candidate directory')
  return {
    gameVersion,
    output,
    env: {
      ...env,
      SODA_COMMUNITY_DIST: output,
      SODA_DERIVED_ROOT: resolve(allowed, 'derived'),
      VITE_SODA_INCREMENTAL32_RECOVERY: String(gameVersion === '3.2'),
      VITE_SODA_INCREMENTAL33_RECOVERY: String(gameVersion === '3.3'),
    },
  }
}

export async function buildCompatibilityRecovery(env = process.env) {
  const modeOptions = recoveryBuildOptions(env)
  const authority = await resolveBuildSourceAuthority(app, env, {
    privateLabel: env.VITE_SODA_RELEASE_ID,
  })
  const { sourceReleaseId } = authority
  const identity = deriveBuildReleaseIdentityFromEnvironment(sourceReleaseId, modeOptions.env, {
    sourceVerified: authority.sourceVerified,
  })
  if (authority.sourceVerified) assertBuildIdentityOverrides(identity, env)
  const options = {
    ...modeOptions,
    env: {
      ...modeOptions.env,
      SODA_SOURCE_RELEASE_ID: sourceReleaseId,
      SODA_SOURCE_VERIFIED: String(authority.sourceVerified),
      ...(authority.sourceKind === 'private' ? { SODA_PRIVATE_SOURCE_LABEL: sourceReleaseId } : {}),
      VITE_SODA_RELEASE_ID: identity.releaseId,
    },
  }
  const result = spawnSync(process.execPath, [resolve(app, 'scripts/build-community-dist.mjs')], {
    cwd: app,
    stdio: 'inherit',
    env: options.env,
  })
  if (result.status === 0) {
    const { output, gameVersion } = options
    const manifest = JSON.parse(
      readFileSync(resolve(output, 'offline-shell-manifest.json'), 'utf8'),
    )
    const schema = Number(
      /databaseSchemaVersion = (\d+)/u.exec(
        readFileSync(resolve(app, 'src/db/databaseCore.ts'), 'utf8'),
      )?.[1],
    )
    if (!Number.isSafeInteger(schema) || schema <= 0)
      throw Error('Recovery storage schema unavailable')
    writeFileSync(
      resolve(output, 'compatibility-recovery.json'),
      JSON.stringify(
        {
          schema: `soda-incremental${gameVersion.replace('.', '')}-compatibility-recovery/v1`,
          sourceReleaseId,
          sourceLabel: sourceReleaseId,
          sourceKind: authority.sourceKind,
          sourceVerified: authority.sourceVerified,
          releaseId: manifest.releaseId,
          computeWorker: manifest.computeWorker,
          computeWorkerSha256: manifest.criticalAssetSha256[manifest.computeWorker],
          disabledCapabilityScope: `${gameVersion}_precision_only`,
          storageReader: `current_${gameVersion}_identity_compatible`,
          storageSchemaVersion: schema,
          previousResults: 'requires_reanalysis',
          identityPreservationTests: [
            ...(gameVersion === '3.3' ? ['gameDataPacks/currentVersionAdoption33.test.ts'] : []),
            'accounts/backupCompatibility32.test.ts',
            'accounts/incrementalUpdateCompatibility.test.ts',
          ],
          releaseManifestSha256: createHash('sha256')
            .update(readFileSync(resolve(output, 'offline-shell-manifest.json')))
            .digest('hex'),
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    )
  }
  return result.status ?? 1
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  process.exitCode = await buildCompatibilityRecovery()
