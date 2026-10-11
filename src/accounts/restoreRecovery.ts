import { database, type SodaDatabase } from '../db/databaseCore'
import { contentHash } from '../application/contentHash'

const prefix = 'backup-restore-recovery-v1-'
export const restoreRecoveryLimit = 10
export type RestoreRecovery = {
  key: string
  createdAt: string
  scope: string
  backup: unknown
  backupHash: string
}

// Stored outside account tables so a complete vault replacement cannot erase undo inputs.
// Call inside the replacement transaction: failed writes roll back the receipt as well.
export async function saveRestoreRecovery(backup: unknown, scope: string, db: SodaDatabase) {
  const saved = await db.settings.filter((row) => row.key.startsWith(prefix)).count()
  if (saved >= restoreRecoveryLimit)
    throw new Error('恢复前副本已达 10 份，请先在账户与备份下载保管副本，再明确移除已保管副本。')
  const key = `${prefix}${crypto.randomUUID()}`
  const recovery: RestoreRecovery = {
    key,
    createdAt: new Date().toISOString(),
    scope,
    backup,
    backupHash: contentHash(backup),
  }
  await db.settings.add({ key, value: recovery })
}

export async function readRestoreRecoveries(db: SodaDatabase = database) {
  const rows = await db.settings.filter((row) => row.key.startsWith(prefix)).toArray()
  return rows
    .flatMap((row) => {
      const value = row.value as Partial<RestoreRecovery> | null
      if (
        !value ||
        value.key !== row.key ||
        typeof value.scope !== 'string' ||
        typeof value.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(value.createdAt)) ||
        value.backup === undefined ||
        value.backupHash !== contentHash(value.backup)
      )
        return []
      return [value as RestoreRecovery]
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function removeSavedRestoreRecovery(
  key: string,
  backupHash: string,
  confirmation: 'downloaded_and_keep_external_copy',
  db: SodaDatabase = database,
) {
  if (confirmation !== 'downloaded_and_keep_external_copy' || !key.startsWith(prefix))
    throw new Error('请明确确认已下载并保管此恢复副本。')
  await db.transaction('rw', db.settings, async () => {
    const value = (await db.settings.get(key))?.value as RestoreRecovery | undefined
    if (!value || value.backupHash !== backupHash || contentHash(value.backup) !== backupHash)
      throw new Error('恢复副本已变化，未移除。')
    await db.settings.delete(key)
  })
}
