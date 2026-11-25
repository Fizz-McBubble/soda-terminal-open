import assert from 'node:assert/strict'
import defaultEqualResultReview from '../src/gameDataPacks/data/team-rating-reviewed-equal-results.3.3.json' with { type: 'json' }

// Select among already admitted, fully rated plays offline. The player only
// matches the resulting play ID; this does not search or calculate a battle.
export function buildGraduatedDefaultPlays(
  index,
  admission,
  reviewed,
  equalResultReview = defaultEqualResultReview,
) {
  assert.equal(index.catalogHash, admission.catalog)
  assert.equal(index.gameVersion, admission.gameVersion)
  const allowed = new Map(admission.rows.map(row => [row[0], new Set(row[2])]))
  const byTeam = new Map()
  for (const row of index.rows) {
    if (!allowed.get(row.members)?.has(row.playId)) continue
    const previous = byTeam.get(row.members)
    if (!previous || row.group < previous.group) byTeam.set(row.members, row)
  }
  // An exact reviewed tie applies only to the evidence that was compared. A
  // different measured play takes precedence even if its displayed score ties.
  const tied = equalResultReview.gameVersion === index.gameVersion ? equalResultReview.entries : []
  for (const { members, preferred, equivalent } of tied) {
    const key = [...members].sort().join('|')
    const current = byTeam.get(key)
    if (current?.playId !== equivalent.playId || current.evidence !== equivalent.evidence) continue
    const chosen = index.rows.find((row) => row.members === key && row.playId === preferred.playId)
    if (
      chosen &&
      chosen.evidence === preferred.evidence &&
      chosen.group === current.group &&
      chosen.score === current.score &&
      allowed.get(key)?.has(chosen.playId)
    )
      byTeam.set(key, chosen)
  }
  for (const entry of reviewed.entries) {
    const members = [...entry.members].sort().join('|')
    const row = index.rows.find(row => row.playId === entry.playId && row.members === members)
    if (row && allowed.get(members)?.has(row.playId)) byTeam.set(members, row)
  }
  return [...byTeam].map(([members, row]) => ({ members, playId: row.playId }))
}
