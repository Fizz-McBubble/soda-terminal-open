import {
  downloadScannerInstaller,
  installerDownloadMaximumSize,
  waitForAbortable,
} from '../scanner/installerDownload'
import { assetQuickReadDownloadAvailable, type AssetQuickReadRelease } from './distribution'

export const assetQuickReadInstallerReleaseUrl = '/downloads/asset-quick-read-release.v1.json'
const maximumManifestBytes = 4096
const manifestKeys = new Set([
  'available',
  'version',
  'bridgeVersion',
  'fileName',
  'releaseTag',
  'repo',
  'downloadUrl',
  'size',
  'sha256',
])

export function parseAssetQuickReadInstallerRelease(value: unknown): AssetQuickReadRelease {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_asset_quick_read_release')
  const release = value as Record<string, unknown>
  const keys = Object.keys(release)
  if (
    keys.some((key) => !manifestKeys.has(key)) ||
    [
      'available',
      'version',
      'fileName',
      'releaseTag',
      'repo',
      'downloadUrl',
      'size',
      'sha256',
    ].some((key) => !Object.hasOwn(release, key)) ||
    typeof release.available !== 'boolean' ||
    typeof release.version !== 'string' ||
    typeof release.fileName !== 'string' ||
    typeof release.releaseTag !== 'string' ||
    typeof release.repo !== 'string' ||
    typeof release.downloadUrl !== 'string' ||
    typeof release.size !== 'number' ||
    typeof release.sha256 !== 'string' ||
    (Object.hasOwn(release, 'bridgeVersion') && typeof release.bridgeVersion !== 'string')
  )
    throw new Error('invalid_asset_quick_read_release')
  const candidate: AssetQuickReadRelease = {
    available: release.available,
    version: release.version,
    ...(typeof release.bridgeVersion === 'string' ? { bridgeVersion: release.bridgeVersion } : {}),
    fileName: release.fileName,
    releaseTag: release.releaseTag,
    repo: release.repo,
    downloadUrl: release.downloadUrl,
    size: release.size,
    sha256: release.sha256.toLowerCase(),
  }
  if (
    !assetQuickReadDownloadAvailable(candidate) ||
    candidate.size === null ||
    candidate.size > installerDownloadMaximumSize ||
    !/^[a-f0-9]{64}$/u.test(candidate.sha256 ?? '')
  )
    throw new Error('invalid_asset_quick_read_release')
  return candidate
}

/** Resolve the current Worker deployment so an old tab cannot reuse stale package identity. */
export async function readAssetQuickReadInstallerRelease(
  signal: AbortSignal,
): Promise<AssetQuickReadRelease> {
  signal.throwIfAborted()
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(60_000)])
  const responsePromise = fetch(assetQuickReadInstallerReleaseUrl, {
    credentials: 'omit',
    cache: 'no-store',
    mode: 'same-origin',
    redirect: 'error',
    signal: requestSignal,
  })
  void responsePromise.then(
    (response) => {
      if (requestSignal.aborted) void response.body?.cancel().catch(() => {})
    },
    () => {},
  )
  const response = await waitForAbortable(responsePromise, requestSignal)
  requestSignal.throwIfAborted()
  const contentLength = response.headers.get('content-length')
  if (
    !response.ok ||
    response.redirected ||
    (contentLength !== null &&
      (!/^\d+$/u.test(contentLength) || Number(contentLength) > maximumManifestBytes))
  )
    throw new Error('asset_quick_read_release_unavailable')
  const text = await waitForAbortable(response.text(), requestSignal)
  requestSignal.throwIfAborted()
  if (new TextEncoder().encode(text).byteLength > maximumManifestBytes)
    throw new Error('invalid_asset_quick_read_release')
  return parseAssetQuickReadInstallerRelease(JSON.parse(text))
}

export async function downloadAssetQuickReadInstaller({
  release,
  ...options
}: Omit<
  Parameters<typeof downloadScannerInstaller>[0],
  'url' | 'fileName' | 'expectedSize' | 'expectedSha256'
> & {
  release: AssetQuickReadRelease
}) {
  if (!assetQuickReadDownloadAvailable(release))
    throw new Error('asset_quick_read_release_unavailable')
  return downloadScannerInstaller({
    ...options,
    url: release.downloadUrl,
    fileName:
      release.version === '1.0.0' ? `Soda-资产快读-${release.version}.exe` : release.fileName,
    expectedSize: release.size!,
    expectedSha256: release.sha256!,
  })
}
