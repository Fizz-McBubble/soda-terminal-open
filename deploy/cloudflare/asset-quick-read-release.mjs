import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.1.7/SodaTerminal-AssetReader-Setup-1.1.7.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.1.7' &&
    manifest.bridgeVersion === '1.0.11' &&
    manifest.releaseTag === 'v1.1.7' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.1.7.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99374821 &&
    manifest.sha256 === '11593ee97c07526493f4e2bcd0e0dc47e31be5366bc60d27fba3c14b7bb7d623'
  )
}
