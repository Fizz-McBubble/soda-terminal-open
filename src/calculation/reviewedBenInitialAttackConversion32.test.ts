import { describe, expect, it } from 'vitest'
import { statWeightCalibrationFixture } from '../decision/developmentStatWeights.calibrationFixture'
import { projectNormalizedAccountFinalStatsDetailed } from '../decision/normalizedAccountFinalStats'
import { evaluateReviewedBenInitialAttackConversion32 } from './reviewedBenInitialAttackConversion32'
import { compileCurrentPlanningSelfEffects32 } from './currentPlanningSelfEffects32'
import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { evaluateSourceBackedPlanningTeamDps } from './currentPlanningTeamDpsRuntime'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'

function fixture() {
  const f = statWeightCalibrationFixture('agent-billy')
  const source = f.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!
  const agent = { ...structuredClone(source), agentId: 'agent-ben' }
  agent.wEngineDetails!.id = 'wengine-13112'
  const discs = f.discs.map((disc) => ({
    ...disc,
    id: `ben-${disc.slot}`,
    mainStat: disc.slot === 5 ? ('fire_dmg' as const) : disc.mainStat,
  }))
  return { agent, discs, engineId: agent.wEngineDetails!.id! }
}
function projected(
  f: ReturnType<typeof fixture>,
  probe?: { stat: 'def_flat' | 'def_percent'; value: number },
) {
  const result = projectNormalizedAccountFinalStatsDetailed({ ...f, statProbe: probe })
  if (result.status !== 'supported') throw new Error(result.reasons.join(';'))
  return result.stats
}
function member(f: ReturnType<typeof fixture>, stats = projected(f)) {
  const coreLevel = f.agent.skillLevels.core
  if (typeof coreLevel !== 'number') throw new Error('Ben fixture requires an explicit core level')
  return {
    ...createLevel60NeutralEffectRuntimeMember('agent-ben'),
    level: stats.level,
    coreLevel,
    initialStats: stats.initialStats,
    finalStats: stats.finalStats,
  }
}

describe('Ben source initial DEF conversion through actual account projection', () => {
  it.each([
    [1, 0.4],
    [2, 0.46],
    [3, 0.52],
    [4, 0.6],
    [5, 0.66],
    [6, 0.72],
    [7, 0.8],
  ])(
    'core %s reads the actual source table, with an independent expected coefficient',
    (coreLevel, coefficient) => {
      const result = evaluateReviewedBenInitialAttackConversion32({
        coreLevel,
        initialDefense: 1500,
      })
      expect(result.status).toBe('supported')
      if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
      expect(result.attackIncrease).toBeCloseTo(1500 * coefficient, 10)
    },
  )

  it('adds completed initial DEF conversion once to all projected attack views', () => {
    const f = fixture()
    const before = structuredClone(f)
    const p = projected(f)
    const contract = getCurrentAgentEventContract('agent-ben')!
    // This fixture's six discs: ATK% main6 30%, six unupgraded 3% ATK
    // substats, Hormone Punk 2pc 10%, and 316 ATK main2. Big Cylinder supplies DEF40%.
    const affixes = f.discs.flatMap((disc) => disc.subStats)
    const attackPercent = affixes
      .filter((row) => row.stat === 'atk_percent')
      .reduce((sum, row) => sum + row.value / 100, 0)
    const attackFlat = affixes
      .filter((row) => row.stat === 'atk_flat')
      .reduce((sum, row) => sum + row.value, 0)
    const rawAttack = p.baseAttack * (1 + 0.3 + attackPercent + 0.1) + 316 + attackFlat
    expect(p.attack).toBeCloseTo(rawAttack + p.defense * 0.8, 9)
    expect(p.initialStats.atk).toBe(p.attack)
    expect(p.finalStats.atk).toBe(p.attack)
    expect(p.initialAttackConversion32?.attackIncrease).toBeCloseTo(p.defense * 0.8, 9)
    // The source character+engine white base remains a separate domain.
    expect(p.baseDefense).toBeCloseTo(
      contract.baseStats.def_base +
        contract.baseStats.def_growth * 59 +
        contract.promotionStats[5]!.def,
      9,
    )
    expect(f).toEqual(before)
    const effects = compileCurrentPlanningSelfEffects32({ member: member(f, p) })
    expect(effects.status).toBe('supported')
    if (effects.status !== 'supported') throw new Error(effects.blockers.join(';'))
    expect(effects.exclusions.map((row) => row.effectKey)).not.toContain('agent-ben:core_atk')
    expect(effects.results.map((row) => row.effectKey)).not.toContain('agent-ben:core_atk')
  })

  it('positive virtual DEF and signed real-disc changes use DEF rather than ATK percentages', () => {
    const f = fixture()
    const p = projected(f)
    expect(projected(f, { stat: 'def_flat', value: 15 }).attack - p.attack).toBeCloseTo(12, 9)
    expect(projected(f, { stat: 'def_percent', value: 4.8 }).attack - p.attack).toBeCloseTo(
      p.baseDefense * 0.048 * 0.8,
      9,
    )
    const extra = {
      ...f,
      discs: f.discs.map((disc) => ({
        ...disc,
        subStats:
          disc.slot === 1
            ? disc.subStats.map((row) =>
                row.stat === 'atk_percent'
                  ? { stat: 'def_flat' as const, value: 15, upgrades: 0 }
                  : row,
              )
            : disc.subStats,
      })),
    }
    const less = projected(f),
      more = projected(extra)
    // Replacing ATK3% by DEF15 changes both known channels; reversal is signed.
    const delta = 15 * 0.8 - p.baseAttack * 0.03
    expect(more.attack - less.attack).toBeCloseTo(delta, 9)
    expect(less.attack - more.attack).toBeCloseTo(-delta, 9)
    const combat = member(f, p)
    combat.finalStats = { ...combat.finalStats, def: combat.finalStats.def + 1000 }
    expect(combat.initialStats.atk).toBe(p.attack)
  })

  it('recomputes level/core/six-disc/refinement boundaries in the production projection', () => {
    const f = fixture()
    for (const core of [null, 0, 8, 2.5]) {
      const next = structuredClone(f)
      next.agent.skillLevels.core = core
      expect(projectNormalizedAccountFinalStatsDetailed(next).status).toBe('unsupported')
    }
    for (const level of [0, 61, 20.5]) {
      const next = structuredClone(f)
      next.agent.level = level
      expect(projectNormalizedAccountFinalStatsDetailed(next).status).toBe('unsupported')
    }
    for (const refinement of [0, 6, 1.5]) {
      const next = structuredClone(f)
      next.agent.wEngineDetails!.refinement = refinement
      expect(projectNormalizedAccountFinalStatsDetailed(next).status).toBe('unsupported')
    }
    expect(
      projectNormalizedAccountFinalStatsDetailed({ ...f, discs: f.discs.slice(1) }).status,
    ).toBe('unsupported')
    const p1 = projected(f),
      p5 = structuredClone(f)
    p5.agent.wEngineDetails!.refinement = 5
    expect(projected(p5).attack).toBe(p1.attack) // Passive refinement cannot change a static panel.
    const lower = structuredClone(f)
    lower.agent.level = 40
    lower.agent.ascension = 3
    lower.agent.wEngineDetails!.level = 40
    lower.agent.wEngineDetails!.ascension = 3
    const low = projected(lower)
    expect(low.initialAttackConversion32?.attackIncrease).toBeCloseTo(low.defense * 0.8, 9)
    expect(low.attack).not.toBe(p1.attack)
  })

  it('diagnoses the real Ben team output after projection without a damage-domain duplicate', () => {
    const f = fixture(),
      ben = member(f)
    const memberIds = ['agent-ben', 'agent-billy', 'agent-lucy'] as const
    const members = [ben, ...memberIds.slice(1).map(createLevel60NeutralEffectRuntimeMember)]
    const eventUsages = memberIds.map((ownerAgentId) => {
      const contract = getCurrentAgentEventContract(ownerAgentId)!
      const event = contract.eventContract.events.find((row) =>
        row.eventId.startsWith('special.EXSpecial'),
      )!
      return {
        ownerAgentId,
        eventId: event.eventId,
        skillLevel: 1,
        occurrenceCount: 1,
        evidenceRefs: ['synthetic:one-source-event'],
      }
    })
    const result = evaluateSourceBackedPlanningTeamDps({
      memberIds,
      members,
      eventUsages,
      baseline: { ...currentNormalizedPlanningBaseline, gameVersion: '3.2' },
    })
    expect(result.status).toBe('supported')
    if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
    expect(
      result.memberDamage.find((row) => row.agentId === 'agent-ben')!.totalDamage,
    ).toBeGreaterThan(0)
    expect(result.sourceEffectExclusions.map((row) => row.effectKey)).not.toContain(
      'agent-ben:core_atk',
    )
    // Inspect outside-domain reporting separately; it must not be damage-applied.
    const recorded = result.effectBuckets.filter((row) => row.effectKey === 'agent-ben:core_atk')
    expect(recorded.length).toBeGreaterThan(0)
    expect(recorded.every((row) => row.application === 'outside_direct_event_formula')).toBe(true)
    const p = projected(f)
    const increase = p.initialAttackConversion32!.attackIncrease
    const unconverted = {
      ...ben,
      initialStats: { ...ben.initialStats, atk: ben.initialStats.atk - increase },
      finalStats: { ...ben.finalStats, atk: ben.finalStats.atk - increase },
    }
    const reference = evaluateSourceBackedPlanningTeamDps({
      memberIds,
      members: [unconverted, ...members.slice(1)],
      eventUsages,
      baseline: { ...currentNormalizedPlanningBaseline, gameVersion: '3.2' },
    })
    if (reference.status !== 'supported') throw new Error(reference.blockers.join(';'))
    const sourceEvent = getCurrentAgentEventContract('agent-ben')!.eventContract.events.find(
      (row) => row.eventId === eventUsages[0]!.eventId,
    )!
    expect(sourceEvent.scalingAttribute).toBe('atk')
    const damage = result.memberDamage.find((row) => row.agentId === 'agent-ben')!.totalDamage
    const rawDamage = reference.memberDamage.find((row) => row.agentId === 'agent-ben')!.totalDamage
    // Same source event and enemy: only ATK changes. A repeated conversion
    // would break this independently derived linear ratio.
    expect(damage / rawDamage).toBeCloseTo(p.attack / (p.attack - increase), 10)
  })
})
