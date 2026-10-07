import { createAccountWithRoster } from './accountCreationCore'
import {
  assertBangbooSkillFacts,
  assertRosterAscensionFacts,
  createEmptyRoster,
  hydrateRosterDefaults,
} from './rosterHydration'
import type { AccountRoster, ScenarioResult } from '../assault/types'
import { normalizeWEngineInstances } from './wEngineInstanceRules'
import { database, type SodaDatabase } from '../db/databaseCore'
import type { DriveDisc } from '../domain/schemas'
import { accountIdSchema, getScopedId, type AccountOptimizationResult } from './types'
import { resolvePlanningDiscReferences } from './planningDiscReferences'
import { assertAccount } from './accountPreferenceRepository'
export { saveAccountPreference, getAccountPreference } from './accountPreferenceRepository'

const activeAccountKey = 'active-account-id'

export async function createAccount(
  displayName: string,
  db: SodaDatabase = database,
  options: { id?: string; now?: Date; makeDefault?: boolean } = {},
) {
  return createAccountWithRoster(displayName, db, options, createEmptyRoster)
}

export async function renameAccount(
  accountId: string,
  displayName: string,
  db: SodaDatabase = database,
  now = new Date(),
) {
  accountIdSchema.parse(accountId)
  const normalized = displayName.trim()
  if (!normalized) throw new Error('账号名称不能为空。')
  if (normalized.length > 40) throw new Error('账号名称不能超过 40 个字符。')
  const current = await db.accounts.get(accountId)
  if (!current) throw new Error('账号不存在。')
  const duplicateNames = await db.accounts
    .filter(
      (account) =>
        account.id !== accountId &&
        account.status === 'active' &&
        account.displayName.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    )
    .toArray()
  const account = { ...current, displayName: normalized, updatedAt: now.toISOString() }
  await db.accounts.put(account)
  return {
    account,
    warning:
      duplicateNames.length > 0
        ? `已有 ${duplicateNames.length} 个同名账号，请通过创建日期和账号 ID 后缀区分。`
        : null,
  }
}

export async function setActiveAccount(accountId: string, db: SodaDatabase = database) {
  accountIdSchema.parse(accountId)
  const account = await db.accounts.get(accountId)
  if (!account || account.status !== 'active') throw new Error('账号不存在或已归档。')
  await db.settings.put({ key: activeAccountKey, value: accountId })
  return account
}

export async function getActiveAccount(db: SodaDatabase = database) {
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

export type AccountSelectionDiagnostic = {
  kind: 'invalid-account-records' | 'invalid-active-pointer'
  retainedAccountCount: number
  message: string
}

/** Read-only startup explanation. All original records and the active pointer are retained. */
export async function getAccountSelectionDiagnostic(
  db: SodaDatabase = database,
): Promise<AccountSelectionDiagnostic | null> {
  const accounts = await db.accounts.toArray()
  const active = accounts.filter((account) => account.status === 'active')
  const malformed = active.filter((account) => !accountIdSchema.safeParse(account.id).success)
  const resolved = await getActiveAccount(db)
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

export type AccountDeleteResult = {
  accountId: string
  deleted: {
    driveDiscs: number
    discEvaluations: number
    scanBatches: number
    scanItems: number
    rosters: number
    optimizationResults: number
    planningDrafts: number
    preferences: number
  }
  nextActiveAccountId: string | null
}

/**
 * Permanently removes one account and every record owned by that account. The caller owns the
 * user-facing confirmation and backup decision; unrelated accounts and unscoped legacy data are
 * deliberately outside this transaction.
 */
export async function deleteAccount(
  accountId: string,
  db: SodaDatabase = database,
): Promise<AccountDeleteResult> {
  accountIdSchema.parse(accountId)
  return db.transaction(
    'rw',
    [
      db.accounts,
      db.settings,
      db.accountDriveDiscs,
      db.accountDiscEvaluations,
      db.accountScanImportBatches,
      db.accountScanImportItems,
      db.accountRosters,
      db.accountOptimizationResults,
      db.accountPlanningDrafts,
      db.accountPreferences,
    ],
    async () => {
      const account = await db.accounts.get(accountId)
      if (!account) throw new Error('账户已不存在，请刷新后重新确认。')
      const activeSetting = await db.settings.get(activeAccountKey)
      const rosterExists = Boolean(await db.accountRosters.get(accountId))
      const deleted = {
        driveDiscs: await db.accountDriveDiscs.where('accountId').equals(accountId).delete(),
        discEvaluations: await db.accountDiscEvaluations
          .where('accountId')
          .equals(accountId)
          .delete(),
        scanBatches: await db.accountScanImportBatches
          .where('accountId')
          .equals(accountId)
          .delete(),
        scanItems: await db.accountScanImportItems.where('accountId').equals(accountId).delete(),
        rosters: await db.accountRosters.delete(accountId).then(() => (rosterExists ? 1 : 0)),
        optimizationResults: await db.accountOptimizationResults
          .where('accountId')
          .equals(accountId)
          .delete(),
        planningDrafts: await db.accountPlanningDrafts
          .where('accountId')
          .equals(accountId)
          .delete(),
        preferences: await db.accountPreferences.where('accountId').equals(accountId).delete(),
      }
      await db.accounts.delete(accountId)

      let nextActiveAccountId =
        typeof activeSetting?.value === 'string' && activeSetting.value !== accountId
          ? activeSetting.value
          : null
      if (nextActiveAccountId && !(await db.accounts.get(nextActiveAccountId))) {
        nextActiveAccountId = null
      }
      if (!nextActiveAccountId) {
        const next =
          (await db.accounts
            .filter((candidate) => candidate.status === 'active' && candidate.isDefault)
            .first()) ??
          (await db.accounts.filter((candidate) => candidate.status === 'active').first())
        nextActiveAccountId = next?.id ?? null
      }
      if (nextActiveAccountId) {
        await db.settings.put({ key: activeAccountKey, value: nextActiveAccountId })
        if (account.isDefault) {
          await db.accounts.update(nextActiveAccountId, { isDefault: true })
        }
      } else {
        await db.settings.delete(activeAccountKey)
      }
      return { accountId, deleted, nextActiveAccountId }
    },
  )
}

export async function listAccountDriveDiscs(accountId: string, db: SodaDatabase = database) {
  await assertAccount(accountId, db)
  return db.accountDriveDiscs.where('accountId').equals(accountId).toArray()
}

/** Stable edit token shared by the asset form and transactional persistence. */
export function accountDriveDiscRevision(disc: DriveDisc) {
  return JSON.stringify({
    id: disc.id,
    setId: disc.setId,
    slot: disc.slot,
    level: disc.level,
    mainStat: disc.mainStat,
    subStats: disc.subStats,
    tags: disc.tags,
    locked: disc.locked,
    favorite: disc.favorite,
    updatedAt: disc.updatedAt,
    discVersion: disc.discVersion,
  })
}

export async function saveAccountDriveDisc(
  accountId: string,
  disc: DriveDisc,
  db: SodaDatabase = database,
  expectedRevision?: string,
) {
  return db.transaction('rw', db.accounts, db.accountDriveDiscs, async () => {
    await assertAccount(accountId, db)
    const existing = await db.accountDriveDiscs.get(getScopedId(accountId, disc.id))
    if (
      expectedRevision !== undefined &&
      (!existing || accountDriveDiscRevision(existing) !== expectedRevision)
    )
      throw new Error('这张驱动盘已被扫描、导入或恢复更新，请刷新后重新确认。')
    await db.accountDriveDiscs.put({
      ...disc,
      scopedId: getScopedId(accountId, disc.id),
      accountId,
      sourceLegacyId: existing?.sourceLegacyId ?? null,
      migratedAt: existing?.migratedAt ?? null,
    })
  })
}

export type AccountDriveDiscDeleteResult = {
  requestedCount: number
  deletedCount: number
  removedEvaluationCount: number
  updatedEquippedAgents: number
  invalidatedPlanningDrafts: number
}

/**
 * Removes account-local discs and every account-local reference that would otherwise become
 * orphaned. Callers own user-facing confirmation; supplied edit tokens are checked inside this transaction.
 */
export async function deleteAccountDriveDiscs(
  accountId: string,
  discIds: string[],
  db: SodaDatabase = database,
  expectedRevisions?: Record<string, string>,
): Promise<AccountDriveDiscDeleteResult> {
  const ids = [...new Set(discIds)]
  if (ids.length === 0) {
    return {
      requestedCount: 0,
      deletedCount: 0,
      removedEvaluationCount: 0,
      updatedEquippedAgents: 0,
      invalidatedPlanningDrafts: 0,
    }
  }

  return db.transaction(
    'rw',
    [
      db.accounts,
      db.accountDriveDiscs,
      db.accountDiscEvaluations,
      db.accountRosters,
      db.accountPlanningDrafts,
    ],
    async () => {
      await assertAccount(accountId, db)
      const existing = await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()
      const existingIds = new Set(existing.map((disc) => disc.id))
      if (ids.some((id) => !existingIds.has(id)))
        throw new Error('批量选择中有驱动盘已消失，请刷新后重新确认。')

      if (
        expectedRevisions &&
        ids.some((id) => {
          const disc = existing.find((item) => item.id === id)
          return !disc || accountDriveDiscRevision(disc) !== expectedRevisions[id]
        })
      )
        throw new Error('批量选择中有驱动盘已更新或消失，请刷新后重新确认。')

      const removedIds = new Set(ids)
      const rosterRecord = await db.accountRosters.get(accountId)
      const planningDrafts = await db.accountPlanningDrafts
        .where('accountId')
        .equals(accountId)
        .toArray()
      const protectedByInventory = existing.some((disc) => removedIds.has(disc.id) && disc.locked)
      const protectedByFavorite = existing.some((disc) => removedIds.has(disc.id) && disc.favorite)
      const protectedByEquipment = rosterRecord?.roster.agents.some((agent) =>
        (agent.equippedDiscIds ?? []).some((id) => removedIds.has(id)),
      )
      const protectedByPlan = planningDrafts.some((draft) =>
        resolvePlanningDiscReferences(draft).referenceIds.some((id) => removedIds.has(id)),
      )
      const protectionReasons = [
        ...(protectedByInventory ? ['已锁定'] : []),
        ...(protectedByFavorite ? ['收藏'] : []),
        ...(protectedByEquipment ? ['当前装备'] : []),
        ...(protectedByPlan ? ['已保存方案'] : []),
      ]
      if (protectionReasons.length)
        throw new Error(`所选驱动盘仍受${protectionReasons.join('、')}保护，请先解除关系再删除。`)

      const evaluations = await db.accountDiscEvaluations
        .where('accountId')
        .equals(accountId)
        .toArray()
      const removedEvaluations = evaluations.filter((evaluation) =>
        removedIds.has(evaluation.discId),
      )
      await db.accountDriveDiscs.bulkDelete(ids.map((id) => getScopedId(accountId, id)))
      if (removedEvaluations.length)
        await db.accountDiscEvaluations.bulkDelete(
          removedEvaluations.map((evaluation) => evaluation.scopedId),
        )

      let updatedEquippedAgents = 0
      if (rosterRecord) {
        const agents = rosterRecord.roster.agents.map((agent) => {
          const equippedDiscIds = agent.equippedDiscIds ?? []
          const nextIds = equippedDiscIds.filter((id) => !removedIds.has(id))
          if (nextIds.length === equippedDiscIds.length) return agent
          updatedEquippedAgents += 1
          return { ...agent, equippedDiscIds: nextIds.length ? nextIds : null }
        })
        if (updatedEquippedAgents) {
          await db.accountRosters.put({
            ...rosterRecord,
            roster: { ...rosterRecord.roster, agents },
            updatedAt: new Date().toISOString(),
          })
        }
      }

      const impactedDrafts = planningDrafts.filter((draft) =>
        resolvePlanningDiscReferences(draft).referenceIds.some((id) => removedIds.has(id)),
      )
      if (impactedDrafts.length) {
        const updatedAt = new Date().toISOString()
        await db.accountPlanningDrafts.bulkPut(
          impactedDrafts.map((draft) => ({
            ...draft,
            warehouseRefs: draft.warehouseRefs.filter((id) => !removedIds.has(id)),
            // Scores in the snapshot are no longer valid after a referenced physical disc is removed.
            candidateWarehouse: undefined,
            updatedAt,
            revision: draft.revision + 1,
          })),
        )
      }

      return {
        requestedCount: ids.length,
        deletedCount: ids.length,
        removedEvaluationCount: removedEvaluations.length,
        updatedEquippedAgents,
        invalidatedPlanningDrafts: impactedDrafts.length,
      }
    },
  )
}

export async function getAccountRoster(accountId: string, db: SodaDatabase = database) {
  await assertAccount(accountId, db)
  const record = await db.accountRosters.get(accountId)
  if (!record) return createEmptyRoster()
  // Reads are used by Dexie liveQuery. Persisting a compatibility hydration here
  // turns an otherwise read-only subscription into a write transaction and makes
  // the affected route fail at runtime. Keep the normalized projection in memory;
  // an explicit roster save remains the sole account-write boundary.
  return hydrateRosterDefaults(record.roster)
}

/** Apply a targeted edit to the latest roster while holding the write transaction.
 * The synchronous mutator owns the entity-level revision check, never a stale whole-roster read.
 */
export async function updateAccountRoster(
  accountId: string,
  mutate: (current: AccountRoster) => AccountRoster,
  db: SodaDatabase = database,
) {
  return db.transaction('rw', db.accounts, db.accountRosters, async () => {
    const current = await getAccountRoster(accountId, db)
    return saveAccountRoster(accountId, mutate(current), db)
  })
}

export async function saveAccountBangboo(
  accountId: string,
  bangbooId: string,
  patch: Partial<AccountRoster['bangboos'][number]>,
  expectedRevision: string,
  db: SodaDatabase = database,
) {
  return updateAccountRoster(
    accountId,
    (roster) => {
      const current = roster.bangboos.find((item) => item.bangbooId === bangbooId)
      if (!current || JSON.stringify(current) !== expectedRevision)
        throw new Error('邦布资料已更新，请刷新后重新确认。')
      return {
        ...roster,
        bangboos: roster.bangboos.map((item) =>
          item.bangbooId === bangbooId
            ? { ...item, ...patch, bangbooId, manualSource: 'manual_override' as const }
            : item,
        ),
      }
    },
    db,
  )
}

export async function saveAccountRoster(
  accountId: string,
  roster: AccountRoster,
  db: SodaDatabase = database,
) {
  await assertAccount(accountId, db)
  assertBangbooSkillFacts(roster)
  assertRosterAscensionFacts(roster)
  const updatedAt = new Date().toISOString()
  const value = normalizeWEngineInstances({ ...roster, updatedAt })
  await db.accountRosters.put({
    accountId,
    roster: value,
    updatedAt,
    source: 'manual',
  })
  return value
}

export async function saveAccountOptimizationResult(
  accountId: string,
  result: ScenarioResult,
  db: SodaDatabase = database,
  now = new Date(),
) {
  await assertAccount(accountId, db)
  const id = `${result.scenario.scope}-${now.getTime()}`
  const record: AccountOptimizationResult = {
    scopedId: getScopedId(accountId, id),
    accountId,
    id,
    result,
    createdAt: now.toISOString(),
    sourceLegacyId: null,
  }
  await db.accountOptimizationResults.add(record)
  return id
}
