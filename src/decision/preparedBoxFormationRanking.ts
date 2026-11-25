import prepared from '../gameDataPacks/generated/box-default-formation-ranks.3.3.json'
import type { CurrentPlayRanking } from './teamGraduatedRankingProjection'

const positions = new Map(prepared.agentIds.map((id, index) => [id, index]))
const rows = new Map(prepared.formations.map((row) => [row[0], row]))
const templates = prepared.templates as unknown as readonly (CurrentPlayRanking | null)[]
const bangbooShortlists: readonly (readonly string[])[] | undefined =
  'bangbooShortlists' in prepared && Array.isArray(prepared.bangbooShortlists)
    ? (prepared.bangbooShortlists as readonly (readonly string[])[])
    : undefined
const agentCount = positions.size

function freezeTemplate(value: unknown) {
  if (!value || typeof value !== 'object') return
  for (const child of Object.values(value)) freezeTemplate(child)
  Object.freeze(value)
}

templates.forEach(freezeTemplate)

function formationRowKey(memberIds: readonly string[]): number {
  if (memberIds.length !== 3) return -1
  let a = positions.get(memberIds[0]!) ?? -1
  let b = positions.get(memberIds[1]!) ?? -1
  let c = positions.get(memberIds[2]!) ?? -1
  if (a < 0 || b < 0 || c < 0) return -1
  if (a > b) [a, b] = [b, a]
  if (b > c) [b, c] = [c, b]
  if (a > b) [a, b] = [b, a]
  if (a === b || b === c) return -1
  return a * agentCount * agentCount + b * agentCount + c
}

/** O(1) lookup for precomputed activation-only Bangboo alternatives bound to the current catalog. */
export function preparedBoxBangbooAlternatives(
  memberIds: readonly string[],
  catalogHash: string | null,
): string[] | undefined {
  if (!bangbooShortlists || catalogHash !== prepared.catalog) return undefined
  const key = formationRowKey(memberIds)
  if (key < 0) return undefined
  const row = rows.get(key) as readonly (number | null)[] | undefined
  const index = row?.[3]
  if (typeof index !== 'number') return undefined
  const list = bangbooShortlists[index]
  return list ? [...list] : undefined
}

/** Undefined requests the canonical reader. Null is a recorded unavailable ranking. */
export function preparedBoxFormationRanking(
  memberIds: readonly string[],
  catalogHash: string | null,
) {
  const ranking = readSharedPreparedBoxFormationRanking(memberIds, catalogHash)
  return ranking && structuredClone(ranking)
}

/** Internal ranking projection may borrow frozen template fields. */
export function readSharedPreparedBoxFormationRanking(
  memberIds: readonly string[],
  catalogHash: string | null,
) {
  if (catalogHash !== prepared.catalog) return undefined
  const key = formationRowKey(memberIds)
  if (key < 0) return undefined
  const row = rows.get(key)
  if (!row || row[1] == null) return undefined
  const template = templates[row[1]]
  if (!template) return template
  if (template.genericOrder && row[2] != null) {
    return {
      ...template,
      genericOrder: { ...template.genericOrder, displayOrder: row[2] },
    }
  }
  return template
}
