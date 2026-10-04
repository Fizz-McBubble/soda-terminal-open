import { describe, expect, it } from 'vitest'
import type { DriveDisc } from '../domain/schemas'
import { projectOutOfCombatPanel } from './outOfCombatPanel'

function discs(
  main4: DriveDisc['mainStat'],
  main5: DriveDisc['mainStat'],
  main6: DriveDisc['mainStat'],
  setId = 'set-inferno-metal',
): DriveDisc[] {
  const mainStats = ['hp_flat', 'atk_flat', 'def_flat', main4, main5, main6] as const
  return mainStats.map((mainStat, index) => ({
    id: `panel-edge-${index + 1}`,
    slot: (index + 1) as DriveDisc['slot'],
    mainStat,
    setId,
    level: 15,
    rarity: 'S',
    subStats: [],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    dataVersion: 'synthetic',
  }))
}
const input = {
  agentId: 'agent-billy',
  level: 60,
  ascension: 5,
  core: 5,
  wEngine: { id: 'wengine-13001', level: 60, ascension: 5, refinement: 1 },
  discs: discs('atk_percent', 'pen_ratio', 'atk_percent'),
}

describe('catalog panel edge cases', () => {
  it('places Yixuan fixed core HP before three HP mains and HP engine secondary', () => {
    const result = projectOutOfCombatPanel({
      ...input,
      agentId: 'agent-yixuan',
      wEngine: { ...input.wEngine, id: 'wengine-12006' },
      discs: discs('hp_percent', 'hp_percent', 'hp_percent'),
    })
    expect(result.status).toBe('ok')
    // Locked Yixuan source: 673 + 84.2519*59 + 2310 promotion + 420 core.
    // Three HP30% mains + engine HP20%; slot1 HP2200 follows the multiplier.
    expect(result.values.hp).toBeCloseTo((673 + 84.2519 * 59 + 2310 + 420) * 2.1 + 2200, 8)
  })

  it('multiplies Lucy fixed core energy regeneration before static equipment percentages', () => {
    const result = projectOutOfCombatPanel({
      ...input,
      agentId: 'agent-lucy',
      discs: discs('atk_percent', 'pen_ratio', 'energy_regen', 'set-swing-jazz'),
    })
    expect(result.status).toBe('ok')
    // Base1.2 + core0.36; slot6 ER60% + Swing Jazz20%.
    expect(result.values.energyRegen).toBeCloseTo(2.808, 8)
  })

  it('keeps Sunna core ATK percent additive with two ATK mains and the engine secondary', () => {
    const result = projectOutOfCombatPanel({ ...input, agentId: 'agent-sunna' })
    expect(result.status).toBe('ok')
    // Core ATK75 is white; core ATK21%, engine ATK25%, slot4/6 ATK30% each.
    expect(result.values.atk).toBeCloseTo((108 + 6.3517 * 59 + 193 + 75 + 594.8) * 2.06 + 316, 8)
  })

  it('keeps Rina core penetration additive with a penetration main', () => {
    const result = projectOutOfCombatPanel({ ...input, agentId: 'agent-rina' })
    expect(result.status).toBe('ok')
    expect(result.values.penRatio).toBeCloseTo(38.4, 8)
  })

  it('routes the real DEF-based Crimson Thirst at both sides of a level-10 ascension boundary', () => {
    const low = projectOutOfCombatPanel({
      ...input,
      wEngine: { id: 'wengine-14161', level: 10, ascension: 0, refinement: 1 },
    })
    const promoted = projectOutOfCombatPanel({
      ...input,
      wEngine: { id: 'wengine-14161', level: 10, ascension: 1, refinement: 1 },
    })
    expect(low.status).toBe('ok')
    expect(promoted.status).toBe('ok')
    // Billy DEF49 + growth6.6203*59 + promotion167. Engine29 base uses
    // level10 table1.5682 and ascension0.8922; second DEF19.2% grows by30%.
    const characterDef = 49 + 6.6203 * 59 + 167
    expect(low.values.def).toBeCloseTo((characterDef + 29 * 2.5682) * 1.192 + 184, 8)
    expect(promoted.values.def).toBeCloseTo((characterDef + 29 * 3.4604) * 1.2496 + 184, 8)
    expect(promoted.values.atk).toBe(low.values.atk)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'rejects non-integer engine refinement %s before producing a valid panel',
    (refinement) => {
      expect(
        projectOutOfCombatPanel({ ...input, wEngine: { ...input.wEngine, refinement } }).status,
      ).toBe('unsupported')
    },
  )
})
