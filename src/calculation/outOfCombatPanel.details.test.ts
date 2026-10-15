import { describe, expect, it } from 'vitest'
import type { DriveDisc } from '../domain/schemas'
import { projectOutOfCombatPanel } from './outOfCombatPanel'

const discs: DriveDisc[] = [1, 2, 3, 4, 5, 6].map((slot) => ({
  id: `details-${slot}`,
  slot: slot as DriveDisc['slot'],
  setId: 'set-fanged-metal',
  level: 15,
  rarity: 'S',
  mainStat:
    slot === 1
      ? 'hp_flat'
      : slot === 2
        ? 'atk_flat'
        : slot === 3
          ? 'def_flat'
          : slot === 5
            ? 'physical_dmg'
            : 'atk_percent',
  subStats: slot === 1 ? [{ stat: 'pen', value: 9, upgrades: 0 }] : [],
  locked: false,
  favorite: false,
  tags: [],
  createdAt: '2026-10-15T00:00:00Z',
  updatedAt: '2026-10-15T00:00:00Z',
  dataVersion: 'synthetic',
}))
const input = {
  agentId: 'agent-billy',
  level: 60,
  ascension: 5,
  core: 5,
  wEngine: { id: 'wengine-13001', level: 60, ascension: 5, refinement: 1 },
  discs,
}

describe('shared out-of-combat detail attributes', () => {
  it('keeps flat PEN separate and adds only static main and two-piece damage', () => {
    const result = projectOutOfCombatPanel(input)
    expect(result.status).toBe('ok')
    expect(result.values.pen).toBe(9)
    expect(result.values.penRatio).toBe(0)
    // S+15 slot5 =30%; Fanged2pc =10%. Its conditional4pc is excluded.
    expect(result.values.physicalDamageBonus).toBe(40)
    expect(result.values.fireDamageBonus).toBe(0)
    expect(result.trace.filter((row) => row.key === 'physicalDamageBonus')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'disc:details-5:main', value: 30 }),
        expect.objectContaining({ source: 'set:set-fanged-metal:2pc source-catalog', value: 10 }),
      ]),
    )
  })
  it('preserves off-element bonuses and isolates a one-disc main-stat change', () => {
    const baseline = projectOutOfCombatPanel(input)
    const changed = projectOutOfCombatPanel({
      ...input,
      discs: discs.map((disc) => ({
        ...disc,
        mainStat: disc.slot === 5 ? 'fire_dmg' : disc.mainStat,
      })),
    })
    expect(changed.status).toBe('ok')
    expect(changed.values.physicalDamageBonus).toBe(10)
    expect(changed.values.fireDamageBonus).toBe(30)
    expect(changed.values.atk).toBe(baseline.values.atk)
    expect(changed.values.pen).toBe(9)
  })
  it('reuses source-bound initial ATK and HP for Yixuan sheer force, without combat buffs', () => {
    const result = projectOutOfCombatPanel({
      ...input,
      agentId: 'agent-yixuan',
      level: 1,
      ascension: 0,
      core: 0,
      wEngine: { id: 'wengine-14137', level: 1, ascension: 0, refinement: 1 },
    })
    expect(result.status).toBe('ok')
    expect(result.values.sheerForce).toBeCloseTo(
      result.values.atk * 0.3 + result.values.hp * 0.1,
      9,
    )
    expect(
      result.trace.some((row) => row.key === 'sheerForce' && row.source.includes('3456cd0')),
    ).toBe(true)
  })
  it('does not invent unverified menu resource values or a nonexistent seventh base element', () => {
    const result = projectOutOfCombatPanel(input)
    expect(result.values.energyGenerationRate).toBeUndefined()
    expect(result.values.maxEnergy).toBeUndefined()
    expect(result.values.adrenalineRegen).toBeUndefined()
    expect(result.values.lumifluxDamageBonus).toBeUndefined()
    expect(
      projectOutOfCombatPanel({ ...input, wEngine: { ...input.wEngine, id: 'unknown' } }).status,
    ).toBe('unsupported')
  })
})
