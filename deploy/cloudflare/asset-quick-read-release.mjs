import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.0/Soda-Asset-Quick-Read-Setup-1.0.0.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.0' &&
    manifest.releaseTag === 'v1.0.0' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'Soda-Asset-Quick-Read-Setup-1.0.0.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 117896485 &&
    manifest.sha256 === 'f5bf32058f813c8677a4b1dfb54a836eded219483afe5589032d4b0ddd544b5e'
  )
}
