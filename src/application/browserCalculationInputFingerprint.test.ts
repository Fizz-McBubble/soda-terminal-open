import { describe, expect, it } from 'vitest'
import {
  ascensionAgent,
  ascensionInput,
  ascensionPlan,
} from './accountDecisionAscension.testFixture'
import { browserCalculationInputFingerprint as fingerprint } from './browserCalculationInputFingerprint'
import { projectRemoteAccountDecisionInput } from './remoteCalculationInput'

describe('browser calculation fact coverage', () => {
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
