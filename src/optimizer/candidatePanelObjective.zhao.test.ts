import { describe, expect, it, vi } from 'vitest'
import * as panels from '../calculation/outOfCombatPanel'
import { supportObjectiveFixture } from './candidatePanelObjective.testFixture'
import { candidatePanelInputForAgent } from './optimizeAccountBuilds'
import {
  getCandidatePanelObjectiveTarget,
  projectCandidatePanelObjective,
  compareCandidatePanelObjective,
  candidatePanelObjectiveWarning,
} from './candidatePanelObjective'
import { compareCandidatePanelPriority } from './candidateSearchFacts'
import { preservesTeamPanelObjectives } from './selectTeamObjectiveAssignment'
import { optimizeBuild } from './optimizeBuild'

describe('Zhao source-bound support target', () => {
  it('uses precise initial HP and never menu ceil as proof of reaching the target', () => {
    const { agent, discs } = supportObjectiveFixture('agent-zhao')
    const input = candidatePanelInputForAgent(agent)!
    for (const core of [-1, 0, 1, 2, 3, 4, 5])
      expect(getCandidatePanelObjectiveTarget(agent.agentId, { ...input, core })).toMatchObject({
        minimumInitialHp: 27000,
      })
    const target = getCandidatePanelObjectiveTarget(agent.agentId, input)!
    expect(candidatePanelObjectiveWarning(target, 'unsupported', false)).not.toContain('核心技7')
    const original = panels.projectOutOfCombatPanel({ ...input, discs })
    expect(original.status).toBe('ok')
    const precise = vi
      .spyOn(panels, 'projectOutOfCombatPanel')
      .mockReturnValue({ ...original, values: { ...original.values, hp: 26999.7 } })
    const objective = projectCandidatePanelObjective(target, input, discs)!
    expect(objective.hpDeficit).toBeCloseTo(0.3)
    precise.mockReturnValue({ ...original, values: { ...original.values, hp: 27399 } })
    const capped = projectCandidatePanelObjective(target, input, discs)!
    expect(capped.hpDeficit).toBe(0)
    expect(compareCandidatePanelObjective(capped, objective)).toBeLessThan(0)
    expect(compareCandidatePanelPriority(capped, objective)).toBeLessThan(0)
    expect(
      preservesTeamPanelObjectives(
        [{ agentId: agent.agentId, panelObjective: objective }],
        [{ agentId: agent.agentId, panelObjective: capped }],
      ),
    ).toBe(false)
    expect(compareCandidatePanelPriority(capped, { ...capped, anomalyProficiency: 999 })).toBe(0)
    expect(
      preservesTeamPanelObjectives(
        [{ agentId: agent.agentId, panelObjective: { ...capped, hpDeficit: undefined } }],
        [{ agentId: agent.agentId, panelObjective: capped }],
      ),
    ).toBe(false)
    precise.mockRestore()
  })
  it('retains the HP-improving physical option before local damage weights and preserves inventory', () => {
    const { agent, discs, profile, knowledge } = supportObjectiveFixture('agent-zhao')
    const hpDisc = {
      ...discs[5]!,
      id: 'zhao-hp-six',
      mainStat: 'hp_percent' as const,
      subStats: discs[5]!.subStats.map((row) =>
        row.stat === 'hp_percent'
          ? { stat: 'hp_flat' as const, value: 112 * (row.upgrades + 1), upgrades: row.upgrades }
          : row,
      ),
    }
    const inventory = [...discs, hpDisc]
    const before = JSON.stringify(inventory)
    const result = optimizeBuild(
      inventory,
      {
        ...profile,
        mainStatFit: { ...profile.mainStatFit, '6': { atk_percent: 1, hp_percent: 0.01 } },
      },
      { ...knowledge, mainStats: { ...knowledge.mainStats, '6': ['atk_percent', 'hp_percent'] } },
      '3.1',
      { panelInput: candidatePanelInputForAgent(agent)!, candidateLimitPerSlot: 1 },
    )
    expect(result.panelObjectiveStatus).toBe('applied')
    expect(result.builds[0]!.discs.map((row) => row.disc.id)).toContain(hpDisc.id)
    expect(result.builds[0]!.panelObjective?.hpDeficit).toBeTypeOf('number')
    expect(JSON.stringify(inventory)).toBe(before)
  })
})
