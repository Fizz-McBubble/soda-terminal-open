import { describe, expect, it } from 'vitest'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveRetentionActionFact } from './absoluteDiscRetentionActionFacts'
import { resolveActionUtility } from './absoluteDiscRetentionActionUtility'
import { absoluteDiscRetentionCatalog } from './absoluteDiscRetentionCatalog'
import review from './reviewedRetentionActionKits.json'

function fact(id: string) {
  return resolveRetentionActionFact(
    'aftershock',
    id,
    getCandidateWarehouseConstraint(id)!,
    getCurrentAgentEventContract(id),
  )
}

describe('pinned complete-kit action review', () => {
  it('uses the explicit self-negative for Cissia without borrowing her teammate aftershock', () => {
    const id = 'agent-cissia'
    const result = fact(id)
    expect(result.presence).toBe('absent')
    expect(result.currentBuildBenefit).toBe('unresolved')
    expect(result.condition).toBeNull()
    expect(result.sourceEvents).toEqual([])
    expect(result.sourceIds.some((source) => source.includes('character/1521.json:'))).toBe(true)
    expect(result.sourceIds.some((source) => source.includes('04162026/165621829.shtml'))).toBe(
      true,
    )
    const utility = resolveActionUtility(
      'aftershock',
      id,
      getCandidateWarehouseConstraint(id)!,
      getCurrentAgentEventContract(id),
      [],
    )
    expect(utility.state).toBe('incompatible')
    expect(utility.detail).toContain('仅用于候选用途判断')
    expect(utility.evidenceIds).toEqual(expect.arrayContaining(result.sourceIds))
  })

  it.each(review.actors.filter((row) => row.aftershockPresence === 'unresolved'))(
    'keeps $actorAgentId scoped to the unconfirmed action tag after reading its full kit',
    (row) => {
      const result = fact(row.actorAgentId)
      expect(result.presence).toBe('unresolved')
      expect(result.detail).toBe(row.detail)
      expect(result.sourceIds.some((id) => id.includes(`character/${row.externalId}.json:`))).toBe(
        true,
      )
      expect(result.sourceIds.some((id) => id.includes('165621829.shtml'))).toBe(false)
      expect(result.currentBuildBenefit).toBe('unresolved')
    },
  )

  it('rejects the negative when actor identity or any adopted mechanic input changes', () => {
    const id = 'agent-cissia'
    const contract = getCurrentAgentEventContract(id)!
    const constraint = getCandidateWarehouseConstraint(id)!
    const changedContracts = [
      { ...contract, stableId: 'agent-trigger' },
      { ...contract, externalId: '1361' },
      { ...contract, upstreamKey: 'Trigger' },
      ...['repository', 'commit', 'formulaPath', 'statsPath', 'formulaSha256', 'statsSha256'].map(
        (field) => ({ ...contract, source: { ...contract.source, [field]: 'unreviewed' } }),
      ),
    ]
    for (const changed of changedContracts) {
      const result = resolveRetentionActionFact('aftershock', id, constraint, changed)
      expect(result.presence).toBe('unresolved')
      expect(result.detail).toBeUndefined()
      expect(result.sourceIds.some((source) => source.includes('165621829.shtml'))).toBe(false)
    }
  })

  it('keeps dual damage tags and basic utility independent from the reviewed negative', () => {
    const trigger = getCandidateWarehouseConstraint('agent-trigger')!
    const contract = getCurrentAgentEventContract('agent-trigger')!
    for (const action of ['basic', 'aftershock'] as const)
      expect(resolveActionUtility(action, 'agent-trigger', trigger, contract, []).state).toBe(
        'valid',
      )
    expect(fact('agent-lucia').presence).toBe('present')
    const id = 'agent-cissia'
    expect(
      resolveActionUtility(
        'basic',
        id,
        getCandidateWarehouseConstraint(id)!,
        getCurrentAgentEventContract(id),
        [],
      ).state,
    ).toBe('incidental')
  })

  it('exposes the versioned review in every live Cissia branch', () => {
    const profiles = absoluteDiscRetentionCatalog.profiles.filter(
      (profile) => profile.agentId === 'agent-cissia',
    )
    expect(profiles.length).toBeGreaterThan(0)
    for (const profile of profiles) {
      const evidence = profile.utilityEvidence?.['action:aftershock']
      expect(evidence?.state).toBe('incompatible')
      expect(evidence?.evidenceIds.some((id) => id.includes(review.reviewVersion))).toBe(true)
    }
  })
})
