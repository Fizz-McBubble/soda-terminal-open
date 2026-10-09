import { describe, expect, it } from 'vitest'
import { fixture } from '../decision/developmentValueBenchmark.fixtures'
import { projectNormalizedAccountFinalStatsDetailed } from '../decision/normalizedAccountFinalStats'
import { evaluateReviewedPreparedAnomalyObjective32 } from './reviewedPreparedAnomalyObjective32'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'

describe('actual projection into the prepared anomaly runtime', () => {
  it.each([
    ['agent-piper', 7.13, 1],
    ['agent-alice', 7.13, 1],
    ['agent-promeia', 5, 6.35],
  ] as const)(
    '%s consumes six actual discs, recorded progress and the same current engine',
    (agentId, baseMultiplier, sourceInstanceMultiplier) => {
      const { warehouse, baseline } = fixture()
      const recorded = warehouse.roster.agents[0]!
      const agent = {
        ...recorded,
        agentId,
        level: 60,
        ascension: 5,
        mindscape: 0,
        potentialImage: 0,
        skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
        wEngineDetails: { id: 'wengine-13008', name: null, level: 60, ascension: 5, refinement: 1 },
      }
      const discs = baseline.map((disc, index) => ({
        ...disc,
        setId: [
          'set-freedom-blues',
          'set-freedom-blues',
          'set-woodpecker-electro',
          'set-woodpecker-electro',
          'set-puffer-electro',
          'set-puffer-electro',
        ][index]!,
        subStats: [],
      }))
      const changed = discs.map((disc, index) =>
        index === 0
          ? { ...disc, subStats: [{ stat: 'anomaly_proficiency' as const, value: 9, upgrades: 0 }] }
          : disc,
      )
      const before = structuredClone({ warehouse, agent, discs, changed })
      const project = (loadout: typeof discs | typeof changed) => {
        const projection = projectNormalizedAccountFinalStatsDetailed({
          agent,
          engineId: 'wengine-13008',
          discs: loadout,
        })
        expect(projection.status).toBe('supported')
        if (projection.status !== 'supported') throw new Error(projection.reasons.join(','))
        const member: PlanningEffectRuntimeMember = {
          agentId,
          level: 60,
          mindscape: 0,
          potential: 0,
          coreLevel: 7,
          skillLevels: agent.skillLevels,
          initialStats: projection.stats.initialStats,
          finalStats: projection.stats.finalStats,
        }
        const result = evaluateReviewedPreparedAnomalyObjective32({
          member,
          baseline: currentNormalizedPlanningBaseline,
          wEngine: { engineId: 'wengine-13008', refinement: 1 },
          discs: loadout,
        })
        expect(result.status).toBe('supported')
        if (result.status !== 'supported') throw new Error(result.blockers.join(','))
        return { result, panel: projection.stats.finalStats }
      }
      const base = project(discs),
        candidate = project(changed)
      // Independent sourced arithmetic, without invoking the anomaly kernel or
      // any objective formula helper: target700/res20%, K60=794, level multiplier2.
      const bonus =
        base.panel.damageBonusesByAttribute?.[agentId === 'agent-promeia' ? 'ice' : 'physical'] ??
        base.panel.damageBonus ??
        0
      const defense = Math.max(0, 700 * (1 - base.panel.pen_) - (base.panel.pen ?? 0))
      const perAP =
        ((base.panel.atk *
          baseMultiplier *
          sourceInstanceMultiplier *
          0.01 *
          2 *
          (1 + bonus) *
          794) /
          (794 + defense)) *
        0.8
      expect(base.result.totalDamage).toBeCloseTo(perAP * base.panel.anomProf, 7)
      expect(candidate.result.totalDamage - base.result.totalDamage).toBeCloseTo(perAP * 9, 7)
      expect(candidate.result.contextHash).toBe(base.result.contextHash)
      expect(candidate.result.runtimeHash).not.toBe(base.result.runtimeHash)
      expect({ warehouse, agent, discs, changed }).toEqual(before)
    },
  )
})
