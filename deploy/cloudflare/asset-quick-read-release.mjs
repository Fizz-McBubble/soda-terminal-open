import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.2/SodaTerminal-AssetReader-Setup-1.1.2.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.2' &&
    manifest.bridgeVersion === '1.0.8' &&
    manifest.releaseTag === 'v1.1.2' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.2.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99261439 &&
    manifest.sha256 === 'e5c4498ba68f6289b494e8cc866c8fd92e3b34d0b7c4c17dcc789e790603ab34'
  )
}
