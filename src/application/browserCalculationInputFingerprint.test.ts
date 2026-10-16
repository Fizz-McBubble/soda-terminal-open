import { describe, expect, it } from 'vitest'
import {
  ascensionAgent,
  ascensionInput,
  ascensionPlan,
} from './accountDecisionAscension.testFixture'
import { browserCalculationInputFingerprint as fingerprint } from './browserCalculationInputFingerprint'
import { projectRemoteAccountDecisionInput } from './remoteCalculationInput'

describe('browser calculation fact coverage', () => {
  it('preserves explicit unknown engine breakthrough through JSON transport and repeated projection', () => {
    const value = ascensionInput()
    const agent = ascensionAgent(value)
    agent.wEngineDetails.ascension = null
    const before = JSON.stringify(value)
    const projected = projectRemoteAccountDecisionInput(value)
    const transported = JSON.parse(JSON.stringify(projected)) as typeof projected
    expect(ascensionAgent(transported).wEngineDetails.ascension).toBeNull()
    expect(
      ascensionAgent(projectRemoteAccountDecisionInput(transported)).wEngineDetails.ascension,
    ).toBeNull()
    expect(ascensionAgent(transported)).not.toHaveProperty('observedFacts')
    expect(ascensionAgent(transported).wEngineDetails).not.toHaveProperty('manualProgression')
    expect(JSON.stringify(value)).toBe(before)
  })
  it('projects unknown equipment progression and detects same-value manual confirmation without exporting provenance', () => {
    const value = ascensionInput()
    const agent = ascensionAgent(value)
    agent.wEngineDetails = {
      id: 'wengine-14102',
      name: '钢铁肉垫',
      level: 50,
      ascension: 3,
      refinement: 2,
    }
    agent.wEngineCopyId = 'old-copy'
    agent.observedFacts = {
      schemaVersion: 1,
      source: 'asset_quick_read',
      protocolVersion: '3.2',
      fields: {
        'wEngineDetails.id': {
          capturedAt: '2026-10-10T00:00:00.000Z',
          snapshotSha256: 'a'.repeat(64),
        },
      },
    }
    const before = fingerprint(value)
    const unobserved = ascensionAgent(projectRemoteAccountDecisionInput(value))
    expect(unobserved.wEngineDetails).toMatchObject({
      id: agent.wEngineDetails.id,
      level: null,
      refinement: null,
    })
    expect(unobserved.wEngineDetails.ascension).toBeUndefined()
    expect(unobserved.wEngineCopyId).toBeNull()
    expect(agent.wEngineDetails.level).toBe(50)
    agent.wEngineDetails.manualProgression = {
      engineId: agent.wEngineDetails.id!,
      level: 50,
      ascension: 3,
      refinement: 2,
    }
    expect(fingerprint(value)).not.toBe(before)
    const confirmed = ascensionAgent(projectRemoteAccountDecisionInput(value))
    expect(confirmed.wEngineDetails).toMatchObject({ level: 50, ascension: 3, refinement: 2 })
    expect(confirmed).not.toHaveProperty('observedFacts')
    expect(confirmed.wEngineDetails).not.toHaveProperty('manualProgression')
    agent.wEngineDetails.manualProgression.engineId = 'another-equipment'
    expect(ascensionAgent(projectRemoteAccountDecisionInput(value)).wEngineDetails.level).toBeNull()
  })
  it.each(['agent', 'equipped-engine'] as const)(
    'includes explicit %s phases without conflating zero, unknown or omission',
    (target) => {
      const values = [undefined, null, 0, 4, 5].map((phase) => {
        const value = ascensionInput()
        const agent = ascensionAgent(value)
        if (target === 'agent') agent.ascension = phase
        else agent.wEngineDetails.ascension = phase
        const projected = ascensionAgent(projectRemoteAccountDecisionInput(value))
        expect(target === 'agent' ? projected.ascension : projected.wEngineDetails.ascension).toBe(
          phase,
        )
        return fingerprint(value)
      })
      expect(new Set(values).size).toBe(values.length)
    },
  )

  it('ignores labels and synchronization timestamps while retaining progression changes', () => {
    const value = ascensionInput(),
      changed = structuredClone(value)
    changed.warehouse.roster.updatedAt = '2026-10-03T01:00:00.000Z'
    const agent = ascensionAgent(changed)
    agent.syncedAt = changed.warehouse.roster.updatedAt
    agent.skills = '个人备注'
    agent.wEngineDetails.name = '我的音擎'
    expect(fingerprint(changed)).toBe(fingerprint(value))
    agent.wEngineDetails.ascension = 5
    expect(fingerprint(changed)).not.toBe(fingerprint(value))
  })

  it.each(['level', 'ascension', 'potential'] as const)(
    'detects saved %s changes even when restoring the same revision',
    (field) => {
      const value = ascensionInput()
      value.drafts = [ascensionPlan(value.warehouse.accountId!)]
      const changed = structuredClone(value)
      const parameters = changed.drafts[0]!.teamEquipmentParameters!
      if (field === 'potential') parameters.potentialByAgentId!['agent-koleda'] = 6
      else parameters.wEngines[0]![field] = (parameters.wEngines[0]![field] ?? 0) + 1
      expect(changed.drafts[0]!.revision).toBe(value.drafts[0]!.revision)
      expect(fingerprint(changed)).not.toBe(fingerprint(value))
    },
  )
})
