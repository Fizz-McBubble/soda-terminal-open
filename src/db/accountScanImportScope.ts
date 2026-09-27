import type { SodaDatabase } from './databaseCore'
import type { AccountScanImportBatch, AccountScanImportItem } from '../accounts/types'
import { resolveScanBatchManifest } from '../domain/scanImportStaging'

export function assertActiveAccountScope(accountId: string, db: SodaDatabase) {
  return db.settings.get('active-account-id').then((setting) => {
    if (setting?.value !== accountId) throw new Error('当前活动账号已变化，请返回账号范围后重试。')
  })
}

export function assertReadyScanReview(
  batch: AccountScanImportBatch,
  items: AccountScanImportItem[],
  options: { requireArmed: boolean; errorMessage: (expectedTotal: number) => string },
) {
  const { manifest } = resolveScanBatchManifest(batch, items, { allowLegacy343: true })
  if (
    items.length !== manifest.expectedTotal ||
    new Set(items.map((item) => item.sourceIdentity)).size !== manifest.expectedTotal ||
    items.some(
      (item) =>
        item.state !== 'ready' ||
        item.duplicate ||
        !item.evidence.detailPath ||
        !item.evidence.visualDetailHash,
    ) ||
    batch.reviewState.preflight !== 'complete' ||
    batch.reviewState.preflightRevision !== batch.reviewState.revision ||
    (options.requireArmed && batch.reviewState.armedRevision !== batch.reviewState.revision)
  )
    throw new Error(options.errorMessage(manifest.expectedTotal))
  return manifest
}
