import { describe, expect, it } from 'vitest'
import { evaluateDevelopmentStatWeights } from './developmentStatWeights'
import {
  evaluateDevelopmentValueBenchmarkSide,
  projectDevelopmentValueBenchmarks,
} from './developmentValueBenchmark'
import { statWeightCalibrationFixture } from './developmentStatWeights.calibrationFixture'
import { candidate } from './developmentValueBenchmark.fixtures'
import { projectNormalizedAccountFinalStatsDetailed } from './normalizedAccountFinalStats'
import type { AccountPlanningDraft } from '../accounts/types'

type AnomalyId = 'agent-piper' | 'agent-alice' | 'agent-promeia'
const actors = [
  ['agent-piper', 7.13, 1],
  ['agent-alice', 7.13, 1],
  ['agent-promeia', 5, 6.35],
] as const

/** Legal synthetic S discs through the production account projection. No real
 * account, modified warehouse state or private asset is read by this fixture. */
function fixture(agentId: AnomalyId) {
  const f = statWeightCalibrationFixture('agent-billy')
  const sourceActor = f.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!
  const actor = f.warehouse.roster.agents.find((row) => row.agentId === agentId)!
  Object.assign(actor, {
    ...sourceActor,
    agentId,
    wEngineCopyId: null,
    wEngineDetails: { id: 'wengine-13008', name: null, level: 60, ascension: 5, refinement: 1 },
  })
  const discs = f.discs.map((disc, index) => ({
    ...disc,
    id: `anomaly-${agentId}-baseline-${disc.slot}`,
    setId: [
      'set-freedom-blues',
      'set-freedom-blues',
      'set-hormone-punk',
      'set-hormone-punk',
      'set-puffer-electro',
      'set-puffer-electro',
    ][index]!,
    mainStat:
      disc.slot === 4
        ? ('anomaly_proficiency' as const)
        : disc.slot === 5
          ? agentId === 'agent-promeia'
            ? ('ice_dmg' as const)
            : ('physical_dmg' as const)
          : disc.mainStat,
  }))
  const changed = discs.map((disc) => ({
    ...disc,
    id: `${disc.id}-candidate`,
    subStats:
      disc.slot === 1
        ? disc.subStats.map((row) =>
            row.stat === 'crit_rate'
              ? { stat: 'anomaly_proficiency' as const, value: 9, upgrades: 0 }
              : row,
          )
        : disc.subStats,
  }))
  actor.equippedDiscIds = discs.map((row) => row.id)
  f.warehouse.discs = [...discs, ...changed]
  return { warehouse: f.warehouse, agentId, actor, discs, changed, stale: false }
}

function plan(agentId: AnomalyId, discs: ReturnType<typeof fixture>['discs']) {
  const result = candidate(discs)
  result.agentIds = [agentId]
  result.loadouts[0]!.agentId = agentId
  return result
}

function savedReference(f: ReturnType<typeof fixture>): AccountPlanningDraft {
  return {
    scopedId: `${f.warehouse.accountId}:saved-anomaly`,
    accountId: f.warehouse.accountId!,
    id: 'saved-anomaly',
    kind: 'agent',
    name: '异常准备态方案参数',
    state: 'saved',
    savedRole: 'current_reference',
    selection: { agentIds: [f.agentId], bangbooId: null, scenario: 'normalized' },
    manualOverrides: {
      wEngineDirection: '显式保存参数',
      discDirection: '仓库方案',
      progressionDirection: '',
      notes: '',
    },
    knowledgeRefs: [],
    warehouseRefs: f.discs.map((row) => row.id),
    solutionContext: {
      contract: 'soda-solution-context/v1',
      scope: 'agent_independent',
      resourcePolicy: 'advisory',
      sourceCandidateId: 'saved-anomaly',
      inputFingerprint: 'historical-only',
      solverMethod: 'fixture',
      gameVersion: '3.2',
      knowledgeVersion: 'fixture',
      exactVariantKey: null,
      comparisonParameters: {
        wEngine: { engineId: 'wengine-13008', level: 40, ascension: 3, refinement: 5 },
      },
    },
    comparisonCapability: 'direction',
    createdAt: '2026-10-08T00:00:00Z',
    updatedAt: '2026-10-08T00:00:00Z',
    revision: 1,
  }
}

describe('production anomaly value / marginal / saved-parameter integration', () => {
  it.each(actors)(
    '%s exposes independent AP+9 through actual production weights',
    (agentId, baseMultiplier, instanceMultiplier) => {
      const f = fixture(agentId),
        before = structuredClone(f)
      const baseline = evaluateDevelopmentValueBenchmarkSide(f)
      const probe = evaluateDevelopmentValueBenchmarkSide({
        ...f,
        statProbe: { stat: 'anomaly_proficiency', value: 9 },
      })
      const weights = evaluateDevelopmentStatWeights(f)
      expect(baseline.state, baseline.reasons.join(';')).toBe('supported')
      expect(baseline.coverage?.domain).toBe('prepared_anomaly_settlement')
      expect(baseline.planningDps).toBeNull()
      expect(baseline.dimensions.duration).toBe('not_applicable')
      expect(weights).toMatchObject({ status: 'limited', objective: 'prepared_anomaly_settlement' })
      const panel = projectNormalizedAccountFinalStatsDetailed({
        agent: f.actor,
        engineId: 'wengine-13008',
        discs: f.discs,
      })
      expect(panel.status).toBe('supported')
      if (panel.status !== 'supported') throw new Error(panel.reasons.join(';'))
      const stats = panel.stats.finalStats
      // Independent sourced single-settlement formula, no tested anomaly helper:
      // K60=794, enemy700/res20%, level60=2; source instance ratio=1/1/6.35.
      const attribute = agentId === 'agent-promeia' ? 'ice' : 'physical'
      const damageBonus = stats.damageBonusesByAttribute?.[attribute] ?? stats.damageBonus ?? 0
      const defense = Math.max(0, 700 * (1 - stats.pen_) - (stats.pen ?? 0))
      const perAP =
        ((stats.atk * baseMultiplier * instanceMultiplier * 0.01 * 2 * (1 + damageBonus) * 794) /
          (794 + defense)) *
        0.8
      const ap = weights.rows.find((row) => row.stat === 'anomaly_proficiency')!
      expect(ap.status).toBe('limited')
      expect(ap.damageDelta).toBeCloseTo(perAP * 9, 7)
      expect(ap.relativeGain).toBeCloseTo(9 / stats.anomProf, 10)
      expect(ap.normalizedWeight).toBeGreaterThan(0)
      expect(probe.totalDamage! - baseline.totalDamage!).toBeCloseTo(perAP * 9, 7)
      expect({ ...probe.dimensions, disc_loadout: baseline.dimensions.disc_loadout }).toEqual(
        baseline.dimensions,
      )
      expect(probe.modelQualification32).toBeUndefined()
      for (const row of weights.rows.filter((row) =>
        ['crit_rate', 'crit_dmg', 'def_percent', 'def_flat', 'hp_percent', 'hp_flat'].includes(
          row.stat,
        ),
      )) {
        expect(row).toMatchObject({
          status: 'unsupported',
          damageDelta: null,
          relativeGain: null,
          normalizedWeight: null,
        })
        expect(row.reasons.join(';')).toContain('未覆盖')
      }
      expect(f).toEqual(before)
    },
  )

  it.each(actors)(
    '%s compares real six-disc candidates without claiming overall superiority',
    (agentId) => {
      const f = fixture(agentId),
        before = structuredClone(f)
      const result = projectDevelopmentValueBenchmarks({
        ...f,
        baseline: f.discs,
        candidates: [plan(agentId, f.changed)],
      })[0]!
      expect(result).toMatchObject({
        status: 'supported',
        comparable: true,
        candidateDisposition: 'unresolved',
        verdict: 'candidate_better',
        planningDpsDelta: null,
        planningDpsPercentDelta: null,
        coverage: {
          domain: 'prepared_anomaly_settlement',
          generalConclusion: 'limited',
          exclusionContextChanged: true,
        },
      })
      expect(result.totalDamageDelta).toBeGreaterThan(0)
      expect(result.totalDamagePercentDelta).toBeGreaterThan(0)
      expect(result.baseline.dimensions.w_engine).toBe(result.candidate.dimensions.w_engine)
      expect(result.baseline.coverage?.excludedEffects.length).toBeGreaterThan(0)
      expect(result.candidate.coverage?.excludedEffects.length).toBeGreaterThan(0)
      expect(f).toEqual(before)
    },
  )

  it.each(actors)(
    '%s replays saved explicit engine progression while preserving the recorded account',
    (agentId) => {
      const f = fixture(agentId),
        saved = savedReference(f),
        before = structuredClone({ f, saved })
      const result = projectDevelopmentValueBenchmarks({
        ...f,
        baseline: [],
        savedPlans: [saved],
        candidates: [plan(agentId, f.changed)],
        candidateParametersByRank: { 1: saved.solutionContext!.comparisonParameters! },
      })[0]!
      expect(result).toMatchObject({
        status: 'supported',
        comparable: true,
        planningDpsDelta: null,
        planningDpsPercentDelta: null,
        candidateDisposition: 'unresolved',
        coverage: { generalConclusion: 'limited' },
        comparisonBasis: { baselineSource: { kind: 'saved', referenceId: 'saved-anomaly' } },
      })
      expect(result.baseline.dimensions.w_engine).toContain('p5:lv40:asc3')
      expect(result.candidate.dimensions.w_engine).toBe(result.baseline.dimensions.w_engine)
      expect(result.comparisonBasis.baselineLabel).toContain('保存的显式方案参数')
      expect(result.totalDamagePercentDelta).toBeGreaterThan(0)
      expect({ f, saved }).toEqual(before)
      expect(f.actor.wEngineDetails.refinement).toBe(1)
      expect(f.actor.wEngineDetails.level).toBe(60)
    },
  )

  it('rejects missing or stale production inputs and does not promote unsupported core1', () => {
    const f = fixture('agent-promeia')
    f.actor.skillLevels.core = 1
    const unknownCore = evaluateDevelopmentStatWeights(f)
    expect(unknownCore.status).toBe('unsupported')
    expect(
      unknownCore.rows.every((row) => row.damageDelta === null && row.normalizedWeight === null),
    ).toBe(true)
    const stale = evaluateDevelopmentStatWeights({ ...fixture('agent-piper'), stale: true })
    expect(stale.status).toBe('stale')
    expect(stale.rows.every((row) => row.relativeGain === null)).toBe(true)
    const missing = fixture('agent-alice')
    missing.actor.wEngineDetails = { id: null, name: null, level: null, refinement: null }
    expect(evaluateDevelopmentStatWeights(missing).status).toBe('unsupported')
  })
})
