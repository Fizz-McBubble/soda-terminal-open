import { describe, expect, it } from 'vitest'
import type { StatKey } from '../domain/schemas'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'
import { evaluateDevelopmentStatWeights } from './developmentStatWeights'
import {
  claretCalibrationSource,
  statWeightCalibrationFixture,
} from './developmentStatWeights.calibrationFixture'

type Fixture = ReturnType<typeof statWeightCalibrationFixture>
function evaluate(f: Fixture) {
  return evaluateDevelopmentStatWeights({ ...f, stale: false })
}
function gain(result: ReturnType<typeof evaluate>, stat: StatKey) {
  const row = result.rows.find((item) => item.stat === stat)!
  expect(row.status, row.reasons.join(';')).not.toBe('unsupported')
  expect(row.relativeGain).not.toBeNull()
  return row.relativeGain!
}

// Same-engine finite differences are wiring checks that probes consume initial CD->CR
// conversion and scaling before combat effects. The extra affix is a
// hypothetical arithmetic perturbation, never an owned/equipped asset.
function sameEnginePerturbedGain(f: Fixture, stat: StatKey, step: number) {
  const baseline = evaluateDevelopmentValueBenchmarkSide({ ...f, stale: false })
  const discs = structuredClone(f.discs)
  const eligible = discs.find(
    (disc) => disc.mainStat !== stat && disc.subStats.some((row) => row.stat === stat),
  )!
  eligible.subStats.find((row) => row.stat === stat)!.value += step
  const candidate = evaluateDevelopmentValueBenchmarkSide({ ...f, discs, stale: false })
  expect(baseline.totalDamage).not.toBeNull()
  expect(candidate.totalDamage).not.toBeNull()
  return candidate.totalDamage! / baseline.totalDamage! - 1
}

describe('stat-weight calibration: conditional source direction and counterexamples', () => {
  it('records original direction and context without deriving coefficients from ranking', () => {
    expect(claretCalibrationSource.url).toBe('https://www.prydwen.gg/zenless/characters/claret')
    expect(claretCalibrationSource.sourceVersion).toBe('3.2')
    expect(claretCalibrationSource.orderedStats).toEqual([
      'crit_rate',
      'def_percent',
      'crit_dmg',
      'pen',
      'def_flat',
    ])
    expect(claretCalibrationSource.comparisonScope).toBe('conditional-direction-only')
  })

  it('uses legal level15 standard S-roll fixtures with no main/substat conflicts', () => {
    for (const agentId of ['agent-claret', 'agent-billy'] as const) {
      for (const upgradedStat of [
        null,
        'crit_rate',
        'crit_dmg',
        'def_percent',
        'atk_percent',
      ] as const) {
        const f = statWeightCalibrationFixture(agentId, upgradedStat)
        for (const disc of f.discs) {
          expect(disc.subStats).toHaveLength(4)
          expect(new Set(disc.subStats.map((row) => row.stat)).size).toBe(4)
          expect(disc.subStats.some((row) => row.stat === disc.mainStat)).toBe(false)
          expect(disc.subStats.reduce((sum, row) => sum + (row.upgrades ?? 0), 0)).toBe(5)
        }
        expect(evaluate(f).status).not.toBe('unsupported')
      }
    }
  })

  it('matches sourced Claret direction on one declared M0/P1 personal fixture', () => {
    const result = evaluate(statWeightCalibrationFixture())
    const order = claretCalibrationSource.orderedStats
    for (let index = 1; index < order.length; index++)
      expect(gain(result, order[index - 1]!)).toBeGreaterThan(gain(result, order[index]!))
    // This match does not certify Norma/Rina team rankings or whole-combat DPS.
    expect(result.status).toBe('supported')
    expect(result.baseline.coverage?.excludedEffects).toEqual([])
  })

  it('checks same-engine affix wiring, including initial CD to CR conversion', () => {
    const f = statWeightCalibrationFixture()
    const before = JSON.stringify(f)
    const result = evaluate(f)
    for (const stat of claretCalibrationSource.orderedStats) {
      const row = result.rows.find((item) => item.stat === stat)!
      expect(gain(result, stat)).toBeCloseTo(sameEnginePerturbedGain(f, stat, row.step), 12)
      expect(row.damageDelta! / result.baseline.totalDamage!).toBeCloseTo(row.relativeGain!, 12)
    }
    // 4.8 CD * 0.35 = 1.68 CR, versus one 2.4 CR standard roll: 0.7x.
    expect(gain(result, 'crit_dmg') / gain(result, 'crit_rate')).toBeCloseTo(0.7, 10)
    expect(JSON.stringify(f)).toBe(before)
  })

  it('retains source-disagreeing local order when CR or DEF is already abundant', () => {
    const ordinary = evaluate(statWeightCalibrationFixture())
    const critRich = evaluate(statWeightCalibrationFixture('agent-claret', 'crit_rate'))
    const defRich = evaluate(statWeightCalibrationFixture('agent-claret', 'def_percent'))
    expect(gain(ordinary, 'crit_rate')).toBeGreaterThan(gain(ordinary, 'def_percent'))
    expect(gain(critRich, 'def_percent')).toBeGreaterThan(gain(critRich, 'crit_rate'))
    expect(gain(defRich, 'crit_dmg')).toBeGreaterThan(gain(defRich, 'def_percent'))
    expect(gain(defRich, 'def_percent')).toBeLessThan(gain(ordinary, 'def_percent'))
    // Model/context counterexamples must not be fitted away to force ranks.
    expect(critRich.status).toBe('supported')
    expect(defRich.status).toBe('supported')
  })

  it('balances ordinary CR/CD dynamically and distinguishes ordinary and sharp critical limits', () => {
    const baseline = evaluate(statWeightCalibrationFixture('agent-billy'))
    const cdRich = evaluate(statWeightCalibrationFixture('agent-billy', 'crit_dmg'))
    const crRich = evaluate(statWeightCalibrationFixture('agent-billy', 'crit_rate'))
    const sharpCrRich = evaluate(statWeightCalibrationFixture('agent-claret', 'crit_rate'))
    expect(gain(baseline, 'crit_dmg')).toBeGreaterThan(gain(baseline, 'crit_rate'))
    expect(gain(cdRich, 'crit_rate')).toBeGreaterThan(gain(cdRich, 'crit_dmg'))
    expect(gain(crRich, 'crit_rate')).toBe(0)
    expect(gain(crRich, 'crit_dmg')).toBeGreaterThan(0)
    expect(gain(sharpCrRich, 'crit_rate')).toBe(0)
  })

  it('dilutes ATK scaling and keeps unmodeled anomaly gain unavailable instead of zero', () => {
    const baseline = evaluate(statWeightCalibrationFixture('agent-billy'))
    const atkRich = evaluate(statWeightCalibrationFixture('agent-billy', 'atk_percent'))
    expect(gain(atkRich, 'atk_percent')).toBeLessThan(gain(baseline, 'atk_percent'))
    expect(baseline.rows.find((row) => row.stat === 'anomaly_proficiency')).toMatchObject({
      status: 'unsupported',
      damageDelta: null,
      relativeGain: null,
      normalizedWeight: null,
    })
  })
})
