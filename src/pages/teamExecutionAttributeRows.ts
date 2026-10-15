import type { TeamExecutionAttributeRow } from './teamExecutionAttributePanel'
import { isCharacterPanelDetailRelevant } from '../application/characterPanelFields'

export function detailedTeamAttributeRows(rows: readonly TeamExecutionAttributeRow[]) {
  return rows.filter((row) =>
    isCharacterPanelDetailRelevant(
      { key: row.key ?? '', detail: row.detail, group: row.group },
      row.currentStatus === 'missing' ? undefined : row.currentValue,
      row.outOfCombatStatus === 'missing' ? undefined : row.outOfCombatValue,
    ),
  )
}

/** Compare unrounded, known values; an unknown value is never a change from zero. */
export function visibleTeamAttributeRows(rows: readonly TeamExecutionAttributeRow[]) {
  return rows.filter(
    (row) =>
      !row.detail ||
      (row.outOfCombatStatus !== 'missing' &&
        row.currentStatus !== 'missing' &&
        row.outOfCombatValue !== undefined &&
        row.currentValue !== undefined &&
        Number.isFinite(row.outOfCombatValue) &&
        Number.isFinite(row.currentValue) &&
        row.outOfCombatValue !== row.currentValue),
  )
}
