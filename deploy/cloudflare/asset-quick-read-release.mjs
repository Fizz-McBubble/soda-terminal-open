import release from '../../src/assetQuickRead/releaseManifest.json' with { type: 'json' }

const pinnedReleases = [
  {
    version: '1.2.0',
    bridgeVersion: '1.1.0',
    releaseTag: 'v1.2.0',
    fileName: 'SodaTerminal-AssetReader-Setup-1.2.0.exe',
    size: 100172302,
    sha256: '7ac9c27ba9ad47c72fba214ec8f4209d9803a13d5b8372b579c4bad96c55f435',
  },
  {
    version: '1.2.1',
    bridgeVersion: '1.1.1',
    releaseTag: 'v1.2.1',
    fileName: 'SodaTerminal-AssetReader-Setup-1.2.1.exe',
    size: 100259344,
    sha256: '9e4c878f5edb1b96b14e05eb9b1f3a1429718bb3babbf8a7ab83533e4e4e12fd',
  },
]

export const assetQuickReadInstallerPath = '/downloads/Soda-Asset-Quick-Read-Setup.exe'
export const assetQuickReadInstallerRelease = release
/** Accept only complete reviewed identities; the manifest still selects the active release. */
export function validAssetQuickReadRelease(manifest = release) {
  return (
    manifest?.available === true &&
    manifest.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    manifest.downloadUrl === assetQuickReadInstallerPath &&
    pinnedReleases.some(
      (pin) =>
        manifest.version === pin.version &&
        manifest.bridgeVersion === pin.bridgeVersion &&
        manifest.releaseTag === pin.releaseTag &&
        manifest.fileName === pin.fileName &&
        manifest.size === pin.size &&
        manifest.sha256 === pin.sha256,
    )
  )
}

export function resolveAssetQuickReadInstallerUrl(manifest = release) {
  if (!validAssetQuickReadRelease(manifest)) return null
  return `https://github.com/${manifest.repo}/releases/download/${manifest.releaseTag}/${manifest.fileName}`
}

export const assetQuickReadInstallerUrl = resolveAssetQuickReadInstallerUrl()
