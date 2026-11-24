import type { TeamExecutionAttributeRow } from './teamExecutionAttributePanel'
import { getStatKeysForAttributeKeyOrLabel, isRowMatched } from './teamLoadoutAttributeLinkage'
import './team-loadout-team-view-foundation.css'

/** The same values and column semantics serve the summary and its local popover. */
export function TeamExecutionAttributeTable({
  rows,
  label,
  accountLabel,
  proposedLabel,
  hasFinalPanel,
  showAccount = true,
  matchedKeys,
  selectedKey,
  onSelectRow,
  onDeselect,
}: {
  rows: readonly TeamExecutionAttributeRow[]
  label: string
  accountLabel: string
  proposedLabel: string
  hasFinalPanel: boolean
  showAccount?: boolean
  matchedKeys?: ReadonlySet<string>
  selectedKey?: string | null
  onSelectRow?: (keyOrLabel: string) => void
  onDeselect?: () => void
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
      {rows.map((row) => {
        const isMatched = Boolean(matchedKeys && isRowMatched(row, matchedKeys))
        const isSelected = Boolean(
          selectedKey && (row.key === selectedKey || row.label === selectedKey),
        )
        const rowKey = row.key ?? row.label
        const isInteractive = Boolean(
          onSelectRow && getStatKeysForAttributeKeyOrLabel(rowKey).length,
        )
        return (
          <div
            className={`team-execution__attribute-row${row.isPriority ? ' is-priority' : ''}${
              row.isBelowTarget ? ' is-below-target' : ''
            }${isMatched ? ' is-matched' : ''}${isSelected ? ' is-selected' : ''}${
              isInteractive ? ' is-interactive' : ''
            }`}
            key={rowKey}
            role="row"
            data-attribute-key={rowKey}
            data-matched={isMatched ? 'true' : undefined}
            data-selected={isSelected ? 'true' : undefined}
          >
            <strong role="cell">
              {isInteractive ? (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  className="team-execution__attribute-choice"
                  onClick={() => onSelectRow?.(rowKey)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation()
                      onDeselect?.()
                    }
                  }}
                >
                  {row.label}
                </button>
              ) : (
                row.label
              )}
            </strong>
            {showAccount ? (
              <span role="cell">{row.outOfCombatStatus === 'missing' ? '—' : row.outOfCombat}</span>
            ) : null}
            <span
              role="cell"
              className="team-execution__attribute-proposed"
              data-changed={
                (showAccount &&
                  hasFinalPanel &&
                  row.outOfCombatStatus === 'exact' &&
                  row.currentStatus === 'exact' &&
                  row.outOfCombat !== row.current) ||
                undefined
              }
            >
              {hasFinalPanel
                ? row.currentStatus === 'missing'
                  ? '—'
                  : row.current
                : row.contribution === '无可证副词条'
                  ? '—'
                  : row.contribution}
            </span>
          </div>
        )
      })}
    </div>
  )
}
