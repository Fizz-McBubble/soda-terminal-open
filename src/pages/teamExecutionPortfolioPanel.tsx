import type { TeamExecutionPortfolioStatus } from './teamExecutionPortfolioPresentation'
import { statusIcon } from './teamExecutionStatusIcons'

/** Player-facing readiness summary for a multi-team projection; shared markup for both builds. */
export type TeamExecutionPortfolioSummaryView = {
  status: TeamExecutionPortfolioStatus
  statusLabel: string
  headline: string
  equipmentLine: string
  blockers: string[]
}

export function TeamExecutionPortfolioSummary({
  view,
}: {
  view: TeamExecutionPortfolioSummaryView
}) {
  const StatusIcon = statusIcon[view.status]
  return (
    <section
      className={`team-execution-portfolio is-${view.status}`}
      aria-labelledby="team-execution-portfolio-title"
    >
      <StatusIcon aria-hidden="true" size={22} />
      <div>
        <p className="team-execution__state">{view.statusLabel}</p>
        <h2 id="team-execution-portfolio-title">{view.headline}</h2>
        <p>{view.equipmentLine}</p>
        {view.blockers.length ? (
          <details>
            <summary>查看还需处理的 {view.blockers.length} 项</summary>
            <ul>
              {view.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  )
}
