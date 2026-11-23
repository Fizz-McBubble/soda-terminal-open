import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { orderRankedTeamItems, orderTeamRecommendations } from './teamRecommendationOrdering'

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

/** Order by the displayed variant, or the strongest visible variant when none is selected. */
export function orderVisibleFamilies(
  families: readonly TeamLoadoutOverviewFamily[],
  activeVariants: Readonly<Record<string, string>> = {},
) {
  const ranked = families.map((family) => ({
    family,
    strongest:
      family.variants.find((item) => item.id === activeVariants[family.id]) ??
      orderTeamRecommendations(family.variants)[0]!,
  }))
  const familyByStrongest = new Map(ranked.map((entry) => [entry.strongest, entry.family]))
  return orderRankedTeamItems(ranked.map((entry) => entry.strongest)).map(
    (strongest) => familyByStrongest.get(strongest)!,
  )
}
