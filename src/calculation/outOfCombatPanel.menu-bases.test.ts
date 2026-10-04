import { describe, expect, it } from 'vitest'
import type { DriveDisc } from '../domain/schemas'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import {
  projectOutOfCombatMenuPanel,
  projectOutOfCombatPanel,
  type PanelInput,
} from './outOfCombatPanel'

function discs(mains: readonly DriveDisc['mainStat'][]): DriveDisc[] {
  return mains.map((mainStat, index) => ({
    id: `menu-base-${index + 1}`,
    slot: (index + 1) as DriveDisc['slot'],
    setId: 'set-inferno-metal',
    mainStat,
    level: 15,
    rarity: 'S',
    subStats: [],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    dataVersion: 'synthetic-panel-arithmetic',
  }))
}

function input(agentId = 'agent-billy'): PanelInput {
  return {
    agentId,
    level: 60,
    ascension: 5,
    core: 5,
    wEngine: { id: 'wengine-13001', level: 60, ascension: 5, refinement: 1 },
    discs: discs(['hp_flat', 'atk_flat', 'def_flat', 'atk_percent', 'pen_ratio', 'atk_percent']),
  }
}

// Only the sourced arithmetic contributions are represented here, not scanner
// enhancement-history claims. Six distinct S15 objects preserve the selected mains.
function promeiaInput(agentId = 'agent-promeia'): PanelInput {
  const source = input(agentId)
  source.wEngine.id = 'wengine-14154'
  source.discs = discs([
    'hp_flat',
    'atk_flat',
    'def_flat',
    'anomaly_proficiency',
    'ice_dmg',
    'anomaly_mastery',
  ]).map((disc, index) => ({
    ...disc,
    setId: index < 4 ? 'set-notes-from-the-chained' : 'set-phaethons-melody',
  }))
  const rows: Array<Array<[DriveDisc['mainStat'], number, number]>> = [
    [
      ['atk_percent', 6, 1],
      ['atk_flat', 38, 1],
      ['def_percent', 9.6, 1],
      ['anomaly_proficiency', 27, 2],
    ],
    [
      ['atk_percent', 6, 1],
      ['hp_percent', 3, 0],
      ['def_percent', 9.6, 1],
      ['def_flat', 30, 1],
    ],
    [
      ['atk_percent', 6, 1],
      ['atk_flat', 38, 1],
      ['hp_flat', 112, 0],
      ['anomaly_proficiency', 27, 2],
    ],
    [
      ['atk_percent', 6, 1],
      ['atk_flat', 38, 1],
      ['def_percent', 14.4, 2],
      ['def_flat', 30, 1],
    ],
    [
      ['atk_percent', 6, 1],
      ['atk_flat', 38, 1],
      ['hp_percent', 3, 0],
      ['anomaly_proficiency', 27, 2],
    ],
    [
      ['hp_percent', 3, 0],
      ['def_percent', 9.6, 1],
      ['anomaly_proficiency', 27, 2],
    ],
  ]
  source.discs.forEach((disc, index) => {
    disc.subStats = rows[index]!.map(([stat, value, upgrades]) => ({ stat, value, upgrades }))
  })
  return source
}

describe('explicit menu white-base projection', () => {
  it('reproduces all three Promeia differences while keeping the original precise entry unchanged', () => {
    const source = promeiaInput()
    const before = structuredClone(source)
    const precise = projectOutOfCombatPanel(source)
    const menu = projectOutOfCombatMenuPanel(source)
    expect(precise.status).toBe('ok')
    expect(menu.status).toBe('ok')
    expect(source).toEqual(before)
    // HP:7788*1.09+2312; ATK:(797+75+713)*1.3+468; DEF:612*1.432+244.
    expect(menu.values.hp).toBeCloseTo(10800.92, 8)
    expect(menu.values.atk).toBeCloseTo(2528.5, 8)
    expect(menu.values.def).toBeCloseTo(1120.384, 8)
    expect([
      Math.ceil(menu.values.hp),
      Math.floor(menu.values.atk),
      Math.floor(menu.values.def),
    ]).toEqual([10801, 2528, 1120])
    expect(precise.values.hp).toBeCloseTo(10801.678749, 8)
    expect(precise.values.atk).toBeCloseTo(2530.2342, 8)
    expect(precise.values.def).toBeCloseTo(1121.2486416, 8)
    expect([
      Math.ceil(precise.values.hp),
      Math.floor(precise.values.atk),
      Math.floor(precise.values.def),
    ]).toEqual([10802, 2530, 1121])
    expect(menu.values.anomalyMastery).toBeCloseTo(248.64, 8)
    expect(menu.values.anomalyProficiency).toBe(314)
    for (const key of [
      'impact',
      'critRate',
      'critDamage',
      'anomalyMastery',
      'anomalyProficiency',
      'pen',
      'energyRegen',
    ] as const)
      expect(menu.values[key]).toBe(precise.values[key])
  })

  it.each(['agent-velina', 'agent-yanagi'])(
    'applies the same source white-stat arithmetic to %s without substituting its core or other stats',
    (agentId) => {
      const menu = projectOutOfCombatMenuPanel(promeiaInput(agentId))
      expect(menu.status).toBe('ok')
      expect(menu.values.hp).toBeCloseTo(10800.92, 8)
      expect(menu.values.atk).toBeCloseTo(2528.5, 8)
      expect(menu.values.def).toBeCloseTo(1120.384, 8)
      // Velina has base111 and core54; Yanagi has base114 and core AM36.
      expect(menu.values.anomalyProficiency).toBe(agentId === 'agent-velina' ? 365 : 314)
    },
  )

  it('preserves the published Aria/Flight bases and the independently checked equipment totals', () => {
    const source = input('agent-aria')
    source.wEngine.id = 'wengine-14133'
    source.discs = discs([
      'hp_flat',
      'atk_flat',
      'def_flat',
      'anomaly_proficiency',
      'ether_dmg',
      'anomaly_mastery',
    ]).map((disc, index) => ({
      ...disc,
      setId: [2, 4].includes(index) ? 'set-shining-aria' : 'set-phaethons-melody',
    }))
    const rows: Array<Array<[DriveDisc['mainStat'], number]>> = [
      [
        ['atk_percent', 9],
        ['atk_flat', 57],
        ['crit_dmg', 9.6],
        ['pen', 9],
      ],
      [
        ['anomaly_proficiency', 27],
        ['atk_percent', 6],
        ['def_percent', 9.6],
        ['crit_dmg', 9.6],
      ],
      [
        ['crit_rate', 4.8],
        ['anomaly_proficiency', 27],
        ['hp_flat', 112],
        ['atk_flat', 38],
      ],
      [
        ['atk_percent', 3],
        ['hp_flat', 336],
        ['def_percent', 4.8],
        ['atk_flat', 57],
      ],
      [
        ['atk_flat', 57],
        ['hp_flat', 112],
        ['pen', 18],
        ['anomaly_proficiency', 18],
      ],
      [
        ['anomaly_proficiency', 18],
        ['atk_percent', 9],
        ['hp_percent', 6],
        ['def_flat', 30],
      ],
    ]
    source.discs.forEach((disc, index) => {
      disc.subStats = rows[index]!.map(([stat, value]) => ({ stat, value, upgrades: 0 }))
    })
    const menu = projectOutOfCombatMenuPanel(source)
    const precise = projectOutOfCombatPanel(source)
    expect(menu.status).toBe('ok')
    expect(menu.values).toEqual(precise.values)
    expect(menu.values.hp).toBeCloseTo(10973.94, 8)
    expect(menu.values.atk).toBeCloseTo(2526.52, 8)
    expect(menu.values.def).toBeCloseTo(922.136, 8)
    expect(menu.values.anomalyMastery).toBeCloseTo(208.38, 8)
    expect(menu.values.anomalyProficiency).toBe(388)
  })

  it('preserves Remielle observed stats including core exactly once', () => {
    const source = { ...input('agent-remielle'), mindscape: 2 }
    const menu = projectOutOfCombatMenuPanel(source)
    const precise = projectOutOfCombatPanel(source)
    expect(menu.status).toBe('ok')
    expect(menu.values).toEqual(precise.values)
    expect(menu.values.hp).toBe(9682)
    expect(menu.values.atk).toBeCloseTo(2937.45, 8)
    expect(menu.values.def).toBe(784)
    expect(menu.values.anomalyProficiency).toBe(170)
    expect(menu.trace.some((row) => row.source.startsWith('character:coreStats'))).toBe(false)
  })

  it.each([
    [0, 74, 994.56, 995.841996],
    [1, 100, 1066.2176, 1067.40384528],
  ])(
    'floors the real typed DEF engine at level10 / ascension%s before percentages',
    (ascension, white, menuDef, preciseDef) => {
      const source = input()
      source.wEngine = { id: 'wengine-14161', level: 10, ascension, refinement: 1 }
      const menu = projectOutOfCombatMenuPanel(source)
      const precise = projectOutOfCombatPanel(source)
      expect(menu.status).toBe('ok')
      expect(menu.values.def).toBeCloseTo(menuDef, 8)
      expect(precise.values.def).toBeCloseTo(preciseDef, 8)
      const engineBases = menu.trace.filter(
        (row) => row.operation === 'base' && row.source.startsWith('wengine:'),
      )
      expect(engineBases).toEqual([expect.objectContaining({ key: 'def', value: white })])
    },
  )

  it('keeps the A1 disc main6.25% and engine secondary8.32% at calculation precision', () => {
    const source = input()
    source.wEngine = { id: 'wengine-12003', level: 10, ascension: 1, refinement: 1 }
    source.discs[3] = { ...source.discs[3]!, rarity: 'A', level: 1 }
    const menu = projectOutOfCombatMenuPanel(source)
    expect(menu.status).toBe('ok')
    expect(menu.values.atk).toBeCloseTo(1538.1625, 8)
    expect(menu.values.critRate).toBeCloseTo(27.72, 8)
    expect(menu.trace).toContainEqual(
      expect.objectContaining({
        source: 'disc:menu-base-4:main',
        operation: 'percent',
        value: 6.25,
      }),
    )
    expect(menu.trace).toContainEqual(
      expect.objectContaining({
        key: 'critRate',
        operation: 'post_flat',
        value: 8.32,
      }),
    )
  })

  it('emits integer white-base traces across the catalog without claiming game verification for every object', () => {
    for (const agentId of Object.keys(currentPanelData.agents)) {
      const menu = projectOutOfCombatMenuPanel(input(agentId))
      expect(menu.status, agentId).toBe('ok')
      for (const row of menu.trace.filter(
        (row) => row.operation === 'base' && ['hp', 'atk', 'def'].includes(row.key),
      ))
        expect(Number.isInteger(row.value), `${agentId}:${row.source}`).toBe(true)
    }
    for (const wEngineId of Object.keys(currentPanelData.wEngines)) {
      const source = input()
      source.wEngine.id = wEngineId
      const menu = projectOutOfCombatMenuPanel(source)
      expect(menu.status, wEngineId).toBe('ok')
      const row = menu.trace.find(
        (entry) => entry.operation === 'base' && entry.source.startsWith('wengine:'),
      )
      expect(row, wEngineId).toBeDefined()
      expect(Number.isInteger(row!.value), wEngineId).toBe(true)
    }
  })
})
