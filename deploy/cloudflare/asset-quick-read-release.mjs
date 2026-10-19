import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.8/SodaTerminal-AssetReader-Setup-1.1.8.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.8' &&
    manifest.bridgeVersion === '1.0.11' &&
    manifest.releaseTag === 'v1.1.8' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.8.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 100113234 &&
    manifest.sha256 === '85047e8a623389bc93f902fb251a6abd2641bb0cdd5293e073df5b5fe9f6648b'
  )
}
