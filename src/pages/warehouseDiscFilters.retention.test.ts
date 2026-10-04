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

describe('player warehouse filters', () => {
  it('keeps retained records distinct from plan use without exposing an internal reason filter', () => {
    const favorite = {
      ...item('proven_low_ceiling', 'cleanup_candidate'),
      action: 'keep' as const,
      statuses: ['favorite' as const],
    }
    expect(matchesWarehouseDiscFilters(favorite, initialFilters)).toBe(true)
    expect(
      matchesWarehouseDiscFilters(favorite, {
        ...initialFilters,
        action: 'cleanup',
      }),
    ).toBe(false)
    expect(matchesWarehouseDiscFilters(favorite, { ...initialFilters, referenced: 'no' })).toBe(
      true,
    )
    expect(matchesWarehouseDiscFilters(favorite, { ...initialFilters, referenced: 'yes' })).toBe(
      false,
    )
  })

  it('filters plan use while keeping old results available for reanalysis', () => {
    const planned = {
      ...item('quality_keep', 'keep'),
      statuses: ['saved_plan_reference' as const],
      recommendationState: 'stale' as const,
    }
    expect(matchesWarehouseDiscFilters(planned, { ...initialFilters, referenced: 'yes' })).toBe(
      true,
    )
    expect(matchesWarehouseDiscFilters(planned, { ...initialFilters, referenced: 'no' })).toBe(
      false,
    )
  })

  it('keeps practical filters composable without depending on recommendation reasons', () => {
    const current = { ...item('try_next_upgrade'), compatibleAgentIds: ['agent-ben'] }
    const filters = {
      ...initialFilters,
      fit: 'agent-ben',
      slot: String(current.disc.slot),
      mainStat: current.disc.mainStat,
      level: String(current.disc.level),
    }
    expect(matchesWarehouseDiscFilters(current, filters)).toBe(true)
    expect(matchesWarehouseDiscFilters(current, { ...filters, fit: 'agent-claret' })).toBe(false)
    expect(Object.keys(initialFilters)).not.toEqual(
      expect.arrayContaining(['qualityBasis', 'useScope', 'review']),
    )
  })
})
