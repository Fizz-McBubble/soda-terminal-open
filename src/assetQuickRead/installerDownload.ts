import { downloadScannerInstaller } from '../scanner/installerDownload'
import {
  assetQuickReadDownloadAvailable,
  assetQuickReadRelease,
  type AssetQuickReadRelease,
} from './distribution'
export async function downloadAssetQuickReadInstaller({
  release = assetQuickReadRelease,
  ...options
}: Omit<
  Parameters<typeof downloadScannerInstaller>[0],
  'url' | 'fileName' | 'expectedSize' | 'expectedSha256'
> & {
  release?: AssetQuickReadRelease
}) {
  if (!assetQuickReadDownloadAvailable(release))
    throw new Error('asset_quick_read_release_unavailable')
  return downloadScannerInstaller({
    ...options,
    url: release.downloadUrl,
    fileName: `Soda-资产快读-${release.version}.exe`,
    expectedSize: release.size!,
    expectedSha256: release.sha256!,
  })
}
