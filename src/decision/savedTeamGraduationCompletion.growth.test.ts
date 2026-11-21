import { describe, expect, it } from 'vitest'
import {
  savedGraduationDiscs,
  savedGraduationExecution,
  savedGraduationRoster,
} from '../testing/savedTeamGraduationCompletion.testFixture'
import { createSavedTeamGraduationCompletion } from './savedTeamGraduationCompletion'

describe('saved equipment growth in graduation panels', () => {
  it.each([
    [0, 123],
    [1, 166],
  ])('uses the saved level-10 engine at explicit ascension %s', (ascension, engineAttack) => {
    const ids = ['agent-aria', 'agent-velina', 'agent-vivian'] as const
    const execution = savedGraduationExecution(ids)
    execution.members[0]!.suggested.wEngine = {
      engineId: 'wengine-14150',
      copyId: null,
      refinement: 1,
      level: 10,
      ascension,
      fact: 'confirmed',
    }
    const roster = savedGraduationRoster(ids)
    roster.agents.find((agent) => agent.agentId === ids[0])!.wEngineDetails = {
      id: 'wengine-14150',
      name: '壳中之灵',
      level: 60,
      ascension: 5,
      refinement: 1,
    }
    const result = createSavedTeamGraduationCompletion({
      execution,
      roster,
      discs: savedGraduationDiscs(ids),
    })
    const member = result.members.find((row) => row.agentId === ids[0])
    expect(member?.status).toBe('scored')
    if (member?.status !== 'scored') throw new Error('Missing saved panel')
    const attack = member.metrics.find((metric) => metric.key === 'atk')
    expect(attack).toMatchObject({ target: 2600, observation: 'out_of_combat' })
    // Aria's menu base ATK is 788 with 75 from Core, plus the Lv10 engine.
    // The fixture adds 30% ATK in slot 4 and 316 flat ATK in slot 2.
    expect(attack?.current).toBeCloseTo((788 + 75 + engineAttack) * 1.3 + 316, 8)
    expect(member.progression).toMatchObject({ wEngineLevel: 10, savedWEngineRefinement: 1 })
  })
})
