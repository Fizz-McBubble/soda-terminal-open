import manifest from './releaseManifest.json'
export type AssetQuickReadRelease = {
  available: boolean
  version: string
  fileName: string
  releaseTag: string
  repo: string
  downloadUrl: string
  size: number | null
  sha256: string | null
}
export const assetQuickReadRelease: AssetQuickReadRelease = manifest
export function assetQuickReadDownloadAvailable(
  release: AssetQuickReadRelease = assetQuickReadRelease,
) {
  return (
    release.available &&
    ((release.version === '1.0.0' &&
      release.fileName === 'Soda-Asset-Quick-Read-Setup-1.0.0.exe') ||
      (release.version === '1.0.1' &&
        release.fileName === 'SodaTerminal-AssetReader-Setup-1.0.1.exe')) &&
    release.releaseTag === `v${release.version}` &&
    release.repo === 'Fizz-McBubble/soda-terminal-asset-quick-read' &&
    release.downloadUrl === '/downloads/Soda-Asset-Quick-Read-Setup.exe' &&
    Number.isSafeInteger(release.size) &&
    (release.size ?? 0) >= 2 &&
    /^[a-fA-F0-9]{64}$/.test(release.sha256 ?? '')
  )
}
