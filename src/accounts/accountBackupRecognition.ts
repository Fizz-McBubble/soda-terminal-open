import { database, type SodaDatabase } from '../db/databaseCore'
import { preflightAccountBackupAgainstDatabase } from './backup'
import type { DataCenterFileRecognition } from './dataCenter'

/** The single-account preview uses the same validator as the restore transaction. */
export async function recognizeAccountBackupFile(
  input: unknown,
  db: SodaDatabase = database,
): Promise<Extract<DataCenterFileRecognition, { kind: 'account_backup' }>> {
  const backupPreflight = await preflightAccountBackupAgainstDatabase(input, db)
  const backup = backupPreflight.backup
  return {
    kind: 'account_backup',
    label: '单账号备份',
    targetAccountId: backup?.account.id ?? null,
    targetAccountName: backup?.account.displayName ?? null,
    counts: {
      total: backup?.counts.driveDiscs ?? 0,
      add: backup?.counts.driveDiscs ?? 0,
      skip: 0,
      confirm: 0,
      failed: backupPreflight.errors.length,
    },
    preservesOriginal: false,
    replacementScope: backup ? `仅完整替换账号“${backup.account.displayName}”` : null,
    errors: backupPreflight.errors,
    risks: [...backupPreflight.risks, ...backupPreflight.conflicts],
    input,
    backupPreflight,
  }
}
