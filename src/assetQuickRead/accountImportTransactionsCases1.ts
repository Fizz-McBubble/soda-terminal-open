import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { createEmptyRoster, hydrateRosterDefaults } from '../accounts/rosterHydration'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  restoreAssetQuickReadImport,
} from './accountImport'
import {
  accountId,
  agentId,
  candidate,
  now,
  otherAccountId,
  storedDisc,
} from './accountImport.fixtures'
import type { AccountImportTransactionsFixture } from './accountImportTransactionsFixture'
import { mergeAssetQuickReadRoster } from './accountRosterMerge'
import { convertAssetSnapshot } from './snapshotAdapter'
import {
  omitted,
  present,
  stat,
  syntheticAssetSnapshot,
  syntheticAssetSnapshot33,
} from './syntheticAssetSnapshotTestFixture'

export function registerAccountImportTransactionsCases1(fixture: AccountImportTransactionsFixture) {
  it('refuses a physical UID whose stored rarity conflicts with the observation', async () => {
    const { db, facts } = fixture
    await db.accountDriveDiscs.put({
      ...storedDisc('old-b', 'asset-quick-read:880001'),
      rarity: 'B',
    })
    const before = await facts()
    await expect(prepareAssetQuickReadImport(accountId, candidate(), db)).rejects.toThrow(
      '品级冲突',
    )
    expect(await facts()).toEqual(before)
  })
  it('previews, count-confirms and restores a mixed-quality observation without losing existing discs', async () => {
    const { db, facts } = fixture
    const prior = { ...storedDisc('existing-a', 'asset-quick-read:990002'), rarity: 'A' as const }
    await db.accountDriveDiscs.put(prior)
    const before = await facts()
    const raw = syntheticAssetSnapshot()
    raw.assets.discs.push({
      uid: present(990002),
      catalog_id: present(31032),
      level: present(0),
      main_stat: stat(12103, 53),
      substats: [stat(11103, 79), stat(20103, 160)],
    })
    raw.assets.discs.push({
      uid: present(990003),
      catalog_id: present(31022),
      level: present(0),
      main_stat: stat(12103, 26),
      substats: [stat(11103, 39)],
    })
    raw.counts.discs = 3
    raw.counts.a_discs = raw.counts.b_discs = 1
    const incoming = convertAssetSnapshot(raw, { snapshotSha256: 'b'.repeat(64), capturedAt: now })
    expect(incoming.issues).toEqual([])
    const plan = await prepareAssetQuickReadImport(accountId, incoming, db)
    expect(plan.summary).toMatchObject({ observedDiscs: 3, newDiscs: 2, updatedDiscs: 1 })
    expect(plan.next.discs.find((disc) => disc.id === prior.id)).toMatchObject({
      rarity: 'A',
      favorite: true,
      tags: prior.tags,
      subStats: expect.arrayContaining([{ stat: 'hp_flat', value: 79, upgrades: 0 }]),
    })
    const confirmation = {
      accountId,
      snapshotSha256: incoming.snapshotSha256,
      sameGameAccountAndCounts: true as const,
    }
    await expect(confirmAssetQuickReadImport(incoming, plan, confirmation, db)).rejects.toThrow(
      '核对全部驱动盘数量',
    )
    expect(await facts()).toEqual(before)
    const receipt = await confirmAssetQuickReadImport(
      incoming,
      plan,
      { ...confirmation, observedDiscCount: 3 },
      db,
    )
    expect(await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()).toHaveLength(
      3,
    )
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect((await facts()).discs).toEqual(before.discs)
  })
  it('preserves existing A/B discs and their identity and metadata through S-only quick read and restore', async () => {
    const { db, facts } = fixture
    const lower = (['A', 'B'] as const).map((rarity) => ({
      ...storedDisc(`lower-${rarity}`, `legacy-${rarity}`),
      rarity,
    }))
    await db.accountDriveDiscs.bulkPut(lower)
    const before = await facts()
    const incoming = candidate()
    const plan = await prepareAssetQuickReadImport(accountId, incoming, db)
    expect(plan.next.discs).toEqual(expect.arrayContaining(lower))
    const result = await confirmAssetQuickReadImport(
      incoming,
      plan,
      { accountId, snapshotSha256: incoming.snapshotSha256, sameGameAccountAndCounts: true },
      db,
    )
    expect(await db.accountDriveDiscs.bulkGet(lower.map((disc) => disc.scopedId))).toEqual(lower)
    await restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db)
    expect((await facts()).discs).toEqual(before.discs)
  })
  it('rejects an existing roster with two aliases for one agent before merging', () => {
    const roster = createEmptyRoster(now)
    const claret = roster.agents.find((agent) => agent.agentId === 'agent-claret')!
    roster.agents.push({ ...structuredClone(claret), agentId: 'candidate-3.2-agent-claret' })
    const before = JSON.stringify(roster)
    expect(() => mergeAssetQuickReadRoster(roster, candidate(), new Map(), undefined)).toThrow(
      '账户中存在指向同一代理人的多个别名记录',
    )
    expect(JSON.stringify(roster)).toBe(before)
  })
  it('blocks malformed A/B at inspection without writing the account', async () => {
    const { db } = fixture

    await db.accountDriveDiscs.clear() // Isolated fake IndexedDB fixture only.
    const raw = syntheticAssetSnapshot()
    for (const catalog of [31021, 31031]) {
      raw.assets.discs.push({
        ...structuredClone(raw.assets.discs[0]),
        uid: present(990001),
        catalog_id: present(catalog),
        level: present(999),
        substats: [],
      })
      raw.counts.discs++
    }
    raw.counts.b_discs = raw.counts.a_discs = 1
    const incoming = convertAssetSnapshot(raw, { snapshotSha256: 'b'.repeat(64), capturedAt: now })
    expect(incoming.counts).toMatchObject({ discs: 3, sDiscs: 1 })
    expect(incoming.importable).toBe(false)
    expect(incoming.discs.discs).toHaveLength(1)
    await expect(prepareAssetQuickReadImport(accountId, incoming, db)).rejects.toThrow()
    expect(await db.accountDriveDiscs.where('accountId').equals(accountId).count()).toBe(0)
  })
  it('rejects an injected A/B candidate with inconsistent S count and preserves account facts', async () => {
    const { db, facts } = fixture

    const before = await facts()
    const incoming = candidate()
    incoming.discs.discs[0].rarity = 'A'
    await expect(prepareAssetQuickReadImport(accountId, incoming, db)).rejects.toThrow(
      '数量与快照不一致',
    )
    expect(await facts()).toEqual(before)
  })

  it('prepares a usable plan without any database writes or recovery side effects', async () => {
    const { db, facts } = fixture

    const before = await facts()
    const plan = await prepareAssetQuickReadImport(accountId, candidate(), db)
    expect(plan.importable).toBe(true)
    expect(plan.summary).toMatchObject({ newDiscs: 1, observedAgents: 1 })
    expect(await facts()).toEqual(before)
  })
  it.each(['3.2', '3.3'] as const)(
    'imports %s discs despite missing agent growth and restores the synthetic account exactly',
    async (protocolVersion) => {
      const { db, facts, agent, patchAgent } = fixture

      const input =
        protocolVersion === '3.3' ? syntheticAssetSnapshot33() : syntheticAssetSnapshot()
      input.assets.agents[0].catalog_id.value = 1031
      Object.assign(input.assets.agents[0], {
        level: omitted(),
        promotion: omitted(),
        skills: [],
        weapon_uid: omitted(),
        dressed_equips: [],
      })
      const old = await patchAgent({
        level: 40,
        ascension: 3,
        skillLevels: {
          basic: 8,
          dodge: 8,
          assist: 8,
          special: 8,
          chain: 8,
          core: 4,
        },
      })
      const before = await facts()
      const converted = convertAssetSnapshot(input, {
        snapshotSha256: 'b'.repeat(64),
        capturedAt: now,
      })
      const plan = await prepareAssetQuickReadImport(accountId, converted, db)
      expect(plan.importable).toBe(true)
      const receipt = await confirmAssetQuickReadImport(
        converted,
        plan,
        {
          accountId,
          snapshotSha256: converted.snapshotSha256,
          sameGameAccountAndCounts: true,
        },
        db,
      )
      expect(await db.accountDriveDiscs.where('accountId').equals(accountId).count()).toBe(1)
      const imported = await agent()
      expect(imported.observedFacts?.protocolVersion).toBe(protocolVersion)
      expect(imported.level).toBe(old.level)
      expect(imported.ascension).toBe(old.ascension)
      expect(imported.skillLevels).toEqual(old.skillLevels)
      expect(imported.observedFacts?.fields.level).toBeUndefined()
      expect(imported.observedFacts?.fields.ascension).toBeUndefined()
      await restoreAssetQuickReadImport(
        accountId,
        receipt.recoveryKey,
        'restore_asset_quick_read',
        db,
      )
      const restored = await facts()
      expect(restored.discs).toEqual(before.discs)
      expect(restored.rosters).toEqual(before.rosters)
      expect(restored.accounts).toEqual(before.accounts)
    },
  )
  it('guards missing, archived and inactive target scopes before preparing', async () => {
    const { db, facts } = fixture

    await expect(
      prepareAssetQuickReadImport('account-synthetic-missing', candidate(), db),
    ).rejects.toThrow('已不存在')
    await db.accounts.update(accountId, { status: 'archived' })
    await expect(prepareAssetQuickReadImport(accountId, candidate(), db)).rejects.toThrow('已归档')
    await db.accounts.update(accountId, { status: 'active' })
    await db.settings.put({ key: 'active-account-id', value: otherAccountId })
    const before = await facts()
    await expect(prepareAssetQuickReadImport(accountId, candidate(), db)).rejects.toThrow(
      '活动账号已变化',
    )
    expect(await facts()).toEqual(before)
  })
  it('imports protocol-default zero progression through the real adapter and retains it after hydration', async () => {
    const { db, facts, agent, apply } = fixture

    const input = syntheticAssetSnapshot()
    input.assets.agents[0].catalog_id.value = 1031
    Object.assign(input.assets.engines[0], { level: omitted(), modification: omitted() })
    const converted = convertAssetSnapshot(input, {
      snapshotSha256: 'c'.repeat(64),
      capturedAt: now,
    })
    expect(converted.importable).toBe(true)
    const before = await facts()
    const receipt = await apply(converted)
    const imported = await agent()
    expect(imported.wEngineDetails).toMatchObject({ level: 0, ascension: 0 })
    expect(imported.observedFacts?.fields['wEngineDetails.level']).toMatchObject({
      capturedAt: now,
      snapshotSha256: converted.snapshotSha256,
    })
    const hydrated = hydrateRosterDefaults((await db.accountRosters.get(accountId))!.roster)
    expect(hydrated.agents.find((row) => row.agentId === agentId)?.wEngineDetails.level).toBe(0)
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    const restored = await facts()
    expect(restored.rosters).toEqual(before.rosters)
    expect(restored.discs).toEqual(before.discs)
  })
  it('rechecks active account at confirmation and never touches the other account', async () => {
    const { db, facts } = fixture

    const input = candidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    await db.settings.put({ key: 'active-account-id', value: otherAccountId })
    const before = await facts()
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
        db,
      ),
    ).rejects.toThrow('活动账号已变化')
    expect(await facts()).toEqual(before)
  })
  it('imports precise owned A-rank M0 and survives roster hydration without default M6', async () => {
    const { db, agent, apply } = fixture

    const unrelated = await db.accountDriveDiscs.where('accountId').equals(otherAccountId).toArray()
    await apply()
    const imported = await agent()
    expect(imported.mindscape).toBe(0)
    expect(imported.skillLevels.basic).toBe(3)
    expect(imported.observedFacts?.fields.mindscape).toEqual({
      capturedAt: now,
      snapshotSha256: 'a'.repeat(64),
    })
    const hydrated = hydrateRosterDefaults(
      (await db.accountRosters.get(accountId))!.roster,
    ).agents.find((row) => row.agentId === agentId)!
    expect(hydrated.mindscape).toBe(0)
    expect(hydrated.skillLevels).toEqual(imported.skillLevels)
    expect(await db.accountDriveDiscs.where('accountId').equals(otherAccountId).toArray()).toEqual(
      unrelated,
    )
  })
  it('automatically updates older manual progression and observed current engine facts', async () => {
    const { db, agent, patchAgent, apply } = fixture

    const before = await patchAgent({
      owned: true,
      manualSource: 'manual_override',
      level: 40,
      ascension: 3,
      mindscape: 2,
      skills: '用户技能说明',
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
      wEngine: '用户已录入音擎',
      wEngineDetails: {
        id: 'wengine-13002',
        name: '用户已录入音擎',
        level: 40,
        ascension: 3,
        refinement: 3,
      },
      refinement: 3,
    })
    const imported = await apply()
    expect(imported.protectedFields).toBe(0)
    expect(imported.syncedManualProgressionFields).toBe(9)
    const current = await agent()
    expect(current).toMatchObject({
      level: 20,
      ascension: 1,
      mindscape: 0,
      skillLevels: candidate().agents[0].fields.skillLevels,
      wEngineDetails: {
        ...before.wEngineDetails,
        ...candidate().agents[0].fields.wEngineDetails,
        level: 40,
      },
      wEngine: '聚宝箱',
      refinement: 1,
      manualSource: 'manual_override',
      equippedDiscIds: ['asset-disc-880001'],
    })
    expect(current.observedFacts?.fields.level).toBeDefined()
    expect(current.observedFacts?.fields['wEngineDetails.id']).toBeDefined()
    await restoreAssetQuickReadImport(
      accountId,
      imported.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect(await agent()).toEqual(before)
  })
  it('automatically adopts older deliberate progression and independently observed engine fields', async () => {
    const { agent, patchAgent, apply } = fixture

    await patchAgent({
      owned: true,
      progressionManuallySet: true,
      level: 40,
      ascension: 3,
      mindscape: 2,
      skills: '用户技能说明',
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    await apply()
    const imported = await agent()
    expect(imported).toMatchObject({
      level: 20,
      ascension: 1,
      mindscape: 0,
      skills: '快读实测',
      skillLevels: candidate().agents[0].fields.skillLevels,
    })
    expect(imported.observedFacts?.fields.level).toBeDefined()
    expect(imported.observedFacts?.fields['wEngineDetails.name']).toBeDefined()
  })
  it('protects parent and exact locked fields independently', async () => {
    const { agent, patchAgent, apply } = fixture

    await patchAgent({
      owned: true,
      level: 40,
      mindscape: 2,
      skills: '用户锁定技能',
      lockedFields: ['level', 'mindscape', 'skillLevels', 'wEngine'],
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    await apply()
    const imported = await agent()
    expect(imported).toMatchObject({
      level: 40,
      mindscape: 2,
      skills: '用户锁定技能',
      skillLevels: { basic: 9, dodge: 9, assist: 9, special: 9, chain: 9, core: 4 },
    })
    expect(imported.observedFacts?.fields.level).toBeUndefined()
    expect(imported.observedFacts?.fields['wEngineDetails.id']).toBeUndefined()
  })
}
