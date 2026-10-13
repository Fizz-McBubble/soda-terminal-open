import { describe, expect, it } from 'vitest'
import {
  preservesTeamFunctionalConstraints32,
  sourceReviewedProtectedUtilityIndices32,
} from './teamFunctionalConstraints32'

function input(agentId: string) {
  return {
    baselineCapacities: [],
    candidateCapacities: [],
    baselineUtility: new Map([[agentId, [100, 1, 100, 100]]]),
    candidateUtility: new Map([[agentId, [100, 1, 100, 99]]]),
  }
}
describe('source-reviewed functional utility selection', () => {
  it('retains conservative old defaults, while verified ordinary attack can lower incidental AP', () => {
    const base = input('agent-billy')
    expect(preservesTeamFunctionalConstraints32(base)).toBe(false)
    expect(
      preservesTeamFunctionalConstraints32({
        ...base,
        protectedUtilityIndicesByAgentId: new Map([
          ['agent-billy', sourceReviewedProtectedUtilityIndices32('agent-billy')],
        ]),
      }),
    ).toBe(true)
  })
  it('protects anomaly purpose and support conversions, not merely specialty', () => {
    expect(sourceReviewedProtectedUtilityIndices32('agent-jane')).toEqual([0, 1, 2, 3])
    expect(sourceReviewedProtectedUtilityIndices32('agent-yuzuha')).toContain(2)
    expect(sourceReviewedProtectedUtilityIndices32('unknown')).toEqual([0, 1, 2, 3])
    const base = input('agent-jane')
    expect(
      preservesTeamFunctionalConstraints32({
        ...base,
        protectedUtilityIndicesByAgentId: new Map([
          ['agent-jane', sourceReviewedProtectedUtilityIndices32('agent-jane')],
        ]),
      }),
    ).toBe(false)
  })
  it('retains raw impact/recovery protections absent sourced numeric coverage', () => {
    const base = input('agent-billy')
    expect(
      preservesTeamFunctionalConstraints32({
        ...base,
        protectedUtilityIndicesByAgentId: new Map([['agent-billy', [0, 1]]]),
        candidateUtility: new Map([['agent-billy', [99, 1, 100, 99]]]),
      }),
    ).toBe(false)
  })
  it('allows source AM conversion to cover raw AM but never covers AP', () => {
    const row = {
      key: 'agent-burnice:source_anomaly_mastery',
      kind: 'anomaly_mastery' as const,
      value: 150,
      contextKey: 'same-reviewed-conversion',
      sourceRefs: ['synthetic:source-binding'],
      included: [],
      excluded: [],
    }
    const base = {
      ...input('agent-burnice'),
      baselineCapacities: [row],
      candidateCapacities: [row],
      candidateUtility: new Map([['agent-burnice', [100, 1, 99, 100]]]),
    }
    expect(preservesTeamFunctionalConstraints32(base)).toBe(true)
    expect(
      preservesTeamFunctionalConstraints32({
        ...base,
        candidateUtility: new Map([['agent-burnice', [100, 1, 99, 99]]]),
      }),
    ).toBe(false)
  })
})
