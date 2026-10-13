import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.10/SodaTerminal-AssetReader-Setup-1.0.10.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.10' &&
    manifest.releaseTag === 'v1.0.10' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.10.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99157594 &&
    manifest.sha256 === 'e4c624e35636e86ca5ddaadbf4cbe9634d9b282588d7930e6cabf41414258499'
  )
}
