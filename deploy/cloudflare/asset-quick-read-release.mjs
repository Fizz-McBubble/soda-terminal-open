import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.6/SodaTerminal-AssetReader-Setup-1.1.6.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.6' &&
    manifest.bridgeVersion === '1.0.10' &&
    manifest.releaseTag === 'v1.1.6' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.6.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99376961 &&
    manifest.sha256 === '66acbfaff70f199e396ff7900eda0fcd49eb1283b004f7f0de2918dbbd534d6b'
  )
}
