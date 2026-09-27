import type { AccountRoster } from '../assault/types'
import type { SodaDatabase } from '../db/databaseCore'
import { accountIdSchema, type AccountProfile } from './types'

/** Account creation and initial roster must commit in the same local transaction. */
export async function createAccountWithRoster(
  displayName: string,
  db: SodaDatabase,
  options: { id?: string; now?: Date; makeDefault?: boolean },
  createRoster: (now: string) => AccountRoster,
) {
  const now = (options.now ?? new Date()).toISOString()
  const id = accountIdSchema.parse(options.id ?? `account-${crypto.randomUUID()}`)
  const account: AccountProfile = {
    id,
    displayName: displayName.trim(),
    createdAt: now,
    updatedAt: now,
    isDefault: options.makeDefault ?? (await db.accounts.count()) === 0,
    status: 'active',
    source: 'manual',
  }
  if (!account.displayName) throw new Error('账号名称不能为空。')
  if (account.displayName.length > 40) throw new Error('账号名称不能超过 40 个字符。')
  await db.transaction('rw', db.accounts, db.settings, db.accountRosters, async () => {
    if (account.isDefault) {
      await db.accounts.toCollection().modify((item) => {
        item.isDefault = false
      })
    }
    await db.accounts.add(account)
    await db.accountRosters.put({
      accountId: account.id,
      roster: createRoster(now),
      updatedAt: now,
      source: 'manual',
    })
    if (!(await db.settings.get('active-account-id'))) {
      await db.settings.put({ key: 'active-account-id', value: account.id })
    }
  })
  return account
}
