import { contentHash } from '../application/contentHash'
import { getScopedId } from '../accounts/types'
import { assertActiveAccountScope } from '../db/accountScanImportScope'
import { database, type SodaDatabase } from '../db/databaseCore'
import { prepareAssetSnapshotExport } from './snapshotRecovery'

const key = 'asset-quick-read-pending-result'
export type PendingAssetResult = { snapshot: unknown; snapshotSha256: string; savedAt: string }

export async function savePendingAssetResult(
  accountId: string,
  raw: unknown,
  snapshotSha256: string,
  db: SodaDatabase = database,
) {
  const prepared = prepareAssetSnapshotExport(raw)
  if (!prepared || !/^[a-f0-9]{64}$/i.test(snapshotSha256)) return false
  const snapshot = prepared.snapshot
  if (JSON.stringify(snapshot).length > 16 * 1024 * 1024) return false
  const value = {
    format: 'soda-pending-asset-result',
    accountId,
    snapshot,
    snapshotSha256,
    savedAt: new Date().toISOString(),
    hash: contentHash(snapshot),
  }
  await db.transaction('rw', [db.settings, db.accountPreferences], async () => {
    await assertActiveAccountScope(accountId, db)
    await db.accountPreferences.put({
      scopedId: getScopedId(accountId, key),
      accountId,
      key,
      value,
      updatedAt: value.savedAt,
    })
  })
  return true
}

export async function readPendingAssetResult(
  accountId: string,
  db: SodaDatabase = database,
): Promise<PendingAssetResult | null> {
  return db.transaction('r', [db.settings, db.accountPreferences], async () => {
    await assertActiveAccountScope(accountId, db)
    const stored = await db.accountPreferences.get(getScopedId(accountId, key))
    if (!stored) return null
    const value = stored.value as Record<string, unknown> | null
    if (
      !value ||
      value.format !== 'soda-pending-asset-result' ||
      stored.accountId !== accountId ||
      value.accountId !== accountId ||
      typeof value.snapshotSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(value.snapshotSha256) ||
      typeof value.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.savedAt)) ||
      value.hash !== contentHash(value.snapshot) ||
      !prepareAssetSnapshotExport(value.snapshot)
    )
      throw new Error('上次读取结果未通过完整性检查，请重新读取或选择已导出的文件。')
    const imported = await db.accountPreferences.get(
      getScopedId(accountId, `asset-quick-read-recovery-${value.snapshotSha256.toLowerCase()}`),
    )
    if (imported) return null
    return {
      snapshot: value.snapshot,
      snapshotSha256: value.snapshotSha256,
      savedAt: value.savedAt,
    }
  })
}

export async function clearPendingAssetResult(
  accountId: string,
  snapshotSha256: string,
  db: SodaDatabase = database,
) {
  await db.transaction('rw', [db.settings, db.accountPreferences], async () => {
    await assertActiveAccountScope(accountId, db)
    const stored = await db.accountPreferences.get(getScopedId(accountId, key))
    if (
      (stored?.value as Partial<PendingAssetResult> | undefined)?.snapshotSha256 === snapshotSha256
    )
      await db.accountPreferences.delete(stored!.scopedId)
  })
}
