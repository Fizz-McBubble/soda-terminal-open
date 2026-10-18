import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { candidatePriorityEvidence } from '../gameDataPacks/candidatePriorityEvidence'
import {
  candidatePriorityToken,
  candidateSubStatWeights,
} from '../gameDataPacks/candidateStatParsing'
import { parseCandidateSubstatPriority } from '../gameDataPacks/candidateSubstatPriority'
import { solveCandidateWarehouse } from '../optimizer/candidateWarehouseSolver'
import { compareCandidatePanelObjective } from '../optimizer/candidatePanelObjective'
import {
  compareCandidatePanelPriority,
  type SearchPanelObjective,
} from '../optimizer/candidateSearchFacts'
import { compileAgentBuildIntent, optimizerOptionsFromBuildIntent } from './buildIntent'
import { refineDevelopmentCandidates } from './developmentCandidateRefinement'
import { evaluateDevelopmentValueBenchmarkSide } from './developmentValueBenchmark'
import { compareValueBenchmarkSides } from '../calculation/valueBenchmarkComparison'
import {
  absoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from '../warehouse/absoluteDiscRetentionCatalog'
import { history } from '../warehouse/absoluteDiscRetentionScoring'
import { buildIntentFingerprintMatches } from '../application/publicBuildIntentFingerprint'
import { contentHash } from '../application/contentHash'

function claretFixture() {
  const roster = createEmptyRoster('2026-10-04T00:00:00.000Z')
  const agent = roster.agents.find((row) => row.agentId === 'agent-claret')!
  Object.assign(agent, {
    owned: true,
    level: 60,
    ascension: 5,
    mindscape: 0,
    potentialImage: 0,
    skillLevels: {
      basic: 12,
      dodge: 12,
      assist: 12,
      special: 12,
      chain: 12,
      core: 7,
    },
    wEngineDetails: { id: 'wengine-14161', name: null, level: 60, ascension: 5, refinement: 1 },
  })
  const baseline: DriveDisc[] = ([1, 2, 3, 4, 5, 6] as const).map((slot) => ({
    id: `base-${slot}`,
    slot,
    setId: slot <= 4 ? 'set-34200' : 'set-soul-rock',
    rarity: 'S',
    level: 15,
    mainStat: (
      {
        1: 'hp_flat',
        2: 'atk_flat',
        3: 'def_flat',
        4: 'crit_rate',
        5: 'electric_dmg',
        6: 'def_percent',
      } as const
    )[slot],
    subStats:
      slot === 4
        ? [
            { stat: 'crit_dmg', value: 28.8, upgrades: 5 },
            { stat: 'pen', value: 9, upgrades: 0 },
            { stat: 'def_percent', value: 4.8, upgrades: 0 },
            { stat: 'hp_percent', value: 3, upgrades: 0 },
          ]
        : slot === 6
          ? [
              { stat: 'crit_dmg', value: 28.8, upgrades: 5 },
              { stat: 'pen', value: 9, upgrades: 0 },
              { stat: 'crit_rate', value: 2.4, upgrades: 0 },
              { stat: 'hp_percent', value: 3, upgrades: 0 },
            ]
          : [
              { stat: 'pen', value: 54, upgrades: 5 },
              { stat: 'crit_rate', value: 2.4, upgrades: 0 },
              { stat: 'def_percent', value: 4.8, upgrades: 0 },
              { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
            ],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    dataVersion: '3.2',
  }))
  const stronger: DriveDisc = {
    ...baseline[0]!,
    id: 'later-id-crit',
    subStats: [
      { stat: 'pen', value: 9, upgrades: 0 },
      { stat: 'crit_rate', value: 14.4, upgrades: 5 },
      { stat: 'def_percent', value: 4.8, upgrades: 0 },
      { stat: 'crit_dmg', value: 4.8, upgrades: 0 },
    ],
  }
  const warehouse: CoreWarehouse = {
    accountId: 'synthetic-algorithm-quality',
    account: null,
    roster,
    discs: [...baseline, stronger],
  }
  const buildIntent = compileAgentBuildIntent({
    agentId: agent.agentId,
    developmentPriorityAgentIds: [agent.agentId],
  })
  const original = solveCandidateWarehouse(
    baseline,
    [agent.agentId],
    'agent',
    optimizerOptionsFromBuildIntent(buildIntent),
    buildIntent.recommendations,
  )
  return { warehouse, baseline, stronger, buildIntent, original, agent }
}

describe('algorithm quality through actual source adapters and calculation modules', () => {
  it('retains current sourced Claret order without changing useful-stat weights', () => {
    const constraint = getCandidateWarehouseConstraint('agent-claret')!
    const before = JSON.stringify(constraint)
    expect(candidatePriorityEvidence(constraint)).toMatchObject({
      kind: 'ordered',
      tiers: [['crit_rate'], ['def_percent'], ['crit_dmg'], ['pen'], ['def_flat']],
    })
    expect(Object.values(constraint.subStatWeights)).toEqual([1, 1, 1, 1, 1])
    expect(JSON.stringify(constraint)).toBe(before)
  })
  it('retains mixed equality and conditional source text with the real token adapter', () => {
    const raw = '暴击率 = 暴击伤害 > 攻击力% > 穿透值 = 固定攻击力'
    expect(parseCandidateSubstatPriority([raw], candidatePriorityToken).tiers).toEqual([
      ['crit_rate', 'crit_dmg'],
      ['atk_percent'],
      ['pen', 'atk_flat'],
    ])
    expect(
      parseCandidateSubstatPriority(['暴击率（达到目标前） > 暴击伤害'], candidatePriorityToken)
        .kind,
    ).toBe('conditional')
    expect(candidateSubStatWeights(raw)).toEqual({
      crit_rate: 1,
      crit_dmg: 1,
      atk_percent: 1,
      pen: 1,
      atk_flat: 1,
    })
  })
  it('rejects changed source pins instead of silently reusing canonical ordered guidance', () => {
    const constraint = structuredClone(getCandidateWarehouseConstraint('agent-claret')!)
    constraint.sources = constraint.sources.map((source) => ({ ...source, contentHash: 'changed' }))
    constraint.teamAndBangbooPreconditions = []
    expect(candidatePriorityEvidence(constraint).kind).toBe('unordered')
  })
  it('uses the covered fixed-event objective after the solo ability is proven inactive', () => {
    const f = claretFixture()
    for (const disc of f.warehouse.discs)
      expect(() =>
        history(toAbsoluteRetentionDisc(disc), absoluteDiscRetentionCatalog.rules),
      ).not.toThrow()
    expect(f.original.loadouts[0]?.discs).toHaveLength(6)
    const side = (discs: DriveDisc[]) =>
      evaluateDevelopmentValueBenchmarkSide({
        warehouse: f.warehouse,
        agentId: f.agent.agentId,
        discs,
        stale: false,
      })
    const next = f.baseline.map((disc) => (disc.slot === 1 ? f.stronger : disc))
    const comparison = compareValueBenchmarkSides({
      baseline: side(f.baseline),
      candidate: side(next),
      changedDimensions: ['disc_loadout'],
      labels: { baseline: 'before', candidate: 'after' },
    })
    expect(comparison.comparable, JSON.stringify(comparison.reasons)).toBe(true)
    // Solo Claret cannot activate the team-gated ability. Its absence is a sourced
    // inactive state, not an unobserved effect. This is only the declared event model.
    expect(comparison.coverage.generalConclusion).toBe('supported')
    expect(comparison.totalDamageDelta).toBeGreaterThan(0)
    const before = JSON.stringify(f.warehouse)
    const result = refineDevelopmentCandidates({
      warehouse: f.warehouse,
      agentId: f.agent.agentId,
      candidates: [f.original],
      buildIntent: f.buildIntent,
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).toContain(f.stronger.id)
    expect(result[0]!.totalScore).toBe(f.original.totalScore)
    expect(result[0]!.boundary).not.toContain('来源词条层级')
    const after = compareValueBenchmarkSides({
      baseline: side(f.baseline),
      candidate: side(result[0]!.loadouts[0]!.discs.map((row) => row.disc)),
      changedDimensions: ['disc_loadout'],
      labels: { baseline: 'before', candidate: 'after' },
    })
    expect(after.coverage.generalConclusion).toBe('supported')
    expect(JSON.stringify(f.warehouse)).toBe(before)
  })
  it('keeps unsupported numerical goals unchanged and cannot introduce invalid history', () => {
    const f = claretFixture()
    f.agent.wEngineDetails = { id: null, name: null, level: null, refinement: null }
    f.warehouse.discs.push({
      ...f.stronger,
      id: 'invalid',
      subStats: [{ stat: 'crit_rate', value: 9999, upgrades: 5 }],
    })
    expect(
      refineDevelopmentCandidates({
        warehouse: f.warehouse,
        agentId: f.agent.agentId,
        candidates: [f.original],
        buildIntent: f.buildIntent,
      }),
    ).toEqual([f.original])
  })
  it('promotes an already-listed covered-model alternative without duplicating it', () => {
    const f = claretFixture()
    const stronger = solveCandidateWarehouse(
      f.baseline.map((disc) => (disc.slot === 1 ? f.stronger : disc)),
      [f.agent.agentId],
      'agent',
      optimizerOptionsFromBuildIntent(f.buildIntent),
      f.buildIntent.recommendations,
    )
    const alreadyMarked = refineDevelopmentCandidates({
      warehouse: f.warehouse,
      agentId: f.agent.agentId,
      candidates: [f.original],
      buildIntent: f.buildIntent,
    })[0]!
    stronger.boundary = alreadyMarked.boundary
    const result = refineDevelopmentCandidates({
      warehouse: f.warehouse,
      agentId: f.agent.agentId,
      candidates: [f.original, stronger],
      buildIntent: f.buildIntent,
    })
    const ids = result.map((plan) => plan.loadouts[0]!.discs.map((row) => row.disc.id))
    expect(ids[0]).toContain(f.stronger.id)
    expect(ids[1]).toContain(f.baseline[0]!.id)
    expect(new Set(ids.map((row) => JSON.stringify(row))).size).toBe(2)
    expect(result[0]!.boundary).not.toContain('来源词条层级')
  })
  it('prefers fewer physical swaps when the fully covered objective is identical', () => {
    const f = claretFixture()
    const duplicate = { ...f.baseline[0]!, id: 'same-facts-other-disc' }
    f.warehouse.discs = [...f.baseline, duplicate]
    f.agent.equippedDiscIds = f.baseline.map((disc) => disc.id)
    const replacement = solveCandidateWarehouse(
      f.baseline.map((disc) => (disc.slot === 1 ? duplicate : disc)),
      [f.agent.agentId],
      'agent',
      optimizerOptionsFromBuildIntent(f.buildIntent),
      f.buildIntent.recommendations,
    )
    const before = JSON.stringify(f.warehouse)
    const result = refineDevelopmentCandidates({
      ...f,
      agentId: f.agent.agentId,
      candidates: [replacement, f.original],
    })
    expect(result[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).toContain('base-1')
    expect(result[1]!.loadouts[0]!.discs.map((row) => row.disc.id)).toContain(duplicate.id)
    expect(JSON.stringify(f.warehouse)).toBe(before)
  })
  it.each(['missing', 'duplicate', 'unknown', 'invalid-history'] as const)(
    'keeps equal-objective source order if equipped baseline is %s',
    (state) => {
      const f = claretFixture()
      const duplicate = { ...f.baseline[0]!, id: 'same-facts-other-disc' }
      f.warehouse.discs = [...f.baseline, duplicate]
      const equipped = f.baseline.map((disc) => disc.id)
      f.agent.equippedDiscIds =
        state === 'missing'
          ? equipped.slice(1)
          : state === 'duplicate'
            ? [...equipped.slice(0, 5), equipped[0]!]
            : state === 'unknown'
              ? [...equipped.slice(0, 5), 'unknown-disc']
              : equipped
      if (state === 'invalid-history') {
        f.warehouse.discs[0] = {
          ...f.baseline[0]!,
          subStats: [{ stat: 'crit_rate', value: 9999, upgrades: 5 }],
        }
      }
      const replacement = solveCandidateWarehouse(
        f.baseline.map((disc) => (disc.slot === 1 ? duplicate : disc)),
        [f.agent.agentId],
        'agent',
        optimizerOptionsFromBuildIntent(f.buildIntent),
        f.buildIntent.recommendations,
      )
      const result = refineDevelopmentCandidates({
        ...f,
        agentId: f.agent.agentId,
        candidates: [replacement, f.original],
      })
      expect(result[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).toContain(duplicate.id)
    },
  )
  it('keeps higher covered benefit ahead of the equipped no-swap candidate', () => {
    const f = claretFixture()
    f.agent.equippedDiscIds = f.baseline.map((disc) => disc.id)
    const result = refineDevelopmentCandidates({
      ...f,
      agentId: f.agent.agentId,
      candidates: [f.original],
    })
    expect(result[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).toContain(f.stronger.id)
  })
  it('can use the complete numeric objective without relying on an unverified guide ordering', () => {
    const f = claretFixture()
    const constraint = f.buildIntent.recommendations[0]!.constraint!
    constraint.sources = constraint.sources.map((source) => ({ ...source, contentHash: 'changed' }))
    const result = refineDevelopmentCandidates({
      warehouse: f.warehouse,
      agentId: f.agent.agentId,
      candidates: [f.original],
      buildIntent: f.buildIntent,
    })
    expect(candidatePriorityEvidence(constraint).kind).toBe('unordered')
    expect(result[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).toContain(f.stronger.id)
    expect(result[0]!.boundary).not.toContain('来源词条层级')
  })
  it('respects fixed discs while exploring actual compatible source proposals', () => {
    const f = claretFixture()
    f.buildIntent.constraints.fixedDiscByAgent[f.agent.agentId] = f.baseline[0]!.id
    const result = refineDevelopmentCandidates({
      warehouse: f.warehouse,
      agentId: f.agent.agentId,
      candidates: [f.original],
      buildIntent: f.buildIntent,
    })
    expect(result[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).toContain(f.baseline[0]!.id)
    expect(result[0]!.loadouts[0]!.discs.map((row) => row.disc.id)).not.toContain(f.stronger.id)
  })
  it('preserves the exact existing functional-panel comparator semantics', () => {
    const values: Array<SearchPanelObjective | undefined> = [
      undefined,
      { attackDeficit: 0, anomalyProficiency: 100 },
      { attackDeficit: 1, anomalyProficiency: 200 },
      { attackDeficit: 0, anomalyProficiency: 200 },
      { attackDeficit: 0, anomalyProficiency: 1, priorityStat: 'energyRegen', energyRegen: 3 },
      { attackDeficit: 0, anomalyProficiency: 1, priorityStat: 'energyRegen', energyRegen: 4 },
    ]
    for (const left of values)
      for (const right of values)
        expect(compareCandidatePanelPriority(left, right)).toBe(
          compareCandidatePanelObjective(left, right),
        )
  })
  it.each([
    'legal-slot-menu-white-qualified-nonstacking-four-piece-r4',
    'raw-dynamic-six-eighteen-disc-objective-r8',
  ])('keeps historical %s build identities readable but no longer current', (branchPolicy) => {
    const f = claretFixture()
    const { fingerprint, ...core } = f.buildIntent
    const historical = {
      ...core,
      fingerprint: contentHash({
        ...core,
        discScoring: 'actual-disc-values-s-standard-r1',
        branchPolicy,
      }),
    }
    expect(historical.fingerprint).not.toBe(fingerprint)
    expect(buildIntentFingerprintMatches(historical, true)).toBe(true)
    expect(buildIntentFingerprintMatches(historical)).toBe(false)
    expect(buildIntentFingerprintMatches(f.buildIntent)).toBe(true)
  })
})
