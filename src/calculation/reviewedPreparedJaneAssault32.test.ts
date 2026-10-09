import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectDomain'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import {
  evaluateReviewedPreparedAnomalyObjective32,
  reviewedPreparedAnomalyPreparation32,
  type PreparedAnomalyPreparation32,
} from './reviewedPreparedAnomalyObjective32'
import { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from '../decision/developmentPreparedAnomalyBenchmark32'
import { evaluateDevelopmentValueBenchmarkSide } from '../decision/developmentValueBenchmarkRuntime'
import { compareValueBenchmarkSides } from './valueBenchmarkComparison'
import { labels } from './valueBenchmarkTestFixtures'
import { legalTeamDisc } from '../decision/teamDynamicIntegration.testFixture'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'

const baseline = {
  ...currentNormalizedPlanningBaseline,
  enemy: {
    id: 'jane-literal-target',
    defense: 0,
    resistance: 0,
    stunMultiplier: 1,
    vulnerability: 0,
  },
}
const declared = () =>
  reviewedPreparedAnomalyPreparation32('agent-jane')! as Extract<
    PreparedAnomalyPreparation32,
    { kind: 'jane_single_assault' }
  >
function member() {
  const row = createLevel60NeutralEffectRuntimeMember('agent-jane')
  row.coreLevel = 7
  row.finalStats = {
    ...row.finalStats,
    atk: 3000,
    anomProf: 300,
    anomMas: 200,
    damageBonus: 0,
    pen_: 0,
  }
  row.initialStats = { ...row.finalStats, atk: 2000 }
  return row
}
function evaluate(row = member(), preparation = declared(), defense = 0) {
  const result = evaluateReviewedPreparedAnomalyObjective32({
    member: row,
    baseline: { ...baseline, enemy: { ...baseline.enemy, defense } },
    preparation,
  })
  expect(result.status, result.status === 'unsupported' ? result.blockers.join(';') : '').toBe(
    'supported',
  )
  if (result.status !== 'supported' || !('snapshot' in result))
    throw new Error('missing Jane snapshot')
  return result
}

describe('reviewed Jane once self-Assault preparation', () => {
  it('locks Jane formula and declares Passion/Gnawed without inferring either from discs', () => {
    const result = evaluate()
    expect(result.totalDamage).toBeCloseTo(3360 * 7.13 * 3 * 2 * (1 + 0.88 * 0.5), 7)
    expect(result.snapshot.attack).toBe(3360)
    expect(result.snapshot.anomalyCritRate).toBeCloseTo(0.88, 12)
    expect(result.snapshot.anomalyCritDamage).toBe(0.5)
    expect(result.sourceRefs).toContainEqual(
      expect.stringContaining('95F6A36CB88F44EA406EF193DE3D0CF295498F693561D717A3B270D34D5F55E8'),
    )
    expect(result.identity.preparation).toEqual(declared())
    expect(result.planningDps).toBeNull()
    expect(result.modeledDirectDamage).toBeNull()
    expect(result.formalCycleReady).toBe(false)
    expect(result.identity.frequency).toBeNull()
  })

  it.each([
    [1, 0.2, 0.001],
    [2, 0.25, 0.0011],
    [3, 0.28, 0.0012],
    [4, 0.31, 0.0013],
    [5, 0.34, 0.0014],
    [6, 0.37, 0.0015],
    [7, 0.4, 0.0016],
  ])('uses actual core%s, literal sourced rate %s + AP * %s', (coreLevel, baseCR, step) => {
    const row = member()
    row.coreLevel = coreLevel
    expect(evaluate(row).totalDamage).toBeCloseTo(
      3360 * 7.13 * 3 * 2 * (1 + (baseCR + 300 * step) * 0.5),
      7,
    )
  })

  it.each([0, 1, 2, 3, 4, 5, 6])(
    'binds M%s without leaking M6 ordinary crit or notOwnBuff',
    (mindscape) => {
      const row = member()
      row.mindscape = mindscape
      const result = evaluate(row, declared(), 600)
      // Source: M1 Passion common +min(.3,300*.001); M2 own ignore .15,
      // Assault CD +.5. No M3/M5/M6 modifier for this one physical Assault.
      const damage = mindscape >= 1 ? 1.3 : 1
      const cd = mindscape >= 2 ? 1 : 0.5
      const defense = 794 / (794 + 600 * (mindscape >= 2 ? 0.85 : 1))
      expect(result.totalDamage).toBeCloseTo(
        3360 * 7.13 * 3 * 2 * damage * (1 + 0.88 * cd) * defense,
        7,
      )
      expect(result.snapshot.defenseIgnore).toBe(mindscape >= 2 ? 0.15 : 0)
      expect(result.snapshot.buffBonus).toBe(0)
      expect(result.excluded.map((x) => x.effectKey)).toContain('agent-jane:m2_assault_defIgn_')
    },
  )

  it('prior M4 buff needs a separate declaration; this event cannot activate it retroactively', () => {
    const row = member()
    row.mindscape = 4
    const inactive = evaluate(row),
      active = evaluate(row, { ...declared(), priorAssaultOrDisorderBuffActive: true })
    expect(active.totalDamage).toBeCloseTo(3360 * 7.13 * 3 * 2 * 1.3 * 1.88 * 1.18, 7)
    expect(active.totalDamage! / inactive.totalDamage!).toBeCloseTo(1.18, 12)
    expect(active.contextHash).not.toBe(inactive.contextHash)
  })

  it.each([
    [0, 0],
    [1, 0],
    [2, 0.1],
    [3, 0.15],
    [4, 0.2],
    [5, 0.25],
    [6, 0.3],
  ])('potential%s adds independently sourced Assault CD %s', (potential, cd) => {
    const row = member()
    row.potential = potential
    const result = evaluate(row)
    expect(result.snapshot.anomalyCritDamage).toBeCloseTo(0.5 + cd, 12)
    expect(result.totalDamage).toBeCloseTo(3360 * 7.13 * 3 * 2 * (1 + 0.88 * (0.5 + cd)), 7)
    expect(result.included).toContain('agent-jane:potential_assault_crit_damage')
  })

  it('ordinary CR/CD and AM cannot become anomaly crit or repeat frequency', () => {
    const row = member(),
      changed = member()
    changed.finalStats.crit_ = 0.95
    changed.finalStats.crit_dmg_ = 3
    changed.finalStats.anomMas = 500
    expect(evaluate(changed).totalDamage).toBe(evaluate(row).totalDamage)
  })

  it('explicitly absent Gnawed removes independent crit, including potential; Passion can be absent too', () => {
    const row = member()
    row.potential = 6
    expect(evaluate(row, { ...declared(), gnawed: false }).totalDamage).toBeCloseTo(
      3360 * 7.13 * 3 * 2,
      7,
    )
    expect(evaluate(row, { ...declared(), gnawed: false, passion: false }).totalDamage).toBeCloseTo(
      3000 * 7.13 * 3 * 2,
      7,
    )
  })

  it('AP threshold/cap and CR clamp follow literal formulas, never panel ordinary crit', () => {
    const below = member(),
      cap = member()
    below.finalStats.anomProf = 100
    cap.finalStats.anomProf = 600
    expect(evaluate(below).totalDamage).toBeCloseTo(3000 * 7.13 * 1 * 2 * (1 + 0.56 * 0.5), 7)
    expect(evaluate(cap).totalDamage).toBeCloseTo(3600 * 7.13 * 6 * 2 * 1.5, 7)
  })

  it('equipment/formation AP enters both Passion conversion and independent CR before settlement', () => {
    const ap: SourceBackedPlanningEffectBucket = {
      bucketId: 'declared-AP',
      effectKey: 'fixture:declared-AP',
      providerAgentId: 'agent-jane',
      recipientAgentIds: ['agent-jane'],
      receiverPath: 'ownBuff.combat.anomProf',
      value: 60,
      damageType: null,
      action: null,
      attribute: null,
      application: 'outside_direct_event_formula',
      sourceRefs: ['literal-prepared-formation-AP'],
    }
    const result = evaluateReviewedPreparedAnomalyObjective32({
      member: member(),
      baseline,
      effectBuckets: [ap],
    })
    expect(result.status).toBe('supported')
    expect(result.totalDamage).toBeCloseTo(3480 * 7.13 * 3.6 * 2 * (1 + 0.976 * 0.5), 7)
  })

  it.each(['passion', 'gnawed', 'priorAssaultOrDisorderBuffActive'] as const)(
    'unknown %s is a real null gap',
    (key) => {
      const preparation = declared()
      delete (preparation as Partial<typeof preparation>)[key]
      const result = evaluateReviewedPreparedAnomalyObjective32({
        member: member(),
        baseline,
        preparation,
      })
      expect(result).toMatchObject({
        status: 'unsupported',
        totalDamage: null,
        planningDps: null,
        blockers: ['jane_prepared_state_unresolved'],
      })
    },
  )

  it.each([0, 8, 1.5])(
    'rejects unresolved/out-of-domain core%s without borrowing core7',
    (coreLevel) => {
      const row = member()
      row.coreLevel = coreLevel
      expect(evaluateReviewedPreparedAnomalyObjective32({ member: row, baseline })).toMatchObject({
        status: 'unsupported',
        totalDamage: null,
        blockers: ['prepared_anomaly_actor_domain_invalid'],
      })
    },
  )

  it('existing comparison reports the sourced AP slice as limited with null DPS and preserved omissions', () => {
    const make = (ap: number) => {
      const row = member()
      row.finalStats.anomProf = ap
      return evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
        member: row,
        baseline,
        discs: [],
        wEngine: { engineId: 'wengine-13008', refinement: 1 },
        engineKey: 'neutral',
        discLoadoutKey: `AP${ap}`,
        subjectKey: 'same-real-Jane',
        potential: 0,
      })
    }
    const result = compareValueBenchmarkSides({
      baseline: make(300),
      candidate: make(330),
      changedDimensions: ['disc_loadout'],
      labels,
    })
    expect(result).toMatchObject({
      status: 'supported',
      comparable: true,
      verdict: 'candidate_better',
      candidateDisposition: 'unresolved',
      planningDpsDelta: null,
      coverage: {
        domain: 'prepared_anomaly_settlement',
        generalConclusion: 'limited',
        exclusionContextChanged: true,
      },
    })
    // CR at AP330 = .4+.528=.928; Passion ATK3420. No production function produces this expected delta.
    expect(result.totalDamageDelta).toBeCloseTo(
      3420 * 7.13 * 3.3 * 2 * 1.464 - 3360 * 7.13 * 3 * 2 * 1.44,
      7,
    )
  })

  it('actual recorded Jane automatically routes through production development comparison without writes', () => {
    const roster = createEmptyRoster('2026-10-08T00:00:00Z')
    const discs = Array.from({ length: 6 }, (_, index) => legalTeamDisc(index))
    roster.agents = roster.agents.map((row) =>
      row.agentId === 'agent-jane'
        ? {
            ...row,
            owned: true,
            level: 60,
            ascension: 5,
            mindscape: 2,
            potentialImage: 3,
            skillLevels: { ...row.skillLevels, core: 7 },
            equippedDiscIds: discs.map((x) => x.id),
            wEngineDetails: {
              id: 'wengine-13008',
              name: null,
              level: 60,
              ascension: 5,
              refinement: 1,
            },
          }
        : row,
    )
    const warehouse = { accountId: 'isolated-jane-prepared', account: null, roster, discs }
    const before = JSON.stringify(warehouse)
    const result = evaluateDevelopmentValueBenchmarkSide({
      warehouse,
      agentId: 'agent-jane',
      discs,
      stale: false,
    })
    expect(result.state, result.reasons.join(';')).toBe('supported')
    expect(result.dimensions.event_set).toBe('jane_single_assault')
    expect(result.coverage?.domain).toBe('prepared_anomaly_settlement')
    expect(result.coverage?.includedEffectKeys).toContain('agent-jane:passion_atk')
    expect(result.planningDps).toBeNull()
    expect(result.totalDamage).toBeGreaterThan(0)
    expect(JSON.stringify(warehouse)).toBe(before)
  })
})
