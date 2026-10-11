import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.2/SodaTerminal-AssetReader-Setup-1.0.2.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.2' &&
    manifest.releaseTag === 'v1.0.2' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.2.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 98819797 &&
    manifest.sha256 === 'a3411806afb2b8c81e594fbf173844eee281697eae68cc129adb171534ee42eb'
  )
}
