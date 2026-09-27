import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { compareTeamRecommendations, recommendationStrengthBucket } from './teamRecommendationRank'

/** Rebuild an already calculated family after a local display filter. */
export function rebuildVisibleFamily(
  family: TeamLoadoutOverviewFamily,
  variants: TeamLoadoutOverviewItem[],
): TeamLoadoutOverviewFamily {
  const primary = variants[0]!
  const isSaved = primary.kind === 'saved'
  const title =
    variants.length > 1 && family.title !== family.variants[0]?.title ? family.title : primary.title
  return {
    ...family,
    kind: primary.kind,
    title,
    coreAgentIds: primary.coreAgentIds,
    mechanism: primary.mechanism,
    stateLabel: isSaved
      ? '已保存'
      : variants.length > 1
        ? `${primary.stateLabel} · ${variants.length} 种搭配`
        : primary.stateLabel,
    reason: isSaved
      ? primary.reason
      : variants.length > 1
        ? `同一核心有 ${variants.length} 种三人搭配，可分别查看评级与邦布建议。`
        : primary.reason,
    planningDps: primary.planningDps,
    planningDpsStatus: primary.planningDpsStatus,
    cultivationPriority: primary.cultivationPriority,
    teamRatingBand: primary.teamRatingBand,
    confidence: primary.confidence,
    outputPotentialBand: primary.outputPotentialBand,
    variants,
  }
}

/** A display filter may change a family's strongest visible variant. Reorder
 * supplied ratings, then apply only the private producer's reviewed tie links. */
export function orderVisibleFamilies(families: readonly TeamLoadoutOverviewFamily[]) {
  const ranked = families.map((family) => ({
    family,
    strongest: family.variants.reduce(
      (best, item) => (compareTeamRecommendations(item, best) < 0 ? item : best),
      family.variants[0]!,
    ),
  }))
  ranked.sort((left, right) => compareTeamRecommendations(left.strongest, right.strongest))
  const ordered: typeof ranked = []
  const keyOf = (ids: readonly string[]) => [...ids].sort().join('|')
  for (let start = 0; start < ranked.length; ) {
    const bucket = recommendationStrengthBucket(ranked[start]!.strongest)
    let end = start + 1
    while (end < ranked.length && recommendationStrengthBucket(ranked[end]!.strongest) === bucket)
      end += 1
    const pending = ranked.slice(start, end)
    while (pending.length) {
      const visibleKeys = new Set(pending.map(({ strongest }) => keyOf(strongest.agentIds)))
      const index = pending.findIndex(({ strongest }) => {
        const memberKey = keyOf(strongest.agentIds)
        return !pending.some(
          ({ strongest: other }) =>
            other.preferredOverMemberKeys?.includes(memberKey) &&
            visibleKeys.has(keyOf(other.agentIds)),
        )
      })
      ordered.push(...pending.splice(index < 0 ? 0 : index, 1))
    }
    start = end
  }
  return ordered.map(({ family }) => family)
}
