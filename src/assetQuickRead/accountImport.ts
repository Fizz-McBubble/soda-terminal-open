import { hydrateRosterDefaults } from '../accounts/rosterHydration'
import type { AccountDriveDisc } from '../accounts/types'
import { getScopedId } from '../accounts/types'
import { contentHash } from '../application/contentHash'
import {
  publicScannerDriveDiscData,
  publicScannerSetIdentities,
} from '../application/publicScannerCatalog'
import { database, type SodaDatabase } from '../db/databaseCore'
import { driveDiscFactIdentity, reconcileAccountReplacementDiscs } from '../db/discReplacementFacts'
import { preflightDriveDiscImport } from '../domain/discImport'
import { driveDiscSchema } from '../domain/schemas'
import {
  type AccountFacts,
  type Recovery,
  assertScope,
  factHash,
  readFacts,
  readPlanningDiscIds,
  recoveryUnavailableReason,
  validRecovery,
} from './accountImportRecoverySupport'
import { mergeAssetQuickReadRoster } from './accountRosterMerge'
import { AssetQuickReadImportError } from './importErrors'
import type { AssetQuickReadCandidate } from './snapshotAdapter'
export {
  type AssetQuickReadRecoverySummary,
  readLatestAssetQuickReadRecovery,
} from './accountImportRecoverySupport'

export const assetQuickReadRecoveryLimit = 10

async function assertSnapshotAvailable(
  accountId: string,
  snapshotSha256: string,
  db: SodaDatabase,
) {
  const key = `asset-quick-read-recovery-${snapshotSha256.toLowerCase()}`
  const existing = await db.accountPreferences.get(getScopedId(accountId, key))
  if (
    existing &&
    (!validRecovery(existing.value, accountId) ||
      !existing.value.restoredAt ||
      factHash(await readFacts(accountId, db)) !== existing.value.beforeHash)
  )
    throw new AssetQuickReadImportError(
      'import_snapshot_reused',
      '这份快照已导入或恢复后账户已有其他修改，请使用新的读取结果。',
    )
  if (
    !existing &&
    (await db.accountPreferences.where('accountId').equals(accountId).toArray()).filter((row) =>
      row.key.startsWith('asset-quick-read-recovery-'),
    ).length >= assetQuickReadRecoveryLimit
  )
    throw new AssetQuickReadImportError(
      'import_recovery_limit_reached',
      '资产快读恢复副本已达 10 份，请先在账户与备份保管恢复副本后再继续。',
    )
  return existing
}

export type AssetQuickReadImportPlan = {
  accountId: string
  snapshotSha256: string
  candidateHash: string
  beforeHash: string
  summary: {
    observedDiscs: number
    newDiscs: number
    updatedDiscs: number
    retainedDiscs: number
    observedAgents: number
    protectedFields: number
    syncedManualProgressionFields: number
    inferredDiscLinks: number
  }
  issues: string[]
  importable: boolean
  next: AccountFacts
}

function createPlan(
  accountId: string,
  candidate: AssetQuickReadCandidate,
  before: AccountFacts,
  planningDiscIds: Set<string>,
): AssetQuickReadImportPlan {
  if (
    !Number.isFinite(Date.parse(candidate.capturedAt)) ||
    (before.roster &&
      (!Number.isFinite(Date.parse(before.roster.updatedAt)) ||
        !Number.isFinite(Date.parse(before.roster.roster.updatedAt)) ||
        before.roster.roster.agents.some((agent) =>
          Object.values(agent.observedFacts?.fields ?? {}).some(
            (field) => field && !Number.isFinite(Date.parse(field.capturedAt)),
          ),
        ))) ||
    before.discs.some(
      (disc) =>
        !Number.isFinite(Date.parse(disc.updatedAt)) ||
        (disc.importSource?.capturedAt !== undefined &&
          !Number.isFinite(Date.parse(disc.importSource.capturedAt))),
    )
  )
    throw new AssetQuickReadImportError(
      'import_snapshot_invalid',
      '驱动盘或快照时间无效，无法核对数据顺序，未写入账户。',
    )
  if (!candidate.importable || candidate.issues.length)
    throw new AssetQuickReadImportError(
      'import_review_required',
      '资产快读结果存在未解决的问题，不能导入。',
    )
  const data = publicScannerDriveDiscData
  if (!data)
    throw new AssetQuickReadImportError(
      'import_data_unavailable',
      '当前驱动盘规则不可用，请先完成数据加载。',
    )
  if (candidate.discs.discs.some((disc) => disc.rarity !== 'S'))
    throw new AssetQuickReadImportError(
      'import_preflight_failed',
      '资产快读仅支持 S 级盘导入，未写入账户。',
    )
  const parsed = candidate.discs.discs.length
    ? preflightDriveDiscImport(candidate.discs, {
        driveDiscSets: data.driveDiscSets,
        driveDiscSetIdentities: publicScannerSetIdentities,
        driveDiscRules: data.rules,
        gameDataVersion: data.gameVersion,
        existingDiscs: [],
        now: candidate.capturedAt,
        batchId: `asset-quick-read-${candidate.snapshotSha256.toLowerCase()}`,
      })
    : { summary: { failed: 0, skipped: 0 }, readyDiscs: [] }
  if (
    parsed.summary.failed ||
    parsed.summary.skipped ||
    parsed.readyDiscs.length !== candidate.counts.sDiscs
  )
    throw new AssetQuickReadImportError(
      'import_preflight_failed',
      '本次 S 盘预检未全部通过，未写入账户。',
    )
  const sources = parsed.readyDiscs.map((disc) => disc.importSource?.sourceId)
  if (sources.some((source) => !source) || new Set(sources).size !== sources.length)
    throw new AssetQuickReadImportError(
      'import_identity_conflict',
      '物理盘实例编号缺失或重复，未写入账户。',
    )
  const incomingSources = new Set(sources)
  const eligible = before.discs.filter(
    (disc) =>
      !disc.importSource?.sourceId?.startsWith('asset-quick-read:') ||
      incomingSources.has(disc.importSource.sourceId),
  )
  const reconciled = reconcileAccountReplacementDiscs(parsed.readyDiscs, eligible)
  // Legacy scans have no physical UID. Equal-sized groups without player
  // annotations can keep all local IDs without moving any per-copy metadata.
  // This remains an inferred link; unequal or annotated groups stay unresolved.
  const reconciledIds = new Set(reconciled.discs.map((disc) => disc.id))
  const availableLegacyByFact = new Map<string, AccountDriveDisc[]>()
  for (const disc of eligible) {
    if (reconciledIds.has(disc.id) || disc.importSource?.sourceId?.startsWith('asset-quick-read:'))
      continue
    const identity = driveDiscFactIdentity(disc)
    const group = availableLegacyByFact.get(identity) ?? []
    group.push(disc)
    availableLegacyByFact.set(identity, group)
  }
  const knownIds = new Set(before.discs.map((disc) => disc.id))
  const protectedDiscIds = new Set([
    ...planningDiscIds,
    ...(before.roster?.roster.agents.flatMap((agent) => agent.equippedDiscIds ?? []) ?? []),
  ])
  const unmatchedByFact = new Map<string, number[]>()
  for (const [index, disc] of reconciled.discs.entries()) {
    if (knownIds.has(disc.id)) continue
    const identity = driveDiscFactIdentity(disc)
    const group = unmatchedByFact.get(identity) ?? []
    group.push(index)
    unmatchedByFact.set(identity, group)
  }
  for (const [identity, indexes] of unmatchedByFact) {
    const legacy = availableLegacyByFact.get(identity) ?? []
    if (
      legacy.length !== indexes.length ||
      legacy.length < 2 ||
      legacy.some((disc) => disc.favorite || disc.tags.length > 0 || protectedDiscIds.has(disc.id))
    )
      continue
    const orderedLegacy = legacy.toSorted((a, b) => a.id.localeCompare(b.id))
    const orderedIndexes = indexes.toSorted((a, b) =>
      reconciled.discs[a]!.importSource!.sourceId!.localeCompare(
        reconciled.discs[b]!.importSource!.sourceId!,
      ),
    )
    orderedIndexes.forEach((index, position) => {
      const old = orderedLegacy[position]!
      reconciled.discs[index] = {
        ...reconciled.discs[index]!,
        id: old.id,
        favorite: old.favorite,
        tags: [...old.tags],
        createdAt: old.createdAt,
      }
    })
  }
  const knownById = new Map(before.discs.map((disc) => [disc.id, disc]))
  const matchedIds = new Set<string>()
  const sourceToId = new Map<string, string>()
  let inferredDiscLinks = 0
  const observed = reconciled.discs.map((disc) => {
    const previous = knownById.get(disc.id)
    if (previous) {
      matchedIds.add(previous.id)
      if (previous.importSource?.sourceId !== disc.importSource?.sourceId) inferredDiscLinks++
    }
    const id =
      previous?.id ?? `asset-disc-${disc.importSource!.sourceId!.slice('asset-quick-read:'.length)}`
    if (!previous && knownById.has(id))
      throw new AssetQuickReadImportError(
        'import_identity_conflict',
        '新实例编号与旧盘冲突，未写入账户。',
      )
    const unchangedFacts =
      previous && driveDiscFactIdentity(previous) === driveDiscFactIdentity(disc)
    const previousCapturedAt = previous?.importSource?.capturedAt
    const staleObservation =
      previousCapturedAt && Date.parse(candidate.capturedAt) <= Date.parse(previousCapturedAt)
    if (previous && staleObservation && !unchangedFacts)
      throw new AssetQuickReadImportError(
        'import_snapshot_stale',
        '文件中的驱动盘数据早于或冲突于已保存的资产快读结果，请重新读取，未写入账户。',
      )
    // An identical older observation can still resolve equipment IDs, but must not rewind its provenance.
    if (previous && staleObservation) {
      sourceToId.set(disc.importSource!.sourceId!, id)
      return previous
    }
    const value: AccountDriveDisc = {
      ...previous,
      ...disc,
      id,
      scopedId: getScopedId(accountId, id),
      accountId,
      sourceLegacyId: previous?.sourceLegacyId ?? null,
      migratedAt: previous?.migratedAt ?? null,
      updatedAt:
        previous && Date.parse(previous.updatedAt) > Date.parse(disc.updatedAt)
          ? previous.updatedAt
          : disc.updatedAt,
      discVersion: unchangedFacts
        ? previous.discVersion
        : contentHash({ id, facts: driveDiscFactIdentity(disc) }),
    }
    driveDiscSchema.parse(value)
    sourceToId.set(disc.importSource!.sourceId!, id)
    return value
  })
  const retained = before.discs.filter((disc) => !matchedIds.has(disc.id))
  // A different number of indistinguishable legacy records must not silently create duplicates.
  const retainedLegacyFacts = new Set(
    retained
      .filter((disc) => !disc.importSource?.sourceId?.startsWith('asset-quick-read:'))
      .map(driveDiscFactIdentity),
  )
  if (
    observed.some(
      (disc) => !matchedIds.has(disc.id) && retainedLegacyFacts.has(driveDiscFactIdentity(disc)),
    )
  )
    throw new AssetQuickReadImportError(
      'import_identity_conflict',
      '旧盘中有同属性记录暂无法确认对应关系，未自动合并或删除。',
    )
  const current = hydrateRosterDefaults(before.roster?.roster ?? {})
  const knownAgentIds = new Set(current.agents.map((agent) => agent.agentId))
  if (candidate.agents.some((agent) => !knownAgentIds.has(agent.agentId)))
    throw new AssetQuickReadImportError(
      'import_data_unavailable',
      '代理人目录未覆盖本次角色，未写入账户。',
    )
  const merged = mergeAssetQuickReadRoster(current, candidate, sourceToId, before.roster?.updatedAt)
  return {
    accountId,
    snapshotSha256: candidate.snapshotSha256,
    candidateHash: contentHash(candidate),
    beforeHash: factHash(before),
    summary: {
      observedDiscs: observed.length,
      newDiscs: observed.length - matchedIds.size,
      updatedDiscs: matchedIds.size,
      retainedDiscs: retained.length,
      observedAgents: candidate.agents.length,
      protectedFields: merged.protectedFields,
      syncedManualProgressionFields: merged.syncedManualProgressionFields,
      inferredDiscLinks,
    },
    issues: [],
    importable: true,
    next: {
      discs: [...retained, ...observed],
      roster: {
        accountId,
        roster: merged.roster,
        updatedAt:
          before.roster && Date.parse(before.roster.updatedAt) > Date.parse(candidate.capturedAt)
            ? before.roster.updatedAt
            : candidate.capturedAt,
        source: before.roster?.source ?? 'manual',
      },
    },
  }
}

export function prepareAssetQuickReadImport(
  accountId: string,
  candidate: AssetQuickReadCandidate,
  db: SodaDatabase = database,
) {
  return db.transaction(
    'r',
    [
      db.accounts,
      db.settings,
      db.accountDriveDiscs,
      db.accountRosters,
      db.accountPreferences,
      db.accountPlanningDrafts,
    ],
    async () => {
      await assertScope(accountId, db)
      await assertSnapshotAvailable(accountId, candidate.snapshotSha256, db)
      return createPlan(
        accountId,
        candidate,
        await readFacts(accountId, db),
        await readPlanningDiscIds(accountId, db),
      )
    },
  )
}

export function confirmAssetQuickReadImport(
  candidate: AssetQuickReadCandidate,
  plan: AssetQuickReadImportPlan,
  confirmation: {
    accountId: string
    snapshotSha256: string
    sameGameAccountAndCounts: true
  },
  db: SodaDatabase = database,
  beforeCommit?: () => void,
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
      if (
        confirmation.sameGameAccountAndCounts !== true ||
        confirmation.accountId !== plan.accountId ||
        confirmation.snapshotSha256 !== plan.snapshotSha256 ||
        contentHash(candidate) !== plan.candidateHash
      )
        throw new AssetQuickReadImportError(
          'import_scope_changed',
          '目标账户或快照已变化，请重新核对并确认。',
        )
      await assertScope(plan.accountId, db)
      const before = await readFacts(plan.accountId, db)
      if (factHash(before) !== plan.beforeHash)
        throw new AssetQuickReadImportError(
          'import_account_changed',
          '账户在检查后发生了变化，请重新检查，未写入。',
        )
      const fresh = createPlan(
        plan.accountId,
        candidate,
        before,
        await readPlanningDiscIds(plan.accountId, db),
      )
      const key = `asset-quick-read-recovery-${candidate.snapshotSha256.toLowerCase()}`
      const scopedId = getScopedId(plan.accountId, key)
      await assertSnapshotAvailable(plan.accountId, candidate.snapshotSha256, db)
      const recovery: Recovery = {
        format: 'soda-asset-quick-read-recovery',
        schemaVersion: 1,
        accountId: plan.accountId,
        createdAt: new Date().toISOString(),
        before,
        beforeHash: factHash(before),
        afterHash: factHash(fresh.next),
      }
      await db.accountPreferences.put({
        scopedId,
        accountId: plan.accountId,
        key,
        value: recovery,
        updatedAt: recovery.createdAt,
      })
      await db.accountDriveDiscs.bulkPut(fresh.next.discs)
      await db.accountRosters.put(fresh.next.roster!)
      const after = await readFacts(plan.accountId, db)
      if (
        factHash(after) !== recovery.afterHash ||
        after.discs.length !== before.discs.length + fresh.summary.newDiscs
      )
        throw new AssetQuickReadImportError(
          'import_conservation_failed',
          '账户守恒校验失败，事务已回滚。',
        )
      beforeCommit?.()
      return {
        accountId: plan.accountId,
        recoveryKey: key,
        ...fresh.summary,
        totalDiscs: after.discs.length,
      }
    },
  )
}

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

export async function removeSavedAssetQuickReadRecovery(
  accountId: string,
  recoveryKey: string,
  expectedHash: string,
  confirmation: 'downloaded_and_keep_external_copy',
  db: SodaDatabase = database,
) {
  if (
    confirmation !== 'downloaded_and_keep_external_copy' ||
    !/^asset-quick-read-recovery-[a-f0-9]{64}$/.test(recoveryKey)
  )
    throw new Error('请明确确认已下载并保管此恢复副本。')
  return db.transaction('rw', [db.accounts, db.settings, db.accountPreferences], async () => {
    await assertScope(accountId, db)
    const key = getScopedId(accountId, recoveryKey)
    const saved = await db.accountPreferences.get(key)
    if (!saved || saved.accountId !== accountId || contentHash(saved.value) !== expectedHash)
      throw new Error('恢复副本已变化，未移除。')
    await db.accountPreferences.delete(key)
  })
}
