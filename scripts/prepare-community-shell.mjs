#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditPublicMediaClearance } from '../deploy/auditPublicMediaClearance.mjs'
import { hasPrivateCommunityLocator } from '../build/communitySourceProjection.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const allowedAsset = /^\/assets\/[A-Za-z0-9._~/-]+\.(?:avif|css|gif|jpe?g|js|json|png|svg|wasm|webp|woff2?)$/u

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : []
  })
}

export function prepareCommunityShell({ dist, releaseId }) {
  if (!/^[A-Za-z0-9._-]{8,80}$/u.test(releaseId ?? '')) throw new Error('invalid_release_id')
  const root = resolve(dist)
  const indexPath = join(root, 'index.html')
  const serviceWorkerPath = join(root, 'service-worker.js')
  if (!existsSync(indexPath) || !existsSync(serviceWorkerPath))
    throw new Error('incomplete_community_artifact')
  const index = readFileSync(indexPath, 'utf8')
  if (
    !index.includes('<meta name="soda-bundle-entry" content="browser-compute" />') ||
    !index.includes('<meta name="soda-compute-mode" content="browser" />')
  )
    throw new Error('community_entry_not_selected')
  const files = filesUnder(root)
  if (files.some((path) => extname(path).toLowerCase() === '.map'))
    throw new Error('source_map_in_community_artifact')
  if (
    files.some(
      (path) =>
        /\.(?:html|js|json)$/u.test(path) &&
        hasPrivateCommunityLocator(readFileSync(path, 'utf8')),
    )
  )
    throw new Error('private_locator_in_community_artifact')
  auditPublicMediaClearance(root)
  const assetPaths = files
    .filter((path) => relative(root, path).replaceAll('\\', '/').startsWith('assets/'))
    .map((path) => `/${relative(root, path).replaceAll('\\', '/')}`)
    .sort()
  if (!assetPaths.length || assetPaths.some((path) => !allowedAsset.test(path)))
    throw new Error('community_asset_path_invalid')
  const workers = assetPaths.filter((path) =>
    /^\/assets\/browserCalculationQuery\.worker-[A-Za-z0-9_-]+\.js$/u.test(path),
  )
  if (workers.length !== 1) throw new Error('browser_query_worker_missing_or_ambiguous')
  const computeWorker = workers[0]
  const appScripts = files.filter(
    (path) => extname(path) === '.js' && path !== serviceWorkerPath && path !== join(root, computeWorker),
  )
  if (!appScripts.some((path) => readFileSync(path, 'utf8').includes(computeWorker.slice('/assets/'.length))))
    throw new Error('browser_query_worker_not_referenced')
  if (!appScripts.some((path) => readFileSync(path, 'utf8').includes(releaseId)))
    throw new Error('community_build_release_id_missing')
  // Install only succeeds once every execution chunk and stylesheet is cached. Decorative images
  // warm in the background; a completed install can already start a fresh calculation offline.
  const criticalAssets = [
    '/index.html',
    '/favicon.svg',
    ...assetPaths.filter((path) => /\.(?:css|js|json|wasm)$/u.test(path)),
  ]
  const manifest = {
    releaseId,
    publicCoreSeparated: false,
    browserCompute: true,
    computeWorker,
    assets: ['/index.html', '/favicon.svg', ...assetPaths],
    criticalAssets,
  }
  writeFileSync(join(root, 'offline-shell-manifest.json'), `${JSON.stringify(manifest)}\n`, {
    flag: 'wx',
  })
  return manifest
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , dist, releaseId] = process.argv
  try {
    const manifest = prepareCommunityShell({ dist, releaseId })
    process.stdout.write(
      `community shell prepared: ${manifest.releaseId}, ${manifest.assets.length} assets\n`,
    )
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
