import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.8/SodaTerminal-AssetReader-Setup-1.0.8.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.8' &&
    manifest.releaseTag === 'v1.0.8' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.8.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99073167 &&
    manifest.sha256 === 'b53a9f1c118ac46156b40ca64ed19e7917382fea9e14387767d9ee4a21f83964'
  )
}
