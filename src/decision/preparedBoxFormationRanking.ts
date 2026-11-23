import prepared from '../gameDataPacks/generated/box-default-formation-ranks.3.3.json'
import type { CurrentPlayRanking } from './teamGraduatedRankingProjection'

const positions = new Map(prepared.agentIds.map((id, index) => [id, index]))
const rows = new Map(prepared.formations.map((row) => [row[0], row]))
const templates = prepared.templates as unknown as readonly (CurrentPlayRanking | null)[]

/** Undefined requests the canonical reader. Null is a recorded unavailable ranking. */
export function preparedBoxFormationRanking(
  memberIds: readonly string[],
  catalogHash: string | null,
) {
  if (catalogHash !== prepared.catalog || memberIds.length !== 3) return undefined
  const indices = memberIds.map((id) => positions.get(id) ?? -1).sort((a, b) => a - b)
  const [a, b, c] = indices as [number, number, number]
  if (a < 0 || a === b || b === c) return undefined
  const count = positions.size
  const row = rows.get(a * count * count + b * count + c)
  if (!row || row[1] == null) return undefined
  const template = templates[row[1]]
  if (!template) return template
  const ranking = structuredClone(template)
  if (ranking.genericOrder && row[2] != null) ranking.genericOrder.displayOrder = row[2]
  return ranking
}
