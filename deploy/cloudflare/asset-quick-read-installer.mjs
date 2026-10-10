import { createPinnedInstallerDownload } from './scanner-installer.mjs'
import {
  assetQuickReadInstallerRelease,
  assetQuickReadInstallerUrl,
  validAssetQuickReadRelease,
} from './asset-quick-read-release.mjs'
export { assetQuickReadInstallerPath } from './asset-quick-read-release.mjs'

/** No full-package buffer: reuse the reviewed OCR range and streaming engine. */
export function createAssetQuickReadInstallerDownload({
  manifest = assetQuickReadInstallerRelease,
  ...options
} = {}) {
  return createPinnedInstallerDownload({
    ...options,
    manifest: { ...manifest, assetUrl: assetQuickReadInstallerUrl },
    validateManifest: () => validAssetQuickReadRelease(manifest),
    fileName: manifest.fileName,
    downloadName: `Soda-资产快读-${manifest.version}.exe`,
  })
}
