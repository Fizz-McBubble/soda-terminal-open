import type { WarehouseActionProjection } from '../application/warehouseActionContract'
import { PlayerSelect } from '../components/PlayerSelect'
import { X } from 'lucide-react'
import { warehouseActionLabels } from '../application/warehouseActionContract'
import { getPublicStatLabel, publicStatOrder } from '../application/publicCandidateLabels'
import type { DriveDisc } from '../domain/schemas'
import { readableAgentName, readableSetName, setNames } from './warehouseFactLabels'
import { actionKinds, type FilterState } from './warehouseDiscPresentation'
import { sortCompatibleAgentsForPicker } from './teamPickerPresentation'

const actionDescriptions = {
  keep: '查看使用关系与适用搭配',
  enhance: '查看词条潜力与适用搭配',
  cleanup: '清理前确认游戏内装备及方案使用情况',
} as const

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
    <div className="warehouse-action-summary" role="group" aria-label="驱动盘建议">
      {actionKinds.map((action) => (
        <button
          key={action}
          type="button"
          className={`warehouse-action-summary__item warehouse-action-summary__item--${action}${filters.action === action ? ' is-active' : ''}`}
          aria-pressed={filters.action === action}
          disabled={!projection}
          aria-description={actionDescriptions[action]}
          title={actionDescriptions[action]}
          onClick={() =>
            updateFilters((current) => {
              const nextAction = current.action === action ? 'all' : action
              return {
                ...current,
                action: nextAction,
                sort:
                  current.sort === 'development' && nextAction !== 'enhance'
                    ? 'game'
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
          <strong>{projection ? projection.counts[action] : '待分析'}</strong>
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
  projection,
}: {
  filters: FilterState
  updateFilters: (updater: (current: FilterState) => FilterState) => void
  data: { discs: DriveDisc[] }
  availableMainStats: Set<DriveDisc['mainStat']>
  compatibleAgentIds: string[]
  ownedAgentIds: Set<string>
  projection: WarehouseActionProjection | null
}) {
  return (
    <section className="warehouse-action-controls" aria-label="驱动盘建议与筛选">
      <form
        className="warehouse-analysis-filters"
        aria-label="驱动盘筛选"
        onSubmit={(event) => event.preventDefault()}
      >
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
              .filter((id) => availableMainStats.has(id as (typeof data.discs)[number]['mainStat']))
              .map((id) => (
                <option key={id} value={id}>
                  {getPublicStatLabel(id)}
                </option>
              ))}
          </PlayerSelect>
        </label>
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
          排序
          <PlayerSelect
            aria-label="排序方式"
            value={filters.sort}
            onChange={(value) =>
              updateFilters((current) => ({ ...current, sort: value as FilterState['sort'] }))
            }
          >
            <option value="game">游戏顺序</option>
            <option value="catalog">套装号位</option>
            <option value="level">强化等级</option>
            {filters.action === 'enhance' ? <option value="development">培养优先</option> : null}
          </PlayerSelect>
        </label>
        <label>
          适用角色
          <PlayerSelect
            aria-label="适用角色"
            disabled={!projection}
            value={filters.fit}
            onChange={(value) => updateFilters((current) => ({ ...current, fit: value }))}
          >
            <option value="">全部角色</option>
            {sortCompatibleAgentsForPicker(compatibleAgentIds, ownedAgentIds).map((agentId) => (
              <option key={agentId} value={agentId}>
                {readableAgentName(agentId)}
                {ownedAgentIds.has(agentId) ? ' · 已拥有' : ' · 未拥有'}
              </option>
            ))}
          </PlayerSelect>
        </label>
        <label>
          方案使用
          <PlayerSelect
            aria-label="方案使用"
            disabled={!projection}
            value={filters.referenced}
            onChange={(value) =>
              updateFilters((current) => ({
                ...current,
                referenced: value as FilterState['referenced'],
              }))
            }
          >
            <option value="all">全部</option>
            <option value="yes">已用于方案</option>
            <option value="no">未用于方案</option>
          </PlayerSelect>
        </label>
      </form>
      {filters.level !== '' || filters.referenced !== 'all' ? (
        <div className="warehouse-active-filters" role="group" aria-label="已启用的更多筛选">
          <span>已启用</span>
          {filters.level !== '' ? (
            <button
              className="button button--quiet"
              type="button"
              aria-label={`取消强化等级 +${filters.level} 筛选`}
              onClick={() => updateFilters((current) => ({ ...current, level: '' }))}
            >
              强化等级 +{filters.level}
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
          {filters.referenced !== 'all' ? (
            <button
              className="button button--quiet"
              type="button"
              aria-label="取消方案使用筛选"
              onClick={() => updateFilters((current) => ({ ...current, referenced: 'all' }))}
            >
              {filters.referenced === 'yes' ? '已用于方案' : '未用于方案'}
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
