import { describe, expect, it } from 'vitest'
import { dynamicDiscProposals } from './dynamicDiscProposals'
import { evaluateDevelopmentStatWeights } from '../decision/developmentStatWeights'
import { statWeightCalibrationFixture } from '../decision/developmentStatWeights.calibrationFixture'

describe('dynamic local proposals', () => {
  it('changes the proposed order with actual attribute dilution, without rewriting guide weights', () => {
    const base = statWeightCalibrationFixture()
    const rich = statWeightCalibrationFixture('agent-claret', 'crit_rate')
    const critDisc = rich.discs[0]!
    const defDisc = statWeightCalibrationFixture('agent-claret', 'def_percent').discs[0]!
    const ordinary = evaluateDevelopmentStatWeights({ ...base, stale: false })
    const critRich = evaluateDevelopmentStatWeights({ ...rich, stale: false })
    expect(
      dynamicDiscProposals([defDisc, critDisc], base.discs[0]!, ordinary).map((disc) => disc.id),
    ).toEqual([critDisc.id, defDisc.id])
    expect(
      dynamicDiscProposals([critDisc, defDisc], base.discs[0]!, critRich).map((disc) => disc.id),
    ).toEqual([defDisc.id, critDisc.id])
  })

  it('preserves unknown affixes and does not extrapolate across main stats, sets, levels or slots', () => {
    const f = statWeightCalibrationFixture()
    const current = f.discs[0]!
    const weights = evaluateDevelopmentStatWeights({ ...f, stale: false })
    const stronger = statWeightCalibrationFixture('agent-claret', 'crit_rate').discs[0]!
    const unknownTrade = {
      ...stronger,
      id: 'unknown',
      subStats: [
        ...stronger.subStats.slice(0, 3),
        { stat: 'anomaly_proficiency' as const, value: 9, upgrades: 0 },
      ],
    }
    const pool = [
      current,
      stronger,
      unknownTrade,
      { ...stronger, id: 'main', mainStat: 'crit_dmg' as const },
      { ...stronger, id: 'set', setId: 'set-soul-rock' },
      { ...stronger, id: 'level', level: 12 },
      { ...stronger, id: 'slot', slot: 2 as const },
      { ...stronger, id: 'rarity', rarity: 'A' as const },
    ]
    expect(dynamicDiscProposals(pool, current, weights).map((disc) => disc.id)).toEqual([
      stronger.id,
    ])
    expect(dynamicDiscProposals(pool, current, { ...weights, status: 'stale' })).toEqual([])
    expect(dynamicDiscProposals(pool, current, { ...weights, status: 'unsupported' })).toEqual([])
  })
})
