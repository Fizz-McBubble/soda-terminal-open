import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  materializeScannerDistribution,
  validatePublicOrigin,
} from '../../scripts/materialize-scanner-distribution.mjs'
import scanFeedbackContract from '../../src/scanner/scanFeedback.contract.json' with { type: 'json' }
import {
  assetQuickReadInstallerPath,
  assetQuickReadInstallerRelease,
  assetQuickReadInstallerUrl,
  validAssetQuickReadRelease,
} from './asset-quick-read-release.mjs'
import { verifyBundledAssetQuickReadInstaller } from './asset-quick-read-distribution.mjs'

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
async function inventory(root, base = '', allowAssetQuickReadInstaller = false) {
  const result = []
  for (const item of await readdir(resolve(root, base), { withFileTypes: true })) {
    const path = base ? `${base}/${item.name}` : item.name
    const full = resolve(root, path)
    const info = await lstat(full)
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
      throw new Error(`asset_not_regular:${path}`)
    if (allowAssetQuickReadInstaller && path === assetQuickReadInstallerPath.slice(1)) {
      await verifyBundledAssetQuickReadInstaller(full)
      continue
    }
    if (forbidden(path, info.isDirectory())) throw new Error(`non_distribution_file:${path}`)
    if (info.isDirectory())
      result.push(...(await inventory(root, path, allowAssetQuickReadInstaller)))
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
export async function inspectDist(
  dist,
  { allowScannerTemplate = false, allowAssetQuickReadInstaller = false, origin } = {},
) {
  const root = resolve(dist)
  if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink())
    throw new Error('dist_must_be_real_directory')
  const files = await inventory(root, '', allowAssetQuickReadInstaller)
  const scannerFiles = [
    'downloads/Soda-Scanner-Bootstrap.cmd',
    'downloads/scanner-runtime-bootstrap.ps1',
    'downloads/scanner-runtime-pointer-store.ps1',
    'downloads/scanner-runtime-release.v1.json',
  ]
  const present = scannerFiles.filter((path) => files.some((file) => file.path === path))
  if (present.length && present.length !== scannerFiles.length)
    throw new Error('scanner_distribution_incomplete')
  if (present.length) {
    const command = await readFile(resolve(root, scannerFiles[0]), 'utf8')
    if (!allowScannerTemplate) {
      if (/__SODA_[A-Z0-9_]+__/u.test(command)) throw new Error('scanner_template_unresolved')
      const embeddedOrigin = command.match(/^set "ORIGIN=([^"]+)"\r?$/mu)?.[1]
      validatePublicOrigin(embeddedOrigin)
      if (origin && embeddedOrigin !== validatePublicOrigin(origin))
        throw new Error('scanner_public_origin_mismatch')
      if (!command.includes('if not "%ORIGIN:~0,8%"=="https://" ('))
        throw new Error('scanner_origin_guard_invalid')
      for (const path of scannerFiles.slice(1)) {
        const file = files.find((item) => item.path === path)
        if (!command.includes(file.sha256)) throw new Error(`scanner_hash_pin_mismatch:${path}`)
      }
    } else if (!command.includes('__SODA_PUBLIC_ORIGIN__')) {
      throw new Error('scanner_source_must_be_template')
    }
  }
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
  const digests = new Map(files.map((file) => [`/${file.path}`, file.sha256]))
  for (const path of manifest.criticalAssets) {
    const expected = manifest.criticalAssetSha256?.[path]
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/u.test(expected))
      throw new Error(`critical_asset_digest_missing:${path}`)
    if (digests.get(path) !== expected) throw new Error(`critical_asset_digest_mismatch:${path}`)
  }
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
export async function prepare({
  dist,
  out,
  accountId,
  name = 'app',
  origin,
  usageStatistics = false,
  scanFeedback = false,
  scanFeedbackNamespaceId,
  customDomain,
}) {
  if (!dist || !out) throw new Error('dist_and_out_required')
  if (origin === 'https://app.sodaterminal.workers.dev') throw new Error('public_origin_retired')
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/u.test(name)) throw new Error('worker_name_invalid')
  if (accountId && !/^[a-f0-9]{32}$/u.test(accountId)) throw new Error('account_id_invalid')
  if (typeof usageStatistics !== 'boolean') throw new Error('usage_statistics_flag_invalid')
  if (usageStatistics && origin !== 'https://sodaterminal.com')
    throw new Error('usage_statistics_requires_production_origin')
  if (typeof scanFeedback !== 'boolean') throw new Error('scan_feedback_flag_invalid')
  if (scanFeedback) {
    if (
      typeof scanFeedbackNamespaceId !== 'string' ||
      !/^[a-f0-9]{32}$/u.test(scanFeedbackNamespaceId)
    )
      throw new Error('scan_feedback_namespace_id_invalid')
    if (!scanFeedbackContract.origins.includes(origin))
      throw new Error('scan_feedback_requires_allowed_origin')
  } else if (scanFeedbackNamespaceId !== undefined) {
    throw new Error('scan_feedback_flag_required_with_namespace_id')
  }
  if (
    customDomain !== undefined &&
    (customDomain !== 'sodaterminal.com' || origin !== `https://${customDomain}`)
  )
    throw new Error('custom_domain_requires_approved_origin')
  const input = resolve(dist),
    output = resolve(out)
  if (within(output, input) || within(input, output) || within(output, here))
    throw new Error('output_overlaps_input_or_tools')
  if (!validAssetQuickReadRelease()) throw new Error('asset_quick_read_release_invalid')
  const report = await inspectDist(input, {
    allowScannerTemplate: true,
    allowAssetQuickReadInstaller: true,
  })
  if (report.files.some((file) => file.path === 'downloads/Soda-Scanner-Bootstrap.cmd'))
    validatePublicOrigin(origin)
  const config = JSON.parse(await readFile(resolve(here, 'wrangler.template.json'), 'utf8'))
  const staticHeaders = await readFile(resolve(here, 'static-headers.txt'), 'utf8')
  config.name = name
  if (!config.assets.run_worker_first.includes(assetQuickReadInstallerPath))
    config.assets.run_worker_first.push(assetQuickReadInstallerPath)
  if (customDomain) config.routes = [{ pattern: customDomain, custom_domain: true }]
  if (accountId) config.account_id = accountId
  config.vars = { SODA_RELEASE_ID: report.releaseId }
  if (usageStatistics) {
    config.vars.SODA_USAGE_STATISTICS = 'enabled'
    config.vars.SODA_PUBLIC_ORIGIN = origin
  }
  if (scanFeedback) {
    config.vars.SODA_SCAN_FEEDBACK = 'enabled'
    config.vars.SODA_PUBLIC_ORIGIN = origin
    config.kv_namespaces = [
      {
        binding: scanFeedbackContract.storageBinding,
        id: scanFeedbackNamespaceId,
      },
    ]
  }
  config.observability = {
    enabled: usageStatistics,
    logs: { enabled: usageStatistics, invocation_logs: false, head_sampling_rate: 1 },
    traces: { enabled: false },
  }
  await mkdir(dirname(output), { recursive: true })
  // Exclusive destination: never overwrite a previous candidate.
  await mkdir(output)
  try {
    await cp(input, resolve(output, 'web'), {
      recursive: true,
      errorOnExist: true,
      force: false,
      filter: (source) =>
        relative(input, source).split(sep).join('/') !== assetQuickReadInstallerPath.slice(1),
    })
    // Recheck the copied tree rather than assume input stayed unchanged during copy.
    const web = resolve(output, 'web')
    const copied = await inspectDist(web, { allowScannerTemplate: true })
    if (copied.inventorySha256 !== report.inventorySha256)
      throw new Error('dist_changed_during_copy')
    if (report.files.some((file) => file.path === 'downloads/Soda-Scanner-Bootstrap.cmd'))
      await materializeScannerDistribution({
        origin,
        templateRoot: resolve(input, 'downloads'),
        output: resolve(web, 'downloads'),
      })
    const headersPath = resolve(web, '_headers')
    try {
      const existing = await readFile(headersPath, 'utf8')
      if (existing !== staticHeaders) throw new Error('static_headers_conflict')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      await writeFile(headersPath, staticHeaders, { flag: 'wx' })
    }
    const upload = await inspectDist(web, { origin })
    const packagedReport = {
      ...upload,
      sourceInventorySha256: report.inventorySha256,
      staticHeadersSha256: hash(staticHeaders),
      assetQuickReadInstallerProxy: {
        path: assetQuickReadInstallerPath,
        url: assetQuickReadInstallerUrl,
        size: assetQuickReadInstallerRelease.size,
        sha256: assetQuickReadInstallerRelease.sha256,
      },
    }
    // Preserve module-relative imports and copy only the edge's reviewed policy and scanner contract dependencies.
    for (const path of [
      'deploy/cloudflare/edge.mjs',
      'deploy/cloudflare/scan-feedback.mjs',
      'deploy/cloudflare/scanner-installer.mjs',
      'deploy/cloudflare/asset-quick-read-installer.mjs',
      'deploy/cloudflare/asset-quick-read-release.mjs',
      'src/assetQuickRead/releaseManifest.json',
      'public/downloads/scanner-installer-release.v1.json',
      'src/assets/reviewed32-media-urls.json',
      'src/scanner/scanFeedback.contract.json',
    ]) {
      await mkdir(dirname(resolve(output, path)), { recursive: true })
      await cp(resolve(here, '../..', path), resolve(output, path), {
        errorOnExist: true,
        force: false,
      })
    }
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
    for (let i = 0; i < args.length; ) {
      if (args[i] === '--usage-statistics') {
        if (options.usageStatistics) throw new Error('duplicate_usage_statistics_flag')
        options.usageStatistics = true
        i += 1
        continue
      }
      if (args[i] === '--scan-feedback') {
        if (options.scanFeedback) throw new Error('duplicate_scan_feedback_flag')
        options.scanFeedback = true
        i += 1
        continue
      }
      if (args[i] === '--scan-feedback-namespace-id') {
        if (options.scanFeedbackNamespaceId)
          throw new Error('duplicate_scan_feedback_namespace_id_flag')
        if (!args[i + 1] || args[i + 1].startsWith('--'))
          throw new Error('scan_feedback_namespace_id_missing')
        options.scanFeedbackNamespaceId = args[i + 1]
        i += 2
        continue
      }
      if (
        !['--dist', '--out', '--account-id', '--name', '--origin', '--custom-domain'].includes(
          args[i],
        ) ||
        !args[i + 1] ||
        args[i + 1].startsWith('--')
      )
        throw new Error(
          'usage: --dist <browser-dist> --out <new-directory> [--account-id <id>] [--name <name>] [--origin <https-origin>] [--usage-statistics] [--custom-domain sodaterminal.com] [--scan-feedback] [--scan-feedback-namespace-id <32-hex-id>]',
        )
      const key =
        args[i] === '--account-id'
          ? 'accountId'
          : args[i] === '--custom-domain'
            ? 'customDomain'
            : args[i].slice(2)
      options[key] = args[i + 1]
      i += 2
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
