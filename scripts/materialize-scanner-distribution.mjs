import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'downloads')
const files = [
  'scanner-runtime-bootstrap.ps1',
  'scanner-runtime-pointer-store.ps1',
  'scanner-runtime-release.v1.json',
]
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const pinnedScannerAssetUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.6/soda-scanner-runtime-18-rc6-win-x64.zip'
export const pinnedScannerAssetUrlRc7 =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.7/soda-scanner-runtime-18-rc7-win-x64.zip'
export const pinnedScannerAssetUrlRc8 =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8/soda-scanner-runtime-18-rc8-win-x64.zip'
export const pinnedScannerAssetUrlRc81 =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.1/soda-scanner-runtime-18-rc8-1-win-x64.zip'
export const pinnedScannerAssetUrlRc82 =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.2/soda-scanner-runtime-18-rc8-2-win-x64.zip'
export const pinnedScannerAssetUrlRc83 =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.3/soda-scanner-runtime-18-rc8-3-win-x64.zip'
export const pinnedScannerAssetUrlRc84 =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.4/soda-scanner-runtime-18-rc8-4-win-x64.zip'
export const pinnedScannerAssetUrlRc85 =
  'https://github.com/Fizz-McBubble/soda-terminal-scanner/releases/download/scanner-runtime-v18.0.0-rc.8.5/soda-scanner-runtime-18-rc8-5-win-x64.zip'

export function scannerAssetLocation(manifest) {
  if (typeof manifest?.assetName !== 'string' || !/^[A-Za-z0-9._-]+\.zip$/.test(manifest.assetName))
    throw new Error('scanner_release_asset_invalid')
  if (manifest.assetUrl === `/downloads/${manifest.assetName}`) return 'same-origin'
  if (
    manifest.assetUrl === pinnedScannerAssetUrl &&
    manifest.assetName === 'soda-scanner-runtime-18-rc6-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.6'
  )
    return 'github-release'
  if (
    manifest.assetUrl === pinnedScannerAssetUrlRc7 &&
    manifest.assetName === 'soda-scanner-runtime-18-rc7-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.7'
  )
    return 'github-release'
  if (
    manifest.assetUrl === pinnedScannerAssetUrlRc8 &&
    manifest.assetName === 'soda-scanner-runtime-18-rc8-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.8'
  )
    return 'github-release'
  if (
    manifest.assetUrl === pinnedScannerAssetUrlRc81 &&
    manifest.assetName === 'soda-scanner-runtime-18-rc8-1-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.8.1'
  )
    return 'github-release'
  if (
    manifest.assetUrl === pinnedScannerAssetUrlRc82 &&
    manifest.assetName === 'soda-scanner-runtime-18-rc8-2-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.8.2'
  )
    return 'github-release'
  if (
    manifest.assetUrl === pinnedScannerAssetUrlRc83 &&
    manifest.assetName === 'soda-scanner-runtime-18-rc8-3-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.8.3'
  )
    return 'github-release'
  if (
    manifest.assetUrl === pinnedScannerAssetUrlRc84 &&
    manifest.assetName === 'soda-scanner-runtime-18-rc8-4-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.8.4'
  )
    return 'github-release'
  if (
    manifest.assetUrl === pinnedScannerAssetUrlRc85 &&
    manifest.assetName === 'soda-scanner-runtime-18-rc8-5-win-x64.zip' &&
    manifest.releaseTag === 'scanner-runtime-v18.0.0-rc.8.5'
  )
    return 'github-release'
  throw new Error('scanner_release_asset_invalid')
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export function validatePublicOrigin(value) {
  if (typeof value !== 'string') throw new Error('scanner_public_origin_required')
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('scanner_public_origin_invalid')
  }
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.origin !== value
  )
    throw new Error('scanner_public_origin_invalid')
  return value
}

export async function materializeScannerDistribution({
  origin,
  output,
  templateRoot = source,
  assetPath,
}) {
  validatePublicOrigin(origin)
  if (!output) throw new Error('scanner_output_required')
  const destination = resolve(output)
  const input = resolve(templateRoot)
  if (destination === input || destination.startsWith(`${input}${sep}`))
    throw new Error('scanner_output_must_not_replace_template')
  const [template, ...payloads] = await Promise.all([
    readFile(join(templateRoot, 'Soda-Scanner-Bootstrap.cmd'), 'utf8'),
    ...files.map((name) => readFile(join(templateRoot, name))),
  ])
  const manifest = JSON.parse(payloads[2].toString('utf8'))
  let assetLocation
  try {
    assetLocation = scannerAssetLocation(manifest)
  } catch {
    throw new Error('scanner_release_template_invalid')
  }
  if (
    !['not_published', 'published'].includes(manifest.releaseState) ||
    !Number.isSafeInteger(manifest.size) ||
    manifest.size <= 0 ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    manifest.accountWriteEnabled !== false ||
    manifest.importAccess !== false
  )
    throw new Error('scanner_release_template_invalid')
  let archiveSource
  if (assetPath) {
    if (assetLocation !== 'same-origin')
      throw new Error('scanner_external_archive_must_not_be_bundled')
    archiveSource = resolve(assetPath)
    if (basename(archiveSource) !== manifest.assetName)
      throw new Error('scanner_runtime_archive_name_mismatch')
    const archiveInfo = await stat(archiveSource)
    if (
      !archiveInfo.isFile() ||
      archiveInfo.size !== manifest.size ||
      (await sha256File(archiveSource)) !== manifest.sha256
    )
      throw new Error('scanner_runtime_archive_mismatch')
  }
  const values = new Map([
    ['__SODA_PUBLIC_ORIGIN__', origin],
    ['__SODA_BOOTSTRAP_SHA256__', sha256(payloads[0])],
    ['__SODA_POINTER_SHA256__', sha256(payloads[1])],
    ['__SODA_MANIFEST_SHA256__', sha256(payloads[2])],
  ])
  let command = template
  for (const [token, value] of values) {
    if (!command.includes(token)) throw new Error(`scanner_template_token_missing:${token}`)
    command = command.replaceAll(token, value)
  }
  if (/__SODA_[A-Z0-9_]+__/.test(command)) throw new Error('scanner_template_token_unresolved')
  const commandBytes = Buffer.from(`${command.trimEnd().replaceAll(/\r?\n/g, '\r\n')}\r\n`, 'utf8')
  const archiveTarget = archiveSource ? join(destination, manifest.assetName) : null
  if (archiveSource === archiveTarget) throw new Error('scanner_runtime_archive_source_is_target')
  await mkdir(destination, { recursive: true })
  await Promise.all(files.map((name, index) => writeFile(join(destination, name), payloads[index])))
  await writeFile(join(destination, 'Soda-Scanner-Bootstrap.cmd'), commandBytes)
  if (archiveSource) {
    await copyFile(archiveSource, archiveTarget, constants.COPYFILE_EXCL)
    if (
      (await stat(archiveTarget)).size !== manifest.size ||
      (await sha256File(archiveTarget)) !== manifest.sha256
    )
      throw new Error('scanner_runtime_archive_copy_mismatch')
  }
  return {
    origin,
    releaseState: manifest.releaseState,
    commandSha256: sha256(commandBytes),
    commandSize: commandBytes.length,
    bootstrapSha256: sha256(payloads[0]),
    pointerSha256: sha256(payloads[1]),
    manifestSha256: sha256(payloads[2]),
    assetName: archiveSource ? manifest.assetName : null,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const value = (key) => args[args.indexOf(key) + 1]
  if (args.length !== 4 || !args.includes('--origin') || !args.includes('--output'))
    throw new Error('usage: --origin https://domain.example --output <dist/downloads>')
  console.log(
    JSON.stringify(
      await materializeScannerDistribution({
        origin: value('--origin'),
        output: value('--output'),
        assetPath: process.env.SODA_SCANNER_ASSET_PATH,
      }),
    ),
  )
}
