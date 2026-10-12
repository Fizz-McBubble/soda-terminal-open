import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.9/SodaTerminal-AssetReader-Setup-1.0.9.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.9' &&
    manifest.releaseTag === 'v1.0.9' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.9.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99148789 &&
    manifest.sha256 === '4622c2ad2f643f72a5bedab20893475534ec173938f443ac5bc363242042de12'
  )
}
