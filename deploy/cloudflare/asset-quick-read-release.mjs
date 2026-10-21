import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.2.0/SodaTerminal-AssetReader-Setup-1.2.0.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.2.0' &&
    manifest.bridgeVersion === '1.1.0' &&
    manifest.releaseTag === 'v1.2.0' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.2.0.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 100172302 &&
    manifest.sha256 === '7ac9c27ba9ad47c72fba214ec8f4209d9803a13d5b8372b579c4bad96c55f435'
  )
}
