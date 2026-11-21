import type { prepareAssetSnapshotExport } from '../assetQuickRead/snapshotRecovery'

/** Download only the already-whitelisted candidate, including pending-version exports. */
export function downloadAssetQuickReadSnapshot(
  safeExport: ReturnType<typeof prepareAssetSnapshotExport>,
) {
  if (!safeExport) return
  const safe = safeExport.snapshot
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeExport.pendingUpdate
    ? 'soda-asset-quick-read-pending-update.json'
    : 'soda-asset-quick-read.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
