import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'
import identities from './catalogIdentityProjection.json'
import discData from '../data/drive-disc-data.v1.json'
import { convertAssetSnapshot } from './snapshotAdapter'
import { present, stat, syntheticAssetSnapshot } from './syntheticAssetSnapshotTestFixture'
import { accountId, createQuickReadTestDatabase } from './accountImport.fixtures'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  restoreAssetQuickReadImport,
} from './accountImport'
import { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'

it('reads PEN and elemental main stats through quick-read import, reload, panel calculation and recovery', async () => {
  const db = await createQuickReadTestDatabase()
  try {
    const before = await db.accountRosters.get(accountId)
    const input = syntheticAssetSnapshot()
    const set = identities.discs.find((row) => row.id === 'set-fanged-metal')!
    const mains = [
      'hp_flat',
      'atk_flat',
      'def_flat',
      'atk_percent',
      'physical_dmg',
      'atk_percent',
    ] as const
    const mainKeys = [11103, 12103, 13103, 12102, 31503, 12102]
    input.assets.discs = mains.map((main, index) => ({
      uid: present(990001 + index),
      catalog_id: present(Number(set.gameId) + 41 + index),
      level: present(0),
      main_stat: stat(
        mainKeys[index],
        discData.rules.mainStatBaseByRarity.S.find((row) => row.stat === main)!.baseValue *
          (main.endsWith('percent') || main.endsWith('_dmg') ? 100 : 1),
      ),
      substats: [stat(23203, 9), stat(20103, 240), stat(21103, 480)],
    }))
    input.assets.agents[0].dressed_equips = mains.map((_, index) => ({
      uid: present(990001 + index),
      slot: present(index + 1),
    }))
    input.assets.agents[0].mindscape = present(0)
    input.counts.discs = input.counts.s_discs = 6
    const candidate = convertAssetSnapshot(input, { snapshotSha256: 'b'.repeat(64) })
    expect(candidate.issues).toEqual([])
    expect(candidate.importable).toBe(true)
    expect(
      candidate.discs.discs.every((disc) =>
        disc.subStats.some((row) => row.stat === 'pen' && row.value === 9),
      ),
    ).toBe(true)
    const plan = await prepareAssetQuickReadImport(accountId, candidate, db)
    const receipt = await confirmAssetQuickReadImport(
      candidate,
      plan,
      { accountId, snapshotSha256: candidate.snapshotSha256, sameGameAccountAndCounts: true },
      db,
    )
    db.close()
    await db.open()
    const roster = (await db.accountRosters.get(accountId))!.roster
    const discs = await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()
    const agent = roster.agents.find((row) => row.agentId === candidate.agents[0].agentId)!
    const panel = createAgentDevelopmentPanelProjection({ agent, discs }).result
    expect(panel.status, panel.reason).toBe('ok')
    expect(panel.values.pen).toBe(54)
    expect(panel.values.physicalDamageBonus).toBe(17.5)
    expect(panel.values.fireDamageBonus).toBe(0)
    expect(panel.values.maxEnergy).toBeUndefined()
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect((await db.accountRosters.get(accountId))!.roster).toEqual(before!.roster)
  } finally {
    db.close()
    expect(db.name.startsWith('asset-quick-read-test-')).toBe(true)
    await Dexie.delete(db.name)
  }
})
