import assert from 'node:assert/strict'

// Select among already admitted, fully rated plays offline. The player only
// matches the resulting play ID; this does not search or calculate a battle.
export function buildGraduatedDefaultPlays(index, admission, reviewed) {
  assert.equal(index.catalogHash, admission.catalog)
  assert.equal(index.gameVersion, admission.gameVersion)
  const allowed = new Map(admission.rows.map(row => [row[0], new Set(row[2])]))
  const byTeam = new Map()
  for (const row of index.rows) {
    if (!allowed.get(row.members)?.has(row.playId)) continue
    const previous = byTeam.get(row.members)
    if (!previous || row.group < previous.group) byTeam.set(row.members, row)
  }
  for (const entry of reviewed.entries) {
    const members = [...entry.members].sort().join('|')
    const row = index.rows.find(row => row.playId === entry.playId && row.members === members)
    if (row && allowed.get(members)?.has(row.playId)) byTeam.set(members, row)
  }
  return [...byTeam].map(([members, row]) => ({ members, playId: row.playId }))
}
