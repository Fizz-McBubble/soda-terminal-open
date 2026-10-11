import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.5/SodaTerminal-AssetReader-Setup-1.0.5.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.5' &&
    manifest.releaseTag === 'v1.0.5' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.5.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99001931 &&
    manifest.sha256 === 'a58f77a70110301fdda801e3ebba936ffd8df75a1ba6a3ef6176986a30904893'
  )
}
