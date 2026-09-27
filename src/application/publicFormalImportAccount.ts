import type { SodaDatabase } from '../db/databaseCore'

/** Read only the active local account identity needed by the scanner import view. */
export async function getPublicFormalImportActiveAccount(db: SodaDatabase) {
  const setting = await db.settings.get('active-account-id')
  if (typeof setting?.value === 'string') {
    const selected = await db.accounts.get(setting.value)
    if (selected?.status === 'active') return selected
  }
  return db.accounts.filter((account) => account.status === 'active' && account.isDefault).first()
}
