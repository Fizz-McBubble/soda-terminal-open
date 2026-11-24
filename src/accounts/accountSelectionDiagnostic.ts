import { database, type SodaDatabase } from '../db/databaseCore'
import { accountIdSchema } from './types'

export const activeAccountKey = 'active-account-id'

export type AccountSelectionDiagnostic = {
  kind: 'invalid-account-records' | 'invalid-active-pointer'
  retainedAccountCount: number
  message: string
}

export async function resolveActiveAccount(db: SodaDatabase = database) {
  const setting = await db.settings.get(activeAccountKey)
  if (typeof setting?.value === 'string' && accountIdSchema.safeParse(setting.value).success) {
    const selected = await db.accounts.get(setting.value)
    if (selected?.status === 'active' && accountIdSchema.safeParse(selected.id).success)
      return selected
  }
  // Historical storage can contain IDs that current scoped readers reject. Skip those records
  // only in this read projection; neither their data nor the saved selection is rewritten.
  return db.accounts
    .filter(
      (account) =>
        account.status === 'active' &&
        account.isDefault &&
        accountIdSchema.safeParse(account.id).success,
    )
    .first()
}

/** Read-only startup explanation. All original records and the active pointer are retained. */
export async function getAccountSelectionDiagnostic(
  db: SodaDatabase = database,
): Promise<AccountSelectionDiagnostic | null> {
  const accounts = await db.accounts.toArray()
  const active = accounts.filter((account) => account.status === 'active')
  const malformed = active.filter((account) => !accountIdSchema.safeParse(account.id).success)
  const resolved = await resolveActiveAccount(db)
  if (!resolved && malformed.length > 0) {
    return {
      kind: 'invalid-account-records',
      retainedAccountCount: accounts.length,
      message:
        '本机保留的历史账户编号无法由当前版本读取。原账户和资产均未修改；请从有效的账户备份恢复，或联系维护者核对历史资料。',
    }
  }
  const setting = await db.settings.get(activeAccountKey)
  if (
    setting &&
    (!accountIdSchema.safeParse(setting.value).success ||
      !active.some((account) => account.id === setting.value))
  ) {
    return {
      kind: 'invalid-active-pointer',
      retainedAccountCount: accounts.length,
      message: resolved
        ? '上次选择的账户无法读取，当前显示可用的默认账户。原账户、资产与选择记录均保留，请在我的资产中确认账户。'
        : '上次选择的账户无法读取，原账户、资产与选择记录均保留。请在我的资产中重新选择账户，或从有效的账户备份恢复。',
    }
  }
  return null
}
