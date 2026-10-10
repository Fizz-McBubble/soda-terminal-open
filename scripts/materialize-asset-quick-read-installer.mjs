import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile, link, copyFile, unlink, statfs, open } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { resolveBuildStorage } from './derived-build-storage.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

export async function materializeAssetQuickReadInstaller({
  manifest,
  output,
  stagingDirectory,
  sourcePath = process.env.SODA_ASSET_QUICK_READ_INSTALLER,
  fetchImpl = globalThis.fetch,
} = {}) {
  manifest ??= JSON.parse(
    await readFile(resolve(appRoot, 'src/assetQuickRead/releaseManifest.json'), 'utf8'),
  )
  if (!manifest.available) return { state: 'not_published' }
  if (
    manifest.version !== '1.0.0' ||
    manifest.releaseTag !== 'v1.0.0' ||
    manifest.repo !== 'Fizz-McBubble/soda-terminal-asset-quick-read' ||
    manifest.fileName !== 'Soda-Asset-Quick-Read-Setup-1.0.0.exe' ||
    manifest.downloadUrl !== '/downloads/Soda-Asset-Quick-Read-Setup.exe' ||
    !Number.isSafeInteger(manifest.size) ||
    manifest.size < 2 ||
    manifest.size > 256 * 1024 * 1024 ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256)
  )
    throw new Error('asset_installer_manifest_invalid')

  const cacheRoot =
    !output || (!stagingDirectory && !sourcePath)
      ? resolve(resolveBuildStorage(appRoot).derivedRoot, 'asset-quick-read/distribution')
      : undefined
  output ??= resolve(cacheRoot, manifest.releaseTag, 'Soda-Asset-Quick-Read-Setup.exe')
  stagingDirectory ??= sourcePath
    ? resolve(dirname(output), '.asset-installer-staging')
    : resolve(cacheRoot, 'verified')

  const verify = (bytes) => {
    if (bytes.length !== manifest.size) throw new Error('asset_installer_size_mismatch')
    if (createHash('sha256').update(bytes).digest('hex') !== manifest.sha256)
      throw new Error('asset_installer_sha256_mismatch')
  }
  try {
    const current = await readFile(output)
    verify(current)
    return { state: 'verified', path: output, size: current.length, sha256: manifest.sha256 }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  await mkdir(dirname(output), { recursive: true })
  const publishLink = async (source) => {
    try {
      // Refuse to overwrite an existing release, including during a concurrent build.
      await link(source, output)
    } catch (error) {
      if (error.code === 'EEXIST') verify(await readFile(output))
      else if (error.code === 'EXDEV') {
        // Honor the explicit destination on another disk, using an atomic local publish.
        const capacity = await statfs(dirname(output))
        if (capacity.bavail * capacity.bsize < manifest.size)
          throw new Error('asset_installer_output_space_insufficient')
        const temporary = resolve(dirname(output), `.asset-installer-${randomUUID()}.tmp`)
        let created = false
        try {
          const owned = await open(temporary, 'wx')
          created = true
          await owned.close()
          await copyFile(source, temporary)
          verify(await readFile(temporary))
          try {
            await link(temporary, output)
          } catch (publishError) {
            if (publishError.code !== 'EEXIST') throw publishError
            verify(await readFile(output))
          }
        } finally {
          if (created) await unlink(temporary)
        }
      } else throw error
    }
    return { state: 'materialized', path: output, size: manifest.size, sha256: manifest.sha256 }
  }
  if (sourcePath) {
    // A local release is reusable only after the same byte checks as a download.
    // Hard linking also prevents a second full copy on the build drive.
    verify(await readFile(sourcePath))
    return publishLink(sourcePath)
  }

  const response = await fetchImpl(
    `https://github.com/${manifest.repo}/releases/download/${manifest.releaseTag}/${manifest.fileName}`,
    { signal: AbortSignal.timeout(180000), credentials: 'omit' },
  )
  if (!response.ok || !response.body) throw new Error('asset_installer_download_failed')
  const finalUrl = new URL(response.url)
  if (
    finalUrl.protocol !== 'https:' ||
    finalUrl.username ||
    finalUrl.password ||
    ![
      'github.com',
      'release-assets.githubusercontent.com',
      'objects.githubusercontent.com',
    ].includes(finalUrl.hostname)
  )
    throw new Error('asset_installer_download_origin_invalid')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > manifest.size) throw new Error('asset_installer_size_mismatch')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  }
  const bytes = Buffer.concat(chunks)
  verify(bytes)
  await mkdir(stagingDirectory, { recursive: true })
  const staging = resolve(stagingDirectory, `${manifest.sha256}.exe`)
  try {
    await writeFile(staging, bytes, { flag: 'wx' })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    verify(await readFile(staging))
  }
  return publishLink(staging)
}

/** The development server exposes only the pinned installer, outside its source watcher. */
export function assetQuickReadInstallerMiddleware(options = {}) {
  let release
  return async (request, response, next) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')
    if (requestUrl.pathname !== '/downloads/Soda-Asset-Quick-Read-Setup.exe') {
      next()
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }).end()
      return
    }
    try {
      release ??= materializeAssetQuickReadInstaller(options)
      const current = await release
      if (!current.path) {
        response.writeHead(503, { 'cache-control': 'no-store' }).end('installer_not_published')
        return
      }
      response.writeHead(200, {
        'content-type': 'application/octet-stream',
        'content-length': String(current.size),
        'content-disposition': 'attachment; filename="Soda-Asset-Quick-Read-Setup-1.0.0.exe"',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      if (request.method === 'HEAD') response.end()
      else await pipeline(createReadStream(current.path), response)
    } catch {
      release = undefined
      if (!response.headersSent)
        response.writeHead(503, { 'cache-control': 'no-store' }).end('installer_unavailable')
      else response.destroy()
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await materializeAssetQuickReadInstaller()))
