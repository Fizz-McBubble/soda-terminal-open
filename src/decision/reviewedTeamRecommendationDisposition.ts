import reviewed from '../gameDataPacks/data/reviewed-team-recommendation-dispositions.v1.json'
import nested from '../gameDataPacks/data/reviewed-team-nested-directions.3.1.json'
import images from '../gameDataPacks/data/reviewed-team-image-directions.3.1.json'
import { stableContentHash } from '../gameDataPacks/types'

const key = (ids: readonly string[]) => [...ids].sort().join('|')
const sources = new Map<string, (typeof nested.records)[number] | (typeof images.records)[number]>([
  ...nested.records.map(
    (row) => [`reviewed-team-nested-directions.3.1.json:${row.claimId}`, row] as const,
  ),
  ...images.records.map(
    (row) => [`reviewed-team-image-directions.3.1.json:${row.claimId}`, row] as const,
  ),
])
// This is an explicit review of exact source claims, not keyword inference at
// runtime. A changed claim/member/condition cannot inherit the old disposition.
const fallbackKeys = new Set(
  reviewed.records.flatMap((fact) => {
    const source = sources.get(`${fact.sourceFile}:${fact.claimId}`)
    return source &&
      stableContentHash(source) === fact.sourceRecordHash &&
      key(source.memberIds) === key(fact.memberIds) &&
      JSON.stringify(source.conditions) === JSON.stringify(fact.conditions)
      ? [key(fact.memberIds)]
      : []
  }),
)

export function isReviewedFallbackTeam(memberIds: readonly string[]) {
  return fallbackKeys.has(key(memberIds))
}
