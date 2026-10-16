import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.4/SodaTerminal-AssetReader-Setup-1.1.4.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.4' &&
    manifest.bridgeVersion === '1.0.10' &&
    manifest.releaseTag === 'v1.1.4' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.4.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99358244 &&
    manifest.sha256 === 'aabee3aa3d6f3ca35129a803c1bb7eaeb58c03a9c9aa67bbdf8cb501e2df865a'
  )
}
