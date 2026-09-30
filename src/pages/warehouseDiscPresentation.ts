import {
  warehouseActionLabels,
  type WarehouseActionItem,
  type WarehouseActionKind,
  type WarehouseActionStatus,
} from '../application/warehouseActionContract'
import type { DriveDisc } from '../domain/schemas'
import { statLabel } from './warehouseFactLabels'
import { formatRecordedDiscStatValue } from './discStatPresentation'
import type { DiscSortMode } from '../domain/discOrdering'
import type { RetentionReasonKind } from '../warehouse/absoluteDiscRetentionContract'

export type QualityBasisFilter =
  | 'all'
  | 'quality_keep'
  | 'legal_growth'
  | 'evidence_gap'
  | 'protected'
  | `reason:${RetentionReasonKind}`

export type FilterState = {
  action: 'all' | WarehouseActionKind
  setId: string
  slot: string
  mainStat: string
  fit: string
  level: string
  referenced: 'all' | 'yes' | 'no'
  review: 'all' | 'yes' | 'no'
  qualityBasis: QualityBasisFilter
  useScope: 'all' | 'owned' | 'unowned' | 'none'
  sort: DiscSortMode
}

export const initialFilters: FilterState = {
  action: 'all',
  setId: '',
  slot: '',
  mainStat: '',
  fit: '',
  level: '',
  referenced: 'all',
  review: 'all',
  qualityBasis: 'all',
  useScope: 'all',
  sort: 'catalog',
}
export const actionKinds: WarehouseActionKind[] = ['keep', 'enhance', 'cleanup']
export const statusLabels: Partial<Record<WarehouseActionStatus, string>> = {
  favorite: '收藏保护',
  currently_equipped: '当前使用',
  active_plan_reference: '当前方案',
  saved_plan_reference: '方案使用中',
  selected_portfolio_reference: '显式多队占用',
  better_alternative: '有替代盘',
  needs_review: '待确认',
  stale: '旧结果',
}

export function substatLine(disc: DriveDisc) {
  return substatLines(disc).join(' · ')
}
export function substatLines(disc: DriveDisc) {
  return disc.subStats.map(
    (item) => `${statLabel(item.stat)} ${formatRecordedDiscStatValue(item.stat, item.value)}`,
  )
}
export function hasStatus(item: WarehouseActionItem, status: WarehouseActionStatus) {
  return item.statuses.includes(status)
}
export function matchesBoolean(value: 'all' | 'yes' | 'no', actual: boolean) {
  return value === 'all' || actual === (value === 'yes')
}
export function statusText(item: WarehouseActionItem) {
  return item.statuses
    .filter((status) =>
      [
        'favorite',
        'currently_equipped',
        'active_plan_reference',
        'saved_plan_reference',
        'selected_portfolio_reference',
      ].includes(status),
    )
    .map((status) => statusLabels[status])
    .filter((label): label is string => Boolean(label))
}
export function warehouseActionStrengthLabel(item: WarehouseActionItem) {
  return warehouseActionLabels[item.action]
}
