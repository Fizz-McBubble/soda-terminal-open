import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.1/SodaTerminal-AssetReader-Setup-1.0.1.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.1' &&
    manifest.releaseTag === 'v1.0.1' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.1.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 97635200 &&
    manifest.sha256 === '366d2010756390166eaec2a37c42416b02031e0072b030621124f7cba9e34dce'
  )
}
