import type { AccountRoster, ObservedAgentField, RosterAgent } from '../assault/types'
import type { AccountDriveDisc, AccountRosterRecord } from '../accounts/types'
import { accountIdSchema, getScopedId } from '../accounts/types'
import {
  assertBangbooSkillFacts,
  assertRosterAscensionFacts,
  hydrateRosterDefaults,
} from '../accounts/rosterHydration'
import { getObservedAgentFieldValue, hasObservedAgentField } from '../accounts/observedAgentFacts'
import {
  publicScannerDriveDiscData,
  publicScannerSetIdentities,
} from '../application/publicScannerCatalog'
import { contentHash } from '../application/contentHash'
import { database, type SodaDatabase } from '../db/databaseCore'
import { assertActiveAccountScope } from '../db/accountScanImportScope'
import { driveDiscFactIdentity, reconcileAccountReplacementDiscs } from '../db/discReplacementFacts'
import { preflightDriveDiscImport } from '../domain/discImport'
import { driveDiscSchema } from '../domain/schemas'
import type { AssetQuickReadCandidate } from './snapshotAdapter'

type AccountFacts = { discs: AccountDriveDisc[]; roster: AccountRosterRecord | null }
type Recovery = {
  format: 'soda-asset-quick-read-recovery'
  schemaVersion: 1
  accountId: string
  createdAt: string
  before: AccountFacts
  beforeHash: string
  afterHash: string
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
    inferredDiscLinks: number
  }
  issues: string[]
  importable: boolean
  next: AccountFacts
}

function factHash(facts: AccountFacts) {
  return contentHash({ ...facts, discs: [...facts.discs].sort((a, b) => a.id.localeCompare(b.id)) })
}

function validRecovery(value: unknown, accountId: string): value is Recovery {
  if (!value || typeof value !== 'object') return false
  const recovery = value as Partial<Recovery>
  if (
    recovery.format !== 'soda-asset-quick-read-recovery' ||
    recovery.schemaVersion !== 1 ||
    recovery.accountId !== accountId ||
    typeof recovery.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(recovery.createdAt)) ||
    typeof recovery.beforeHash !== 'string' ||
    typeof recovery.afterHash !== 'string' ||
    !recovery.before ||
    !Array.isArray(recovery.before.discs) ||
    (recovery.before.roster !== null && recovery.before.roster?.accountId !== accountId)
  )
    return false
  try {
    return (
      recovery.before.discs.every(
        (disc) =>
          driveDiscSchema.safeParse(disc).success &&
          disc.accountId === accountId &&
          disc.scopedId === getScopedId(accountId, disc.id),
      ) && factHash(recovery.before) === recovery.beforeHash
    )
  } catch {
    return false
  }
}

export type AssetQuickReadRecoverySummary = {
  recoveryKey: string
  createdAt: string
  canRestore: boolean
  unavailableReason?: string
}

/** Discover only this active account's saved receipt; discovery never restores or writes. */
export function readLatestAssetQuickReadRecovery(
  accountId: string,
  db: SodaDatabase = database,
): Promise<AssetQuickReadRecoverySummary | null> {
  return db.transaction(
    'r',
    [db.accounts, db.settings, db.accountDriveDiscs, db.accountRosters, db.accountPreferences],
    async () => {
      await assertScope(accountId, db)
      const saved = (await db.accountPreferences.where('accountId').equals(accountId).toArray())
        .filter(
          (row) =>
            /^asset-quick-read-recovery-[a-f0-9]{64}$/.test(row.key) &&
            row.scopedId === getScopedId(accountId, row.key) &&
            validRecovery(row.value, accountId),
        )
        .sort(
          (left, right) =>
            Date.parse((right.value as Recovery).createdAt) -
              Date.parse((left.value as Recovery).createdAt) || right.key.localeCompare(left.key),
        )[0]
      if (!saved) return null
      const recovery = saved.value as Recovery
      const currentHash = factHash(await readFacts(accountId, db))
      const canRestore = currentHash === recovery.afterHash
      return {
        recoveryKey: saved.key,
        createdAt: recovery.createdAt,
        canRestore,
        ...(!canRestore
          ? {
              unavailableReason:
                currentHash === recovery.beforeHash
                  ? '这次资产快读导入已恢复，恢复副本继续保留。'
                  : '导入后账户已有其他修改，恢复副本保留，不能直接覆盖。',
            }
          : {}),
      }
    },
  )
}

async function readFacts(accountId: string, db: SodaDatabase): Promise<AccountFacts> {
  return {
    discs: await db.accountDriveDiscs.where('accountId').equals(accountId).toArray(),
    roster: (await db.accountRosters.get(accountId)) ?? null,
  }
}

async function assertScope(accountId: string, db: SodaDatabase) {
  accountIdSchema.parse(accountId)
  const account = await db.accounts.get(accountId)
  if (!account || account.status !== 'active') throw new Error('资产快读目标账户已不存在或已归档。')
  await assertActiveAccountScope(accountId, db)
}

function locked(agent: RosterAgent, field: ObservedAgentField) {
  return (
    agent.manualSource === 'manual_override' ||
    agent.lockedFields.includes(field) ||
    agent.lockedFields.includes(field.split('.')[0]) ||
    (field.startsWith('skillLevels.') && agent.lockedFields.includes('skills')) ||
    (field.startsWith('wEngineDetails.') && agent.lockedFields.includes('wEngine')) ||
    (agent.progressionManuallySet === true &&
      (['level', 'ascension', 'mindscape'].includes(field) || field.startsWith('skillLevels.')))
  )
}

function mergeRoster(
  current: AccountRoster,
  candidate: AssetQuickReadCandidate,
  sourceToId: Map<string, string>,
) {
  let protectedFields = 0
  const incoming = new Map(candidate.agents.map((agent) => [agent.agentId, agent]))
  const roster: AccountRoster = {
    ...current,
    agents: current.agents.map((existing) => {
      const observation = incoming.get(existing.agentId)
      if (!observation) return existing
      const next = structuredClone(existing)
      let adopted = false
      const adoptedFields = new Set<ObservedAgentField>()
      for (const field of observation.observedFields) {
        if (
          locked(existing, field) ||
          (existing.observedFacts?.fields[field]?.capturedAt ?? '') > candidate.capturedAt
        ) {
          protectedFields++
          continue
        }
        const value =
          field === 'equippedDiscIds'
            ? observation.equippedSourceIds.map((id) => sourceToId.get(id))
            : getObservedAgentFieldValue(observation.fields, field)
        if (field === 'equippedDiscIds' && (value as unknown[]).some((id) => !id))
          throw new Error('代理人装备盘无法对应到本次账户盘库，未导入。')
        const [parent, child] = field.split('.')
        if (child) {
          if (parent === 'skillLevels') next.skillLevels = { ...next.skillLevels, [child]: value }
          else if (parent === 'wEngineDetails')
            next.wEngineDetails = { ...next.wEngineDetails, [child]: value }
          else throw new Error('资产快读字段不在可导入范围内。')
        } else {
          Object.assign(next, { [parent]: value })
        }
        next.observedFacts ??= {
          schemaVersion: 1,
          source: 'asset_quick_read',
          protocolVersion: '3.2',
          fields: {},
        }
        next.observedFacts.fields[field] = {
          capturedAt: candidate.capturedAt,
          snapshotSha256: candidate.snapshotSha256,
        }
        if (!hasObservedAgentField(next, field))
          throw new Error('资产快读代理人字段未通过值与来源检查，未导入。')
        adopted = true
        adoptedFields.add(field)
      }
      if (adopted) {
        next.source = 'asset_quick_read'
        next.syncedAt = candidate.capturedAt
        next.completeness = 'partial'
        if (adoptedFields.has('wEngineDetails.name'))
          next.wEngine = next.wEngineDetails.name ?? next.wEngine
        if (adoptedFields.has('wEngineDetails.refinement'))
          next.refinement = next.wEngineDetails.refinement ?? next.refinement
        if ([...adoptedFields].some((field) => field.startsWith('skillLevels.')))
          next.skills = '快读实测'
        if (adoptedFields.has('equippedDiscIds')) next.currentEquipment = 'known'
      }
      return next
    }),
    updatedAt: candidate.capturedAt,
  }
  const physicalOwners = new Map<string, string>()
  for (const agent of roster.agents) {
    for (const id of agent.equippedDiscIds ?? []) {
      const owner = physicalOwners.get(id)
      if (owner && owner !== agent.agentId)
        throw new Error('本次装备引用与保留的手动或旧装备记录冲突，请先核对该盘的装备归属。')
      physicalOwners.set(id, agent.agentId)
    }
  }
  assertBangbooSkillFacts(roster)
  assertRosterAscensionFacts(roster)
  return { roster, protectedFields }
}

function createPlan(
  accountId: string,
  candidate: AssetQuickReadCandidate,
  before: AccountFacts,
): AssetQuickReadImportPlan {
  if (!candidate.importable || candidate.issues.length)
    throw new Error('资产快读结果存在未解决的问题，不能导入。')
  const data = publicScannerDriveDiscData
  if (!data) throw new Error('当前驱动盘规则不可用，请先完成数据加载。')
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
    throw new Error('本次 S 盘预检未全部通过，未写入账户。')
  const sources = parsed.readyDiscs.map((disc) => disc.importSource?.sourceId)
  if (sources.some((source) => !source) || new Set(sources).size !== sources.length)
    throw new Error('物理盘实例编号缺失或重复，未写入账户。')
  const incomingSources = new Set(sources)
  const eligible = before.discs.filter(
    (disc) =>
      !disc.importSource?.sourceId?.startsWith('asset-quick-read:') ||
      incomingSources.has(disc.importSource.sourceId),
  )
  const reconciled = reconcileAccountReplacementDiscs(parsed.readyDiscs, eligible)
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
    if (!previous && knownById.has(id)) throw new Error('新实例编号与旧盘冲突，未写入账户。')
    const unchangedFacts =
      previous && driveDiscFactIdentity(previous) === driveDiscFactIdentity(disc)
    const previousCapturedAt = previous?.importSource?.capturedAt
    const staleObservation =
      previousCapturedAt && Date.parse(candidate.capturedAt) <= Date.parse(previousCapturedAt)
    if (previous && staleObservation && !unchangedFacts)
      throw new Error(
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
    throw new Error(
      '旧扫描盘与本次物理实例存在数量不一致的同属性记录，请先核对，未自动合并或删除。',
    )
  const current = hydrateRosterDefaults(before.roster?.roster ?? {})
  const knownAgentIds = new Set(current.agents.map((agent) => agent.agentId))
  if (candidate.agents.some((agent) => !knownAgentIds.has(agent.agentId)))
    throw new Error('代理人目录未覆盖本次角色，未写入账户。')
  const merged = mergeRoster(current, candidate, sourceToId)
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
      inferredDiscLinks,
    },
    issues: [],
    importable: true,
    next: {
      discs: [...retained, ...observed],
      roster: {
        accountId,
        roster: merged.roster,
        updatedAt: candidate.capturedAt,
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
    [db.accounts, db.settings, db.accountDriveDiscs, db.accountRosters],
    async () => {
      await assertScope(accountId, db)
      return createPlan(accountId, candidate, await readFacts(accountId, db))
    },
  )
}

export function confirmAssetQuickReadImport(
  candidate: AssetQuickReadCandidate,
  plan: AssetQuickReadImportPlan,
  confirmation: { accountId: string; snapshotSha256: string; sameGameAccountAndCounts: true },
  db: SodaDatabase = database,
  beforeCommit?: () => void,
) {
  return db.transaction(
    'rw',
    [db.accounts, db.settings, db.accountDriveDiscs, db.accountRosters, db.accountPreferences],
    async () => {
      if (
        confirmation.sameGameAccountAndCounts !== true ||
        confirmation.accountId !== plan.accountId ||
        confirmation.snapshotSha256 !== plan.snapshotSha256 ||
        contentHash(candidate) !== plan.candidateHash
      )
        throw new Error('目标账户或快照已变化，请重新核对并确认。')
      await assertScope(plan.accountId, db)
      const before = await readFacts(plan.accountId, db)
      if (factHash(before) !== plan.beforeHash)
        throw new Error('账户在检查后发生了变化，请重新检查，未写入。')
      const fresh = createPlan(plan.accountId, candidate, before)
      const key = `asset-quick-read-recovery-${candidate.snapshotSha256.toLowerCase()}`
      const scopedId = getScopedId(plan.accountId, key)
      if (await db.accountPreferences.get(scopedId))
        throw new Error('这份快照已导入并保留恢复副本，请勿重复导入。')
      const recovery: Recovery = {
        format: 'soda-asset-quick-read-recovery',
        schemaVersion: 1,
        accountId: plan.accountId,
        createdAt: new Date().toISOString(),
        before,
        beforeHash: factHash(before),
        afterHash: factHash(fresh.next),
      }
      await db.accountPreferences.add({
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
        throw new Error('账户守恒校验失败，事务已回滚。')
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
    [db.accounts, db.settings, db.accountDriveDiscs, db.accountRosters, db.accountPreferences],
    async () => {
      if (confirmation !== 'restore_asset_quick_read') throw new Error('需要明确确认恢复本次导入。')
      await assertScope(accountId, db)
      const stored = await db.accountPreferences.get(getScopedId(accountId, recoveryKey))
      const recovery = stored?.value
      if (stored?.accountId !== accountId || !validRecovery(recovery, accountId))
        throw new Error('本次导入的恢复副本不可用，未修改账户。')
      const current = await readFacts(accountId, db)
      if (factHash(current) !== recovery.afterHash)
        throw new Error('导入后账户已有其他修改，未覆盖；请通过账户备份单独恢复。')
      for (const disc of recovery.before.discs) {
        driveDiscSchema.parse(disc)
        if (disc.accountId !== accountId || disc.scopedId !== getScopedId(accountId, disc.id))
          throw new Error('恢复副本账户范围不一致。')
      }
      const previousIds = new Set(recovery.before.discs.map((disc) => disc.id))
      await db.accountDriveDiscs.bulkDelete(
        current.discs.filter((disc) => !previousIds.has(disc.id)).map((disc) => disc.scopedId),
      )
      await db.accountDriveDiscs.bulkPut(recovery.before.discs)
      if (recovery.before.roster) await db.accountRosters.put(recovery.before.roster)
      else await db.accountRosters.delete(accountId)
      if (factHash(await readFacts(accountId, db)) !== recovery.beforeHash)
        throw new Error('恢复守恒校验失败，事务已回滚。')
      return { accountId, restoredDiscs: recovery.before.discs.length }
    },
  )
}
