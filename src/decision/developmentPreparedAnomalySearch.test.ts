import { describe, expect, it } from 'vitest'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { dynamicLegalInventory } from '../optimizer/teamDynamicDomain'
import { compileAgentBuildIntent } from './buildIntent'
import { projectDevelopmentCandidateAlternatives } from './developmentCandidateAlternatives'
import { searchDevelopmentDynamicCandidates } from './developmentDynamicSearch'
import { projectNormalizedAccountFinalStatsDetailed } from './normalizedAccountFinalStats'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import {
  evaluateDevelopmentValueBenchmarkSide,
  projectDevelopmentValueBenchmarks,
} from './developmentValueBenchmark'
import { candidate } from './developmentValueBenchmark.fixtures'

/** Synthetic game-legal S15 inventory, never a real account or saved draft. */
function fixture(slotSix: 'anomaly_mastery' | 'energy_regen' = 'anomaly_mastery') {
  const value = statWeightCalibrationFixture('agent-billy')
  const sourceActor = value.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!
  const actor = value.warehouse.roster.agents.find((row) => row.agentId === 'agent-piper')!
  Object.assign(actor, {
    ...structuredClone(sourceActor),
    agentId: 'agent-piper',
    wEngineCopyId: null,
    wEngineDetails: { id: 'wengine-13008', name: null, level: 60, ascension: 5, refinement: 1 },
  })
  const discs: DriveDisc[] = value.discs.map((disc) => ({
    ...disc,
    id: `prepared-piper-${disc.slot}`,
    setId: disc.slot <= 4 ? 'set-fanged-metal' : 'set-freedom-blues',
    mainStat:
      disc.slot === 4
        ? 'anomaly_proficiency'
        : disc.slot === 5
          ? 'atk_percent'
          : disc.slot === 6
            ? slotSix
            : disc.mainStat,
    // Exactly five upgrade rolls; no main/substat identity conflict.
    subStats: [
      { stat: 'crit_rate', value: 2.4, upgrades: 0 },
      { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
      disc.slot === 4
        ? { stat: 'atk_percent', value: 3, upgrades: 0 }
        : { stat: 'anomaly_proficiency', value: 9, upgrades: 0 },
      { stat: 'pen', value: 54, upgrades: 5 },
    ],
  }))
  const attack = discs.find((disc) => disc.slot === 5)!
  const physical = {
    ...structuredClone(attack),
    id: 'prepared-five-physical',
    mainStat: 'physical_dmg' as const,
  }
  const fire = {
    ...structuredClone(attack),
    id: 'prepared-five-fire',
    mainStat: 'fire_dmg' as const,
  }
  actor.equippedDiscIds = discs.map((disc) => disc.id)
  value.warehouse.discs = [...discs, physical, fire]
  return {
    warehouse: value.warehouse,
    agentId: 'agent-piper',
    actor,
    discs,
    attack,
    physical,
    fire,
  }
}

type Fixture = ReturnType<typeof fixture>
const replace = (discs: DriveDisc[], replacement: DriveDisc) =>
  discs.map((disc) => (disc.slot === replacement.slot ? replacement : disc))
const records = (plan: CandidateWarehousePlan) => plan.loadouts[0]!.discs.map((row) => row.disc)
function plan(discs: DriveDisc[]) {
  const result = candidate(discs)
  result.agentIds = ['agent-piper']
  result.loadouts[0]!.agentId = 'agent-piper'
  return result
}
const project = (f: Fixture) =>
  projectDevelopmentCandidateAlternatives(
    { warehouse: f.warehouse, developmentPriorityAgentIds: [] },
    f.agentId,
  )
const side = (f: Fixture, discs: DriveDisc[]) =>
  evaluateDevelopmentValueBenchmarkSide({ ...f, discs, stale: false })

/** Independent sourced Assault settlement: K60=794, multiplier7.13, level60=2,
 * DEF700 / RES20%; neither tested anomaly evaluator nor ranking score is used. */
function independentSettlement(f: Fixture, discs: DriveDisc[]) {
  const panel = projectNormalizedAccountFinalStatsDetailed({
    agent: f.actor,
    engineId: 'wengine-13008',
    discs,
  })
  expect(panel.status).toBe('supported')
  if (panel.status !== 'supported') throw new Error(panel.reasons.join(';'))
  const stats = panel.stats.finalStats
  const defense = Math.max(0, 700 * (1 - stats.pen_) - (stats.pen ?? 0))
  const physicalBonus = stats.damageBonusesByAttribute?.physical ?? stats.damageBonus ?? 0
  return (
    ((stats.atk * 7.13 * (stats.anomProf / 100) * 2 * (1 + physicalBonus) * 794) /
      (794 + defense)) *
    0.8
  )
}

describe('prepared anomaly ranking through actual development candidates', () => {
  it('reports an exhausted observation budget without inventing an exact or global optimum', () => {
    const f = fixture()
    const source = plan(f.discs)
    const result = searchDevelopmentDynamicCandidates({
      ...f,
      buildIntent: compileAgentBuildIntent({ agentId: f.agentId }),
      candidates: [source],
      evaluationBudget: 1,
    })
    expect(result.candidates).toEqual([source])
    expect('preparedAnomalySearch' in result && result.preparedAnomalySearch).toMatchObject({
      status: 'budget_exhausted',
      evaluations: 1,
      exactWithinDeclaredModel: false,
    })
  })
  it('ranks the independently stronger physical fifth disc ahead of attack, retaining limited coverage and zero writes', () => {
    const f = fixture()
    const before = JSON.stringify(f.warehouse)
    expect(dynamicLegalInventory(f.warehouse.discs)).toHaveLength(f.warehouse.discs.length)
    const attackValue = independentSettlement(f, f.discs)
    const physicalValue = independentSettlement(f, replace(f.discs, f.physical))
    expect(physicalValue).toBeGreaterThan(attackValue)
    const result = project(f)
    expect(result.status).toBe('ready')
    expect(result.candidateSearch).toMatchObject({
      rankingMethod: 'prepared_anomaly_settlement',
      exactWithinDeclaredModel: false,
      productionGameAccuracyCertified: false,
    })
    const fifthIds = result.candidates.map(
      (value) => records(value).find((disc) => disc.slot === 5)!.id,
    )
    expect(fifthIds).toContain(f.attack.id)
    expect(fifthIds).toContain(f.physical.id)
    expect(fifthIds.indexOf(f.physical.id)).toBeLessThan(fifthIds.indexOf(f.attack.id))
    const comparisons = projectDevelopmentValueBenchmarks({
      ...f,
      baseline: f.discs,
      candidates: result.candidates,
      stale: false,
    })
    const physical = comparisons[fifthIds.indexOf(f.physical.id)]!
    expect(physical).toMatchObject({
      status: 'supported',
      comparable: true,
      candidateDisposition: 'unresolved',
      planningDpsDelta: null,
      planningDpsPercentDelta: null,
      coverage: { domain: 'prepared_anomaly_settlement', generalConclusion: 'limited' },
    })
    expect(physical.totalDamageDelta).toBeCloseTo(physicalValue - attackValue, 7)
    expect(physical.totalDamagePercentDelta).toBeCloseTo((physicalValue / attackValue - 1) * 100, 7)
    for (const value of result.candidates) {
      const settlement = side(f, records(value))
      expect(settlement.totalDamage).toBeCloseTo(independentSettlement(f, records(value)), 7)
      expect(settlement.planningDps).toBeNull()
      expect(settlement.coverage?.domain).toBe('prepared_anomaly_settlement')
      expect(settlement.dimensions.duration).toBe('not_applicable')
    }
    expect(JSON.stringify(f.warehouse)).toBe(before)
  })

  it('includes the matching attribute bonus without granting fire bonus to physical Assault', () => {
    const f = fixture()
    const physical = replace(f.discs, f.physical),
      fire = replace(f.discs, f.fire)
    const physicalValue = side(f, physical),
      fireValue = side(f, fire)
    expect(physicalValue.totalDamage).toBeCloseTo(independentSettlement(f, physical), 7)
    expect(fireValue.totalDamage).toBeCloseTo(independentSettlement(f, fire), 7)
    expect(physicalValue.totalDamage!).toBeGreaterThan(fireValue.totalDamage!)
    // Explicit source alternatives keep all three slots. Raw proposals only
    // replace existing comparable slots; their count is deliberately bounded.
    const result = searchDevelopmentDynamicCandidates({
      ...f,
      buildIntent: compileAgentBuildIntent({ agentId: f.agentId }),
      candidates: [plan(f.discs), plan(fire), plan(physical)],
    })
    const fifthIds = result.candidates.map(
      (value) => records(value).find((disc) => disc.slot === 5)!.id,
    )
    expect(fifthIds).toContain(f.fire.id)
    expect(fifthIds.indexOf(f.physical.id)).toBeLessThan(fifthIds.indexOf(f.fire.id))
  })

  it.each(['fixed', 'excluded'] as const)(
    'respects %s inventory constraints during raw fifth-disc exploration',
    (constraint) => {
      const f = fixture(),
        before = JSON.stringify(f.warehouse)
      const buildIntent = compileAgentBuildIntent({
        agentId: f.agentId,
        optimizerOptions:
          constraint === 'fixed'
            ? { fixedDiscByAgent: { [f.agentId]: f.attack.id } }
            : { excludedDiscIds: [f.physical.id] },
      })
      const result = searchDevelopmentDynamicCandidates({
        ...f,
        buildIntent,
        candidates: [plan(f.discs)],
      })
      expect(result.candidates.length).toBeGreaterThan(0)
      for (const value of result.candidates) {
        const ids = records(value).map((disc) => disc.id)
        expect(ids).not.toContain(f.physical.id)
        if (constraint === 'fixed') expect(ids).toContain(f.attack.id)
      }
      expect(JSON.stringify(f.warehouse)).toBe(before)
    },
  )

  it.each(['anomaly_mastery', 'energy_regen', 'anomaly_proficiency'] as const)(
    'does not propose a higher single settlement by sacrificing %s',
    (protectedStat) => {
      const f = fixture(protectedStat === 'energy_regen' ? 'energy_regen' : 'anomaly_mastery')
      const original =
        protectedStat === 'anomaly_proficiency'
          ? f.physical
          : f.discs.find((disc) => disc.slot === 6)!
      const replacement: DriveDisc = {
        ...structuredClone(original),
        id: `sacrificed-${protectedStat}`,
        mainStat: protectedStat === 'anomaly_proficiency' ? 'physical_dmg' : 'atk_percent',
      }
      // For AP, retain physical's benefit but remove the nine AP on the attack disc.
      if (protectedStat === 'anomaly_proficiency')
        replacement.subStats = replacement.subStats.map((row) =>
          row.stat === 'anomaly_proficiency'
            ? { stat: 'hp_percent' as const, value: 3, upgrades: 0 }
            : row,
        )
      f.warehouse.discs = [...f.discs, replacement]
      const before = JSON.stringify(f.warehouse)
      expect(dynamicLegalInventory(f.warehouse.discs)).toHaveLength(7)
      const changed = replace(f.discs, replacement),
        baseline = side(f, f.discs),
        tempting = side(f, changed)
      expect(tempting.totalDamage!).toBeGreaterThan(baseline.totalDamage!)
      const field = {
        anomaly_mastery: 'anomMas',
        energy_regen: 'enerRegen',
        anomaly_proficiency: 'anomProf',
      }[protectedStat] as 'anomMas' | 'enerRegen' | 'anomProf'
      expect(tempting.functionalStats32![field]).toBeLessThan(baseline.functionalStats32![field])
      const originalPlan = plan(f.discs)
      const result = searchDevelopmentDynamicCandidates({
        ...f,
        buildIntent: compileAgentBuildIntent({ agentId: f.agentId }),
        candidates: [originalPlan],
      })
      expect(result.candidates).toEqual([originalPlan])
      expect(JSON.stringify(f.warehouse)).toBe(before)
    },
  )

  it.each(['unknown_engine', 'unsupported_stun'] as const)(
    'preserves original order and null values for %s',
    (condition) => {
      const f = fixture()
      if (condition === 'unknown_engine') f.actor.wEngineDetails.id = null
      const scenarioSelection =
        condition === 'unsupported_stun'
          ? { schemaVersion: 1 as const, id: 'declared-stun-comparison' as const }
          : undefined
      const before = JSON.stringify(f.warehouse)
      const source = [plan(f.discs), plan(replace(f.discs, f.physical))]
      for (const value of source) {
        const settlement = evaluateDevelopmentValueBenchmarkSide({
          ...f,
          discs: records(value),
          stale: false,
          scenarioSelection,
        })
        expect(settlement.state).toBe('unsupported')
        expect(settlement.totalDamage).toBeNull()
        expect(settlement.planningDps).toBeNull()
      }
      const result = searchDevelopmentDynamicCandidates({
        ...f,
        scenarioSelection,
        buildIntent: compileAgentBuildIntent({ agentId: f.agentId }),
        candidates: source,
      })
      expect(result.rankingApplied).toBe(false)
      expect(result.candidates).toEqual(source)
      const actual = projectDevelopmentCandidateAlternatives(
        { warehouse: f.warehouse, developmentPriorityAgentIds: [] },
        f.agentId,
        undefined,
        scenarioSelection,
      )
      expect(actual.candidateSearch?.rankingMethod).toBe('source_and_local_refinement')
      expect(JSON.stringify(f.warehouse)).toBe(before)
    },
  )
})
