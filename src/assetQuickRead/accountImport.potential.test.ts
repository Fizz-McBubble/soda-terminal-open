import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RosterAgent } from '../assault/types'
import type { SodaDatabase } from '../db/databaseCore'
import { saveAccountRoster } from '../accounts/repository'
import { hydrateRosterDefaults } from '../accounts/rosterHydration'
import { hasObservedAgentField } from '../accounts/observedAgentFacts'
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
  createQuickReadTestDatabase,
} from './accountImport.fixtures'
import { convertAssetSnapshot } from './snapshotAdapter'
import { present, omitted, syntheticAssetSnapshot } from './syntheticAssetSnapshotTestFixture'

const agentId = 'agent-koleda'
function potentialCandidate(id?: number | null) {
  const raw = syntheticAssetSnapshot()
  if (id !== undefined)
    Object.assign(raw.assets.agents[0], {
      potential_detail_id: id === null ? omitted() : present(id),
    })
  const result = convertAssetSnapshot(raw, { snapshotSha256: 'a'.repeat(64), capturedAt: now })
  result.agents[0].observedFields = result.agents[0].observedFields.filter(
    (field) => field === 'potentialImage',
  )
  return result
}
describe('quick-read potential facts and reversible account synchronization', () => {
  let db: SodaDatabase
  beforeEach(async () => {
    db = await createQuickReadTestDatabase()
    await patch({
      owned: true,
      manualSource: 'manual_override',
      progressionManuallySet: true,
      potentialImage: 2,
    })
  })
  afterEach(async () => {
    db.close()
    expect(db.name.startsWith('asset-quick-read-test-')).toBe(true)
    await Dexie.delete(db.name)
  })
  async function patch(change: Partial<RosterAgent>, updatedAt = earlier) {
    const record = (await db.accountRosters.get(accountId))!
    Object.assign(record.roster.agents.find((agent) => agent.agentId === agentId)!, change)
    record.updatedAt = record.roster.updatedAt = updatedAt
    await db.accountRosters.put(record)
  }
  async function facts() {
    return {
      rosters: await db.accountRosters.toArray(),
      discs: await db.accountDriveDiscs.toArray(),
      preferences: await db.accountPreferences.toArray(),
    }
  }
  async function apply(candidate = potentialCandidate(110105)) {
    const plan = await prepareAssetQuickReadImport(accountId, candidate, db)
    return confirmAssetQuickReadImport(
      candidate,
      plan,
      { accountId, snapshotSha256: candidate.snapshotSha256, sameGameAccountAndCounts: true },
      db,
    )
  }
  async function current() {
    return (await db.accountRosters.get(accountId))!.roster.agents.find(
      (agent) => agent.agentId === agentId,
    )!
  }
  it('updates older manual potential, persists provenance after refresh and restores exact prior facts', async () => {
    const before = await facts()
    const receipt = await apply()
    expect(await current()).toMatchObject({ potentialImage: 6 })
    expect(hasObservedAgentField(await current(), 'potentialImage')).toBe(true)
    db.close()
    await db.open()
    const hydrated = hydrateRosterDefaults((await db.accountRosters.get(accountId))!.roster)
    expect(hydrated.agents.find((agent) => agent.agentId === agentId)?.potentialImage).toBe(6)
    expect((await current()).observedFacts?.fields.potentialImage).toEqual({
      capturedAt: now,
      snapshotSha256: 'a'.repeat(64),
    })
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    const restored = await facts()
    expect(restored.rosters).toEqual(before.rosters)
    expect(restored.discs).toEqual(before.discs)
    expect(restored.preferences).toHaveLength(1)
    expect(restored.preferences[0].key).toBe(receipt.recoveryKey)
  })
  it.each([undefined, null, 0, 999999, 121104])(
    'preserves manual potential for old, omitted or unrecognized detail %s',
    async (id) => {
      await apply(potentialCandidate(id))
      expect((await current()).potentialImage).toBe(2)
      expect(hasObservedAgentField(await current(), 'potentialImage')).toBe(false)
    },
  )
  it('preserves exact locks and newer observations while keeping potential zero a valid stored fact', async () => {
    await patch({ potentialImage: 0, lockedFields: ['potentialImage'] })
    await apply()
    expect((await current()).potentialImage).toBe(0)
    await patch({
      lockedFields: [],
      potentialImage: 5,
      observedFacts: {
        schemaVersion: 1,
        source: 'asset_quick_read',
        protocolVersion: '3.2',
        fields: {
          potentialImage: {
            capturedAt: '2026-10-11T00:00:00.000Z',
            snapshotSha256: 'b'.repeat(64),
          },
        },
      },
    })
    const next = potentialCandidate(110105)
    next.snapshotSha256 = 'c'.repeat(64)
    await apply(next)
    expect((await current()).potentialImage).toBe(5)
    expect(hasObservedAgentField(await current(), 'potentialImage')).toBe(true)
  })
  it('rejects old reads, edits after inspection and a changed active account without writes', async () => {
    const candidate = potentialCandidate(110105)
    await patch({ potentialImage: 3 }, '2026-10-11T00:00:00.000Z')
    const laterFacts = await facts()
    await expect(prepareAssetQuickReadImport(accountId, candidate, db)).rejects.toThrow(
      '后续手动修改',
    )
    expect(await facts()).toEqual(laterFacts)
    await patch({ potentialImage: 2 })
    const plan = await prepareAssetQuickReadImport(accountId, candidate, db)
    await patch({ potentialImage: 4 })
    const edited = await facts()
    const confirmation = {
      accountId,
      snapshotSha256: candidate.snapshotSha256,
      sameGameAccountAndCounts: true as const,
    }
    await expect(confirmAssetQuickReadImport(candidate, plan, confirmation, db)).rejects.toThrow()
    expect(await facts()).toEqual(edited)
    const fresh = await prepareAssetQuickReadImport(accountId, candidate, db)
    await db.settings.put({ key: 'active-account-id', value: otherAccountId })
    await expect(confirmAssetQuickReadImport(candidate, fresh, confirmation, db)).rejects.toThrow()
    expect(await facts()).toEqual(edited)
  })
  it('allows later player editing and a newer potential observation without replaying the prior receipt', async () => {
    await apply()
    const record = (await db.accountRosters.get(accountId))!
    Object.assign(record.roster.agents.find((agent) => agent.agentId === agentId)!, {
      potentialImage: 3,
      manualSource: 'manual_override',
    })
    await saveAccountRoster(accountId, record.roster, db)
    expect((await current()).potentialImage).toBe(3)
    const next = potentialCandidate(110104)
    next.capturedAt = new Date(Date.now() + 60000).toISOString()
    next.snapshotSha256 = 'd'.repeat(64)
    await apply(next)
    expect((await current()).potentialImage).toBe(5)
  })
  it('makes replay a zero-write operation and refuses to restore over a subsequent player edit', async () => {
    const receipt = await apply()
    const after = await facts()
    await expect(apply()).rejects.toThrow('已导入')
    expect(await facts()).toEqual(after)
    const record = (await db.accountRosters.get(accountId))!
    Object.assign(record.roster.agents.find((agent) => agent.agentId === agentId)!, {
      potentialImage: 4,
    })
    await saveAccountRoster(accountId, record.roster, db)
    const edited = await facts()
    await expect(
      restoreAssetQuickReadImport(accountId, receipt.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow()
    expect(await facts()).toEqual(edited)
  })
  it.each([0, 6, 7, -1, 2.5])(
    'only authorizes stored integer potential in 0..6: %s',
    async (potentialImage) => {
      await patch({
        potentialImage,
        observedFacts: {
          schemaVersion: 1,
          source: 'asset_quick_read',
          protocolVersion: '3.2',
          fields: { potentialImage: { capturedAt: now, snapshotSha256: 'a'.repeat(64) } },
        },
      })
      expect(hasObservedAgentField(await current(), 'potentialImage')).toBe(
        Number.isInteger(potentialImage) && potentialImage >= 0 && potentialImage <= 6,
      )
    },
  )
})
