import { describe, it, expect } from 'vitest'
import {
  calculateSourceQualifiedOrdinaryAnomalySettlement32,
  sourceQualifiedOrdinaryAnomalyHash32,
  type SourceQualifiedOrdinaryAnomalyInput32,
} from './currentSourceQualifiedAnomalySettlement32'

// Full Soda source/catalog runtime, with synthetic declared snapshots. These
// accepted weights are not a game anomaly threshold or inferred trigger count.
function input(): SourceQualifiedOrdinaryAnomalyInput32 {
  const stats = (attack: number, anomalyProficiency: number) => ({
    attackerLevel: 60,
    attack,
    anomalyProficiency,
    anomalyBaseBonus: 0,
    flatAnomalyDamage: 0,
    anomalyCritRate: 0,
    anomalyCritDamage: 0,
    damageBonus: 0,
    buffBonus: 0,
    directDamageBonus: 0,
    defenseIgnore: 0,
    penetrationRatio: 0,
    penetrationFlat: 0,
    resistanceIgnore: 0,
  })
  return {
    sourceIdentityHash: sourceQualifiedOrdinaryAnomalyHash32,
    eventId: 'synthetic-declared-assault',
    triggerAgentId: 'agent-billy',
    memberAgentIds: ['agent-billy'],
    attribute: 'physical',
    targetId: 'synthetic-neutral',
    atSeconds: 2,
    buildupStateId: 'gauge',
    totalBuildup: 100,
    sourceRefs: ['synthetic-declared-settlement'],
    target: {
      enemyDefense: 0,
      resistance: 0,
      defenseReduction: 0,
      resistanceReduction: 0,
      vulnerability: 0,
      stunMultiplier: 1,
      sourceRefs: ['synthetic-target-not-game-capture'],
    },
    contributions: [
      {
        id: 'before-buff',
        ownerAgentId: 'agent-billy',
        ownerKind: 'agent',
        attribute: 'physical',
        targetId: 'synthetic-neutral',
        buildupStateId: 'gauge',
        buildup: 50,
        snapshotAtSeconds: 0,
        stats: stats(3000, 100),
        instance: { kind: 'anomaly', motionValueMultiplier: 1 },
        sourceRefs: ['synthetic-snapshot-a'],
      },
      {
        id: 'after-buff',
        ownerAgentId: 'agent-billy',
        ownerKind: 'agent',
        attribute: 'physical',
        targetId: 'synthetic-neutral',
        buildupStateId: 'gauge',
        buildup: 50,
        snapshotAtSeconds: 1,
        stats: stats(1000, 300),
        instance: { kind: 'anomaly', motionValueMultiplier: 1 },
        sourceRefs: ['synthetic-snapshot-b'],
      },
    ],
  }
}
describe('source-qualified ordinary heterogeneous anomaly adapter', () => {
  it('uses 2000 ATK and 200 AP, keeps raw snapshots, and grants no Formal cycle qualification', () => {
    const raw = input(),
      before = structuredClone(raw)
    const result = calculateSourceQualifiedOrdinaryAnomalySettlement32(raw)
    // Independently: (3000+1000)/2 * 7.13 * ((100+300)/2)/100 * level60(2).
    expect(result.expectedDamage).toBeCloseTo(57040, 8)
    expect(result.formalCycleReady).toBe(false)
    expect(result.modelQualification32).toBeNull()
    expect(raw).toEqual(before)
  })
  it('rejects a reused historical source identity, ordinary crit leakage, and future snapshots', () => {
    const raw = input()
    expect(() =>
      calculateSourceQualifiedOrdinaryAnomalySettlement32({
        ...raw,
        sourceIdentityHash: 'historical',
      }),
    ).toThrow()
    const crit = input()
    crit.contributions[0]!.stats.anomalyCritRate = 0.5
    expect(() => calculateSourceQualifiedOrdinaryAnomalySettlement32(crit)).toThrow()
    const future = input()
    future.contributions[0]!.snapshotAtSeconds = 99
    expect(() => calculateSourceQualifiedOrdinaryAnomalySettlement32(future)).toThrow()
  })
  it('rejects mixed actor levels, incomplete shares and unreviewed special instances', () => {
    const level = input()
    level.contributions[1]!.stats.attackerLevel = 59
    expect(() => calculateSourceQualifiedOrdinaryAnomalySettlement32(level)).toThrow(
      'mixed_levels_require_separate_adoption',
    )
    const partial = input()
    partial.contributions[1]!.buildup = 40
    expect(() => calculateSourceQualifiedOrdinaryAnomalySettlement32(partial)).toThrow(
      'incomplete_effective_buildup',
    )
    const special = input()
    special.contributions[0]!.instance = { kind: 'abloom', motionValueMultiplier: 6.35 }
    expect(() => calculateSourceQualifiedOrdinaryAnomalySettlement32(special)).toThrow(
      'not_an_ordinary_anomaly_settlement',
    )
  })
})
