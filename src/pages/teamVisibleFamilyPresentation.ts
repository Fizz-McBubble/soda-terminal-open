import { matchesAgentSearchQuery } from '../application/agentSearchAliases'
import { getAgentName } from '../application/publicRosterNames'
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

function matchesRecommendedTeam(family: TeamLoadoutOverviewFamily, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true
  if (family.title.toLocaleLowerCase().includes(normalizedQuery)) return true
  const agentIds = new Set([
    ...family.coreAgentIds,
    ...family.variants.flatMap((variant) => variant.agentIds),
  ])
  return [...agentIds].some((agentId) =>
    matchesAgentSearchQuery(agentId, getAgentName(agentId), normalizedQuery),
  )
}

export function matchRecommendedVariants(family: TeamLoadoutOverviewFamily, queryText: string) {
  if (!matchesRecommendedTeam(family, queryText)) return []
  const query = queryText.trim().toLocaleLowerCase()
  if (!query) return [family]
  const matchingVariants = family.variants.filter(
    (variant) =>
      variant.title.toLocaleLowerCase().includes(query) ||
      variant.agentIds.some((agentId) =>
        matchesAgentSearchQuery(agentId, getAgentName(agentId), query),
      ),
  )
  // A family-name search keeps all alternatives; a member search opens the
  // matching trio, rather than an unrelated remembered alternative.
  return matchingVariants.length && matchingVariants.length !== family.variants.length
    ? [rebuildVisibleFamily(family, matchingVariants)]
    : [family]
}
