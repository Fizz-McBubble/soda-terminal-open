import type { WarehouseActionItem } from '../application/warehouseActionContract'
import { hasStatus, matchesBoolean, type FilterState } from './warehouseDiscPresentation'

/** Filters the current projection only; never derives a new retention decision. */
export function matchesWarehouseDiscFilters(item: WarehouseActionItem, filters: FilterState) {
  if (filters.action !== 'all' && item.action !== filters.action) return false
  if (filters.qualityBasis !== 'all') {
    const basis = item.absoluteRetention
    const matches = filters.qualityBasis.startsWith('reason:')
      ? basis?.reasonKind === filters.qualityBasis.slice('reason:'.length)
      : filters.qualityBasis === 'quality_keep'
        ? basis?.disposition === 'keep'
        : filters.qualityBasis === 'legal_growth'
          ? basis?.disposition === 'observe'
          : filters.qualityBasis === 'evidence_gap'
            ? basis?.disposition === 'review' || basis?.sourceCoverage === 'partial'
            : hasStatus(item, 'favorite') ||
              hasStatus(item, 'currently_equipped') ||
              hasStatus(item, 'active_plan_reference') ||
              hasStatus(item, 'saved_plan_reference') ||
              hasStatus(item, 'selected_portfolio_reference')
    if (!matches) return false
  }
  if (filters.useScope !== 'all') {
    const basis = item.absoluteRetention
    const matches =
      filters.useScope === 'owned'
        ? Boolean(basis?.ownedUseAgentIds.length)
        : filters.useScope === 'unowned'
          ? Boolean(basis?.unownedUseAgentIds.length)
          : !basis?.ownedUseAgentIds.length && !basis?.unownedUseAgentIds.length
    if (!matches) return false
  }
  if (filters.setId && item.disc.setId !== filters.setId) return false
  if (filters.slot && String(item.disc.slot) !== filters.slot) return false
  if (filters.mainStat && item.disc.mainStat !== filters.mainStat) return false
  if (filters.fit && !item.compatibleAgentIds.includes(filters.fit)) return false
  if (filters.level && String(item.disc.level) !== filters.level) return false
  if (
    !matchesBoolean(
      filters.referenced,
      hasStatus(item, 'active_plan_reference') ||
        hasStatus(item, 'saved_plan_reference') ||
        hasStatus(item, 'selected_portfolio_reference'),
    )
  )
    return false
  if (filters.review === 'no' && item.recommendationState === 'stale') return false
  return matchesBoolean(filters.review, hasStatus(item, 'needs_review'))
}
