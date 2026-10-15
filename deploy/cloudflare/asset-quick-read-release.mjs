import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.1/SodaTerminal-AssetReader-Setup-1.1.1.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.1' &&
    manifest.bridgeVersion === '1.0.7' &&
    manifest.releaseTag === 'v1.1.1' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.1.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 186844149 &&
    manifest.sha256 === 'e81486b4a2ff1d32268f7befc4a176bf1c57bc5aaf35c34e42d8b9223c8962ca'
  )
}
