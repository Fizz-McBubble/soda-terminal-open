import type { DriveDisc } from '../domain/schemas'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'

const recommendedSlots = [4, 5, 6] as const

/**
 * Explains only recorded main-stat differences from the same candidate constraint
 * used by the warehouse matcher. It neither scores discs nor treats a difference
 * as an unavailable warehouse item.
 */
export function candidateMainStatDifferences(
  agentId: string,
  discs: readonly DriveDisc[],
): string[] {
  const constraint = getCandidateWarehouseConstraint(agentId)
  if (!constraint) return []

  return recommendedSlots.flatMap((slot) => {
    const recommended = constraint.mainStats[String(slot) as '4' | '5' | '6']
    const actual = discs.find((disc) => disc.slot === slot)?.mainStat
    if (!actual || !recommended?.length || recommended.includes(actual)) return []

    const [actualLabel] = getCandidateStatLabels([actual], '主词条')
    const recommendedLabel = getCandidateStatLabels(recommended, '主词条').join('或')
    return [`${slot}号位：${actualLabel}（建议${recommendedLabel}）`]
  })
}
