import { describe, expect, it } from 'vitest'
import { convertAssetSnapshot } from './snapshotAdapter'
import { omitted, present, stat, syntheticAssetSnapshot } from './syntheticAssetSnapshotTestFixture'

const context = { snapshotSha256: 'a'.repeat(64) }

function mixed() {
  const input = syntheticAssetSnapshot()
  for (const [index, rarity] of (['A', 'B'] as const).entries()) {
    input.assets.discs.push({
      uid: present(990002 + index),
      catalog_id: present(rarity === 'A' ? 31032 : 31022),
      level: present(0),
      main_stat: stat(12103, rarity === 'A' ? 53 : 26),
      substats: rarity === 'A' ? [stat(11103, 79), stat(20103, 160)] : [stat(11103, 39)],
    })
    input.counts.discs++
    if (rarity === 'A') input.counts.a_discs++
    else input.counts.b_discs++
  }
  return input
}

describe('quick-read A/B records', () => {
  it('retains explicit observed values without substituting conflicting local steps', () => {
    const result = convertAssetSnapshot(mixed(), context)
    expect(result.issues).toEqual([])
    expect(result.importable).toBe(true)
    expect(result.discs.discs).toHaveLength(3)
    expect(result.discs.discs[1]).toMatchObject({
      rarity: 'A',
      subStats: expect.arrayContaining([{ stat: 'hp_flat', value: 79, upgrades: 0 }]),
    })
    expect(result.discs.discs[2]).toMatchObject({
      rarity: 'B',
      subStats: [{ stat: 'hp_flat', value: 39 }],
    })
  })

  it.each(['uid', 'level', 'base', 'add', 'duplicate', 'main', 'unknown'] as const)(
    'blocks an incomplete or invalid A/B record: %s',
    (failure) => {
      const input = mixed()
      const lower = input.assets.discs[1]
      if (failure === 'uid') lower.uid = input.assets.discs[0].uid
      if (failure === 'level') lower.level = omitted() as unknown as typeof lower.level
      if (failure === 'base')
        lower.substats[0].base_value = omitted() as unknown as (typeof lower.substats)[0]['base_value']
      if (failure === 'add') lower.substats[0].add_value = present(0)
      if (failure === 'duplicate') lower.substats[1].key = lower.substats[0].key
      if (failure === 'main') lower.main_stat.key = lower.substats[0].key
      if (failure === 'unknown') lower.substats[0].key = present(999999)
      expect(convertAssetSnapshot(input, context).importable).toBe(false)
    },
  )
})
