import { describe, expect, it } from 'vitest'
import {
  createEmptyRoster,
  allocation,
  candidate,
  input,
  memberIds,
} from './teamExecutionProjection.testFixture'
import { projectTargetTeamExecution, projectTeamExecutions } from './teamExecutionProjection'
import { reviewedAuthorComparisonMembership32 } from './reviewedAuthorComparisonMembership32'

describe('execution equipment facts', () => {
  it('retains an explicit low-level unascended scheme engine instead of a max-level display', () => {
    const execution = projectTargetTeamExecution({
      ...input(),
      candidate: candidate(),
      warehousePlan: {
        scope: 'team',
        agentIds: [...memberIds],
        loadouts: allocation().global,
        totalScore: 0,
        alternatives: [],
        gaps: [],
        boundary: 'fixture',
      },
      effectiveEquipmentParameters: {
        wEngines: memberIds.map((agentId) => ({
          agentId,
          engineId: 'wengine-13004',
          refinement: 2,
          level: 10,
          ascension: 0,
        })),
        bangbooId: 'bangboo-belion',
        bangbooStars: 1,
        source: 'player_confirmed',
      },
    })
    expect(execution.members.every((row) => row.suggested.wEngine?.level === 10)).toBe(true)
    expect(execution.members.every((row) => row.suggested.wEngine?.ascension === 0)).toBe(true)
  })

  it('uses the current engine and absence in a declared account-bound comparison', () => {
    const ids: [string, string, string] = ['agent-claret', 'agent-rina', 'agent-roxy']
    const roster = createEmptyRoster()
    for (const row of roster.agents) {
      row.owned = ids.includes(row.agentId)
      if (!row.owned) continue
      row.wEngineCopyId = null
      row.wEngineDetails = { id: null, name: null, level: null, refinement: null }
    }
    roster.agents.find((row) => row.agentId === 'agent-claret')!.wEngineDetails = {
      id: 'wengine-13004',
      name: '合成账户音擎',
      level: 30,
      ascension: 2,
      refinement: 3,
    }
    const before = structuredClone(roster)
    const [execution] = projectTeamExecutions({
      ...input(roster),
      allocation: {
        ...allocation(),
        global: allocation().global.map((row, index) => ({ ...row, agentId: ids[index]! })),
      },
      candidates: [
        {
          candidateId: 'synthetic-author-equipment',
          memberIds: ids,
          bangbooId: null,
          authorComparisonMembership: reviewedAuthorComparisonMembership32(ids, ids)!,
          scenarioTags: [],
          provenance: 'authority_exact',
        },
      ],
    })
    expect(execution?.wEngineBindingMode).toBe('account_fact_binding')
    expect(
      execution?.members.find((row) => row.agentId === 'agent-claret')?.suggested.wEngine,
    ).toMatchObject({ engineId: 'wengine-13004', level: 30, ascension: 2, refinement: 3 })
    expect(
      execution?.members.find((row) => row.agentId === 'agent-rina')?.suggested.wEngine,
    ).toBeNull()
    expect(roster).toEqual(before)
  })
})
