import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat } from 'node:fs/promises'
import {
  assetQuickReadInstallerRelease,
  validAssetQuickReadRelease,
} from './asset-quick-read-release.mjs'

/** Build output may contain a verified local copy, but Workers serves this release through the proxy. */
export async function verifyBundledAssetQuickReadInstaller(path) {
  const release = assetQuickReadInstallerRelease
  if (!validAssetQuickReadRelease(release)) throw new Error('asset_quick_read_release_invalid')
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error('asset_quick_read_installer_not_regular')
  if (info.size !== release.size) throw new Error('asset_quick_read_installer_size_mismatch')
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of createReadStream(path)) {
    size += chunk.length
    hash.update(chunk)
  }
  if (size !== release.size || hash.digest('hex') !== release.sha256)
    throw new Error('asset_quick_read_installer_hash_mismatch')
}
