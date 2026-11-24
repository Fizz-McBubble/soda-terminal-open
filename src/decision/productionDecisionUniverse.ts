import type { AccountRoster } from '../assault/types'
import { currentBangbooDirectory } from '../assault/catalog'
import { stableContentHash } from '../gameDataPacks/types'
import { projectCurrent31ExhaustiveAccountCandidates } from '../teamEngine/current31ExhaustiveAccountCandidateProjection'
import { classifyCurrentBangbooDecisionBlockerCounts } from './teamDecisionIssueClassification'
import { resolveCurrent31VariantBangbooRecommendation } from './current31VariantBangbooRecommendation'
import type { scoreCurrent31ExhaustiveAccountCandidates } from './exhaustiveAccountCandidateScoring'

import type { LegalAgentFormation } from '../teamEngine/current31LegalCandidateUniverse'

/**
 * Production identity/rating input. It preserves the complete legal formation universe without
 * running the exhaustive numeric oracle. Numeric evaluation belongs after the intrinsic shortlist.
 */
export function projectCurrent31ProductionDecisionUniverse(
  roster: AccountRoster,
  exactFormations?: readonly LegalAgentFormation[],
) {
  const ownedAgentIds = roster.agents.filter((agent) => agent.owned).map((agent) => agent.agentId)
  const ownedBangbooCount = currentBangbooDirectory.filter(
    (bangboo) => bangboo.releaseState === 'released',
  ).length
  const formationProjection = projectCurrent31ExhaustiveAccountCandidates(
    ownedAgentIds,
    'indexed',
    exactFormations,
  )
  const authorityFormations = formationProjection.candidates.map((candidate) => {
    const bestBangbooId = resolveCurrent31VariantBangbooRecommendation(candidate.memberIds)
    return {
      ...candidate,
      rank: null,
      wEngineBindings: [],
      bestBangbooId,
      bangbooRecommendationStatus: bestBangbooId
        ? ('selected' as const)
        : ('no_authoritative_recommendation' as const),
      rawDamageLeaderBangbooId: null,
      planningDps: null,
    }
  })
  const decisionIssueClassification = classifyCurrentBangbooDecisionBlockerCounts({})
  const coverage = {
    ownedAgentCount: ownedAgentIds.length,
    ownedBangbooCount,
    scoredBangbooChoiceCount: 0,
    sourceBackedBangbooChoiceCount: new Set<string>(
      authorityFormations
        .map((candidate) => candidate.bestBangbooId)
        .filter((bangbooId) => bangbooId !== null),
    ).size,
    eligibleFormationCount: formationProjection.coverage.eligibleFormationCount,
    mechanicClosedAtBaseCount: formationProjection.coverage.mechanicClosedAtBaseCount,
    limitedButNotPrunedCount: formationProjection.coverage.limitedButNotPrunedCount,
    assetBoundFormationCount: 0,
    formationBangbooCandidateCount:
      formationProjection.coverage.eligibleFormationCount * (ownedBangbooCount + 1),
    scoredFormationBangbooCandidateCount: 0,
    sourceBackedBangbooRecommendationCount: authorityFormations.filter(
      (candidate) => candidate.bestBangbooId !== null,
    ).length,
    unsupportedBangbooCandidateCount: 0,
    bangbooBlockerCounts: {} as Record<string, number>,
    decisionIssueClassification,
    missingAssetFormationCount: formationProjection.coverage.eligibleFormationCount,
    complete: false,
  }
  return {
    contract: 'soda-production-decision-universe/v1' as const,
    rankedFormations: [] as ReturnType<
      typeof scoreCurrent31ExhaustiveAccountCandidates
    >['rankedFormations'],
    authorityFormations,
    coverage,
    fingerprint: stableContentHash({
      universe: formationProjection.fingerprint,
      ownedBangbooCount,
      mode: 'identity_and_intrinsic_rating_only',
    }),
    boundary: exactFormations
      ? '按已验证的精确三人组合读取离线榜单，实体装备在打开队伍时按需计算。'
      : '生产 Query 只投影完整合法 formation identity 与账户无关 Team Rating；不在线执行 Exhaustive numeric oracle。Team Warehouse Fit 与 Account-bound Benchmark 必须在 shortlist 后按候选专属三人资产域求解。',
  }
}
