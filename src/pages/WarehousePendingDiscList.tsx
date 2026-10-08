import {
  compareDiscCatalogOrder,
  compareDiscGameOrder,
  compareDiscLevelOrder,
} from '../domain/discOrdering'
import { useMemo, useRef, useState, useLayoutEffect, type KeyboardEvent } from 'react'
import type { DriveDisc } from '../domain/schemas'
import type { FilterState } from './warehouseDiscPresentation'
import { substatLines } from './warehouseDiscPresentation'
import { readableSetName, statLabel } from './warehouseFactLabels'
import { warehouseActionWindowSize } from './warehouseActionListConfig'
import { defaultWarehouseActionListOrder } from './warehouseActionListJoin'

/** Account facts only. No action item or provisional retention decision is created. */
export function WarehousePendingDiscList({
  discs,
  filters,
  selectedId,
  selectDisc,
}: {
  discs: DriveDisc[]
  filters: FilterState
  selectedId: string | null
  selectDisc: (id: string) => void
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const body = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<number | null>(null)
  const rows = useMemo(
    () =>
      discs
        .filter(
          (disc) =>
            (!filters.setId || disc.setId === filters.setId) &&
            (!filters.slot || String(disc.slot) === filters.slot) &&
            (!filters.mainStat || disc.mainStat === filters.mainStat) &&
            (!filters.level || String(disc.level) === filters.level),
        )
        .sort((a, b) =>
          filters.sort === 'level'
            ? compareDiscLevelOrder(a, b, defaultWarehouseActionListOrder)
            : filters.sort === 'catalog'
              ? compareDiscCatalogOrder(a, b, defaultWarehouseActionListOrder)
              : compareDiscGameOrder(a, b, defaultWarehouseActionListOrder),
        ),
    [discs, filters.setId, filters.slot, filters.mainStat, filters.level, filters.sort],
  )
  // A fixed factual row has the same geometry on desktop and narrow screens.
  const rowHeight = 112
  const first = Math.max(
    0,
    Math.min(
      Math.floor(scrollTop / rowHeight) - 4,
      Math.max(0, rows.length - warehouseActionWindowSize),
    ),
  )
  const windowed = rows.slice(first, first + warehouseActionWindowSize)
  const selected = rows.find((disc) => disc.id === selectedId) ?? rows[0]
  const tabStop =
    activeIndex >= first && activeIndex < first + windowed.length ? activeIndex : first
  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    const row = body.current?.querySelector<HTMLButtonElement>(`[data-row-index="${target}"]`)
    if (row) {
      row.focus({ preventScroll: true })
      pendingFocus.current = null
    }
  }, [first, activeIndex])
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target =
      event.key === 'ArrowDown'
        ? index + 1
        : event.key === 'ArrowUp'
          ? index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : null
    if (target === null) return
    event.preventDefault()
    const next = Math.max(0, Math.min(target, rows.length - 1))
    pendingFocus.current = next
    setActiveIndex(next)
    if (body.current) {
      const top = next * rowHeight
      if (
        top < body.current.scrollTop ||
        top + rowHeight > body.current.scrollTop + body.current.clientHeight
      ) {
        body.current.scrollTop = top
        setScrollTop(top)
      }
    }
  }
  return (
    <div className="warehouse-action-workspace warehouse-pending-workspace">
      <section
        className="warehouse-action-list warehouse-pending-list"
        aria-label="当前账户驱动盘事实列表"
      >
        <div className="warehouse-pending-list__heading">
          驱动盘 · {rows.length} 张 <span>品质与用途建议待分析</span>
        </div>
        <div
          className="warehouse-action-list__body"
          ref={body}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {rows.length ? (
            <div
              className="warehouse-action-list__spacer"
              style={{ height: rows.length * rowHeight }}
            >
              <div
                className="warehouse-action-list__window"
                style={{ transform: `translateY(${first * rowHeight}px)` }}
              >
                {windowed.map((disc, offset) => (
                  <button
                    className={`warehouse-pending-row${selected?.id === disc.id ? ' is-selected' : ''}`}
                    key={disc.id}
                    data-row-index={first + offset}
                    tabIndex={tabStop === first + offset ? 0 : -1}
                    type="button"
                    aria-pressed={selected?.id === disc.id}
                    aria-label={`第 ${first + offset + 1} / ${rows.length} 张，查看 ${readableSetName(disc.setId)} ${disc.slot} 号位详情，建议待分析`}
                    onFocus={() => setActiveIndex(first + offset)}
                    onKeyDown={(event) => keyDown(event, first + offset)}
                    onClick={() => selectDisc(disc.id)}
                  >
                    <span>
                      <strong>{readableSetName(disc.setId)}</strong>
                      <small>
                        {disc.slot} 号位 · +{disc.level}
                      </small>
                    </span>
                    <span>
                      <strong>{statLabel(disc.mainStat)}</strong>
                      <small>{substatLines(disc).join(' · ')}</small>
                    </span>
                    <em>待分析</em>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="warehouse-action-list__empty">当前筛选下没有驱动盘。</div>
          )}
        </div>
      </section>
      <aside className="warehouse-action-drawer warehouse-pending-detail">
        {selected ? (
          <>
            <h2 id="warehouse-action-drawer-title" tabIndex={-1}>
              {readableSetName(selected.setId)} · {selected.slot} 号位
            </h2>
            <p>
              强化等级 +{selected.level} · {statLabel(selected.mainStat)}
            </p>
            <ul>
              {substatLines(selected).map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
            <p>品质、用途及保留建议待分析。当前显示账户记录。</p>
          </>
        ) : (
          <p>当前筛选下没有可查看的驱动盘。</p>
        )}
      </aside>
    </div>
  )
}
