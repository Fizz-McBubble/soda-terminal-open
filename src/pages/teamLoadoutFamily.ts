import { getAgentName } from '../application/publicRosterNames'
import { hasTeamSystemRankingAuthority } from '../decision/teamSystemRankingAuthority'
import { resolveTeamPresentationFamily } from './teamSourceFamilyProjection'
import { orderTeamRecommendations } from './teamRecommendationOrdering'
import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'

export function familyFromVariants(
  familyKey: string,
  variants: TeamLoadoutOverviewItem[],
): TeamLoadoutOverviewFamily {
  const hasSystemRanking = variants.some((item) =>
    hasTeamSystemRankingAuthority(item.teamSystemRanking),
  )
  const ordered = hasSystemRanking
    ? orderTeamRecommendations(variants)
    : variants.some((item) => item.kind === 'saved')
      ? [...variants].sort(
          (left, right) =>
            right.recommendationRank - left.recommendationRank || left.id.localeCompare(right.id),
        )
      : orderTeamRecommendations(variants)
  const primary = ordered[0]!
  const isSaved = primary.kind === 'saved'
  const core = resolveTeamPresentationFamily(primary.agentIds as [string, string, string])
  return {
    id: `family:${familyKey}`,
    kind: primary.kind,
    title:
      !isSaved && ordered.length > 1 && core.status === 'aggregated'
        ? `${core.coreAgentIds.map(getAgentName).join(' · ')}核心`
        : primary.title,
    coreAgentIds: primary.coreAgentIds,
    mechanism: primary.mechanism,
    stateLabel: isSaved
      ? '已保存'
      : ordered.length > 1
        ? `${primary.stateLabel} · ${ordered.length} 种搭配`
        : primary.stateLabel,
    reason: isSaved
      ? primary.reason
      : ordered.length > 1
        ? `同一核心有 ${ordered.length} 种三人搭配，可分别查看评级与邦布建议。`
        : primary.reason,
    planningDps: primary.planningDps,
    planningDpsStatus: primary.planningDpsStatus,
    cultivationPriority: primary.cultivationPriority,
    teamRatingBand: primary.teamRatingBand,
    confidence: primary.confidence,
    outputPotentialBand: primary.outputPotentialBand,
    variants: ordered,
  }
}
