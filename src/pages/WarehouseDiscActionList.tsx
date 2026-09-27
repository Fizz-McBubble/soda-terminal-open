import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Archive } from 'lucide-react'
import { VisualEntityImage } from '../components/VisualEntityImage'
import {
  warehouseActionLabels,
  type WarehouseActionItem,
} from '../application/warehouseActionContract'
import type { DriveDisc } from '../domain/schemas'
import { warehouseDevelopmentAction } from '../application/warehouseDevelopmentPresentation'
import { readablePhysicalDiscLabel, readableSetName, statLabel } from './warehouseFactLabels'
import { projectWarehouseActionListJoin } from './warehouseActionListJoin'
import { WarehouseUsedAgents } from './WarehouseUsedAgents'
import { substatLines } from './warehouseDiscPresentation'

export function WarehouseDiscActionList({
  actionList,
  listBodyRef,
  setScrollTop,
  rowHeight,
  firstVisible,
  windowed,
  selectedItem,
  data,
  selectDisc,
  selectionNotice,
  sameKindContext,
}: {
  actionList: ReturnType<typeof projectWarehouseActionListJoin>
  listBodyRef: RefObject<HTMLDivElement | null>
  setScrollTop: (value: number) => void
  rowHeight: number
  firstVisible: number
  windowed: ReturnType<typeof projectWarehouseActionListJoin>['rows']
  selectedItem: WarehouseActionItem | null
  data: { discs: DriveDisc[] }
  selectDisc: (id: string) => void
  selectionNotice?: string
  sameKindContext?: { label: string; onReturn: () => void }
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const pendingFocusIndex = useRef<number | null>(null)
  const firstRenderedIndex = firstVisible
  const lastRenderedIndex = firstVisible + windowed.length - 1
  const tabStopIndex =
    activeIndex >= firstRenderedIndex && activeIndex <= lastRenderedIndex
      ? activeIndex
      : firstRenderedIndex

  useLayoutEffect(() => {
    const index = pendingFocusIndex.current
    if (index === null) return
    const row = listBodyRef.current?.querySelector<HTMLButtonElement>(
      `.warehouse-action-row[data-row-index="${index}"]`,
    )
    if (!row) return
    row.focus({ preventScroll: true })
    pendingFocusIndex.current = null
  }, [activeIndex, firstVisible, listBodyRef, windowed])

  function moveKeyboardFocus(index: number) {
    const bounded = Math.max(0, Math.min(index, actionList.rows.length - 1))
    if (bounded === activeIndex && pendingFocusIndex.current === null) return
    pendingFocusIndex.current = bounded
    setActiveIndex(bounded)
    const list = listBodyRef.current
    if (!list) return
    const rowTop = bounded * rowHeight
    const rowBottom = rowTop + rowHeight
    if (rowTop < list.scrollTop || rowBottom > list.scrollTop + list.clientHeight) {
      const nextScrollTop = rowTop < list.scrollTop ? rowTop : rowBottom - list.clientHeight
      list.scrollTop = nextScrollTop
      setScrollTop(nextScrollTop)
    }
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const destination =
      event.key === 'ArrowDown'
        ? index + 1
        : event.key === 'ArrowUp'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? actionList.rows.length - 1
              : null
    if (destination === null) return
    event.preventDefault()
    moveKeyboardFocus(destination)
  }

  return (
    <section
      className="warehouse-action-list"
      aria-label="当前账户驱动盘行动列表"
      aria-describedby="warehouse-action-list-keyboard-help"
    >
      <p className="visually-hidden" id="warehouse-action-list-keyboard-help">
        在驱动盘列表中使用上下方向键逐张浏览，Home 和 End 跳转首尾，按 Enter 查看详情。
      </p>
      <div className="warehouse-action-list__header">
        <span className="warehouse-action-list__result">
          <span>驱动盘 · {actionList.rows.length} 张</span>
          {sameKindContext ? (
            <button className="text-action" type="button" onClick={sameKindContext.onReturn}>
              返回原筛选
            </button>
          ) : null}
        </span>
        <span>词条</span>
        <span>使用情况</span>
        <span>建议</span>
      </div>
      <div
        className="warehouse-action-list__body"
        ref={listBodyRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {selectionNotice ? (
          <p className="warehouse-action-list__selection-notice" role="status">
            {selectionNotice}
          </p>
        ) : null}
        {actionList.missingRecords.length ? (
          <section className="warehouse-action-list__missing-records" role="status">
            <strong>{actionList.missingRecords.length} 条旧分析已找不到对应驱动盘</strong>
            <p>这些记录暂未列入列表，请重新分析以更新结果。</p>
          </section>
        ) : null}
        {actionList.rows.length ? (
          <div
            className="warehouse-action-list__spacer"
            style={{ height: actionList.rows.length * rowHeight }}
          >
            <div
              className="warehouse-action-list__window"
              style={{ transform: `translateY(${firstVisible * rowHeight}px)` }}
            >
              {windowed.map(({ item, disc }, windowIndex) => {
                const rowIndex = firstVisible + windowIndex
                const stale = item.recommendationState === 'stale'
                const referenced =
                  item.affectedPlans.length > 0 ||
                  item.statuses.some((status) =>
                    [
                      'active_plan_reference',
                      'saved_plan_reference',
                      'selected_portfolio_reference',
                    ].includes(status),
                  )
                const categoryLabel =
                  item.action === 'cleanup' ? '清理候选' : warehouseActionLabels[item.action]
                const actionSummary =
                  item.action === 'enhance' && item.developmentAdvice
                    ? warehouseDevelopmentAction(item.developmentAdvice)
                    : null
                return (
                  <button
                    key={item.disc.id}
                    data-row-index={rowIndex}
                    className={`warehouse-action-row warehouse-action-row--${item.action}${stale ? ' is-stale' : ''}${selectedItem?.disc.id === item.disc.id ? ' is-selected' : ''}`}
                    type="button"
                    tabIndex={rowIndex === tabStopIndex ? 0 : -1}
                    aria-pressed={selectedItem?.disc.id === item.disc.id}
                    aria-label={`第 ${rowIndex + 1} / ${actionList.rows.length} 张，查看 ${readablePhysicalDiscLabel(disc, data.discs)}详情，${stale ? '旧结果待重新分析' : categoryLabel}`}
                    aria-describedby={
                      rowIndex === tabStopIndex ? 'warehouse-action-list-keyboard-help' : undefined
                    }
                    onFocus={() => setActiveIndex(rowIndex)}
                    onKeyDown={(event) => onRowKeyDown(event, rowIndex)}
                    onClick={() => {
                      setActiveIndex(rowIndex)
                      selectDisc(item.disc.id)
                    }}
                  >
                    <span className="warehouse-action-row__identity">
                      <VisualEntityImage
                        className="warehouse-action-row__image"
                        entityId={disc.setId}
                        entityType="drive_disc_set"
                        name={readableSetName(disc.setId)}
                        slotId="drive-disc-set.icon"
                        consumer="warehouse.action-list"
                      />
                      <span>
                        <strong>{readableSetName(disc.setId)}</strong>
                        <small>
                          {disc.slot} 号位 · +{disc.level}
                        </small>
                      </span>
                    </span>
                    <span className="warehouse-action-row__stats">
                      <strong>{statLabel(disc.mainStat)}</strong>
                      <span className="warehouse-action-row__substats">
                        {substatLines(disc).map((line, index) => (
                          <small key={index}>{line}</small>
                        ))}
                      </span>
                    </span>
                    <span className="warehouse-action-row__relations">
                      <WarehouseUsedAgents agentIds={item.usageAgentIds} maxVisible={2} />
                      {!item.usageAgentIds.length ? (
                        <small>{referenced ? '方案引用' : '暂无使用'}</small>
                      ) : null}
                    </span>
                    <span className="warehouse-action-row__advice">
                      <em
                        className={`warehouse-action-badge warehouse-action-badge--${item.action}`}
                      >
                        {stale ? '旧结果待刷新' : categoryLabel}
                      </em>
                      {actionSummary && !stale ? (
                        <small title={actionSummary}>{actionSummary}</small>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="warehouse-action-list__empty">
            <Archive size={26} />
            <p>当前筛选下没有驱动盘。</p>
          </div>
        )}
      </div>
    </section>
  )
}
