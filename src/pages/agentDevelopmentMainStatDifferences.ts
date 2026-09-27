import type { DriveDisc } from '../domain/schemas'
import { getCandidateStatLabels } from '../application/publicCandidateLabels'

/** Compare recorded values against targets supplied by the private Query. */
export function agentDevelopmentMainStatDifferences(
  recommendedMainStats: Record<'4' | '5' | '6', readonly string[]>,
  discs: readonly DriveDisc[],
) {
  return ([4, 5, 6] as const).flatMap((slot) => {
    const recommended = recommendedMainStats[String(slot) as '4' | '5' | '6']
    const actual = discs.find((disc) => disc.slot === slot)?.mainStat
    if (!actual || !recommended.length || recommended.includes(actual)) return []
    const [actualLabel] = getCandidateStatLabels([actual], '主词条')
    const recommendedLabel = getCandidateStatLabels([...recommended], '主词条').join('或')
    return [`${slot}号位：${actualLabel}（建议${recommendedLabel}）`]
  })
}
