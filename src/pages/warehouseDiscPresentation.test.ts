import { describe, expect, it } from 'vitest'
import type { WarehouseActionItem } from '../application/warehouseActionContract'
import { warehouseRetentionBasis } from '../application/warehouseRetention'
import type { WarehouseDiscDecision } from '../warehouse/discWarehouseAnalysis'
import { statusText } from './warehouseDiscPresentation'

describe('warehouse retired favorite presentation', () => {
  it('keeps captured favorite data but does not present it as a player protection source', () => {
    const decision = {
      cleanupSafety: { favorite: true, equipped: false },
      absoluteRetention: { disposition: 'cleanup_candidate', ownedUseAgentIds: [] },
    } as unknown as WarehouseDiscDecision
    const item = {
      action: 'keep',
      retentionBasis: warehouseRetentionBasis(decision, new Set()),
      statuses: ['favorite'],
      usageAgentIds: [],
    } as unknown as WarehouseActionItem
    const before = structuredClone({ decision, item })
    expect(item.retentionBasis).toBe('user_protected')
    expect(statusText(item)).toEqual([])
    expect(item.usageAgentIds).toEqual([])
    expect({ decision, item }).toEqual(before)
  })
  it('omits favorite text and preserves actual equipment or saved-plan usage labels', () => {
    expect(statusText({ statuses: [] } as unknown as WarehouseActionItem)).toEqual([])
    expect(
      statusText({
        statuses: ['currently_equipped', 'favorite'],
      } as unknown as WarehouseActionItem),
    ).toEqual(['已使用'])
  })
})
