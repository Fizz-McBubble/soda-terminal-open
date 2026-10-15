import { describe, expect, it } from 'vitest'
import {
  developmentComparisonPanelsContract,
  developmentPanelKeys,
  hasDevelopmentComparisonPanels,
  type DevelopmentComparisonPanels,
} from './publicDevelopmentComparisonPanels'

const values = Object.fromEntries(
  developmentPanelKeys.map((key) => [key, 0]),
) as DevelopmentComparisonPanels['entries'][number]['values']
function presentation(extra: Record<string, number> = {}): DevelopmentComparisonPanels {
  return {
    contract: developmentComparisonPanelsContract,
    agentId: 'agent-yixuan',
    entries: [{ discFingerprint: 'synthetic', status: 'ok', values: { ...values, ...extra } }],
    targetDisplayByLabel: {},
    saveKnowledge: {
      scenario: '',
      profileId: '',
      status: 'candidate',
      version: '3.2',
      source: '',
      currentEngineRecorded: true,
    },
  }
}
describe('public optional panel attribute transport', () => {
  it('round-trips known extended values while preserving missing resource values', () => {
    const decoded = JSON.parse(
      JSON.stringify(presentation({ sheerForce: 567.9732, etherDamageBonus: 30, pen: 9 })),
    ) as DevelopmentComparisonPanels
    expect(hasDevelopmentComparisonPanels(decoded, 'agent-yixuan')).toBe(true)
    expect(decoded.entries[0]?.values).toMatchObject({
      sheerForce: 567.9732,
      etherDamageBonus: 30,
      pen: 9,
    })
    expect(decoded.entries[0]?.values.maxAdrenaline).toBeUndefined()
  })
  it('accepts old snapshots without inventing new attributes, and rejects malformed known optional fields', () => {
    expect(hasDevelopmentComparisonPanels(presentation(), 'agent-yixuan')).toBe(true)
    for (const key of ['sheerForce', 'physicalDamageBonus', 'maxEnergy', 'adrenalineRegen'])
      expect(
        hasDevelopmentComparisonPanels(presentation({ [key]: Number.NaN }), 'agent-yixuan'),
      ).toBe(false)
    expect(hasDevelopmentComparisonPanels(presentation(), 'another-agent')).toBe(false)
  })
})
