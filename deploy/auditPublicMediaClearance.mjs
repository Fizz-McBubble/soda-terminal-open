import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const mediaExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : []
  })
}

/** Shared rights/hash gate for the retained R17 artifact and the browser-compute release. */
export function auditPublicMediaClearance(
  dist,
  clearancePath = join(appRoot, 'deploy', 'public-media-clearance.v1.json'),
) {
  const root = resolve(dist)
  const media = filesUnder(root)
    .filter((path) => mediaExtensions.has(extname(path).toLowerCase()))
    .map((path) => ({
      path: `/${relative(root, path).replaceAll('\\', '/')}`,
      sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    }))
  if (!existsSync(clearancePath))
    throw new Error(`public_media_clearance_missing:${media.length} file(s)`)
  let clearance
  try {
    clearance = JSON.parse(readFileSync(clearancePath, 'utf8'))
  } catch {
    throw new Error('public_media_clearance_invalid')
  }
  if (clearance?.schemaVersion !== 1 || !Array.isArray(clearance.files))
    throw new Error('public_media_clearance_invalid')
  const entries = new Map()
  for (const record of clearance.files) {
    if (
      !record ||
      typeof record !== 'object' ||
      typeof record.path !== 'string' ||
      !/^\/[a-zA-Z0-9._/-]+\.(?:avif|gif|jpeg|jpg|png|svg|webp)$/.test(record.path) ||
      record.path.split('/').includes('..') ||
      !/^[a-f0-9]{64}$/.test(record.sha256) ||
      !['project_original', 'redistribution_license', 'owner_authorization'].includes(
        record.rightsBasis,
      ) ||
      typeof record.evidence !== 'string' ||
      !record.evidence.trim() ||
      entries.has(record.path)
    )
      throw new Error('public_media_clearance_invalid')
    entries.set(record.path, record)
  }
  for (const asset of media) {
    const record = entries.get(asset.path)
    if (!record || record.sha256 !== asset.sha256)
      throw new Error(`public_media_rights_unverified:${asset.path}`)
  }
  if (entries.size !== media.length) throw new Error('public_media_clearance_stale')
  return media
}
