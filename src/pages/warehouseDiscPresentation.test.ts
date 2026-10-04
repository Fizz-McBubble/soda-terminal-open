import { describe, expect, it } from 'vitest'
import type { WarehouseActionItem } from '../application/warehouseActionContract'
import { warehouseRetentionBasis } from '../application/warehouseRetention'
import type { WarehouseDiscDecision } from '../warehouse/discWarehouseAnalysis'
import { statusText } from './warehouseDiscPresentation'

describe('warehouse favorite protection presentation', () => {
  it('shows player protection without claiming equipment or character usage', () => {
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
    expect(statusText(item)).toEqual(['已有保留记录'])
    expect(item.usageAgentIds).toEqual([])
    expect({ decision, item }).toEqual(before)
  })
  it('omits favorite text for an ordinary disc and preserves existing usage labels', () => {
    expect(statusText({ statuses: [] } as unknown as WarehouseActionItem)).toEqual([])
    expect(
      statusText({
        statuses: ['currently_equipped', 'favorite'],
      } as unknown as WarehouseActionItem),
    ).toEqual(['当前使用', '已有保留记录'])
  })
})
