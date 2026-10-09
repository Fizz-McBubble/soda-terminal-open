import { describe, expect, it } from 'vitest'
import type { DriveDisc, StatKey } from '../domain/schemas'
import { teamDynamicFixture } from './teamDynamicIntegration.testFixture'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import agentSource from '../gameDataPacks/generated/current-agent-mechanic-catalog.v1.json'
import bangbooSource from '../gameDataPacks/generated/current-bangboo-numeric-catalog.v1.json'

type Fixture = ReturnType<typeof teamDynamicFixture>
type Agent = 'agent-billy' | 'agent-nicole' | 'agent-anby'

// GO3456cd Characters/{Billy,Nicole,Anby}.json and corresponding formula sheets.
// Literal transcriptions: expected calculations never call a production panel,
// schedule selector, effect evaluator, damage function, or assignment objective.
const source = {
  'agent-billy': {
    name: 'Billy',
    attack: [113, 6.7335, 202, 75],
    coreCR: 0.144,
    occurrences: 5,
    events: [
      [0.68, 0.062],
      [0.076, 0.007],
      [0.618, 0.057],
      [0.127, 0.012],
      [0.495, 0.045],
    ],
  },
  'agent-nicole': {
    name: 'Nicole',
    attack: [93, 5.3249, 167, 75],
    coreCR: 0,
    occurrences: 2,
    events: [[3.771, 0.343]], // Assist Follow-Up: Window of Opportunity.
  },
  'agent-anby': {
    name: 'Anby',
    attack: [95, 5.423, 169, 75],
    coreCR: 0,
    occurrences: 4,
    events: [[5.83, 0.53]], // EX Special: Lightning Bolt.
  },
} as const
const mainValues: Partial<Record<StatKey, number>> = {
  hp_flat: 2200,
  atk_flat: 316,
  def_flat: 184,
  atk_percent: 30,
}

function fixture(): Fixture {
  const input = teamDynamicFixture()
  input.warehouse.roster.agents = input.warehouse.roster.agents.map((agent) =>
    input.candidate.memberIds.includes(agent.agentId)
      ? {
          ...agent,
          ascension: 5,
          mindscape: 0,
          potentialImage: 0,
          skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
        }
      : agent,
  )
  input.parameters.wEngines = input.parameters.wEngines.map((engine) => ({
    ...engine,
    level: 60,
    ascension: 5,
  }))
  return input
}

function memberDamage(
  agentId: Agent,
  discs: readonly DriveDisc[],
  probe?: { stat: StatKey; value: number },
) {
  const totals: Partial<Record<StatKey, number>> = {}
  const add = (stat: StatKey, value: number) => {
    totals[stat] = (totals[stat] ?? 0) + value
  }
  const counts = new Map<string, number>()
  expect(discs).toHaveLength(6)
  expect(new Set(discs.map((disc) => disc.slot)).size).toBe(6)
  for (const disc of discs) {
    expect(disc).toMatchObject({ rarity: 'S', level: 15 })
    const main = mainValues[disc.mainStat]
    if (main === undefined) throw new Error(`Unreviewed main stat ${disc.mainStat}`)
    add(disc.mainStat, main)
    for (const sub of disc.subStats) add(sub.stat, sub.value)
    counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  }
  if (probe) add(probe.stat, probe.value)
  expect([...counts].toSorted()).toEqual(
    [
      ['set-woodpecker-electro', 2],
      ['set-chaotic-metal', 2],
      ['set-hormone-punk', 2],
    ].toSorted(),
  )
  const value = (stat: StatKey) => totals[stat] ?? 0
  const s = source[agentId]
  const [base, growth, promotion, coreFlat] = s.attack
  const attackBase = base + 59 * growth + promotion + coreFlat + 32 * (1 + 9.409 + 5 * 0.8922)
  const attack = attackBase * (1 + 0.2 + 0.1 + value('atk_percent') / 100) + value('atk_flat')
  const cr = 0.05 + s.coreCR + 0.08 + value('crit_rate') / 100
  const cd = 0.5 + value('crit_dmg') / 100
  const crit = 1 + Math.min(1, Math.max(0, cr)) * cd
  const defense = 794 / (794 + Math.max(0, 700 - value('pen')))
  const weightedCoefficient = s.events.reduce((sum, [base, growth], index) => {
    // Moon Pleniluna's attack passive requires attack specialty: only Billy.
    // Billy core7 applies only to basic hits 2/3; Chaotic Metal2 only to Nicole.
    const damageBonus =
      agentId === 'agent-billy'
        ? 0.2 + (index === 2 || index === 3 ? 0.5 : 0)
        : agentId === 'agent-nicole'
          ? 0.1
          : 0
    return sum + (base + 11 * growth) * (1 + damageBonus)
  }, 0)
  return attack * weightedCoefficient * s.occurrences * crit * defense * 0.8
}

function independentDamage(
  input: Fixture,
  probes: Partial<Record<string, { stat: StatKey; value: number }>> = {},
) {
  const damage = input.fit.loadouts.map((loadout) => {
    const discs = loadout.discIds.map((id) => {
      const disc = input.warehouse.discs.find((row) => row.id === id)
      if (!disc) throw new Error(`Missing physical disc ${id}`)
      return disc
    })
    return {
      agentId: loadout.agentId,
      totalDamage: memberDamage(loadout.agentId as Agent, discs, probes[loadout.agentId]),
    }
  })
  // Nanoka 3.1 frozen Amillion 54005, reviewed for3.2: level60 attack, skill10,
  // stars5, one enemy, one active + one chain. Settle against the same enemy:
  // level60 coefficient 794, DEF700, RES20%, and source CR5%/CD50%.
  const bangbooAttack = Math.floor(72 + (360408 / 10000) * 59 + 6665)
  const bangboo =
    bangbooAttack * (8.1 + 9 * 0.81 + (8.4 + 9 * 0.84) * (1 + 0.9)) * (794 / 1494) * 0.8 * 1.025
  return { damage, bangboo, total: damage.reduce((sum, row) => sum + row.totalDamage, bangboo) }
}

function calibrate(input: Fixture) {
  expect(new Set(input.fit.loadouts.flatMap((row) => row.discIds)).size).toBe(18)
  for (const agentId of input.candidate.memberIds) {
    expect(input.warehouse.roster.agents.find((agent) => agent.agentId === agentId)).toMatchObject({
      level: 60,
      ascension: 5,
      mindscape: 0,
      potentialImage: 0,
      skillLevels: { basic: 12, assist: 12, special: 12, core: 7 },
    })
    expect(input.parameters.wEngines.find((engine) => engine.agentId === agentId)).toMatchObject({
      engineId: 'wengine-12001',
      level: 60,
      ascension: 5,
      refinement: 5,
    })
  }
  const expected = independentDamage(input)
  const actual = compileTargetTeamPlanningContext(input)
  expect(actual.status).toBe('supported')
  if (actual.status !== 'supported') throw new Error(actual.blockers.join(';'))
  expect(actual.coverage.excludedEffects).toEqual([])
  expect(actual.declaredDurationSeconds).toBe(30)
  expect(actual.context.scenario.enemy).toMatchObject({
    defense: 700,
    resistance: 0.2,
    stunMultiplier: 1,
    vulnerability: 0,
  })
  // Do not silently assume Nicole buffs active merely because Cunning Hares
  // activates her ability. This fixture explicitly uses the declared neutral
  // no-bullets/field-hit state; assert production disposition stays inactive.
  for (const key of ['agent-nicole:core_defRed_', 'agent-nicole:ability_ether_dmg_']) {
    const disposition = actual.context.evidence.find(
      (field) => field.fieldId === `effect-disposition:${key}`,
    )
    expect(disposition?.reason).toContain('inactive')
  }
  for (const row of expected.damage) {
    const observed = actual.memberDamage.find((member) => member.agentId === row.agentId)!
    expect(Math.abs(observed.totalDamage - row.totalDamage), row.agentId).toBeLessThan(1e-8)
  }
  if (actual.bangbooDamage === null) throw new Error('The declared Bangboo result is unavailable')
  expect(Math.abs(actual.bangbooDamage - expected.bangboo)).toBeLessThan(1e-8)
  expect(Math.abs(actual.totalDamage - expected.total)).toBeLessThan(1e-8)
  expect(actual.planningDps).toBeCloseTo(expected.total / 30, 10)
  return { actual, expected }
}

describe('independent same-condition three-member fixed-event arithmetic', () => {
  it('calibrates each member S-step team marginal without changing physical assets or qualification', () => {
    const input = fixture()
    const before = JSON.stringify(input)
    // Independently frozen official S steps, not read from the probe generator.
    const steps: Array<{ stat: StatKey; value: number }> = [
      { stat: 'hp_flat', value: 112 },
      { stat: 'hp_percent', value: 3 },
      { stat: 'atk_flat', value: 19 },
      { stat: 'atk_percent', value: 3 },
      { stat: 'def_flat', value: 15 },
      { stat: 'def_percent', value: 4.8 },
      { stat: 'pen', value: 9 },
      { stat: 'crit_rate', value: 2.4 },
      { stat: 'crit_dmg', value: 4.8 },
    ]
    for (const agentId of input.candidate.memberIds) {
      for (const step of steps) {
        const probes = { [agentId]: step }
        const expected = independentDamage(input, probes)
        const actual = compileTargetTeamPlanningContext({ ...input, statProbesByAgentId: probes })
        expect(actual.status).toBe('supported')
        if (actual.status !== 'supported') throw new Error(actual.blockers.join(';'))
        expect(actual.memberModelQualification32).toBeNull()
        expect(
          Math.abs(actual.totalDamage - expected.total),
          `${agentId}:${step.stat}`,
        ).toBeLessThan(1e-8)
        for (const row of expected.damage)
          expect(
            Math.abs(
              actual.memberDamage.find((m) => m.agentId === row.agentId)!.totalDamage -
                row.totalDamage,
            ),
          ).toBeLessThan(1e-8)
      }
    }
    expect(JSON.stringify(input)).toBe(before)
  })

  it('pins source identity and calibrates every member plus the team total', () => {
    for (const s of Object.values(source)) {
      const pinned = agentSource.items.find((row) => row.upstreamKey === s.name)!
      expect(pinned.source.commit).toBe('3456cd0f6f5bea10e168074502460dac2fcd6df4')
      expect(pinned.baseStats.atk_base).toBe(s.attack[0])
      expect(pinned.baseStats.atk_growth).toBe(s.attack[1])
      expect(pinned.promotionStats.at(-1)?.atk).toBe(s.attack[2])
    }
    expect(
      bangbooSource.items.find((row) => row.stableId === 'bangboo-amillion')?.source.sha256,
    ).toBe('497F8A47427AD708480C8BADBDF334E4D85EE995709EE8113F38B1CAF115FF93')
    const { expected } = calibrate(fixture())
    expect(expected.total).toBeCloseTo(322248.9923371286, 8)
  })

  it('calibrates legal CR upgrade gains and a physical-disc competition counterexample', () => {
    const input = fixture()
    const baseline = calibrate(input)
    const criticalDisc = input.warehouse.discs.find((disc) => disc.id === 'legal-team-3')!
    // Redirect the five HP% upgrades to CR: still four distinct substats and
    // five legal upgrades, CR increases by 12 percentage points.
    criticalDisc.subStats = criticalDisc.subStats.map((sub) =>
      sub.stat === 'crit_rate'
        ? { ...sub, value: 14.4, upgrades: 5 }
        : sub.stat === 'hp_percent'
          ? { ...sub, value: 3, upgrades: 0 }
          : sub,
    )
    const billyOwns = calibrate(input)
    const billy = input.fit.loadouts.find((row) => row.agentId === 'agent-billy')!
    const anby = input.fit.loadouts.find((row) => row.agentId === 'agent-anby')!
    billy.discIds[3] = 'legal-team-15'
    anby.discIds[3] = criticalDisc.id
    const anbyOwns = calibrate(input)
    const billyGain = billyOwns.expected.total - baseline.expected.total
    const anbyGain = anbyOwns.expected.total - baseline.expected.total
    expect(billyGain).toBeGreaterThan(0)
    expect(anbyGain).toBeGreaterThan(billyGain)
    expect(billyOwns.actual.totalDamage - baseline.actual.totalDamage).toBeCloseTo(billyGain, 8)
    expect(anbyOwns.actual.totalDamage - baseline.actual.totalDamage).toBeCloseTo(anbyGain, 8)
    expect(anbyOwns.actual.totalDamage - billyOwns.actual.totalDamage).toBeCloseTo(
      anbyGain - billyGain,
      8,
    )
  })
})
