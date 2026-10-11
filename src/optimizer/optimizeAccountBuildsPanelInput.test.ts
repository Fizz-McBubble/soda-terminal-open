import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { candidatePanelInputForAgent } from './optimizeAccountBuildsPanelInput'

describe('account candidate panel conditions', () => {
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
