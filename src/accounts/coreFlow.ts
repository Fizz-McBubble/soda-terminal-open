import {
  saveRoster as saveLegacyRoster,
  saveScenarioResult as saveLegacyScenarioResult,
} from './legacyRosterPersistence'
import type { AccountRoster, ScenarioResult } from '../assault/types'
import {
  archiveDiscWithEvaluation,
  database,
  DiscNotFoundError,
  updateArchivedDisc,
  type SodaDatabase,
} from '../db/database'
import { createDiscEvaluation, getDriveDiscVersion } from '../domain/discEvaluations'
import { driveDiscSchema, type DiscEvaluation, type DriveDisc } from '../domain/schemas'
import type { EvaluationSnapshot } from '../evaluation/types'
import { saveAccountOptimizationResult, saveAccountRoster } from './repository'
import { getScopedId } from './types'

/**
 * Compatibility re-export. Reads live in `accounts/coreWarehouse.ts` so the browser can keep
 * reading its own local account without importing the evaluation-bound write path.
 */
export type { CoreDataScope, CoreDiscRecord, CoreWarehouse } from './coreWarehouse'
export {
  getCoreScopeLabel,
  loadActiveCoreScenarioResult,
  loadCoreDisc,
  loadCoreRoster,
  loadCoreWarehouse,
} from './coreWarehouse'

export async function saveCoreRoster(
  accountId: string | null,
  roster: AccountRoster,
  db: SodaDatabase = database,
) {
  return accountId ? saveAccountRoster(accountId, roster, db) : saveLegacyRoster(roster, db)
}

function scopeEvaluation(accountId: string, evaluation: DiscEvaluation) {
  return {
    ...evaluation,
    scopedId: getScopedId(accountId, evaluation.id),
    accountId,
    sourceLegacyId: null,
    migratedAt: null,
  }
}

export async function archiveCoreDiscWithEvaluation(
  accountId: string | null,
  disc: DriveDisc,
  snapshot: EvaluationSnapshot,
  previousSnapshot?: EvaluationSnapshot | null,
  db: SodaDatabase = database,
) {
  if (!accountId) return archiveDiscWithEvaluation(disc, snapshot, previousSnapshot)
  if (!(await db.accounts.get(accountId))) throw new Error('活动账号不存在。')

  const scopedId = getScopedId(accountId, disc.id)
  const existing = await db.accountDriveDiscs.get(scopedId)
  const archivedDisc = driveDiscSchema.parse({
    ...disc,
    discVersion: getDriveDiscVersion(disc),
    updatedAt: new Date().toISOString(),
  })

  await db.transaction('rw', db.accountDriveDiscs, db.accountDiscEvaluations, async () => {
    await db.accountDriveDiscs.put({
      ...archivedDisc,
      scopedId,
      accountId,
      sourceLegacyId: existing?.sourceLegacyId ?? null,
      migratedAt: existing?.migratedAt ?? null,
    })
    if (previousSnapshot) {
      const previous = createDiscEvaluation(
        { ...previousSnapshot.input, id: disc.id },
        previousSnapshot,
      )
      await db.accountDiscEvaluations.put(scopeEvaluation(accountId, previous))
    }
    await db.accountDiscEvaluations.put(
      scopeEvaluation(accountId, createDiscEvaluation(archivedDisc, snapshot)),
    )
  })

  return archivedDisc
}

export async function updateCoreDisc(
  accountId: string | null,
  disc: DriveDisc,
  db: SodaDatabase = database,
) {
  if (!accountId) return updateArchivedDisc(disc)
  return db.transaction('rw', db.accountDriveDiscs, async () => {
    const scopedId = getScopedId(accountId, disc.id)
    const existing = await db.accountDriveDiscs.get(scopedId)
    if (!existing) throw new DiscNotFoundError()
    const updated = driveDiscSchema.parse({
      ...disc,
      id: existing.id,
      createdAt: existing.createdAt,
      discVersion: getDriveDiscVersion(disc),
      updatedAt: new Date().toISOString(),
    })
    await db.accountDriveDiscs.put({
      ...updated,
      scopedId,
      accountId,
      sourceLegacyId: existing.sourceLegacyId,
      migratedAt: existing.migratedAt,
    })
    return updated
  })
}

export async function saveCoreScenarioResult(
  accountId: string | null,
  result: ScenarioResult,
  db: SodaDatabase = database,
) {
  return accountId
    ? saveAccountOptimizationResult(accountId, result, db)
    : saveLegacyScenarioResult(result, db)
}
