import { getScopedId } from '../accounts/types'

import { database, type SodaDatabase } from '../db/databaseCore'

import { driveDiscSchema } from '../domain/schemas'
import {
  assertScope,
  factHash,
  readFacts,
  recoveryUnavailableReason,
  validRecovery,
} from './accountImportRecoverySupport'

import { AssetQuickReadImportError } from './importErrors'

export function restoreAssetQuickReadImport(
  accountId: string,
  recoveryKey: string,
  confirmation: 'restore_asset_quick_read',
  db: SodaDatabase = database,
) {
  return db.transaction(
    'rw',
    [
      db.accounts,
      db.settings,
      db.accountDriveDiscs,
      db.accountRosters,
      db.accountPreferences,
      db.accountPlanningDrafts,
    ],
    async () => {
      if (confirmation !== 'restore_asset_quick_read')
        throw new AssetQuickReadImportError('import_restore_conflict', '需要明确确认恢复本次导入。')
      await assertScope(accountId, db)
      const stored = await db.accountPreferences.get(getScopedId(accountId, recoveryKey))
      const recovery = stored?.value
      if (stored?.accountId !== accountId || !validRecovery(recovery, accountId))
        throw new AssetQuickReadImportError(
          'import_restore_unavailable',
          '本次导入的恢复副本不可用，未修改账户。',
        )
      const current = await readFacts(accountId, db)
      const unavailableReason = await recoveryUnavailableReason(accountId, recovery, current, db)
      if (unavailableReason)
        throw new AssetQuickReadImportError('import_restore_conflict', unavailableReason)
      for (const disc of recovery.before.discs) {
        driveDiscSchema.parse(disc)
        if (disc.accountId !== accountId || disc.scopedId !== getScopedId(accountId, disc.id))
          throw new AssetQuickReadImportError('import_restore_conflict', '恢复副本账户范围不一致。')
      }
      const previousIds = new Set(recovery.before.discs.map((disc) => disc.id))
      await db.accountDriveDiscs.bulkDelete(
        current.discs.filter((disc) => !previousIds.has(disc.id)).map((disc) => disc.scopedId),
      )
      await db.accountDriveDiscs.bulkPut(recovery.before.discs)
      if (recovery.before.roster) await db.accountRosters.put(recovery.before.roster)
      else await db.accountRosters.delete(accountId)
      if (factHash(await readFacts(accountId, db)) !== recovery.beforeHash)
        throw new AssetQuickReadImportError(
          'import_restore_conservation_failed',
          '恢复守恒校验失败，事务已回滚。',
        )
      await db.accountPreferences.put({
        ...stored!,
        value: { ...recovery, restoredAt: new Date().toISOString() },
      })
      return { accountId, restoredDiscs: recovery.before.discs.length }
    },
  )
}
