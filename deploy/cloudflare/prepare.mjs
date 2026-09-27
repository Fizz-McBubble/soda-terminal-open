import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const wranglerVersion = '4.141.0'
const here = dirname(fileURLToPath(import.meta.url))
const MAX_FILE = 25 * 1024 * 1024
const MAX_FILES = 20_000
const uploadExtensions = new Set([
  '.avif',
  '.cmd',
  '.css',
  '.gif',
  '.html',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.mp3',
  '.mp4',
  '.ogg',
  '.png',
  '.ps1',
  '.svg',
  '.txt',
  '.wasm',
  '.webmanifest',
  '.webp',
  '.woff',
  '.woff2',
  '.xml',
])
const assetPath = /^\/(?:assets\/[A-Za-z0-9._~/-]+|index\.html|favicon\.svg)$/u
const privateText =
  /(?:[A-Za-z]:[\\/](?:Users|Knowledge|AIProjects|AI项目|Codex)[\\/]|["'`][A-Za-z]:[\\/]|\/Users\/[^/]+\/|\/home\/[^/]+\/|\.up\.railway\.app|\/api\/calculation\/)/iu
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const within = (child, parent) => {
  const p = relative(parent, child)
  return !p || (!p.startsWith(`..${sep}`) && p !== '..' && !isAbsolute(p))
}
function forbidden(path, isDirectory = false) {
  const parts = path.split('/')
  return (
    path === '_redirects' || // SPA fallback is owned by Wrangler routing.
    (!isDirectory && path !== '_headers' && !uploadExtensions.has(extname(path).toLowerCase())) ||
    parts.some(
      (part) =>
        part.startsWith('.') ||
        ['node_modules', 'private', 'server', 'outputs', 'test-results'].includes(part),
    ) ||
    /\.(?:map|ts|tsx|cs|pdb|log|zip|env|pem|key)$/iu.test(path) ||
    /(?:^|\/)(?:isolated-account[^/]*|trace\.zip|[^/]*(?:account-backup|full-backup)[^/]*\.json)$/iu.test(
      path,
    ) ||
    ['package.json', 'pnpm-lock.yaml', 'package-lock.json'].includes(path)
  )
}
async function inventory(root, base = '') {
  const result = []
  for (const item of await readdir(resolve(root, base), { withFileTypes: true })) {
    const path = base ? `${base}/${item.name}` : item.name
    const full = resolve(root, path)
    const info = await lstat(full)
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
      throw new Error(`asset_not_regular:${path}`)
    if (forbidden(path, info.isDirectory())) throw new Error(`non_distribution_file:${path}`)
    if (info.isDirectory()) result.push(...(await inventory(root, path)))
    else {
      if (info.size > MAX_FILE) throw new Error(`asset_over_25MiB:${path}`)
      const bytes = await readFile(full)
      if (bytes.length > MAX_FILE) throw new Error(`asset_over_25MiB:${path}`)
      result.push({ path, bytes: bytes.length, sha256: hash(bytes) })
    }
    if (result.length > MAX_FILES) throw new Error('asset_count_over_20000')
  }
  return result.sort((a, b) => a.path.localeCompare(b.path))
}
function browserMarker(html) {
  return [...html.matchAll(/<meta\b[^>]*>/giu)].some(
    ([tag]) =>
      /\bname\s*=\s*['"]soda-compute-mode['"]/iu.test(tag) &&
      /\bcontent\s*=\s*['"]browser['"]/iu.test(tag),
  )
}
export async function inspectDist(dist) {
  const root = resolve(dist)
  if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink())
    throw new Error('dist_must_be_real_directory')
  const files = await inventory(root)
  const html = await readFile(resolve(root, 'index.html'), 'utf8')
  if (!browserMarker(html)) throw new Error('browser_compute_marker_required_not_R17')
  if (
    !/<meta\b[^>]*name=['"]soda-bundle-entry['"][^>]*content=['"]browser-compute['"]/iu.test(html)
  )
    throw new Error('browser_entry_required')
  const manifest = JSON.parse(await readFile(resolve(root, 'offline-shell-manifest.json'), 'utf8'))
  if (typeof manifest.releaseId !== 'string' || !/^[A-Za-z0-9._-]{8,80}$/u.test(manifest.releaseId))
    throw new Error('release_id_missing_or_invalid')
  if (
    manifest.browserCompute !== true ||
    typeof manifest.computeWorker !== 'string' ||
    !/^\/assets\/[A-Za-z0-9._~-]+\.js$/u.test(manifest.computeWorker)
  )
    throw new Error('browser_compute_manifest_required')
  if (
    !Array.isArray(manifest.assets) ||
    !Array.isArray(manifest.criticalAssets) ||
    manifest.assets.some(
      (path) => typeof path !== 'string' || !assetPath.test(path) || path.includes('..'),
    ) ||
    new Set(manifest.assets).size !== manifest.assets.length ||
    manifest.criticalAssets.some(
      (path) => typeof path !== 'string' || !manifest.assets.includes(path),
    ) ||
    new Set(manifest.criticalAssets).size !== manifest.criticalAssets.length ||
    !manifest.assets.includes('/index.html') ||
    !manifest.criticalAssets.includes('/index.html') ||
    !manifest.criticalAssets.includes(manifest.computeWorker)
  )
    throw new Error('offline_asset_manifest_invalid')
  const names = new Set(files.map((file) => `/${file.path}`))
  for (const path of manifest.assets)
    if (!names.has(path)) throw new Error(`offline_asset_missing:${path}`)
  for (const name of names)
    if (name.startsWith('/assets/') && !manifest.assets.includes(name))
      throw new Error(`offline_asset_unlisted:${name}`)
  const workerSource = await readFile(resolve(root, manifest.computeWorker.slice(1)), 'utf8')
  if (
    !workerSource.trim() ||
    !files.some(
      (file) => file.path.endsWith('.js') && file.path !== manifest.computeWorker.slice(1),
    )
  )
    throw new Error('compute_worker_bundle_missing')
  const workerName = manifest.computeWorker.split('/').at(-1)
  let workerReferenced = false
  for (const file of files) {
    if (
      ![
        '.html',
        '.js',
        '.json',
        '.cmd',
        '.ps1',
        '.css',
        '.svg',
        '.txt',
        '.xml',
        '.webmanifest',
      ].includes(extname(file.path)) &&
      file.path !== '_headers'
    )
      continue
    const text = await readFile(resolve(root, file.path), 'utf8')
    if (privateText.test(text)) throw new Error(`private_or_remote_reference:${file.path}`)
    if (
      file.path.endsWith('.js') &&
      file.path !== manifest.computeWorker.slice(1) &&
      text.includes(workerName)
    )
      workerReferenced = true
  }
  if (!workerReferenced) throw new Error('compute_worker_not_referenced')
  return {
    schema: 'soda.cloudflare.preflight/v1',
    releaseId: manifest.releaseId,
    fileCount: files.length,
    totalBytes: files.reduce((n, file) => n + file.bytes, 0),
    inventorySha256: hash(JSON.stringify(files)),
    files,
    warnings: [],
    scope: 'browser_bundle_file_closure_and_reference_audit_not_runtime_acceptance',
  }
}
export async function prepare({ dist, out, accountId, name = 'soda-terminal' }) {
  if (!dist || !out) throw new Error('dist_and_out_required')
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/u.test(name)) throw new Error('worker_name_invalid')
  if (accountId && !/^[a-f0-9]{32}$/u.test(accountId)) throw new Error('account_id_invalid')
  const input = resolve(dist),
    output = resolve(out)
  if (within(output, input) || within(input, output) || within(output, here))
    throw new Error('output_overlaps_input_or_tools')
  const report = await inspectDist(input)
  const config = JSON.parse(await readFile(resolve(here, 'wrangler.template.json'), 'utf8'))
  const staticHeaders = await readFile(resolve(here, 'static-headers.txt'), 'utf8')
  config.name = name
  if (accountId) config.account_id = accountId
  config.vars = { SODA_RELEASE_ID: report.releaseId }
  await mkdir(dirname(output), { recursive: true })
  // Exclusive destination: never overwrite a previous candidate.
  await mkdir(output)
  try {
    await cp(input, resolve(output, 'web'), { recursive: true, errorOnExist: true, force: false })
    // Recheck the copied tree rather than assume input stayed unchanged during copy.
    const web = resolve(output, 'web')
    const copied = await inspectDist(web)
    if (copied.inventorySha256 !== report.inventorySha256)
      throw new Error('dist_changed_during_copy')
    const headersPath = resolve(web, '_headers')
    try {
      const existing = await readFile(headersPath, 'utf8')
      if (existing !== staticHeaders) throw new Error('static_headers_conflict')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      await writeFile(headersPath, staticHeaders, { flag: 'wx' })
    }
    const upload = await inspectDist(web)
    const packagedReport = {
      ...upload,
      sourceInventorySha256: report.inventorySha256,
      staticHeadersSha256: hash(staticHeaders),
    }
    await cp(resolve(here, 'edge.mjs'), resolve(output, 'edge.mjs'), {
      errorOnExist: true,
      force: false,
    })
    await writeFile(resolve(output, 'wrangler.json'), JSON.stringify(config, null, 2) + '\n')
    await writeFile(
      resolve(output, 'package.json'),
      JSON.stringify(
        {
          name: 'soda-cloudflare-candidate',
          private: true,
          type: 'module',
          devDependencies: { wrangler: wranglerVersion },
          scripts: {
            'cf:whoami': 'wrangler whoami',
            'cf:login': 'wrangler login',
            'cf:dev': 'wrangler dev --local',
            'cf:dry-run': 'wrangler deploy --dry-run',
            'cf:deploy': 'wrangler deploy',
          },
        },
        null,
        2,
      ) + '\n',
    )
    await writeFile(resolve(output, '.gitignore'), 'node_modules/\n.wrangler/\n.dev.vars*\n.env*\n')
    await writeFile(
      resolve(output, 'preflight-report.json'),
      JSON.stringify(packagedReport, null, 2) + '\n',
    )
    return packagedReport
  } catch (error) {
    await rm(output, { recursive: true, force: true })
    throw error
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    options = {}
  try {
    for (let i = 0; i < args.length; i += 2) {
      if (
        !['--dist', '--out', '--account-id', '--name'].includes(args[i]) ||
        !args[i + 1] ||
        args[i + 1].startsWith('--')
      )
        throw new Error(
          'usage: --dist <browser-dist> --out <new-directory> [--account-id <id>] [--name <name>]',
        )
      options[args[i] === '--account-id' ? 'accountId' : args[i].slice(2)] = args[i + 1]
    }
    const report = await prepare(options)
    console.log(
      JSON.stringify(
        {
          prepared: true,
          releaseId: report.releaseId,
          fileCount: report.fileCount,
          inventorySha256: report.inventorySha256,
          warnings: report.warnings,
          deployed: false,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
