import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { verifySourceManifest } from './source-manifest.mjs'

const sourceReleaseIdPattern = /^soda-open-[a-f0-9]{16}$/u
const buildReleaseIdPattern = /^[A-Za-z0-9._-]{8,80}$/u
const privateLabelPattern = /^[A-Za-z0-9._-]{8,64}$/u

function recoveryFlag(value, name) {
  if (value === undefined || value === '' || value === 'false' || value === false) return false
  if (value === 'true' || value === true) return true
  throw new Error(`build_recovery_flag_invalid:${name}`)
}

function usageFlag(value) {
  if (value === undefined || value === '' || value === 'disabled' || value === false) return false
  if (value === 'enabled' || value === true) return true
  throw new Error('build_usage_statistics_flag_invalid')
}

export function deriveBuildReleaseIdentity({
  sourceReleaseId,
  incremental32Recovery = false,
  incremental33Recovery = false,
  usageStatistics = false,
  sourceVerified = true,
} = {}) {
  if (
    typeof sourceReleaseId !== 'string' ||
    (sourceVerified
      ? !sourceReleaseIdPattern.test(sourceReleaseId)
      : !privateLabelPattern.test(sourceReleaseId))
  )
    throw new Error('build_source_release_id_invalid')
  const recovery32 = recoveryFlag(incremental32Recovery, 'VITE_SODA_INCREMENTAL32_RECOVERY')
  const recovery33 = recoveryFlag(incremental33Recovery, 'VITE_SODA_INCREMENTAL33_RECOVERY')
  if (recovery32 && recovery33) throw new Error('build_recovery_modes_conflict')
  const usage = usageFlag(usageStatistics)
  const suffix = recovery33 ? '-compat33' : recovery32 ? '-compat32' : ''
  const releaseId = `${sourceReleaseId}${suffix}${usage ? '-usage' : ''}`
  if (!buildReleaseIdPattern.test(releaseId)) throw new Error('build_release_id_invalid')
  return Object.freeze({
    sourceReleaseId,
    sourceVerified,
    releaseId,
    recoveryMode: recovery33 ? 'compat33' : recovery32 ? 'compat32' : 'normal',
    usageStatistics: usage,
  })
}

export function deriveBuildReleaseIdentityFromEnvironment(
  sourceReleaseId,
  env = process.env,
  { sourceVerified = true } = {},
) {
  return deriveBuildReleaseIdentity({
    sourceReleaseId,
    sourceVerified,
    incremental32Recovery: env.VITE_SODA_INCREMENTAL32_RECOVERY,
    incremental33Recovery: env.VITE_SODA_INCREMENTAL33_RECOVERY,
    usageStatistics: env.VITE_SODA_USAGE_STATISTICS,
  })
}

export function assertBuildIdentityOverrides(identity, env = process.env) {
  if (
    env.SODA_SOURCE_VERIFIED !== undefined &&
    String(identity.sourceVerified) !== env.SODA_SOURCE_VERIFIED
  )
    throw new Error('build_source_verification_override_forbidden')
  if (env.SODA_SOURCE_RELEASE_ID && env.SODA_SOURCE_RELEASE_ID !== identity.sourceReleaseId)
    throw new Error(
      `build_source_release_id_override_forbidden:${env.SODA_SOURCE_RELEASE_ID}:${identity.sourceReleaseId}`,
    )
  if (env.VITE_SODA_RELEASE_ID && env.VITE_SODA_RELEASE_ID !== identity.releaseId)
    throw new Error(
      `build_release_id_override_forbidden:${env.VITE_SODA_RELEASE_ID}:${identity.releaseId}`,
    )
}

export function normalizePrivateSourceLabel(value) {
  if (typeof value !== 'string') throw new Error('private_source_label_required')
  const normalized = value
    .trim()
    .replace(/-(?:compat32|compat33)(?:-usage)?$/u, '')
    .replace(/-usage$/u, '')
  if (!privateLabelPattern.test(normalized)) throw new Error('private_source_label_invalid')
  return normalized
}

export function inspectPublicSourceMarkers(appRoot) {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))
  const markers = readdirSync(appRoot)
    .filter((name) => /^SOURCE(?:-|$)/u.test(name))
    .sort()
  if (packageJson.name === 'soda-terminal-open') markers.unshift('package.json:name')
  return {
    packageJson,
    markers: [...new Set(markers)],
  }
}

export async function resolveBuildSourceAuthority(
  appRoot,
  env = process.env,
  { privateLabel } = {},
) {
  const { packageJson, markers } = inspectPublicSourceMarkers(appRoot)
  if (markers.length) {
    if (env.SODA_SOURCE_VERIFIED === 'false' || env.SODA_PRIVATE_SOURCE_LABEL)
      throw new Error('public_source_private_identity_forbidden')
    const { sourceReleaseId } = await verifySourceManifest(appRoot)
    return {
      sourceReleaseId,
      sourceVerified: true,
      sourceKind: 'public',
      sourceMarkers: markers,
    }
  }
  if (packageJson.name !== 'soda-terminal' || packageJson.private !== true)
    throw new Error('build_source_authority_unknown')
  if (!privateLabel) throw new Error('private_source_label_required')
  if (env.SODA_SOURCE_VERIFIED === 'true') throw new Error('private_source_verification_forbidden')
  return {
    sourceReleaseId: normalizePrivateSourceLabel(privateLabel),
    sourceVerified: false,
    sourceKind: 'private',
    sourceMarkers: [],
  }
}
