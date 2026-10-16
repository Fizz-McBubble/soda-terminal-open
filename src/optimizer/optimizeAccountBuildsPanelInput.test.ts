import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { candidatePanelInputForAgent } from './optimizeAccountBuildsPanelInput'
import { candidatePanelInputsForScheme } from './optimizeAccountBuilds'
import { getCandidatePanelObjectiveTarget } from './candidatePanelObjective'

describe('account candidate panel conditions', () => {
  it('isolates the shared live-team and saved-replay scheme operands from current unknown observations', () => {
    const agents = ['agent-zhao', 'agent-astra', 'agent-pan-yinhu'].map((agentId) => {
      const agent = createEmptyRoster().agents.find((row) => row.agentId === agentId)!
      agent.level = 60
      agent.skillLevels.core = 7
      agent.potentialImage = 2
      agent.wEngineDetails = {
        id: 'wengine-14002',
        name: '当前旧音擎',
        level: 40,
        ascension: null,
        refinement: 1,
        manualProgression: { engineId: 'wengine-old', level: 30, ascension: 2, refinement: 3 },
      }
      agent.observedFacts = {
        schemaVersion: 1,
        source: 'asset_quick_read',
        protocolVersion: '3.2',
        fields: {
          'wEngineDetails.id': {
            capturedAt: '2026-10-15T00:00:00.000Z',
            snapshotSha256: 'a'.repeat(64),
          },
        },
      }
      return agent
    })
    const before = JSON.stringify(agents)
    const ids = agents.map((agent) => agent.agentId)
    const engines = ids.map((agentId) => ({
      agentId,
      engineId: 'wengine-14002',
      refinement: 1,
      level: 60,
      ascension: 5,
    }))
    expect(candidatePanelInputForAgent(agents[0])).toBeUndefined()
    const inputs = candidatePanelInputsForScheme(agents, ids, engines)!
    expect(Object.keys(inputs)).toEqual(ids)
    expect(inputs['agent-zhao']).toMatchObject({
      potentialImage: 2,
      core: 5,
      wEngine: { level: 60, ascension: 5 },
    })
    expect(
      getCandidatePanelObjectiveTarget('agent-zhao', inputs['agent-zhao'])?.minimumInitialHp,
    ).toBe(27000)
    expect(
      candidatePanelInputsForScheme(
        agents,
        ids,
        engines.map(({ agentId, engineId, refinement }) => ({ agentId, engineId, refinement })),
      )?.['agent-zhao']?.wEngine.ascension,
    ).toBe(5)
    expect(
      candidatePanelInputsForScheme(
        agents,
        ids,
        engines.map((engine) => ({ ...engine, ascension: null })),
      ),
    ).toBeUndefined()
    expect(
      candidatePanelInputsForScheme(
        agents,
        ids,
        engines.map((engine) => ({ ...engine, level: 40, ascension: 3 })),
      ),
    ).toBeUndefined()
    expect(
      candidatePanelInputsForScheme(
        agents,
        ids,
        engines.map((engine) => ({ ...engine, ascension: 3 })),
      ),
    ).toBeUndefined()
    expect(JSON.stringify(agents)).toBe(before)
  })
  it('passes existing potential with the same maintained progression conditions', () => {
    const agent = createEmptyRoster().agents.find((row) => row.agentId === 'agent-astra')!
    agent.level = 60
    agent.skillLevels.core = 7
    agent.potentialImage = 4
    agent.wEngineDetails = { id: 'wengine-14102', name: null, level: 60, refinement: 1 }
    expect(candidatePanelInputForAgent(agent)).toMatchObject({
      potentialImage: 4,
      mindscape: agent.mindscape,
    })
    agent.observedFacts = {
      schemaVersion: 1,
      source: 'asset_quick_read',
      protocolVersion: '3.2',
      fields: {
        'wEngineDetails.id': { capturedAt: '2026-10-10T00:00:00Z', snapshotSha256: 'a'.repeat(64) },
      },
    }
    expect(candidatePanelInputForAgent(agent)).toBeUndefined()
    expect(agent.wEngineDetails.level).toBe(60)
  })
})
