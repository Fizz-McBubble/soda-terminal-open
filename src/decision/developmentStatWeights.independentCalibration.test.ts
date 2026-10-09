import { describe, expect, it } from 'vitest'
import type { StatKey } from '../domain/schemas'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'
import { evaluateDevelopmentStatWeights } from './developmentStatWeights'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import agentSource from '../gameDataPacks/generated/current-agent-mechanic-catalog.v1.json'
import engineSource from '../gameDataPacks/generated/current-wengine-static-catalog.v1.json'

type Fixture = ReturnType<typeof statWeightCalibrationFixture>
type Probe = { stat: StatKey; value: number }

/** Literal source transcriptions, NOT calculated by any runtime, projection,
 * event selector, expression evaluator, damage function or standard-roll helper.
 * GO3456cd stats/Characters/{Claret,Billy}.json; Wengine/{CrimsonThirst,
 * LunarPleniluna}.json; common defaults in formula/src/util.ts; level 60 engine
 * multiplier 94090/10000 and ascension factor .8922 in stats/src/wengine.ts.
 * Full source locators and preparation are in independent-calibration.md.
 */
const source = {
  claret: {
    defBase: 35,
    defGrowth: 4.8155,
    promotionDef: 122,
    coreCR: 0.288,
    engineBase: 29,
    engineDefPercent: 0.48,
    coreCombatCR: 0.3,
    initialCDtoCR: 0.35,
    lacerationDamage: 1.5,
    upward: [0.766, 0.07],
    burial: [3.128, 0.285],
    maim: [8.127, 0.739],
    axe: [3.28, 0.299],
    engineCR: [0.25, 0.275, 0.3, 0.325, 0.35],
    engineElectric: [0.15, 0.175, 0.2, 0.225, 0.25],
    engineSharp: [0.1, 0.115, 0.13, 0.145, 0.16],
  },
  billy: {
    atkBase: 113,
    atkGrowth: 6.7335,
    promotionAtk: 202,
    coreAtk: 75,
    coreCR: 0.144,
    engineBase: 32,
    engineAtkPercent: 0.2,
    coreBasic: 0.5,
    basic: [
      [0.68, 0.062],
      [0.076, 0.007],
      [0.618, 0.057],
      [0.127, 0.012],
      [0.495, 0.045],
    ],
    engineBasic: [0.12, 0.14, 0.16, 0.18, 0.2],
  },
  level60Defense: 794,
  enemyDefense: 700,
  enemyResistance: 0.2,
} as const

// S level15 main stats (base x4); deliberately independent of main-stat resolver.
const mainValues: Partial<Record<StatKey, number>> = {
  hp_flat: 2200,
  atk_flat: 316,
  def_flat: 184,
  crit_rate: 24,
  crit_dmg: 48,
  atk_percent: 30,
  def_percent: 48,
  hp_percent: 30,
  pen_ratio: 24,
  electric_dmg: 30,
  physical_dmg: 30,
}
const standardSteps: Partial<Record<StatKey, number>> = {
  hp_flat: 112,
  hp_percent: 3,
  atk_flat: 19,
  atk_percent: 3,
  def_flat: 15,
  def_percent: 4.8,
  pen: 9,
  crit_rate: 2.4,
  crit_dmg: 4.8,
}
function independentPanel(f: Fixture, probe?: Probe) {
  const totals: Partial<Record<StatKey, number>> = {}
  const add = (stat: StatKey, value: number) => {
    totals[stat] = (totals[stat] ?? 0) + value
  }
  for (const disc of f.discs) {
    expect(disc.level).toBe(15)
    expect(disc.rarity).toBe('S')
    const main = mainValues[disc.mainStat]
    if (main === undefined) throw new Error(`Unreviewed main stat ${disc.mainStat}`)
    add(disc.mainStat, main)
    for (const row of disc.subStats) add(row.stat, row.value)
  }
  if (probe) add(probe.stat, probe.value)
  const value = (stat: StatKey) => totals[stat] ?? 0
  const counts = new Map<string, number>()
  for (const disc of f.discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  const two = (set: string) => (counts.get(set) ?? 0) >= 2
  const fourRose = (counts.get('set-34200') ?? 0) >= 4
  for (const [set, count] of counts) {
    if (
      ![
        'set-34200',
        'set-soul-rock',
        'set-woodpecker-electro',
        'set-hormone-punk',
        'set-puffer-electro',
      ].includes(set) ||
      (count >= 4 && !fourRose)
    )
      throw new Error(`Unreviewed independent set ${set}`)
  }
  const claret = f.agentId === 'agent-claret'
  const refinement = f.warehouse.roster.agents.find((a) => a.agentId === f.agentId)!.wEngineDetails
    .refinement
  if (
    typeof refinement !== 'number' ||
    !Number.isInteger(refinement) ||
    refinement < 1 ||
    refinement > 5
  )
    throw new Error('Independent oracle requires an explicit W-Engine refinement from P1 to P5')
  const cr =
    0.05 +
    (claret ? source.claret.coreCR : source.billy.coreCR) +
    value('crit_rate') / 100 +
    (two('set-woodpecker-electro') ? 0.08 : 0)
  const cd = 0.5 + value('crit_dmg') / 100
  const defBase =
    source.claret.defBase +
    59 * source.claret.defGrowth +
    source.claret.promotionDef +
    source.claret.engineBase * (1 + 9.409 + 5 * 0.8922)
  const defense =
    defBase *
      (1 +
        source.claret.engineDefPercent +
        value('def_percent') / 100 +
        (two('set-34200') ? 0.16 : 0) +
        (two('set-soul-rock') ? 0.16 : 0)) +
    value('def_flat')
  const atkBase =
    source.billy.atkBase +
    59 * source.billy.atkGrowth +
    source.billy.promotionAtk +
    source.billy.coreAtk +
    source.billy.engineBase * (1 + 9.409 + 5 * 0.8922)
  const attack =
    atkBase *
      (1 +
        source.billy.engineAtkPercent +
        value('atk_percent') / 100 +
        (two('set-hormone-punk') ? 0.1 : 0)) +
    value('atk_flat')
  const roseCR = fourRose ? (defense >= 1800 ? 0.16 : defense >= 1000 ? 0.08 : 0) : 0
  return {
    attack,
    defense,
    cd,
    initialCR: cr,
    initialCD: cd,
    cr: claret
      ? cr +
        cd * source.claret.initialCDtoCR +
        source.claret.coreCombatCR +
        source.claret.engineCR[refinement - 1]! +
        roseCR
      : cr,
    damage:
      value(claret ? 'electric_dmg' : 'physical_dmg') / 100 +
      (claret
        ? source.claret.engineElectric[refinement - 1]! + (fourRose ? 0.15 : 0)
        : source.billy.engineBasic[refinement - 1]!),
    sharp: claret ? source.claret.engineSharp[refinement - 1]! : 0,
    penRatio: value('pen_ratio') / 100 + (two('set-puffer-electro') ? 0.08 : 0),
    pen: value('pen'),
    roseCR,
  }
}
function independentDamage(f: Fixture, probe?: Probe) {
  const p = independentPanel(f, probe)
  const defenseFactor =
    source.level60Defense /
    (source.level60Defense + Math.max(0, source.enemyDefense * (1 - p.penRatio) - p.pen))
  // Elementary probability enumeration: no critical, once, twice. One additional
  // check has probability at most one. Never call the production cap implementation.
  const first = Math.min(1, Math.max(0, p.cr))
  const second = Math.min(1, Math.max(0, p.cr - 1))
  const claret = f.agentId === 'agent-claret'
  const critExpectation = claret
    ? 1 - first + first * (1 - second) * 2.5 + first * second * 6.25
    : 1 + first * p.cd
  const skill12 = ([base, growth]: readonly number[]) => base! + 11 * growth!
  const damageWeightedCoefficient = claret
    ? skill12(source.claret.upward) +
      skill12(source.claret.burial) +
      3 * skill12(source.claret.maim) +
      skill12(source.claret.axe)
    : // Billy source sheet binds core damage only to indices 2 and 3, not to
      // the complete Basic. Aggregate each event's additive damage bucket.
      5 *
      source.billy.basic.reduce(
        (sum, row, index) =>
          sum +
          skill12(row) * (1 + p.damage + (index === 2 || index === 3 ? source.billy.coreBasic : 0)),
        0,
      )
  return (
    (claret ? p.defense : p.attack) *
    damageWeightedCoefficient *
    (claret ? 1 + p.damage : 1) *
    (1 + p.sharp) *
    defenseFactor *
    (1 - source.enemyResistance) *
    critExpectation
  )
}
function assertSameConditions(f: Fixture) {
  const a = f.warehouse.roster.agents.find((a) => a.agentId === f.agentId)!
  expect(a).toMatchObject({
    level: 60,
    ascension: 5,
    mindscape: 0,
    potentialImage: 0,
    skillLevels: { basic: 12, special: 12, chain: 12, core: 7 },
    wEngineDetails: {
      id: f.agentId === 'agent-claret' ? 'wengine-14161' : 'wengine-12001',
      level: 60,
      ascension: 5,
    },
  })
  expect(f.discs).toHaveLength(6)
  expect(new Set(f.discs.map((d) => d.slot)).size).toBe(6)
}
function calibrate(f: Fixture) {
  assertSameConditions(f)
  const benchmark = evaluateDevelopmentValueBenchmarkSide({ ...f, stale: false })
  const weights = evaluateDevelopmentStatWeights({ ...f, stale: false })
  const expected = independentDamage(f)
  expect(benchmark.state, benchmark.reasons.join(';')).toBe('supported')
  // No rounding or empirical fitting: tolerance covers floating point operation
  // order only (1e-8 absolute, <1e-12 relative for these full six-disc fixtures).
  expect(Math.abs(benchmark.totalDamage! - expected)).toBeLessThan(1e-8)
  expect(benchmark.planningDps!).toBeCloseTo(expected / 30, 10)
  const expectedDeltas = Object.entries(standardSteps).map(([stat, value]) => ({
    stat: stat as StatKey,
    value: value!,
    delta: independentDamage(f, { stat: stat as StatKey, value: value! }) - expected,
  }))
  const maximum = Math.max(...expectedDeltas.map((row) => row.delta))
  for (const { stat, value, delta } of expectedDeltas) {
    const row = weights.rows.find((row) => row.stat === stat)!
    expect(row.status, row.reasons.join(';')).not.toBe('unsupported')
    expect(row.step, stat).toBe(value)
    expect(Math.abs(row.damageDelta! - delta), stat).toBeLessThan(1e-8)
    expect(row.relativeGain!, stat).toBeCloseTo(delta / expected, 12)
    expect(row.normalizedWeight!, stat).toBeCloseTo(delta / maximum, 12)
  }
  return { weights, expected, panel: independentPanel(f) }
}
function gain(result: ReturnType<typeof calibrate>, stat: StatKey) {
  return result.weights.rows.find((row) => row.stat === stat)!.relativeGain!
}

describe('independent same-condition full-six-disc stat-weight arithmetic', () => {
  it('retains independently expanded baseline arithmetic anchors', () => {
    expect(independentDamage(statWeightCalibrationFixture())).toBeCloseTo(736991.1591198456, 8)
    expect(independentDamage(statWeightCalibrationFixture('agent-billy'))).toBeCloseTo(
      70659.63776962385,
      8,
    )
  })

  it('pins literal numeric input provenance without consuming compiled operators for expectations', () => {
    expect(agentSource.items.find((x) => x.upstreamKey === 'Claret')?.source.statsSha256).toBe(
      '49BDB5A6D64AC3CA2727F376765BF97F884C7DDF03F9B954017532757C85388C',
    )
    expect(agentSource.items.find((x) => x.upstreamKey === 'Billy')?.source.statsSha256).toBe(
      'EC555A3E843C3145A2374551D649843792B2EBE46ABDAE8104958E439CE478B2',
    )
    expect(engineSource.items.find((x) => x.stableId === 'wengine-14161')?.source.dataSha256).toBe(
      'BD793DAC8D8E9231ECA7B526B9A1DCF1EEA4992F186B18C42E01B7D6A0E7E741',
    )
  })

  it.each([null, 'crit_rate', 'crit_dmg', 'def_percent'] as const)(
    'Claret %s: raw growth, CD→CR, DEF scaling, PEN and two-check expectation',
    (upgraded) => {
      const f = statWeightCalibrationFixture('agent-claret', upgraded)
      const before = JSON.stringify(f)
      const result = calibrate(f)
      expect(result.panel.defense).toBeGreaterThan(1800)
      expect(gain(result, 'atk_percent')).toBe(0)
      expect(gain(result, 'atk_flat')).toBe(0)
      expect(gain(result, 'pen')).toBeGreaterThan(0)
      expect(JSON.stringify(f)).toBe(before)
    },
  )

  it('Claret above 200%: both CR and converting CD saturate while DEF still gains', () => {
    const rich = calibrate(statWeightCalibrationFixture('agent-claret', 'crit_rate'))
    expect(rich.panel.cr).toBeGreaterThan(2)
    expect(gain(rich, 'crit_rate')).toBe(0)
    expect(gain(rich, 'crit_dmg')).toBe(0)
    expect(gain(rich, 'def_percent')).toBeGreaterThan(0)
    const ordinary = calibrate(statWeightCalibrationFixture())
    expect(ordinary.panel.cr).toBeGreaterThan(1)
    expect(ordinary.panel.cr).toBeLessThan(2)
    expect(gain(ordinary, 'crit_dmg') / gain(ordinary, 'crit_rate')).toBeCloseTo(0.7, 10)
  })

  it('PEN ratio is applied before flat PEN; Puffer two-piece changes the actual six-disc result', () => {
    const f = statWeightCalibrationFixture()
    const ordinary = calibrate(f)
    for (const d of f.discs.filter((d) => d.slot >= 5)) d.setId = 'set-puffer-electro'
    const puffer = calibrate(f)
    expect(puffer.panel.penRatio).toBe(0.08)
    expect(puffer.panel.defense).toBeLessThan(ordinary.panel.defense)
    expect(gain(puffer, 'pen')).toBeGreaterThan(gain(ordinary, 'pen'))
  })

  it.each([1, 2, 3, 4, 5])('Claret P%s uses independent raw phase values', (refinement) => {
    const f = statWeightCalibrationFixture()
    f.warehouse.roster.agents.find((a) => a.agentId === f.agentId)!.wEngineDetails.refinement =
      refinement
    calibrate(f)
  })

  it.each([null, 'crit_rate', 'crit_dmg', 'atk_percent'] as const)(
    'Billy %s: ordinary 100% cap, raw ATK scaling and PEN',
    (upgraded) => {
      calibrate(statWeightCalibrationFixture('agent-billy', upgraded))
    },
  )

  it('Billy ordinary CR saturates at 100%; ATK abundance dilutes a standard roll', () => {
    const ordinary = calibrate(statWeightCalibrationFixture('agent-billy'))
    const crRich = calibrate(statWeightCalibrationFixture('agent-billy', 'crit_rate'))
    const atkRich = calibrate(statWeightCalibrationFixture('agent-billy', 'atk_percent'))
    expect(crRich.panel.cr).toBeGreaterThan(1)
    expect(gain(crRich, 'crit_rate')).toBe(0)
    expect(gain(crRich, 'crit_dmg')).toBeGreaterThan(0)
    expect(gain(atkRich, 'atk_percent')).toBeLessThan(gain(ordinary, 'atk_percent'))
    expect(gain(ordinary, 'def_percent')).toBe(0)
    expect(
      ordinary.weights.rows.find((r) => r.stat === 'anomaly_proficiency')?.relativeGain,
    ).toBeNull()
  })
})
