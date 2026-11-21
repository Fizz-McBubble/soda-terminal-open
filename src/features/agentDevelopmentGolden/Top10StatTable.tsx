import { useId } from 'react'
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
  const tableId = useId()
  const known = (value: number | undefined): value is number =>
    value !== undefined && Number.isFinite(value)
  const visibleStats = data.allStats.filter(
    (stat) =>
      data.statPresentation !== 'static_panel' ||
      isCharacterPanelDetailRelevant(
        stat,
        selectedRow?.finalStats[stat.key],
        baselineAvailable ? data.baseline.finalStats[stat.key] : undefined,
      ),
  )
  const valueText = (stat: GoldenTop10Data['allStats'][number], value: number | undefined) => {
    if (!known(value)) return '—'
    if (data.statPresentation !== 'static_panel') return formatStat(value, stat.unit)
    return formatCharacterPanelValue(stat, value)
  }
  const title = data.statPresentation === 'static_panel' ? '属性对比' : '副词条合计'
  const deltaText = (stat: GoldenTop10Data['allStats'][number], delta: number | undefined) => {
    if (delta === undefined) return '—'
    if (data.statPresentation !== 'static_panel') return formatStat(delta, stat.unit, true)
    const text = formatCharacterPanelValue(stat, delta, { isDelta: true })
    return `${Number.parseFloat(text) > 0 ? '+' : ''}${text}`
  }
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
                  ? data.statPresentation === 'static_panel'
                    ? Number.parseFloat(formatCharacterPanelValue(stat, candidate)) -
                      Number.parseFloat(formatCharacterPanelValue(stat, current))
                    : candidate - current
                  : undefined
              const target = staticPanelTargetDisplay(stat.target)?.trim()
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
                      <small className="comparison-priority-label">培养目标 {target}</small>
                    ) : null}
                  </strong>
                  {baselineAvailable ? (
                    <>
                      <span role="cell">{valueText(stat, current)}</span>
                      <b role="cell" className="comparison-stat-delta">
                        {deltaText(stat, delta)}
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
        </header>
      ) : null}
      {renderTable(visibleStats)}
    </section>
  )
}
