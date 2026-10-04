import { describe, expect, it } from 'vitest'
import {
  savedGraduationDiscs,
  savedGraduationExecution,
  savedGraduationRoster,
} from '../testing/savedTeamGraduationCompletion.testFixture'
import { createSavedTeamGraduationCompletion } from './savedTeamGraduationCompletion'

describe('saved equipment growth in graduation panels', () => {
  it('uses the saved level-10 unascended engine, including an explicit zero ascension', () => {
    const ids = ['agent-remielle', 'agent-aria', 'agent-velina'] as const
    const execution = savedGraduationExecution(ids)
    execution.members[0]!.suggested.wEngine = {
      engineId: 'wengine-14158',
      copyId: null,
      refinement: 1,
      level: 10,
      ascension: 0,
      fact: 'confirmed',
    }
    const result = createSavedTeamGraduationCompletion({
      execution,
      roster: savedGraduationRoster(ids, { mindscapeByAgentId: { 'agent-remielle': 2 } }),
      discs: savedGraduationDiscs(ids),
    })
    const member = result.members.find((row) => row.agentId === ids[0])
    expect(member?.status).toBe('scored')
    if (member?.status !== 'scored') throw new Error('Missing saved panel')
    // Menu white ATK823; Lv10/A0 engine50*(1+1.5682).
    // Slot4 ATK30% + engine ATK14.4%; slot2 flat316.
    expect(member.metrics.find((metric) => metric.key === 'atk')?.current).toBeCloseTo(
      (823 + 50 * (1 + 1.5682)) * 1.444 + 316,
      8,
    )
    expect(member.progression.wEngineLevel).toBe(10)
  })
})
