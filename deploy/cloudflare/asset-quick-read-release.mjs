import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.3/SodaTerminal-AssetReader-Setup-1.0.3.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.3' &&
    manifest.releaseTag === 'v1.0.3' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.3.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 98888907 &&
    manifest.sha256 === '2caeff5c865a8f415b224634fb77e4060390ba739fb214c9e15d348ebf5c1823'
  )
}
