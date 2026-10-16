import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.5/SodaTerminal-AssetReader-Setup-1.1.5.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.5' &&
    manifest.bridgeVersion === '1.0.10' &&
    manifest.releaseTag === 'v1.1.5' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.5.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99393050 &&
    manifest.sha256 === 'de2681088a0ab3a6957e06e7dcc7b1b556ab9e8b4e74a1b04db31ecd1223bb8d'
  )
}
