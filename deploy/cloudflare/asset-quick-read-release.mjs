import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.0/SodaTerminal-AssetReader-Setup-1.1.0.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.0' &&
    manifest.releaseTag === 'v1.1.0' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.0.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99092775 &&
    manifest.sha256 === '83de6c8644e5b5a038ca3b69486ed21bf26bc4409173ad1adcc88c1a356fe831'
  )
}
