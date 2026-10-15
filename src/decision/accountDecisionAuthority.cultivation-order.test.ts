import {
  describe,
  expect,
  it,
  defaultTeamPortfolioPreference,
  projectAccountDecisionAuthority,
  memberIds,
  formation,
  fixture,
} from './accountDecisionAuthority.testFixture'

describe('current cultivation with unassessed inventory', () => {
  it('retains known investment gaps without rewriting intrinsic team strength', () => {
    const developed = ['agent-billy', 'agent-nicole', 'agent-anby'] as const
    const { roster, allocation } = fixture([...memberIds, ...developed])
    roster.agents = roster.agents.map((agent) =>
      memberIds.includes(agent.agentId as (typeof memberIds)[number])
        ? {
            ...agent,
            level: 1,
            skillLevels: { basic: 1, dodge: 1, assist: 1, special: 1, chain: 1, core: 1 },
          }
        : agent,
    )
    const result = projectAccountDecisionAuthority({
      rankedFormations: [
        formation('stronger-long-term', 100, memberIds),
        formation('less-investment-now', 90, developed),
      ],
      roster,
      allocation: { ...allocation, global: [], independent: [] },
      preference: defaultTeamPortfolioPreference,
    })
    if (result.status !== 'ready') throw new Error('fixture should be ready')
    const stronger = result.consumerRecommendations.find(
      (row) => row.candidateId === 'stronger-long-term',
    )!
    const nearer = result.consumerRecommendations.find(
      (row) => row.candidateId === 'less-investment-now',
    )!
    expect(stronger.accountInputs.currentReadiness).toBe('not_evaluated')
    expect(nearer.accountInputs.currentReadiness).toBe('not_evaluated')
    expect(stronger.teamStrengthOrder).toBeLessThan(nearer.teamStrengthOrder!)
    expect(nearer.cultivationPriorityOrder).toBeLessThan(stronger.cultivationPriorityOrder!)
    expect(result.longTermPortfolio.candidateIds).toEqual(['stronger-long-term'])
    expect(result.currentPortfolio.candidateIds).toEqual(['less-investment-now'])
    expect(nearer.accountInputs.buildCompletionDistance.missingDiscSlots).toBeNull()
  })
})
