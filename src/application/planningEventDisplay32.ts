import data from './planningEventDisplay32.data.json'
import { agentCatalog } from './publicRosterNames'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'

type Display = {
  action: string
  parameter: string
  sourceRow: number
  rowCount: number
  kind: string
}
const actors: Readonly<Record<string, { events: Readonly<Record<string, Display>> }>> = data.actors

const evidenceIds = new Map([
  ...agentCatalog.map(([id, , , evidenceId]) => [id, evidenceId] as const),
  ...currentReleasedIdentityMap.entries
    .filter((row) => row.stableId.startsWith('agent-'))
    .map((row) => [row.stableId, row.gameEvidenceId] as const),
])

/** Display names do not change or re-sign the calculation vocabulary. */
export function planningEventDisplayLabel32(ownerAgentId: string, eventId: string) {
  const actor = actors[evidenceIds.get(ownerAgentId) ?? '']
  const event = actor?.events[eventId]
  if (!event) return null
  const row = event
  return `${row.kind === 'formula_term' ? '公式项：' : ''}${row.action}${row.parameter ? ` · ${row.parameter}` : row.rowCount > 1 ? ` · 来源倍率项 ${row.sourceRow}` : ''}`
}
