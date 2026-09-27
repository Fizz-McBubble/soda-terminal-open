import type { GoldenTop10Data, LoadoutRow } from './types'
import { formatStat } from './top10Labels'

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
  const title = data.statPresentation === 'static_panel' ? '属性对比' : '副词条合计'
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
      <div
        className={`comparison-stat-table${baselineAvailable ? '' : ' is-candidate-only'}`}
        role="table"
        aria-label={title}
      >
        {[0, 1].map((column) => (
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
            {data.allStats
              .filter((_, index) => index % 2 === column)
              .map((stat) => {
                const current = data.baseline.finalStats[stat.key] ?? 0
                const candidate = selectedRow?.finalStats[stat.key] ?? 0
                const delta = candidate - current
                return (
                  <div role="row" key={stat.key} className={stat.highlight ? 'is-priority' : ''}>
                    <strong role="cell" aria-label={stat.label}>
                      {stat.label}
                      {data.statPresentation !== 'disc_contribution' && stat.target ? (
                        <small className="comparison-priority-label">毕业参考 {stat.target}</small>
                      ) : stat.highlight ? (
                        <small className="comparison-priority-label">重点</small>
                      ) : null}
                    </strong>
                    {baselineAvailable ? (
                      <>
                        <span role="cell">{formatStat(current, stat.unit)}</span>
                        <b role="cell">{delta === 0 ? '—' : formatStat(delta, stat.unit, true)}</b>
                      </>
                    ) : null}
                    <span role="cell">{formatStat(candidate, stat.unit)}</span>
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </section>
  )
}
