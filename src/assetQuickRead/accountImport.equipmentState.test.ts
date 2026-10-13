import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hydrateRosterDefaults } from '../accounts/rosterHydration'
import { hasObservedAgentField } from '../accounts/observedAgentFacts'
import { resolveWEngine } from '../decision/wEngineResolver'
import type { SodaDatabase } from '../db/databaseCore'
import { convertAssetSnapshot } from './snapshotAdapter'
import { syntheticAssetSnapshot, present, omitted } from './syntheticAssetSnapshotTestFixture'
import { accountId, agentId, createQuickReadTestDatabase } from './accountImport.fixtures'
import {
  prepareAssetQuickReadImport,
  confirmAssetQuickReadImport,
  restoreAssetQuickReadImport,
} from './accountImport'

const time = '2026-10-10T00:00:00.000Z'
const later = '2026-10-11T00:00:00.000Z'
const oldDetails = {
  id: 'wengine-14110',
  name: '测试旧音擎',
  level: 60,
  ascension: 5,
  refinement: 1,
}
function snapshot() {
  const input = syntheticAssetSnapshot()
  input.assets.agents[0].catalog_id = present(1031)
  return input
}

describe('observed current equipment transitions through conversion, import and recovery', () => {
  let db: SodaDatabase
  beforeEach(async () => {
    db = await createQuickReadTestDatabase()
  })
  afterEach(async () => {
    db.close()
    await Dexie.delete(db.name)
  })
  async function roster() {
    return (await db.accountRosters.get(accountId))!.roster
  }
  async function facts() {
    return {
      rosters: await db.accountRosters.toArray(),
      discs: await db.accountDriveDiscs.toArray(),
      preferences: await db.accountPreferences.toArray(),
      plans: await db.accountPlanningDrafts.toArray(),
    }
  }
  async function apply(
    input: ReturnType<typeof syntheticAssetSnapshot>,
    hash: string,
    capturedAt = time,
  ) {
    const candidate = convertAssetSnapshot(input, { snapshotSha256: hash.repeat(64), capturedAt })
    expect(candidate.importable).toBe(true)
    expect(candidate.issues).toEqual([])
    const plan = await prepareAssetQuickReadImport(accountId, candidate, db)
    return confirmAssetQuickReadImport(
      candidate,
      plan,
      {
        accountId,
        snapshotSha256: candidate.snapshotSha256,
        sameGameAccountAndCounts: true,
      },
      db,
    )
  }
  async function oldEngine() {
    const record = (await db.accountRosters.get(accountId))!
    Object.assign(record.roster.agents.find((row) => row.agentId === agentId)!, {
      wEngineDetails: oldDetails,
      wEngine: oldDetails.name,
      refinement: 1,
      wEngineCopyId: 'legacy-engine',
    })
    record.roster.wEngines = [
      {
        copyId: 'legacy-engine',
        engineId: oldDetails.id,
        level: 60,
        refinement: 1,
        equippedAgentId: agentId,
        manualSource: 'manual_override',
        refinementManuallySet: false,
      },
    ]
    await db.accountRosters.put(record)
  }

  it('moves a physical S disc to another agent, saves the empty former owner and restores both owners', async () => {
    const input = snapshot()
    const other = structuredClone(input.assets.agents[0])
    other.catalog_id = present(1101)
    other.weapon_uid = omitted()
    other.dressed_equips = []
    input.assets.agents.push(other)
    input.counts.agents = 2
    await apply(input, 'a')
    const before = await facts()
    input.assets.agents[1].dressed_equips = input.assets.agents[0].dressed_equips
    input.assets.agents[0].dressed_equips = []
    const receipt = await apply(input, 'b', later)
    const current = await roster()
    const previousOwner = current.agents.find((row) => row.agentId === agentId)!
    expect(previousOwner.equippedDiscIds).toEqual([])
    expect(previousOwner.currentEquipment).toBe('known')
    expect(hasObservedAgentField(previousOwner, 'equippedDiscIds')).toBe(true)
    const hydrated = hydrateRosterDefaults(JSON.parse(JSON.stringify(current)), later)
    expect(hydrated.agents.find((row) => row.agentId === agentId)!.equippedDiscIds).toEqual([])
    expect(current.agents.find((row) => row.agentId === 'agent-koleda')!.equippedDiscIds).toEqual([
      'asset-disc-990001',
    ])
    const discs = await db.accountDriveDiscs.toArray()
    expect(discs).toHaveLength(before.discs.length)
    for (const prior of before.discs)
      expect(discs.find((disc) => disc.id === prior.id)).toMatchObject({
        id: prior.id,
        accountId: prior.accountId,
        setId: prior.setId,
        slot: prior.slot,
        level: prior.level,
        rarity: prior.rarity,
        mainStat: prior.mainStat,
        subStats: prior.subStats,
      })
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect((await facts()).rosters).toEqual(before.rosters)
    expect((await facts()).discs).toEqual(before.discs)
  })

  it('clears an explicitly unequipped engine as one state without legacy resurrection or inventory deletion', async () => {
    await oldEngine()
    const before = await facts()
    const input = snapshot()
    input.assets.agents[0].weapon_uid = present(0)
    const receipt = await apply(input, 'c')
    const current = await roster()
    const agent = current.agents.find((row) => row.agentId === agentId)!
    expect(agent.wEngineDetails).toEqual({ id: null, name: null, level: null, refinement: null })
    expect(agent.wEngine).toBe('')
    expect(agent.refinement).toBe(0)
    expect(agent.wEngineCopyId).toBeNull()
    expect(hasObservedAgentField(agent, 'wEngineDetails.id')).toBe(true)
    expect(resolveWEngine({ agent, legacyWEngines: current.wEngines }).current).toBeNull()
    const hydrated = hydrateRosterDefaults(JSON.parse(JSON.stringify(current)), time)
    const reloaded = hydrated.agents.find((row) => row.agentId === agentId)!
    expect(reloaded.wEngineDetails).toEqual(agent.wEngineDetails)
    expect(
      resolveWEngine({ agent: reloaded, legacyWEngines: hydrated.wEngines }).current,
    ).toBeNull()
    expect(current.wEngines).toEqual(
      before.rosters[0].roster.wEngines!.map((copy) => ({ ...copy, equippedAgentId: null })),
    )
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect((await facts()).rosters).toEqual(before.rosters)
    expect((await facts()).discs).toEqual(before.discs)
  })

  it('keeps an omitted engine and refuses to clear a newer or locked engine progression field', async () => {
    await oldEngine()
    const input = snapshot()
    input.assets.agents[0].weapon_uid = omitted()
    await apply(input, 'd')
    expect((await roster()).agents.find((row) => row.agentId === agentId)!.wEngineDetails).toEqual(
      oldDetails,
    )
    const record = (await db.accountRosters.get(accountId))!
    record.roster.agents.find((row) => row.agentId === agentId)!.lockedFields = [
      'wEngineDetails.level',
    ]
    await db.accountRosters.put(record)
    input.assets.agents[0].weapon_uid = present(0)
    await apply(input, 'e', later)
    expect((await roster()).agents.find((row) => row.agentId === agentId)!.wEngineDetails).toEqual(
      oldDetails,
    )
    const newer = (await db.accountRosters.get(accountId))!
    const agent = newer.roster.agents.find((row) => row.agentId === agentId)!
    agent.lockedFields = []
    agent.observedFacts!.fields['wEngineDetails.level'] = {
      capturedAt: '2026-10-12T00:00:00.000Z',
      snapshotSha256: 'f'.repeat(64),
    }
    await db.accountRosters.put(newer)
    await apply(input, 'f', later)
    expect((await roster()).agents.find((row) => row.agentId === agentId)!.wEngineDetails).toEqual(
      oldDetails,
    )
  })

  it('rejects an empty equipment observation captured before a later manual engine edit without writes', async () => {
    await oldEngine()
    const record = (await db.accountRosters.get(accountId))!
    record.roster.agents.find((row) => row.agentId === agentId)!.manualSource = 'manual_override'
    record.updatedAt = record.roster.updatedAt = later
    await db.accountRosters.put(record)
    const input = snapshot()
    input.assets.agents[0].weapon_uid = present(0)
    const before = await facts()
    await expect(apply(input, 'a', time)).rejects.toThrow('请重新读取')
    expect(await facts()).toEqual(before)
  })

  it('does not clear a former owner when its incoming reference is invalid and keeps all writes atomic', async () => {
    const input = snapshot()
    await apply(input, 'a')
    input.assets.agents[0].dressed_equips[0].uid = present(0)
    const converted = convertAssetSnapshot(input, {
      snapshotSha256: 'b'.repeat(64),
      capturedAt: later,
    })
    expect(converted.agents[0].observedFields).not.toContain('equippedDiscIds')
    await apply(input, 'b', later)
    expect((await roster()).agents.find((row) => row.agentId === agentId)!.equippedDiscIds).toEqual(
      ['asset-disc-990001'],
    )
    const bad = convertAssetSnapshot(snapshot(), {
      snapshotSha256: 'c'.repeat(64),
      capturedAt: later,
    })
    bad.agents[0].fields.wEngineDetails = { id: null, name: 'stale', level: null, refinement: null }
    bad.agents[0].observedFields = ['wEngineDetails.id']
    const before = await facts()
    await expect(prepareAssetQuickReadImport(accountId, bad, db)).rejects.toThrow(
      '未装备音擎的观察状态不一致',
    )
    expect(await facts()).toEqual(before)
  })
})
