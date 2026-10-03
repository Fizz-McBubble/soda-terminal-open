import { describe, expect, it } from 'vitest'
import { createLevel60NeutralEffectRuntimeMember } from '../calculation/currentPlanningEffectRuntime'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
import { compileIncremental32PlanningSourceSelection } from './incremental32PlanningSourceSelection'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import { fixture } from './targetTeamPlanningContext.testFixture'
import { projectTargetTeamAccountBoundBenchmark } from './targetTeamAccountBoundBenchmark'
import { projectTargetTeamValueBenchmark } from './targetTeamValueBenchmark'

const memberIds = ['agent-claret', 'agent-roxy', 'agent-koleda'] as const

describe('shared prepared three-agent fixed benchmark', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])(
    'sums exact source packets and ally/self potential once at P%s',
    (potential) => {
      const members = memberIds.map((agentId) => {
        const base = createLevel60NeutralEffectRuntimeMember(agentId)
        const stats = {
          ...base.finalStats,
          atk: 1000,
          def: 400,
          crit_: 0.5,
          crit_dmg_: 1,
          enerRegen: 1.2,
          damageBonus: 0,
          pen_: 0,
          pen: 0,
          lacerationDamage: 1.5,
          sharpDamageBonus: 0,
          directDamageBonus: 0,
          buffBonus: 0,
        }
        return {
          ...base,
          level: 60,
          coreLevel: 7,
          mindscape: 0,
          potential: agentId === 'agent-koleda' ? potential : 0,
          skillLevels: { basic: 12, special: 12 },
          initialStats: { ...stats },
          finalStats: { ...stats },
        }
      })
      const selection = compileIncremental32PlanningSourceSelection({ members, eventUsages: [] })
      expect(selection.status).toBe('supported')
      expect(selection.sourcePackets).toHaveLength(3)
      const baseline = {
        ...currentNormalizedPlanningBaseline,
        enemy: {
          id: 'literal-defense794',
          defense: 794,
          resistance: 0,
          stunMultiplier: 1,
          vulnerability: 0,
        },
      }
      const result = evaluateSourceBackedPlanningTeamDps({
        memberIds,
        members,
        baseline,
        eventUsages: selection.eventUsages,
        baselineReferencesByAgentId: selection.referencesByAgentId,
      })
      if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
      const active = potential >= 2
      const common = active ? 1.35 : 1
      const critBonus = [0, 0, 0.11, 0.17, 0.23, 0.29, 0.35][potential]!
      const lacerationBonus = [0, 0, 0.04, 0.06, 0.08, 0.1, 0.12][potential]!
      // Prepared prior Maim activates Claret's sourced +.25 Laceration; Koleda's
      // receiver-specific +Laceration goes only to Claret, +CD to the two others.
      const laceration = 1.5 + 0.25 + lacerationBonus
      const expected = [
        400 * 63.136 * 0.5 * common * (1 + laceration) * (1 + 0.15 * laceration),
        // Roxy source ability: 8% + level * 1.2%, active with this Stun/Rupture
        // formation. It shares the damage-bonus bucket with Koleda's 35%.
        1000 * 40.908 * 0.5 * (common + 0.08 + 60 * 0.012) * (1 + 0.5 * (1 + critBonus)),
        1000 * (14.191 * common + (active ? 8.108 * 0.1 : 0)) * 0.5 * (1 + 0.5 * (1 + critBonus)),
      ]
      result.memberDamage.forEach((row, index) =>
        expect(row.totalDamage).toBeCloseTo(expected[index]!, 7),
      )
      expect(result.memberDamage.reduce((sum, row) => sum + row.totalDamage, 0)).toBeCloseTo(
        expected.reduce((sum, value) => sum + value, 0),
        7,
      )
      expect(
        selection.sourcePackets.find((row) => row.agentId === 'agent-koleda')?.resourceLegality,
      ).toMatchObject({ furnaceFire: { initial: 1, consumed: 1, final: 0 }, gash: { consumed: 0 } })
    },
  )

  it('feeds actual eighteen-disc compilation without asking for an engineering declaration', () => {
    const original = fixture()
    original.warehouse.roster.agents = original.warehouse.roster.agents.map((agent) =>
      memberIds.includes(agent.agentId as (typeof memberIds)[number])
        ? {
            ...agent,
            owned: true,
            level: 50,
            ascension: 4,
            mindscape: 0,
            potentialImage: agent.agentId === 'agent-koleda' ? 6 : 0,
            skillLevels: { ...agent.skillLevels, basic: 12, special: 12, chain: 12, core: 7 },
          }
        : agent,
    )
    const parameters = {
      ...original.parameters,
      wEngines: memberIds.map((agentId) => ({
        agentId,
        engineId: 'wengine-12001',
        level: 40,
        ascension: 3,
        refinement: 1,
      })),
    }
    const candidate = {
      ...original.candidate,
      memberIds: [...memberIds] as [string, string, string],
      candidateId: 'prepared-32-trio',
    }
    const fit = {
      ...original.fit,
      memberIds: [...memberIds] as [string, string, string],
      loadouts: original.fit.loadouts.map((row, index) => ({ ...row, agentId: memberIds[index]! })),
    }
    const input = { ...original, candidate, fit, parameters }
    const before = JSON.stringify(input)
    const result = compileTargetTeamPlanningContext(input)
    if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
    expect(result.sourcePackets).toHaveLength(3)
    expect(result.memberDamage.every((row) => row.totalDamage > 0)).toBe(true)
    expect(result.totalDamage).toBeCloseTo(
      result.memberDamage.reduce((sum, row) => sum + row.totalDamage, 0),
      7,
    )
    expect(result.bangbooDamage).toBeNull()
    expect(result.context.bangboo).toBeNull()
    expect(result.includedScope).toBe('three_members')
    expect(result.planningDps).toBeCloseTo(result.totalDamage / 30, 7)
    expect(JSON.stringify(input)).toBe(before)
    // Unknown Fanged Metal four-piece activation must not acquire Formal merely
    // because each member has a reviewed action packet.
    expect(result.memberModelQualification32).toBeNull()
    const unqualifiedBenchmark = projectTargetTeamAccountBoundBenchmark({
      ...input,
      equipmentParameters: parameters,
    })
    const unqualifiedComparison = projectTargetTeamValueBenchmark({
      ...input,
      targetFit: fit,
      targetBenchmark: unqualifiedBenchmark,
      drafts: [],
      activePlanIds: {},
      equipmentParameters: parameters,
      stale: false,
    })
    expect(unqualifiedComparison.candidate.dimensions.bangboo).toBe('excluded_from_member_model')
    const neutralDiscs = {
      ...input,
      warehouse: {
        ...input.warehouse,
        discs: input.warehouse.discs.map((disc) => ({
          ...disc,
          setId:
            disc.slot <= 2
              ? 'set-fanged-metal'
              : disc.slot <= 4
                ? 'set-woodpecker-electro'
                : 'set-soul-rock',
        })),
      },
    }
    const neutral = compileTargetTeamPlanningContext(neutralDiscs)
    if (neutral.status !== 'supported') throw new Error(neutral.blockers.join(';'))
    expect(neutral.memberModelQualification32).toMatchObject({
      status: 'formal',
      capability: 'formal_dps',
      bangbooIncluded: false,
      importReady: false,
    })
    expect(neutral.memberModelQualification32!.totalDamage).toBeCloseTo(
      neutral.memberDamage.reduce((sum, row) => sum + row.totalDamage, 0),
      8,
    )
    expect(neutral.memberModelQualification32!.planningDps).toBeCloseTo(
      neutral.memberModelQualification32!.totalDamage / 30,
      8,
    )
    // The existing comparison uses the certified member sum, not the candidate
    // aggregate containing unrelated Bangboo events. Both sides must qualify.
    neutralDiscs.warehouse.roster.agents = neutralDiscs.warehouse.roster.agents.map((agent) => {
      const loadout = fit.loadouts.find((row) => row.agentId === agent.agentId)
      const engine = parameters.wEngines.find((row) => row.agentId === agent.agentId)
      return loadout && engine
        ? {
            ...agent,
            equippedDiscIds: loadout.discIds,
            wEngineDetails: {
              id: engine.engineId,
              name: null,
              level: engine.level,
              ascension: engine.ascension,
              refinement: engine.refinement,
            },
          }
        : agent
    })
    const targetBenchmark = projectTargetTeamAccountBoundBenchmark({
      ...neutralDiscs,
      equipmentParameters: parameters,
    })
    const comparison = projectTargetTeamValueBenchmark({
      ...neutralDiscs,
      targetFit: fit,
      targetBenchmark,
      drafts: [],
      activePlanIds: {},
      equipmentParameters: parameters,
      stale: false,
    })
    expect(comparison.status).toBe('supported')
    expect(comparison.planningDpsPercentDelta).toBe(0)
    expect(comparison.candidate.totalDamage).toBeCloseTo(
      neutral.memberModelQualification32!.totalDamage,
      7,
    )
    expect(comparison.candidate.dimensions.bangboo).toBe('excluded_from_member_model')
    expect(comparison.baseline.memberModelQualification32?.status).toBe('formal')
    const sourceSets = {
      ...neutralDiscs,
      warehouse: {
        ...neutralDiscs.warehouse,
        discs: neutralDiscs.warehouse.discs.map((disc) => {
          const memberIndex = fit.loadouts.findIndex((row) => row.discIds.includes(disc.id))
          return {
            ...disc,
            setId:
              disc.slot <= 4
                ? ['set-34200', 'set-astral-voice', 'set-shockstar-disco'][memberIndex]!
                : ['set-soul-rock', 'set-swing-jazz', 'set-inferno-metal'][memberIndex]!,
          }
        }),
      },
    }
    sourceSets.parameters = {
      ...sourceSets.parameters,
      bangbooId: 'bangboo-sumoboo',
      wEngines: sourceSets.parameters.wEngines.map((row) =>
        row.agentId === 'agent-koleda' ? { ...row, engineId: 'wengine-14110' } : row,
      ),
    }
    const realSets = compileTargetTeamPlanningContext(sourceSets)
    if (realSets.status !== 'supported') throw new Error(realSets.blockers.join(';'))
    expect(
      realSets.memberModelQualification32?.status,
      JSON.stringify(realSets.coverage.excludedEffects),
    ).toBe('formal')
    expect(realSets.bangbooDamage).toBeNull()
    expect(realSets.modifierProjection.bangboo.blockers).toContain(
      '缺少邦布事件 flag：enemy_daze_above_50',
    )
    expect(realSets.discEffects.preparedQuickAssist).toBe('none_in_preceding_15s_or_counted_events')
    for (const claretEngine of [
      'wengine-14161',
      'wengine-13021',
      'wengine-13017',
      'wengine-12016',
    ]) {
      for (const refinement of [1, 5]) {
        const equipped = compileTargetTeamPlanningContext({
          ...neutralDiscs,
          parameters: {
            ...neutralDiscs.parameters,
            wEngines: neutralDiscs.parameters.wEngines.map((row) => ({
              ...row,
              refinement,
              engineId:
                row.agentId === 'agent-claret'
                  ? claretEngine
                  : row.agentId === 'agent-roxy'
                    ? 'wengine-14162'
                    : row.engineId,
            })),
          },
        })
        if (equipped.status !== 'supported') throw new Error(equipped.blockers.join(';'))
        expect(
          equipped.memberModelQualification32,
          JSON.stringify(
            equipped.coverage.excludedEffects.map((row) => ({
              key: row.effectKey,
              fields: row.fields,
            })),
          ),
        ).not.toBeNull()
        expect(equipped.memberModelQualification32!.totalDamage).toBeGreaterThan(0)
      }
    }
  })
})
