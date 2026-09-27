import type { WarehouseActionProjection } from '../application/warehouseActionContract'
import { PlayerSelect } from '../components/PlayerSelect'
import { Filter } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { warehouseActionLabels } from '../application/warehouseActionContract'
import { getPublicStatLabel, publicStatOrder } from '../application/publicCandidateLabels'
import type { DriveDisc } from '../domain/schemas'
import { readableAgentName, readableSetName, setNames } from './warehouseFactLabels'
import { initialFilters, actionKinds, type FilterState } from './warehouseDiscPresentation'

export function WarehouseActionSummary({
  filters,
  updateFilters,
  stale,
  projection,
}: {
  filters: FilterState
  updateFilters: (updater: (current: FilterState) => FilterState) => void
  stale: boolean
  projection: WarehouseActionProjection | null
}) {
  return (
    <div className="warehouse-action-summary" aria-label="驱动盘建议">
      {actionKinds.map((action) => (
        <button
          key={action}
          type="button"
          className={`warehouse-action-summary__item warehouse-action-summary__item--${action}${filters.action === action ? ' is-active' : ''}`}
          aria-pressed={filters.action === action}
          onClick={() =>
            updateFilters((current) => {
              const nextAction = current.action === action ? 'all' : action
              return {
                ...current,
                action: nextAction,
                cleanupBasis: 'all',
                sort:
                  current.sort === 'development' && nextAction !== 'enhance'
                    ? 'catalog'
                    : current.sort,
              }
            })
          }
        >
          <span>
            {stale
              ? `旧结果 · ${action === 'cleanup' ? '清理候选' : warehouseActionLabels[action]}`
              : action === 'cleanup'
                ? '清理候选'
                : warehouseActionLabels[action]}
          </span>
          <strong>{projection?.counts[action] ?? 0}</strong>
        </button>
      ))}
    </div>
  )
}

export function WarehouseDiscControls({
  filters,
  updateFilters,
  data,
  availableMainStats,
  compatibleAgentIds,
  ownedAgentIds,
  moreFilterCount,
  hasFilters,
}: {
  filters: FilterState
  updateFilters: (updater: (current: FilterState) => FilterState) => void
  data: { discs: DriveDisc[] }
  availableMainStats: Set<DriveDisc['mainStat']>
  compatibleAgentIds: string[]
  ownedAgentIds: Set<string>
  moreFilterCount: number
  hasFilters: boolean
}) {
  const moreFiltersRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const details = moreFiltersRef.current
    if (!details) return
    const closeOutside = (event: PointerEvent) => {
      if (!details.open || event.composedPath().includes(details)) return
      const target = event.target
      const popover =
        target instanceof Element ? target.closest<HTMLElement>('.f5v-select-menu-popover') : null
      if (
        popover &&
        [...details.querySelectorAll('[aria-controls]')].some(
          (control) => control.getAttribute('aria-controls') === popover.id,
        )
      )
        return
      details.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (!details.open || event.key !== 'Escape' || event.defaultPrevented) return
      details.open = false
      details.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])
  const cleanupBasisControl = (
    <label>
      清理依据
      <PlayerSelect
        aria-label="清理依据"
        value={filters.cleanupBasis}
        onChange={(value) =>
          updateFilters((current) => ({
            ...current,
            action: 'cleanup',
            cleanupBasis: value as FilterState['cleanupBasis'],
          }))
        }
      >
        <option value="all">全部</option>
        <option value="complete">依据齐全</option>
        <option value="replacement">已有更好的盘</option>
        <option value="no_current_fit">当前账号暂无推荐用途</option>
      </PlayerSelect>
    </label>
  )
  return (
    <section className="warehouse-action-controls" aria-label="驱动盘建议与筛选">
      <form
        className="warehouse-analysis-filters"
        aria-label="驱动盘筛选"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="warehouse-analysis-filters__discs">
          <Filter size={17} aria-hidden="true" />
          <label>
            套装
            <PlayerSelect
              aria-label="套装"
              value={filters.setId}
              onChange={(value) => updateFilters((current) => ({ ...current, setId: value }))}
            >
              <option value="">全部套装</option>
              {[...new Set([...setNames.keys(), ...data.discs.map((disc) => disc.setId)])].map(
                (id) => (
                  <option key={id} value={id}>
                    {readableSetName(id)}
                  </option>
                ),
              )}
            </PlayerSelect>
          </label>
          <label>
            号位
            <PlayerSelect
              aria-label="号位"
              value={filters.slot}
              onChange={(value) =>
                updateFilters((current) => ({
                  ...current,
                  slot: value,
                  mainStat: data.discs.some(
                    (disc) =>
                      (!value || String(disc.slot) === value) && disc.mainStat === current.mainStat,
                  )
                    ? current.mainStat
                    : '',
                }))
              }
            >
              <option value="">全部号位</option>
              {[1, 2, 3, 4, 5, 6].map((slot) => (
                <option key={slot} value={slot}>
                  {slot} 号位
                </option>
              ))}
            </PlayerSelect>
          </label>
          <label>
            主词条
            <PlayerSelect
              aria-label="主词条"
              value={filters.mainStat}
              onChange={(value) => updateFilters((current) => ({ ...current, mainStat: value }))}
            >
              <option value="">全部主词条</option>
              {publicStatOrder
                .filter((id) =>
                  availableMainStats.has(id as (typeof data.discs)[number]['mainStat']),
                )
                .map((id) => (
                  <option key={id} value={id}>
                    {getPublicStatLabel(id)}
                  </option>
                ))}
            </PlayerSelect>
          </label>
        </div>
        <div className="warehouse-analysis-filters__usage">
          <label>
            适用角色
            <PlayerSelect
              aria-label="适用角色"
              value={filters.fit}
              onChange={(value) => updateFilters((current) => ({ ...current, fit: value }))}
            >
              <option value="">全部角色</option>
              {compatibleAgentIds.map((agentId) => (
                <option key={agentId} value={agentId}>
                  {readableAgentName(agentId)}
                  {ownedAgentIds.has(agentId) ? ' · 已拥有' : ' · 未拥有'}
                </option>
              ))}
            </PlayerSelect>
          </label>
          <label>
            排序
            <PlayerSelect
              aria-label="排序方式"
              value={filters.sort}
              onChange={(value) =>
                updateFilters((current) => ({ ...current, sort: value as FilterState['sort'] }))
              }
            >
              <option value="catalog">套装号位</option>
              <option value="level">强化等级</option>
              {filters.action === 'enhance' ? <option value="development">培养优先</option> : null}
            </PlayerSelect>
          </label>
          <div className="warehouse-filter-actions">
            <details ref={moreFiltersRef} className="warehouse-more-filters" data-motion-static>
              <summary>更多筛选 · {moreFilterCount}</summary>
              <div>
                <label>
                  等级/强化
                  <PlayerSelect
                    aria-label="等级/强化"
                    value={filters.level}
                    onChange={(value) => updateFilters((current) => ({ ...current, level: value }))}
                  >
                    <option value="">全部等级</option>
                    {Array.from({ length: 16 }, (_, level) => level).map((level) => (
                      <option key={level} value={level}>
                        +{level}
                      </option>
                    ))}
                  </PlayerSelect>
                </label>
                <label>
                  方案引用
                  <PlayerSelect
                    aria-label="方案引用"
                    value={filters.referenced}
                    onChange={(value) =>
                      updateFilters((current) => ({
                        ...current,
                        referenced: value as FilterState['referenced'],
                      }))
                    }
                  >
                    <option value="all">全部</option>
                    <option value="yes">已被引用</option>
                    <option value="no">未被引用</option>
                  </PlayerSelect>
                </label>
                <label>
                  核对状态
                  <PlayerSelect
                    aria-label="核对状态"
                    value={filters.review}
                    onChange={(value) =>
                      updateFilters((current) => ({
                        ...current,
                        review: value as FilterState['review'],
                      }))
                    }
                  >
                    <option value="all">全部</option>
                    <option value="yes">待核对</option>
                    <option value="no">无需核对</option>
                  </PlayerSelect>
                </label>
                {cleanupBasisControl}
                {hasFilters ? (
                  <button
                    className="button button--quiet warehouse-clear-filters"
                    type="button"
                    onClick={() =>
                      updateFilters((current) => ({ ...initialFilters, sort: current.sort }))
                    }
                  >
                    清除全部筛选
                  </button>
                ) : null}
              </div>
            </details>
          </div>
        </div>
      </form>
    </section>
  )
}
