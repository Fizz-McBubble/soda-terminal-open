import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.3/SodaTerminal-AssetReader-Setup-1.1.3.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.3' &&
    manifest.bridgeVersion === '1.0.9' &&
    manifest.releaseTag === 'v1.1.3' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.3.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99301909 &&
    manifest.sha256 === '0665bac22e069c155b4d9ab45a3865c6bfb807c862eaab8a37e4982d669454fb'
  )
}
