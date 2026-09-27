import { database, type SodaDatabase } from '../db/databaseCore'
import {
  getRoster as getLegacyRoster,
  getScenarioResult as getLegacyScenarioResult,
} from './legacyRosterPersistence'
import type { AccountRoster } from '../assault/types'
import type { DiscEvaluation, DriveDisc } from '../domain/schemas'
import { getAccountRoster, getActiveAccount } from './repository'
import type { AccountProfile } from './types'

export type CoreDataScope = {
  account: AccountProfile | null
  accountId: string | null
}

export type CoreWarehouse = CoreDataScope & {
  discs: DriveDisc[]
  roster: AccountRoster
}

export type CoreDiscRecord = CoreDataScope & {
  disc: DriveDisc | null
  evaluations: DiscEvaluation[]
}

function toScope(account: AccountProfile | null | undefined): CoreDataScope {
  return { account: account ?? null, accountId: account?.id ?? null }
}

export function getCoreScopeLabel(scope: CoreDataScope) {
  return scope.account ? scope.account.displayName : '旧表兼容（当前没有活动账号）'
}

/**
 * Read-only account warehouse projection: the browser keeps reading and displaying its own local
 * records without an online calculation, while every calculation stays on the private side.
 */
export async function loadCoreWarehouse(db: SodaDatabase = database): Promise<CoreWarehouse> {
  const account = await getActiveAccount(db)
  if (account) {
    const [discs, roster] = await Promise.all([
      db.accountDriveDiscs.where('accountId').equals(account.id).toArray(),
      getAccountRoster(account.id, db),
    ])
    return { ...toScope(account), discs, roster }
  }

  const [discs, roster] = await Promise.all([db.driveDiscs.toArray(), getLegacyRoster(db)])
  return { ...toScope(null), discs, roster }
}

export async function loadCoreRoster(db: SodaDatabase = database) {
  const account = await getActiveAccount(db)
  const roster = account ? await getAccountRoster(account.id, db) : await getLegacyRoster(db)
  return { ...toScope(account), roster }
}

export async function loadCoreDisc(
  discId: string,
  db: SodaDatabase = database,
): Promise<CoreDiscRecord> {
  const account = await getActiveAccount(db)
  if (account) {
    const [disc, evaluations] = await Promise.all([
      db.accountDriveDiscs.where('[accountId+id]').equals([account.id, discId]).first(),
      db.accountDiscEvaluations.where('[accountId+discId]').equals([account.id, discId]).toArray(),
    ])
    return { ...toScope(account), disc: disc ?? null, evaluations }
  }

  const [disc, evaluations] = await Promise.all([
    db.driveDiscs.get(discId),
    db.discEvaluations.where('discId').equals(discId).toArray(),
  ])
  return { ...toScope(null), disc: disc ?? null, evaluations }
}

export async function loadActiveCoreScenarioResult(id: string, db: SodaDatabase = database) {
  const account = await getActiveAccount(db)
  if (!account) {
    return { ...toScope(null), result: await getLegacyScenarioResult(id, db) }
  }
  const record = await db.accountOptimizationResults
    .where('[accountId+id]')
    .equals([account.id, id])
    .first()
  return {
    ...toScope(account),
    result: record ? { ...record.result, id: record.id } : undefined,
  }
}
