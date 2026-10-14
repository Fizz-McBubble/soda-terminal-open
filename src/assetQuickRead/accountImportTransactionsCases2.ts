import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { createEmptyRoster } from '../accounts/rosterHydration'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  restoreAssetQuickReadImport,
} from './accountImport'
import { accountId, agentId, candidate, earlier, storedDisc } from './accountImport.fixtures'
import type { AccountImportTransactionsFixture } from './accountImportTransactionsFixture'
import { mergeAssetQuickReadRoster } from './accountRosterMerge'

export function registerAccountImportTransactionsCases2(fixture: AccountImportTransactionsFixture) {
  it('marks partial skills as 快读部分实测 and preserves unobserved skill levels from existing account', async () => {
    const { agent, patchAgent, apply } = fixture

    await patchAgent({
      owned: true,
      progressionManuallySet: true,
      skills: '用户已有技能说明',
      skillLevels: { basic: 7, dodge: 8, assist: 9, special: 10, chain: 11, core: 3 },
    })
    const c = candidate()
    c.agents[0].observedFields = c.agents[0].observedFields.filter((f) => f !== 'skillLevels.dodge')
    c.agents[0].fields.skillLevels = {
      basic: 11,
      dodge: null,
      assist: 11,
      special: 11,
      chain: 11,
      core: 7,
    }
    await apply(c)
    const imported = await agent()
    expect(imported.skills).toBe('快读部分实测')
    expect(imported.skillLevels.dodge).toBe(8)
    expect(imported.skillLevels.basic).toBe(11)
  })

  it('preserves manualProgression when updating an equivalent engine registered as an alias and cleans it on genuine engine swap', async () => {
    const { agent, patchAgent, apply } = fixture

    await patchAgent({
      owned: true,
      wEngineDetails: {
        id: 'candidate-3.2-wengine-14161',
        name: '猩红渴望',
        level: 50,
        ascension: 4,
        refinement: 1,
        manualProgression: {
          engineId: 'candidate-3.2-wengine-14161',
          level: 50,
          ascension: 4,
          refinement: 1,
        },
      },
    })
    const c = candidate()
    c.agents[0].fields.wEngineDetails = {
      id: 'wengine-14161',
      name: '猩红渴望',
      level: 60,
      ascension: 5,
      refinement: 2,
    }
    c.agents[0].observedFields.push(
      'wEngineDetails.id',
      'wEngineDetails.name',
      'wEngineDetails.level',
      'wEngineDetails.ascension',
      'wEngineDetails.refinement',
    )
    await apply(c)
    const imported = await agent()
    expect(imported.wEngineDetails.level).toBe(60)
    expect(imported.wEngineDetails.refinement).toBe(2)
    expect(imported.wEngineDetails.manualProgression).toBeDefined()

    const swap = candidate()
    swap.snapshotSha256 = 'c'.repeat(64)
    swap.capturedAt = new Date(Date.now() + 60_000).toISOString()
    swap.agents[0].fields.wEngineDetails = {
      id: 'wengine-14110',
      name: '钢铁肉垫',
      level: 60,
      ascension: 5,
      refinement: 1,
    }
    swap.agents[0].observedFields.push(
      'wEngineDetails.id',
      'wEngineDetails.name',
      'wEngineDetails.level',
      'wEngineDetails.ascension',
      'wEngineDetails.refinement',
    )
    await apply(swap)
    const swapped = await agent()
    expect(swapped.wEngineDetails.id).toBe('wengine-14110')
    expect(swapped.wEngineDetails.manualProgression).toBeUndefined()
  })

  it('blocks merge with ambiguity error when incoming candidate contains multiple aliases of same agent', () => {
    const c = candidate()
    c.agents = [
      { ...c.agents[0], agentId: 'agent-claret' },
      { ...c.agents[0], agentId: 'candidate-3.2-agent-claret' },
    ]
    const currentRoster = createEmptyRoster()
    expect(() => mergeAssetQuickReadRoster(currentRoster, c, new Map(), undefined)).toThrow(
      '快照中存在指向同一代理人的多个别名记录，存在歧义未写入账户。',
    )
  })

  it('merges incoming snapshot agent into existing agent using registered candidate alias', () => {
    const currentRoster = createEmptyRoster()
    const claretIndex = currentRoster.agents.findIndex((a) => a.agentId === 'agent-claret')
    currentRoster.agents[claretIndex] = {
      ...currentRoster.agents[claretIndex],
      agentId: 'candidate-3.2-agent-claret',
      owned: true,
      level: 10,
    }
    const c = candidate()
    c.agents = [
      {
        ...c.agents[0],
        agentId: 'agent-claret',
        fields: { owned: true, level: 60 },
        observedFields: ['owned', 'level'],
      },
    ]
    const merged = mergeAssetQuickReadRoster(currentRoster, c, new Map(), undefined)
    const mergedClaret = merged.roster.agents.find(
      (a) => a.agentId === 'candidate-3.2-agent-claret',
    )!
    expect(mergedClaret.level).toBe(60)
    expect(mergedClaret.agentId).toBe('candidate-3.2-agent-claret')
  })

  it('refuses guessing metadata ownership among identical legacy physical copies', async () => {
    const { db, facts, apply } = fixture

    await db.accountDriveDiscs.bulkPut([
      storedDisc('local-a', 'scanner:synthetic-a'),
      { ...storedDisc('local-b', 'scanner:synthetic-b'), favorite: false, tags: ['测试'] },
    ])
    const input = candidate()
    input.discs.discs.push({
      ...structuredClone(input.discs.discs[0]),
      sourceId: 'asset-quick-read:880002',
    })
    input.counts.discs = input.counts.sDiscs = 2
    const before = await facts()
    await expect(apply(input)).rejects.toThrow('同属性记录')
    expect(await facts()).toEqual(before)
    const discs = await db.accountDriveDiscs.where('accountId').equals(accountId).sortBy('id')
    expect(discs.map((row) => row.id)).toEqual(['local-a', 'local-b'])
    expect(
      discs.map((row) => ({
        favorite: row.favorite,
        tags: row.tags,
        createdAt: row.createdAt,
        sourceLegacyId: row.sourceLegacyId,
      })),
    ).toEqual([
      { favorite: true, tags: ['保留'], createdAt: earlier, sourceLegacyId: 'synthetic-legacy' },
      { favorite: false, tags: ['测试'], createdAt: earlier, sourceLegacyId: 'synthetic-legacy' },
    ])
  })
  it('keeps every unannotated legacy ID for equal-sized identical groups without adding copies', async () => {
    const { db, agent, apply } = fixture

    const legacy = ['local-b', 'local-a'].map((id) => ({
      ...storedDisc(id, `scanner:${id}`),
      favorite: false,
      tags: [],
    }))
    await db.accountDriveDiscs.bulkPut(legacy)
    const input = candidate()
    input.discs.discs.push({
      ...structuredClone(input.discs.discs[0]),
      sourceId: 'asset-quick-read:880002',
    })
    input.counts.discs = input.counts.sDiscs = 2
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    const reversed = structuredClone(input)
    reversed.discs.discs.reverse()
    const reversedPlan = await prepareAssetQuickReadImport(accountId, reversed, db)
    const binding = (value: typeof plan) =>
      value.next.discs.map((disc) => [disc.id, disc.importSource?.sourceId]).toSorted()
    expect(binding(plan)).toEqual(binding(reversedPlan))
    expect(plan.summary).toMatchObject({ newDiscs: 0, updatedDiscs: 2, inferredDiscLinks: 2 })
    const receipt = await apply(input)
    expect(receipt).toMatchObject({ newDiscs: 0, updatedDiscs: 2, totalDiscs: 2 })
    const after = await db.accountDriveDiscs.where('accountId').equals(accountId).sortBy('id')
    expect(after.map((disc) => disc.id)).toEqual(['local-a', 'local-b'])
    expect(after.map((disc) => disc.importSource?.sourceId)).toEqual([
      'asset-quick-read:880001',
      'asset-quick-read:880002',
    ])
    expect(after.every((disc) => !disc.favorite && disc.tags.length === 0)).toBe(true)
    expect((await agent()).equippedDiscIds).toEqual(['local-a'])
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect(await db.accountDriveDiscs.where('accountId').equals(accountId).sortBy('id')).toEqual(
      legacy.toSorted((a, b) => a.id.localeCompare(b.id)),
    )
  })
  it('still refuses unequal identical legacy groups without changing account facts', async () => {
    const { db, facts, apply } = fixture

    await db.accountDriveDiscs.bulkPut(
      ['local-a', 'local-b'].map((id) => ({
        ...storedDisc(id, `scanner:${id}`),
        favorite: false,
        tags: [],
      })),
    )
    const before = await facts()
    await expect(apply()).rejects.toThrow('暂无法确认对应关系')
    expect(await facts()).toEqual(before)
  })
  it('does not infer interchangeable copies used by current equipment', async () => {
    const { db, facts, patchAgent, apply } = fixture

    await db.accountDriveDiscs.bulkPut(
      ['local-a', 'local-b'].map((id) => ({
        ...storedDisc(id, `scanner:${id}`),
        favorite: false,
        tags: [],
      })),
    )
    await patchAgent({ equippedDiscIds: ['local-a'] })
    const input = candidate()
    input.discs.discs.push({
      ...structuredClone(input.discs.discs[0]),
      sourceId: 'asset-quick-read:880002',
    })
    input.counts.discs = input.counts.sDiscs = 2
    const before = await facts()
    await expect(apply(input)).rejects.toThrow('暂无法确认对应关系')
    expect(await facts()).toEqual(before)
  })
  it('rechecks a plan reference added after preparation before binding interchangeable copies', async () => {
    const { db, facts } = fixture

    await db.accountDriveDiscs.bulkPut(
      ['local-a', 'local-b'].map((id) => ({
        ...storedDisc(id, `scanner:${id}`),
        favorite: false,
        tags: [],
      })),
    )
    const input = candidate()
    input.discs.discs.push({
      ...structuredClone(input.discs.discs[0]),
      sourceId: 'asset-quick-read:880002',
    })
    input.counts.discs = input.counts.sDiscs = 2
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    await db.accountPlanningDrafts.put({
      id: 'protected-copy-plan',
      scopedId: `${accountId}:protected-copy-plan`,
      accountId,
      kind: 'agent',
      name: 'Synthetic protected copy',
      state: 'saved',
      selection: { agentIds: [agentId], bangbooId: null, scenario: 'synthetic' },
      manualOverrides: {
        wEngineDirection: '',
        discDirection: '',
        progressionDirection: '',
        notes: '',
      },
      knowledgeRefs: [],
      warehouseRefs: ['local-a'],
      comparisonCapability: 'direction',
      createdAt: earlier,
      updatedAt: earlier,
      revision: 1,
    })
    const before = await facts()
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
        db,
      ),
    ).rejects.toThrow('暂无法确认对应关系')
    expect(await facts()).toEqual(before)
    await expect(prepareAssetQuickReadImport(accountId, input, db)).rejects.toThrow(
      '暂无法确认对应关系',
    )
    expect((await db.accountPlanningDrafts.toArray())[0]?.warehouseRefs).toEqual(['local-a'])
  })
}
