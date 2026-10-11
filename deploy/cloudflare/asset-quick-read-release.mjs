import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.7/SodaTerminal-AssetReader-Setup-1.0.7.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.7' &&
    manifest.releaseTag === 'v1.0.7' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.7.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99000315 &&
    manifest.sha256 === '7270f699ce2941144c47d22fc3cfea41ea22552b9cc7ca228670ed9a7af39fea'
  )
}
