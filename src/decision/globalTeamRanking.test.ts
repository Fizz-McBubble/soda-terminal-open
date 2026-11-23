import { describe, expect, it } from 'vitest'
import {
  createGlobalTeamRanking,
  globalTeamRankingContractId,
  previewGlobalTeamRankingForBox,
  type GlobalTeamRankingCandidate,
} from './globalTeamRanking'

const agentIds = ['agent-a', 'agent-b', 'agent-c', 'agent-d']
const teams = [
  ['agent-a', 'agent-b', 'agent-c'],
  ['agent-a', 'agent-b', 'agent-d'],
  ['agent-a', 'agent-c', 'agent-d'],
  ['agent-b', 'agent-c', 'agent-d'],
] as const

function candidates(): GlobalTeamRankingCandidate[] {
  return teams.map((memberIds, index) => ({
    candidateId: memberIds.join(':'),
    memberIds,
    diagnosticScore: index === 3 ? null : 400 - index * 20,
    status: index === 3 ? 'unsupported' : 'ranked',
    reasons: index === 3 ? ['required action contract missing'] : [],
  }))
}

function ranking(input = candidates()) {
  return createGlobalTeamRanking({
    policy: {
      gameVersion: 'test-version',
      objectiveIdentity: 'unit-test-objective/v1',
      objectiveDefinition: 'A single declared test objective.',
    },
    agentIds,
    candidates: input,
  })
}

describe('global team ranking authority', () => {
  it('requires exact full-domain coverage and one objective', () => {
    expect(ranking().policy).toMatchObject({
      contract: globalTeamRankingContractId,
      authorityKind: 'diagnostic_shadow',
      runtimeEligible: false,
      sourceAuthority: 'none',
      accountAuthority: 'filter_only',
    })
    expect(() => ranking(candidates().slice(0, -1))).toThrow('coverage mismatch')
    expect(() =>
      ranking([...candidates().slice(0, -1), { ...candidates()[0]!, candidateId: 'duplicate' }]),
    ).toThrow('duplicate')
  })

  it('keeps unsupported teams outside the ranked sequence and preserves dense ties', () => {
    const input = candidates()
    input[1]!.diagnosticScore = input[0]!.diagnosticScore
    const result = ranking(input)
    expect(result.rankedCount).toBe(3)
    expect(result.unsupportedCount).toBe(1)
    expect(
      result.entries.filter((entry) => entry.status === 'ranked').map((entry) => entry.denseRank),
    ).toEqual([1, 1, 2])
    expect(result.entries.at(-1)).toMatchObject({
      denseRank: null,
      reasons: ['required action contract missing'],
    })
  })

  it('uses BOX state only as a filter and never creates an account-specific rerank', () => {
    const result = ranking()
    const matched = previewGlobalTeamRankingForBox(result, {
      ownedAgentIds: ['agent-a', 'agent-b', 'agent-d'],
      fixedAgentIds: ['agent-d'],
    })
    expect(matched.map((entry) => entry.candidateId)).toEqual(['agent-a:agent-b:agent-d'])
    expect(matched[0]?.denseRank).toBe(2)
    expect(result.fingerprint).toBe(ranking().fingerprint)
  })

  it('drops undeclared source fields instead of copying them into ranking entries', () => {
    const input = candidates()
    input[0] = {
      ...input[0]!,
      sourceTier: 'S',
      sourceCount: 9,
    } as GlobalTeamRankingCandidate
    expect(ranking(input).entries[0]).not.toHaveProperty('sourceTier')
    expect(ranking(input).entries[0]).not.toHaveProperty('sourceCount')
  })
})
