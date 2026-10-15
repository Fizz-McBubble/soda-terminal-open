import { useId } from 'react'
import { ExplanationPopover } from '../../components/ExplanationPopover'
import { formatCharacterPanelValue } from '../../application/characterPanelFields'
import type { GoldenTop10Data, LoadoutRow } from './types'
import { formatStat } from './top10Labels'
import { staticPanelTargetDisplay } from '../../gameDataPacks/targetPanelSemantics'

export function Top10StatTable({
  data,
  selectedRow,
  baselineAvailable,
  baselineLabel,
}: {
  data: GoldenTop10Data
  selectedRow?: LoadoutRow
  baselineAvailable: boolean
  baselineLabel: string
}) {
  const scope = data.panelScopeKey ?? data.agentName
  const tableId = useId()
  const known = (value: number | undefined): value is number =>
    value !== undefined && Number.isFinite(value)
  const changed = (key: string) => {
    const before = data.baseline.finalStats[key]
    const after = selectedRow?.finalStats[key]
    return baselineAvailable && known(before) && known(after) && before !== after
  }
  const hasDetails =
    data.statPresentation === 'static_panel' && data.allStats.some((stat) => stat.detail)
  const visibleStats = data.allStats.filter(
    (stat) => data.statPresentation !== 'static_panel' || !stat.detail || changed(stat.key),
  )
  const valueText = (stat: GoldenTop10Data['allStats'][number], value: number | undefined) =>
    !known(value)
      ? '—'
      : data.statPresentation === 'static_panel'
        ? formatStat(Number.parseFloat(formatCharacterPanelValue(stat, value)), stat.unit)
        : formatStat(value, stat.unit)
  const title = data.statPresentation === 'static_panel' ? '属性对比' : '副词条合计'
  const renderTable = (stats: GoldenTop10Data['allStats'], details = false) => (
    <div
      id={details ? undefined : tableId}
      className={`comparison-stat-table${baselineAvailable ? '' : ' is-candidate-only'}${details ? ' character-panel-more__comparison' : ''}`}
      role="table"
      aria-label={details ? '完整属性对比' : title}
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
              const delta = known(candidate) && known(current) ? candidate - current : undefined
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
                      <small className="comparison-priority-label">参考 {target}</small>
                    ) : stat.highlight ? (
                      <small className="comparison-priority-label">参考</small>
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
      {hasDetails ? (
        <header className="comparison-stats__attributes-header">
          <h2>{title}</h2>
          <ExplanationPopover
            key={scope}
            className="character-panel-more character-panel-more--comparison"
            label="查看完整面板"
            title="完整属性对比"
            closeLabel="关闭完整面板"
          >
            {renderTable(data.allStats, true)}
          </ExplanationPopover>
        </header>
      ) : null}
      {renderTable(visibleStats)}
    </section>
  )
}
