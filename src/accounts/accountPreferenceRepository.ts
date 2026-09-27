import { database, type SodaDatabase } from '../db/databaseCore'
import { accountIdSchema, getScopedId } from './types'

export async function assertAccount(accountId: string, db: SodaDatabase) {
  accountIdSchema.parse(accountId)
  if (!(await db.accounts.get(accountId))) throw new Error('账号不存在。')
}

export async function saveAccountPreference(
  accountId: string,
  key: string,
  value: unknown,
  db: SodaDatabase = database,
) {
  await assertAccount(accountId, db)
  await db.accountPreferences.put({
    scopedId: getScopedId(accountId, key),
    accountId,
    key,
    value,
    updatedAt: new Date().toISOString(),
  })
}

export async function getAccountPreference(
  accountId: string,
  key: string,
  db: SodaDatabase = database,
) {
  await assertAccount(accountId, db)
  return (await db.accountPreferences.get(getScopedId(accountId, key)))?.value
}
