import { useId, useState } from 'react'
import {
  formatCharacterPanelValue,
  isCharacterPanelDetailRelevant,
} from '../../application/characterPanelFields'
import type { GoldenTop10Data, LoadoutRow } from './types'
import { formatStat } from './top10Labels'
import { staticPanelTargetDisplay } from '../../gameDataPacks/targetPanelSemantics'

type Top10StatTableProps = {
  data: GoldenTop10Data
  selectedRow?: LoadoutRow
  baselineAvailable: boolean
  baselineLabel: string
}

export function Top10StatTable(props: Top10StatTableProps) {
  // Expansion belongs to this account/agent view, independently of the compared loadouts.
  const scope = props.data.panelScopeKey ?? props.data.agentName
  return <ComparisonStatTable key={scope} {...props} />
}

function ComparisonStatTable({
  data,
  selectedRow,
  baselineAvailable,
  baselineLabel,
}: Top10StatTableProps) {
  const [expanded, setExpanded] = useState(false)
  const tableId = useId()
  const detailsId = useId()
  const known = (value: number | undefined): value is number =>
    value !== undefined && Number.isFinite(value)
  const changed = (key: string) => {
    const before = data.baseline.finalStats[key]
    const after = selectedRow?.finalStats[key]
    return baselineAvailable && known(before) && known(after) && before !== after
  }
  const visibleStats = data.allStats.filter(
    (stat) => data.statPresentation !== 'static_panel' || !stat.detail || changed(stat.key),
  )
  const visibleKeys = new Set(visibleStats.map((stat) => stat.key))
  const detailStats = data.allStats.filter((stat) => {
    if (data.statPresentation !== 'static_panel' || visibleKeys.has(stat.key)) return false
    const current = data.baseline.finalStats[stat.key]
    const candidate = selectedRow?.finalStats[stat.key]
    return isCharacterPanelDetailRelevant(stat, candidate, baselineAvailable ? current : undefined)
  })
  const groups = [
    { key: 'primary', label: '基础与战斗' },
    { key: 'supplementary', label: '辅助属性' },
    { key: 'resource', label: '资源与循环' },
  ] as const
  const hasDetails = detailStats.length > 0
  const valueText = (stat: GoldenTop10Data['allStats'][number], value: number | undefined) =>
    !known(value)
      ? '—'
      : data.statPresentation === 'static_panel'
        ? formatStat(Number.parseFloat(formatCharacterPanelValue(stat, value)), stat.unit)
        : formatStat(value, stat.unit)
  const title = data.statPresentation === 'static_panel' ? '属性对比' : '副词条合计'
  const renderTable = (
    stats: GoldenTop10Data['allStats'],
    details = false,
    label: string = title,
  ) => (
    <div
      id={details ? undefined : tableId}
      className={`comparison-stat-table${baselineAvailable ? '' : ' is-candidate-only'}`}
      role="table"
      aria-label={label}
    >
      {(details ? [0] : [0, 1]).map((column) => (
        <div role="rowgroup" key={column}>
          <div role="row" className="comparison-stat-table__head">
            <span role="columnheader">属性</span>
            {baselineAvailable ? (
              <>
                <span role="columnheader">{baselineLabel}</span>
                <span role="columnheader">变化</span>
              </>
            ) : null}
            <span role="columnheader">方案</span>
          </div>
          {stats
            .filter((_, index) => details || index % 2 === column)
            .map((stat) => {
              const current = data.baseline.finalStats[stat.key]
              const candidate = selectedRow?.finalStats[stat.key]
              const delta =
                baselineAvailable && known(candidate) && known(current)
                  ? candidate - current
                  : undefined
              const target = staticPanelTargetDisplay(stat.target)
              return (
                <div
                  role="row"
                  key={stat.key}
                  className={[
                    stat.highlight ? 'is-priority' : '',
                    delta !== undefined && delta !== 0 ? 'is-changed' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <strong role="cell" aria-label={stat.label}>
                    {stat.label}
                    {data.statPresentation !== 'disc_contribution' && target ? (
                      <small className="comparison-priority-label">毕业推荐 {target}</small>
                    ) : stat.highlight ? (
                      <small className="comparison-priority-label">毕业推荐</small>
                    ) : null}
                  </strong>
                  {baselineAvailable ? (
                    <>
                      <span role="cell">{valueText(stat, current)}</span>
                      <b role="cell" className="comparison-stat-delta">
                        {delta === undefined || delta === 0
                          ? '—'
                          : formatStat(delta, stat.unit, true)}
                      </b>
                    </>
                  ) : null}
                  <span role="cell">{valueText(stat, candidate)}</span>
                </div>
              )
            })}
        </div>
      ))}
    </div>
  )
  return (
    <section
      className="comparison-stats"
      aria-label={data.statPresentation === 'static_panel' ? title : undefined}
      aria-labelledby={
        data.statPresentation === 'static_panel' ? undefined : 'comparison-stats-title'
      }
    >
      {data.statPresentation !== 'static_panel' ? (
        <header>
          <div>
            <h2 id="comparison-stats-title">{title}</h2>
            <p>六张驱动盘的副词条合计，不含主词条和套装效果。</p>
          </div>
        </header>
      ) : null}
      {data.statPresentation === 'static_panel' ? (
        <header className="comparison-stats__attributes-header">
          <h2>{title}</h2>
          {hasDetails ? (
            <button
              type="button"
              aria-controls={detailsId}
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? '收起完整面板' : '查看完整面板'}
            </button>
          ) : null}
        </header>
      ) : null}
      {renderTable(visibleStats)}
      {hasDetails ? (
        <div
          id={detailsId}
          className="comparison-stats__expanded"
          hidden={!expanded}
          role="region"
          aria-label="完整属性对比"
        >
          {groups.map((group) => {
            const stats = detailStats.filter(
              (stat) => (stat.group ?? 'supplementary') === group.key,
            )
            return stats.length ? (
              <section key={group.key} className="comparison-stats__group" aria-label={group.label}>
                <h3>{group.label}</h3>
                {renderTable(stats, true, `${group.label}对比`)}
              </section>
            ) : null
          })}
        </div>
      ) : null}
    </section>
  )
}
