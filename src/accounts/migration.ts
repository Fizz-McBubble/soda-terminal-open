import { contentHash } from '../evaluation/contentHash'
import { createEmptyRoster, hydrateRosterDefaults } from '../assault/catalog'
import type { AccountRoster, ScenarioResult } from '../assault/types'
import { database, type SodaDatabase } from '../db/database'
import { getBackupFilename } from '../domain/backup'
import type { ScanImportBatchMeta, ScanImportItem } from '../domain/scanImportStaging'
import type { DiscEvaluation, DriveDisc } from '../domain/schemas'
import {
  accountIdSchema,
  getScopedId,
  scopeLegacyEntity,
  type AccountOptimizationResult,
  type AccountProfile,
} from './types'

export const legacyDefaultAccountId = 'account-legacy-default'
const legacyRosterKey = 'assault-roster-v1'
const legacyResultPrefix = 'assault-result:'

export type LegacyMigrationCounts = {
  agents: number
  bangboos: number
  driveDiscs: number
  discEvaluations: number
  scanBatches: number
  scanItems: number
  optimizationResults: number
  preferences: number
}

export type LegacyAccountMigrationPreflight = {
  readOnly: true
  targetAccount: AccountProfile
  counts: LegacyMigrationCounts
  conflicts: string[]
  backupFilename: string
  rollback: string
  preflightHash: string
  legacyDataHash: string
  alreadyCopied: boolean
  copyVerified: boolean
  canCopy: boolean
}

type LegacyDataSnapshot = {
  driveDiscs: DriveDisc[]
  evaluations: DiscEvaluation[]
  scanBatches: ScanImportBatchMeta[]
  scanItems: ScanImportItem[]
  roster: AccountRoster | null
  results: Array<{ key: string; value: unknown }>
}

function sortById<T extends { id: string }>(items: T[]) {
  return [...items].sort((left, right) => left.id.localeCompare(right.id))
}

function hashLegacyData(snapshot: LegacyDataSnapshot) {
  return contentHash({
    driveDiscs: sortById(snapshot.driveDiscs),
    evaluations: sortById(snapshot.evaluations),
    scanBatches: sortById(snapshot.scanBatches),
    scanItems: sortById(snapshot.scanItems),
    roster: snapshot.roster,
    results: [...snapshot.results].sort((left, right) => left.key.localeCompare(right.key)),
  })
}

function removeScope<
  T extends {
    scopedId: string
    accountId: string
    sourceLegacyId: string | null
    migratedAt: string | null
  },
>(item: T) {
  const {
    scopedId: _scopedId,
    accountId: _accountId,
    sourceLegacyId: _sourceLegacyId,
    migratedAt: _migratedAt,
    ...entity
  } = item
  void _scopedId
  void _accountId
  void _sourceLegacyId
  void _migratedAt
  return entity
}

async function hashScopedLegacyCopy(accountId: string, db: SodaDatabase) {
  const [driveDiscs, evaluations, scanBatches, scanItems, roster, results] = await Promise.all([
    db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
    db.accountDiscEvaluations.where('accountId').equals(accountId).toArray(),
    db.accountScanImportBatches.where('accountId').equals(accountId).toArray(),
    db.accountScanImportItems.where('accountId').equals(accountId).toArray(),
    db.accountRosters.get(accountId),
    db.accountOptimizationResults.where('accountId').equals(accountId).toArray(),
  ])
  return hashLegacyData({
    driveDiscs: driveDiscs.map(removeScope),
    evaluations: evaluations.map(removeScope),
    scanBatches: scanBatches.map(removeScope),
    scanItems: scanItems.map(removeScope),
    roster: roster?.roster ?? null,
    results: results.map((result) => ({
      key: result.sourceLegacyId ?? `${legacyResultPrefix}${result.id}`,
      value: result.result,
    })),
  })
}

function duplicateIds(items: Array<{ id: string }>) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id)
    seen.add(item.id)
  }
  return [...duplicates]
}

export async function preflightLegacyAccountMigration(
  db: SodaDatabase = database,
  now = new Date(),
): Promise<LegacyAccountMigrationPreflight> {
  const [
    driveDiscs,
    evaluations,
    scanBatches,
    scanItems,
    rosterSetting,
    resultSettings,
    existingAccount,
    scopedCounts,
    scopedHash,
  ] = await Promise.all([
    db.driveDiscs.toArray(),
    db.discEvaluations.toArray(),
    db.scanImportBatches.toArray(),
    db.scanImportItems.toArray(),
    db.settings.get(legacyRosterKey),
    db.settings.filter((setting) => setting.key.startsWith(legacyResultPrefix)).toArray(),
    db.accounts.get(legacyDefaultAccountId),
    Promise.all([
      db.accountDriveDiscs.where('accountId').equals(legacyDefaultAccountId).count(),
      db.accountDiscEvaluations.where('accountId').equals(legacyDefaultAccountId).count(),
      db.accountScanImportBatches.where('accountId').equals(legacyDefaultAccountId).count(),
      db.accountScanImportItems.where('accountId').equals(legacyDefaultAccountId).count(),
    ]),
    db.accounts
      .get(legacyDefaultAccountId)
      .then((account) =>
        account ? hashScopedLegacyCopy(legacyDefaultAccountId, db) : Promise.resolve(null),
      ),
  ])

  const roster = rosterSetting?.value as Partial<AccountRoster> | undefined
  // The preflight hashes the exact v3 projection that the transaction will
  // write, while the original v2 settings row remains untouched.
  const migratedRoster = roster
    ? hydrateRosterDefaults(roster, roster.updatedAt ?? now.toISOString())
    : null
  const conflicts: string[] = []
  for (const [label, items] of [
    ['驱动盘', driveDiscs],
    ['鉴定历史', evaluations],
    ['扫描批次', scanBatches],
    ['扫描条目', scanItems],
  ] as const) {
    const duplicates = duplicateIds(items)
    if (duplicates.length) conflicts.push(`${label}存在重复 ID：${duplicates.join('、')}`)
  }
  const discIds = new Set(driveDiscs.map((item) => item.id))
  for (const evaluation of evaluations) {
    if (!discIds.has(evaluation.discId)) {
      conflicts.push(`鉴定 ${evaluation.id} 找不到驱动盘 ${evaluation.discId}。`)
    }
  }
  const batchIds = new Set(scanBatches.map((item) => item.id))
  for (const item of scanItems) {
    if (!batchIds.has(item.batchId))
      conflicts.push(`扫描条目 ${item.id} 找不到批次 ${item.batchId}。`)
  }
  const legacyDataHash = hashLegacyData({
    driveDiscs,
    evaluations,
    scanBatches,
    scanItems,
    roster: migratedRoster,
    results: resultSettings,
  })
  const alreadyCopied = Boolean(existingAccount)
  const copyVerified =
    alreadyCopied &&
    existingAccount?.source === 'legacy_migration' &&
    scopedHash === legacyDataHash &&
    scopedCounts[0] === driveDiscs.length &&
    scopedCounts[1] === evaluations.length &&
    scopedCounts[2] === scanBatches.length &&
    scopedCounts[3] === scanItems.length
  if (alreadyCopied && !copyVerified) {
    conflicts.push('默认迁移账号已存在，但副本数量或 hash 与旧数据不一致。')
  } else if (!alreadyCopied && scopedCounts.some((count) => count > 0)) {
    conflicts.push('检测到没有账号档案的孤立作用域数据，不能继续复制。')
  }

  const timestamp = now.toISOString()
  const targetAccount: AccountProfile = {
    id: legacyDefaultAccountId,
    displayName: '原本地账号',
    createdAt: timestamp,
    updatedAt: timestamp,
    isDefault: true,
    status: 'active',
    source: 'legacy_migration',
  }
  const counts: LegacyMigrationCounts = {
    agents: migratedRoster?.agents.filter((agent) => agent.owned).length ?? 0,
    bangboos: migratedRoster?.bangboos.filter((bangboo) => bangboo.owned).length ?? 0,
    driveDiscs: driveDiscs.length,
    discEvaluations: evaluations.length,
    scanBatches: scanBatches.length,
    scanItems: scanItems.length,
    optimizationResults: resultSettings.length,
    preferences: 0,
  }
  const hashInput = {
    targetAccountId: targetAccount.id,
    counts,
    legacyDataHash,
  }

  return {
    readOnly: true,
    targetAccount,
    counts,
    conflicts,
    backupFilename: getBackupFilename(now),
    rollback: '复制完成并校验前保留全部旧表；回滚只删除本次账号作用域副本，旧数据保持不变。',
    preflightHash: contentHash(hashInput),
    legacyDataHash,
    alreadyCopied,
    copyVerified,
    canCopy: conflicts.length === 0,
  }
}

export async function copyLegacyDataToAccount(
  accountId: string,
  expectedPreflightHash: string,
  db: SodaDatabase = database,
  now = new Date(),
  beforeCommit?: () => void,
) {
  accountIdSchema.parse(accountId)
  if (accountId !== legacyDefaultAccountId) throw new Error('旧数据只能复制到预检确定的默认账号。')
  const preflight = await preflightLegacyAccountMigration(db, now)
  if (!preflight.canCopy) throw new Error(preflight.conflicts[0] ?? '旧数据迁移预检未通过。')
  if (preflight.preflightHash !== expectedPreflightHash)
    throw new Error('旧数据已变化，请重新预检。')
  if (preflight.alreadyCopied && preflight.copyVerified) {
    await db.settings.put({ key: 'active-account-id', value: accountId })
    return {
      status: 'already_copied' as const,
      counts: preflight.counts,
      legacyDataHash: preflight.legacyDataHash,
    }
  }

  const migratedAt = now.toISOString()
  await db.transaction(
    'rw',
    [
      db.accounts,
      db.accountDriveDiscs,
      db.accountDiscEvaluations,
      db.accountScanImportBatches,
      db.accountScanImportItems,
      db.accountRosters,
      db.accountOptimizationResults,
      db.driveDiscs,
      db.discEvaluations,
      db.scanImportBatches,
      db.scanImportItems,
      db.settings,
    ],
    async () => {
      const [driveDiscs, evaluations, scanBatches, scanItems, rosterSetting, resultSettings] =
        await Promise.all([
          db.driveDiscs.toArray(),
          db.discEvaluations.toArray(),
          db.scanImportBatches.toArray(),
          db.scanImportItems.toArray(),
          db.settings.get(legacyRosterKey),
          db.settings.filter((setting) => setting.key.startsWith(legacyResultPrefix)).toArray(),
        ])
      // Convert only the v2 shape. Missing v3 skill facts become null, with no
      // default inferred from level, stars, or rarity; a failure aborts this
      // transaction before any legacy data is removed.
      const migratedRoster = rosterSetting?.value
        ? hydrateRosterDefaults(rosterSetting.value as Partial<AccountRoster>, migratedAt)
        : null
      await db.accounts.add({
        ...preflight.targetAccount,
        createdAt: migratedAt,
        updatedAt: migratedAt,
      })
      await db.accountDriveDiscs.bulkAdd(
        driveDiscs.map((item) => scopeLegacyEntity(accountId, item, migratedAt)),
      )
      await db.accountDiscEvaluations.bulkAdd(
        evaluations.map((item) => scopeLegacyEntity(accountId, item, migratedAt)),
      )
      await db.accountScanImportBatches.bulkAdd(
        scanBatches.map((item) => scopeLegacyEntity(accountId, item, migratedAt)),
      )
      await db.accountScanImportItems.bulkAdd(
        scanItems.map((item) => scopeLegacyEntity(accountId, item, migratedAt)),
      )
      if (migratedRoster) {
        await db.accountRosters.add({
          accountId,
          roster: migratedRoster,
          updatedAt: migratedAt,
          source: 'legacy_migration',
        })
      }
      const optimizationResults: AccountOptimizationResult[] = resultSettings.map((setting) => {
        const id = setting.key.slice(legacyResultPrefix.length)
        return {
          scopedId: getScopedId(accountId, id),
          accountId,
          id,
          result: setting.value as ScenarioResult,
          createdAt: migratedAt,
          sourceLegacyId: setting.key,
        }
      })
      await db.accountOptimizationResults.bulkAdd(optimizationResults)
      const scopedHash = await hashScopedLegacyCopy(accountId, db)
      if (scopedHash !== preflight.legacyDataHash) {
        throw new Error('账号副本 hash 校验失败，事务已回滚。')
      }
      await db.settings.put({ key: 'active-account-id', value: accountId })
      beforeCommit?.()
    },
  )
  return {
    status: 'copied' as const,
    counts: preflight.counts,
    legacyDataHash: preflight.legacyDataHash,
  }
}

export async function rollbackLegacyAccountCopy(accountId: string, db: SodaDatabase = database) {
  const account = await db.accounts.get(accountId)
  if (!account || account.source !== 'legacy_migration') {
    throw new Error('目标不是可回滚的旧数据副本。')
  }
  return db.transaction(
    'rw',
    [
      db.accounts,
      db.accountDriveDiscs,
      db.accountDiscEvaluations,
      db.accountScanImportBatches,
      db.accountScanImportItems,
      db.accountRosters,
      db.accountOptimizationResults,
      db.accountPreferences,
    ],
    async () => {
      const counts = await Promise.all([
        db.accountDriveDiscs.where('accountId').equals(accountId).delete(),
        db.accountDiscEvaluations.where('accountId').equals(accountId).delete(),
        db.accountScanImportBatches.where('accountId').equals(accountId).delete(),
        db.accountScanImportItems.where('accountId').equals(accountId).delete(),
        db.accountRosters.delete(accountId),
        db.accountOptimizationResults.where('accountId').equals(accountId).delete(),
        db.accountPreferences.where('accountId').equals(accountId).delete(),
      ])
      await db.accounts.delete(accountId)
      return counts
    },
  )
}

export async function getScopedRoster(accountId: string, db: SodaDatabase = database) {
  accountIdSchema.parse(accountId)
  return (await db.accountRosters.get(accountId))?.roster ?? createEmptyRoster()
}
