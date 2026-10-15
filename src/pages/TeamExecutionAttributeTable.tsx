import type { TeamExecutionAttributeRow } from './teamExecutionAttributePanel'

/** The same values and column semantics serve the summary and its local popover. */
export function TeamExecutionAttributeTable({
  rows,
  label,
  accountLabel,
  proposedLabel,
  hasFinalPanel,
  showAccount = true,
}: {
  rows: readonly TeamExecutionAttributeRow[]
  label: string
  accountLabel: string
  proposedLabel: string
  hasFinalPanel: boolean
  showAccount?: boolean
}) {
  return (
    <div
      className={`team-execution__attribute-table values-only${showAccount ? '' : ' without-account'}`}
      role="table"
      aria-label={label}
    >
      <div className="team-execution__attribute-row is-heading" role="row">
        <span role="columnheader">属性</span>
        {showAccount ? <span role="columnheader">{accountLabel}</span> : null}
        <span role="columnheader">{proposedLabel}</span>
      </div>
      {rows.map((row) => (
        <div
          className={`team-execution__attribute-row${row.isPriority ? ' is-priority' : ''}${row.isBelowTarget ? ' is-below-target' : ''}`}
          key={row.key ?? row.label}
          role="row"
        >
          <strong role="cell">{row.label}</strong>
          {showAccount ? (
            <span role="cell">{row.outOfCombatStatus === 'missing' ? '—' : row.outOfCombat}</span>
          ) : null}
          <span role="cell" className="team-execution__attribute-proposed">
            {hasFinalPanel
              ? row.currentStatus === 'missing'
                ? '—'
                : row.current
              : row.contribution === '无可证副词条'
                ? '—'
                : row.contribution}
          </span>
        </div>
      ))}
    </div>
  )
}
