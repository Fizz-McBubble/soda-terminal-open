import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { createEmptyRoster, hydrateRosterDefaults } from '../accounts/rosterHydration'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  restoreAssetQuickReadImport,
} from './accountImport'
import { accountId, agentId, candidate, now, otherAccountId } from './accountImport.fixtures'
import type { AccountImportTransactionsFixture } from './accountImportTransactionsFixture'
import { mergeAssetQuickReadRoster } from './accountRosterMerge'
import { convertAssetSnapshot } from './snapshotAdapter'
import { omitted, present, syntheticAssetSnapshot } from './syntheticAssetSnapshotTestFixture'

export function registerAccountImportTransactionsCases1(fixture: AccountImportTransactionsFixture) {
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
  it('excludes malformed A/B at inspection and imports only S discs through preview and confirm', async () => {
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
    expect(incoming.importable).toBe(true)
    expect(incoming.discs.discs).toHaveLength(1)
    const preview = await prepareAssetQuickReadImport(accountId, incoming, db)
    expect(preview.summary.observedDiscs).toBe(1)
    expect(preview.next.discs.every((disc) => disc.rarity === 'S')).toBe(true)
    await confirmAssetQuickReadImport(
      incoming,
      preview,
      { accountId, snapshotSha256: incoming.snapshotSha256, sameGameAccountAndCounts: true },
      db,
    )
    const saved = await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()
    expect(saved).toHaveLength(1)
    expect(saved[0].rarity).toBe('S')
  })
  it('rejects an injected A/B candidate at the shared preview/confirm boundary with all account facts preserved', async () => {
    const { db, facts } = fixture

    const before = await facts()
    const incoming = candidate()
    incoming.discs.discs[0].rarity = 'A'
    await expect(prepareAssetQuickReadImport(accountId, incoming, db)).rejects.toThrow(
      '仅支持 S 级盘',
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
  it('imports all valid discs despite missing agent growth and restores the synthetic account exactly', async () => {
    const { db, facts, agent, patchAgent } = fixture

    const input = syntheticAssetSnapshot()
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
  })
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
