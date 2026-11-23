import { database, type SodaDatabase } from '../db/databaseCore'
import { getScopedId } from './types'

/** Read-only access does not import save-time combat/source validation. */
export async function listAccountPlanningDrafts(accountId: string, db: SodaDatabase = database) {
  return db.accountPlanningDrafts.where('accountId').equals(accountId).sortBy('updatedAt')
}

export async function getAccountPlanningDraft(
  accountId: string,
  id: string,
  db: SodaDatabase = database,
) {
  return db.accountPlanningDrafts.get(getScopedId(accountId, id))
}
