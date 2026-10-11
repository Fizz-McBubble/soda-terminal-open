import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveAccountRoster } from '../accounts/repository'
import { hydrateRosterDefaults } from '../accounts/rosterHydration'
import type { RosterAgent } from '../assault/types'
import type { SodaDatabase } from '../db/databaseCore'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  restoreAssetQuickReadImport,
} from './accountImport'
import {
  accountId,
  otherAccountId,
  now,
  earlier,
  agentId,
  candidate,
  storedDisc,
  createQuickReadTestDatabase,
} from './accountImport.fixtures'

const oldEngine = {
  id: 'wengine-13002',
  name: '旧手动音擎',
  level: 40,
  ascension: 3,
  refinement: 3,
}
function engineCandidate() {
  const input = candidate()
  input.agents[0].fields.wEngineDetails = {
    id: 'wengine-13001',
    name: '聚宝箱',
    level: 20,
    ascension: 1,
    refinement: 2,
  }
  input.agents[0].observedFields.push('wEngineDetails.level', 'wEngineDetails.ascension')
  return input
}

const mainStats = [
  'hp_flat',
  'atk_flat',
  'def_flat',
  'hp_percent',
  'physical_dmg',
  'energy_regen',
] as const
const oldDiscIds = mainStats.map((_, index) => `old-equipped-${index + 1}`)
function equippedCandidate() {
  const input = engineCandidate()
  const disc = input.discs.discs[0]
  input.discs.discs = mainStats.map((mainStat, index) => ({
    ...structuredClone(disc),
    mainStat,
    slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    sourceId: `asset-quick-read:${880001 + index}`,
  }))
  input.counts.discs = input.counts.sDiscs = 6
  input.agents[0].equippedSourceIds = input.discs.discs.map((row) => row.sourceId!)
  return input
}

describe('asset quick read current engine synchronization', () => {
  let db: SodaDatabase
  beforeEach(async () => {
    db = await createQuickReadTestDatabase()
    await patchAgent({
      manualSource: 'manual_override',
      wEngineDetails: oldEngine,
      wEngine: oldEngine.name,
      refinement: oldEngine.refinement,
    })
  })
  afterEach(async () => {
    db.close()
    expect(db.name.startsWith('asset-quick-read-test-')).toBe(true)
    await Dexie.delete(db.name)
  })
  async function agent() {
    return (await db.accountRosters.get(accountId))!.roster.agents.find(
      (row) => row.agentId === agentId,
    )!
  }
  async function patchAgent(patch: Partial<RosterAgent>) {
    const record = (await db.accountRosters.get(accountId))!
    Object.assign(
      record.roster.agents.find((row) => row.agentId === agentId)!,
      structuredClone(patch),
    )
    await db.accountRosters.put(record)
  }
  async function facts() {
    return {
      accounts: await db.accounts.toArray(),
      rosters: await db.accountRosters.toArray(),
      discs: await db.accountDriveDiscs.toArray(),
      preferences: await db.accountPreferences.toArray(),
      plans: await db.accountPlanningDrafts.toArray(),
    }
  }
  function confirmation(input = engineCandidate()) {
    return {
      accountId,
      snapshotSha256: input.snapshotSha256,
      sameGameAccountAndCounts: true as const,
    }
  }
  async function apply(input = engineCandidate()) {
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    return confirmAssetQuickReadImport(input, plan, confirmation(input), db)
  }
  async function saveOldEquipment() {
    await db.accountDriveDiscs.bulkPut(
      mainStats.map((mainStat, index) => ({
        ...storedDisc(oldDiscIds[index], `asset-quick-read:${990001 + index}`),
        mainStat,
        slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      })),
    )
    await patchAgent({ equippedDiscIds: oldDiscIds, currentEquipment: 'known' })
  }

  it('adopts current engine and six equipped discs, persists them without changing saved intentions and restores the exact prior roster', async () => {
    await saveOldEquipment()
    const other = structuredClone((await db.accountRosters.get(accountId))!)
    other.accountId = otherAccountId
    other.roster.agents.find((row) => row.agentId === agentId)!.equippedDiscIds = null
    await db.accountRosters.put(other)
    await db.accountPlanningDrafts.put({
      scopedId: `${accountId}:synthetic-build`,
      accountId,
      id: 'synthetic-build',
      kind: 'agent',
      name: '玩家配装方案',
      state: 'saved',
      selection: { agentIds: [agentId], bangbooId: null, scenario: 'synthetic' },
      manualOverrides: {
        wEngineDirection: '旧手动音擎',
        discDirection: '玩家选择',
        progressionDirection: '保留方案',
        notes: '',
      },
      solutionContext: {
        contract: 'soda-solution-context/v1',
        scope: 'agent_independent',
        resourcePolicy: 'advisory',
        sourceCandidateId: 'synthetic',
        inputFingerprint: 'synthetic',
        solverMethod: 'synthetic',
        gameVersion: '3.2',
        knowledgeVersion: 'synthetic',
        exactVariantKey: null,
        comparisonParameters: {
          wEngine: { engineId: oldEngine.id, level: 40, ascension: 3, refinement: 3 },
        },
      },
      knowledgeRefs: [],
      warehouseRefs: oldDiscIds,
      comparisonCapability: 'direction',
      createdAt: earlier,
      updatedAt: earlier,
      revision: 1,
    })
    const before = await facts()
    const input = equippedCandidate()
    const receipt = await apply(input)
    expect(await agent()).toMatchObject({
      wEngineDetails: input.agents[0].fields.wEngineDetails,
      wEngine: '聚宝箱',
      refinement: 2,
      manualSource: 'manual_override',
    })
    for (const field of input.agents[0].observedFields.filter((field) =>
      field.startsWith('wEngineDetails.'),
    ))
      expect((await agent()).observedFacts?.fields[field]).toEqual({
        capturedAt: now,
        snapshotSha256: input.snapshotSha256,
      })
    db.close()
    await db.open()
    const hydrated = hydrateRosterDefaults(
      (await db.accountRosters.get(accountId))!.roster,
    ).agents.find((row) => row.agentId === agentId)!
    expect(hydrated.wEngineDetails).toEqual(input.agents[0].fields.wEngineDetails)
    const currentIds = input.agents[0].equippedSourceIds.map(
      (source) => `asset-disc-${source.slice('asset-quick-read:'.length)}`,
    )
    expect(hydrated.equippedDiscIds).toEqual(currentIds)
    expect(hydrated.currentEquipment).toBe('known')
    expect((await agent()).observedFacts?.fields.equippedDiscIds).toEqual({
      capturedAt: now,
      snapshotSha256: input.snapshotSha256,
    })
    expect(await db.accountPlanningDrafts.toArray()).toEqual(before.plans)
    expect((await facts()).rosters.filter((row) => row.accountId === otherAccountId)).toEqual(
      before.rosters.filter((row) => row.accountId === otherAccountId),
    )
    expect((await facts()).discs.filter((row) => row.accountId === otherAccountId)).toEqual(
      before.discs.filter((row) => row.accountId === otherAccountId),
    )
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect((await facts()).rosters).toEqual(before.rosters)
    expect((await facts()).discs).toEqual(before.discs)
    expect((await facts()).plans).toEqual(before.plans)
  })
  it.each(['locked', 'unobserved', 'newer observation'])(
    'retains manual equipped discs when the current reference is %s',
    async (boundary) => {
      await saveOldEquipment()
      const input = equippedCandidate()
      if (boundary === 'locked') await patchAgent({ lockedFields: ['equippedDiscIds'] })
      else if (boundary === 'newer observation')
        await patchAgent({
          observedFacts: {
            schemaVersion: 1,
            source: 'asset_quick_read',
            protocolVersion: '3.2',
            fields: {
              equippedDiscIds: {
                capturedAt: '2026-10-10T00:01:00.000Z',
                snapshotSha256: 'b'.repeat(64),
              },
            },
          },
        })
      else
        input.agents[0].observedFields = input.agents[0].observedFields.filter(
          (field) => field !== 'equippedDiscIds',
        )
      await apply(input)
      expect((await agent()).equippedDiscIds).toEqual(oldDiscIds)
      expect((await agent()).observedFacts?.fields.equippedDiscIds?.snapshotSha256).toBe(
        boundary === 'newer observation' ? 'b'.repeat(64) : undefined,
      )
    },
  )
  it('rejects stale manual equipment changes but treats identical disc IDs as equal facts', async () => {
    await saveOldEquipment()
    const input = equippedCandidate()
    await apply(input)
    const currentIds = (await agent()).equippedDiscIds!
    const record = (await db.accountRosters.get(accountId))!
    record.roster.agents.find((row) => row.agentId === agentId)!.equippedDiscIds = oldDiscIds
    record.updatedAt = record.roster.updatedAt = '2026-10-10T00:01:00.000Z'
    await db.accountRosters.put(record)
    const late = equippedCandidate()
    late.snapshotSha256 = 'b'.repeat(64)
    late.agents[0].observedFields = ['equippedDiscIds']
    const before = await facts()
    await expect(apply(late)).rejects.toThrow('请重新读取')
    expect(await facts()).toEqual(before)
    await patchAgent({ equippedDiscIds: [...currentIds] })
    const unchanged = await facts()
    const plan = await prepareAssetQuickReadImport(accountId, late, db)
    expect(plan.summary.protectedFields).toBe(1)
    expect(
      plan.next.roster!.roster.agents.find((row) => row.agentId === agentId)!.equippedDiscIds,
    ).toEqual(currentIds)
    expect(await facts()).toEqual(unchanged)
  })
  it.each(['wEngine', 'wEngineDetails'])(
    'retains the %s parent lock without adding engine observation authority',
    async (lock) => {
      await patchAgent({ lockedFields: [lock] })
      await apply()
      expect(await agent()).toMatchObject({
        wEngineDetails: oldEngine,
        wEngine: oldEngine.name,
        refinement: oldEngine.refinement,
      })
      expect(
        Object.keys((await agent()).observedFacts?.fields ?? {}).filter((field) =>
          field.startsWith('wEngineDetails.'),
        ),
      ).toEqual([])
    },
  )
  it('protects exact engine locks and newer per-field observations independently', async () => {
    const marker = { capturedAt: '2026-10-09T23:00:00-02:00', snapshotSha256: 'b'.repeat(64) }
    await patchAgent({
      lockedFields: ['wEngineDetails.level'],
      observedFacts: {
        schemaVersion: 1,
        source: 'asset_quick_read',
        protocolVersion: '3.2',
        fields: { 'wEngineDetails.refinement': marker },
      },
    })
    await apply()
    expect((await agent()).wEngineDetails).toEqual({
      id: 'wengine-13001',
      name: '聚宝箱',
      level: 40,
      ascension: 1,
      refinement: 3,
    })
    expect((await agent()).refinement).toBe(3)
    expect((await agent()).observedFacts?.fields['wEngineDetails.level']).toBeUndefined()
    expect((await agent()).observedFacts?.fields['wEngineDetails.refinement']).toEqual(marker)
  })
  it('rejects an older candidate conflicting only with manually edited engine facts before any writes', async () => {
    const input = engineCandidate()
    input.agents[0].observedFields = input.agents[0].observedFields.filter((field) =>
      field.startsWith('wEngineDetails.'),
    )
    const record = (await db.accountRosters.get(accountId))!
    record.updatedAt = record.roster.updatedAt = '2026-10-10T00:01:00.000Z'
    await db.accountRosters.put(record)
    const before = await facts()
    await expect(apply(input)).rejects.toThrow('请重新读取')
    expect(await facts()).toEqual(before)
  })
  it('adopts observed identity while keeping unobserved manual growth and provenance absent', async () => {
    await patchAgent({
      wEngineDetails: {
        ...oldEngine,
        manualProgression: {
          engineId: oldEngine.id,
          level: oldEngine.level,
          ascension: oldEngine.ascension,
          refinement: oldEngine.refinement,
        },
      },
    })
    const input = engineCandidate()
    input.agents[0].observedFields = input.agents[0].observedFields.filter(
      (field) =>
        !['wEngineDetails.level', 'wEngineDetails.ascension', 'wEngineDetails.refinement'].includes(
          field,
        ),
    )
    input.agents[0].fields.wEngineDetails = {
      id: 'wengine-13001',
      name: '聚宝箱',
      level: null,
      refinement: null,
    }
    await apply(input)
    expect((await agent()).wEngineDetails.manualProgression).toBeUndefined()
    expect((await agent()).wEngineDetails).toEqual({
      ...oldEngine,
      id: 'wengine-13001',
      name: '聚宝箱',
    })
    for (const field of [
      'wEngineDetails.level',
      'wEngineDetails.ascension',
      'wEngineDetails.refinement',
    ] as const)
      expect((await agent()).observedFacts?.fields[field]).toBeUndefined()
  })
  it('does not clear the old engine when the candidate contains no observed equipment reference', async () => {
    const input = engineCandidate()
    delete input.agents[0].fields.wEngineDetails
    input.agents[0].observedFields = input.agents[0].observedFields.filter(
      (field) => !field.startsWith('wEngineDetails.'),
    )
    await apply(input)
    expect((await agent()).wEngineDetails).toEqual(oldEngine)
  })
  it('rejects engine edits after preview and account changes with zero import or recovery writes', async () => {
    const input = engineCandidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    await patchAgent({ wEngineDetails: { ...oldEngine, level: 41 } })
    const edited = await facts()
    await expect(confirmAssetQuickReadImport(input, plan, confirmation(input), db)).rejects.toThrow(
      '检查后发生了变化',
    )
    expect(await facts()).toEqual(edited)
    const fresh = await prepareAssetQuickReadImport(accountId, input, db)
    await db.settings.put({ key: 'active-account-id', value: otherAccountId })
    await expect(
      confirmAssetQuickReadImport(input, fresh, confirmation(input), db),
    ).rejects.toThrow('活动账号已变化')
    expect(await facts()).toEqual(edited)
  })
  it('rejects manual disc changes after equipment preview without import or recovery writes', async () => {
    await saveOldEquipment()
    const input = equippedCandidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    await patchAgent({ equippedDiscIds: [...oldDiscIds].reverse() })
    const edited = await facts()
    await expect(confirmAssetQuickReadImport(input, plan, confirmation(input), db)).rejects.toThrow(
      '检查后发生了变化',
    )
    expect(await facts()).toEqual(edited)
  })
  it('serializes a double confirmation and keeps one import and one recoverable receipt', async () => {
    await saveOldEquipment()
    const input = equippedCandidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    const results = await Promise.allSettled([
      confirmAssetQuickReadImport(input, plan, confirmation(input), db),
      confirmAssetQuickReadImport(input, plan, confirmation(input), db),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await db.accountPreferences.count()).toBe(1)
    expect((await agent()).wEngineDetails).toEqual(input.agents[0].fields.wEngineDetails)
    expect((await agent()).equippedDiscIds).toEqual(
      input.agents[0].equippedSourceIds.map(
        (source) => `asset-disc-${source.slice('asset-quick-read:'.length)}`,
      ),
    )
    const committed = await facts()
    await expect(apply(input)).rejects.toThrow('已导入')
    expect(await facts()).toEqual(committed)
  })
  it('keeps post-import player engine edits, rejects an old replay and adopts the next newer read', async () => {
    const receipt = await apply()
    const roster = (await db.accountRosters.get(accountId))!.roster
    roster.agents.find((row) => row.agentId === agentId)!.wEngineDetails = {
      ...oldEngine,
      level: 41,
    }
    await saveAccountRoster(accountId, roster, db)
    expect((await agent()).wEngineDetails.level).toBe(41)
    const edited = await facts()
    const replay = engineCandidate()
    replay.snapshotSha256 = 'b'.repeat(64)
    replay.agents[0].observedFields = replay.agents[0].observedFields.filter((field) =>
      field.startsWith('wEngineDetails.'),
    )
    await expect(apply(replay)).rejects.toThrow('请重新读取')
    await expect(
      restoreAssetQuickReadImport(accountId, receipt.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('已有其他修改')
    expect(await facts()).toEqual(edited)
    replay.capturedAt = new Date(Date.now() + 60_000).toISOString()
    await apply(replay)
    expect((await agent()).wEngineDetails).toEqual(replay.agents[0].fields.wEngineDetails)
  })
})
