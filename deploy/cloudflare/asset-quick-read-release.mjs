import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
export const assetQuickReadInstallerUrl =
  'https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read/releases/download/v1.0.4/SodaTerminal-AssetReader-Setup-1.0.4.exe'
/** One independently published release, shared with the browser download checksum. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.version === '1.0.4' &&
    manifest.releaseTag === 'v1.0.4' &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.fileName === 'SodaTerminal-AssetReader-Setup-1.0.4.exe' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    manifest.size === 99018813 &&
    manifest.sha256 === 'e483ce0adfa2cb7ee206b1ab2757cdff8fb2f7be89d6f0b950eb19cfb1ce9598'
  )
}
