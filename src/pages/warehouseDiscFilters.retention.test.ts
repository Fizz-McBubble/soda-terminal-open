import { describe, expect, it } from 'vitest'
import type { WarehouseActionItem } from '../application/warehouseActionContract'
import { sampleDiscs } from '../evaluation/fixtures'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import { matchesWarehouseDiscFilters } from './warehouseDiscFilters'
import { initialFilters } from './warehouseDiscPresentation'

function item(
  reasonKind: NonNullable<WarehouseAbsoluteRetentionEvidence['reasonKind']>,
  disposition: WarehouseAbsoluteRetentionEvidence['disposition'] = 'observe',
): WarehouseActionItem {
  return {
    disc: sampleDiscs.treasureCandidate,
    action: 'enhance',
    recommendationState: 'current',
    reasons: [],
    statuses: [],
    compatibleAgentIds: [],
    usageAgentIds: [],
    affectedAgentIds: [],
    affectedPlans: [],
    affectedTeams: [],
    alternativeDiscIds: [],
    absoluteRetention: {
      disposition,
      reasonKind,
      policyId: 'synthetic-policy',
      policyCalibration: 'approved',
      sourceCoverage: 'complete',
      branchCount: 1,
      bestUseProfileId: null,
      bestUseScore: null,
      ownedUseAgentIds: [],
      unownedUseAgentIds: [],
      leadingUses: [],
    },
  }
}

describe('retention reason filters', () => {
  it('includes explicit favorite protection without pretending it is a plan reference', () => {
    const favorite = {
      ...item('proven_low_ceiling', 'cleanup_candidate'),
      action: 'keep' as const,
      statuses: ['favorite' as const],
    }
    expect(
      matchesWarehouseDiscFilters(favorite, { ...initialFilters, qualityBasis: 'protected' }),
    ).toBe(true)
    expect(
      matchesWarehouseDiscFilters(favorite, {
        ...initialFilters,
        qualityBasis: 'protected',
        action: 'cleanup',
      }),
    ).toBe(false)
    expect(matchesWarehouseDiscFilters(favorite, { ...initialFilters, referenced: 'no' })).toBe(
      true,
    )
    expect(
      matchesWarehouseDiscFilters(item('proven_low_ceiling', 'cleanup_candidate'), {
        ...initialFilters,
        qualityBasis: 'protected',
      }),
    ).toBe(false)
  })

  it('selects each concrete reason independently of disposition and card action', () => {
    const functional = item('functional_ready', 'keep')
    const nextUpgrade = item('try_next_upgrade')
    const lowInvestment = item('low_investment_value')
    const filter = (qualityBasis: typeof initialFilters.qualityBasis) => ({
      ...initialFilters,
      qualityBasis,
    })
    expect(matchesWarehouseDiscFilters(functional, filter('reason:functional_ready'))).toBe(true)
    expect(matchesWarehouseDiscFilters(functional, filter('reason:quality_keep'))).toBe(false)
    expect(matchesWarehouseDiscFilters(nextUpgrade, filter('reason:try_next_upgrade'))).toBe(true)
    expect(matchesWarehouseDiscFilters(lowInvestment, filter('reason:try_next_upgrade'))).toBe(
      false,
    )
    expect(matchesWarehouseDiscFilters(lowInvestment, filter('reason:low_investment_value'))).toBe(
      true,
    )
    expect(
      matchesWarehouseDiscFilters(nextUpgrade, {
        ...filter('reason:try_next_upgrade'),
        action: 'keep',
      }),
    ).toBe(false)
  })

  it('retains legacy broad choices for saved filter state', () => {
    expect(
      matchesWarehouseDiscFilters(item('functional_ready', 'keep'), {
        ...initialFilters,
        qualityBasis: 'quality_keep',
      }),
    ).toBe(true)
    expect(
      matchesWarehouseDiscFilters(item('low_investment_value'), {
        ...initialFilters,
        qualityBasis: 'legal_growth',
      }),
    ).toBe(true)
    expect(
      matchesWarehouseDiscFilters(item('try_next_upgrade'), {
        ...initialFilters,
        qualityBasis: 'evidence_gap',
      }),
    ).toBe(false)
  })
})
