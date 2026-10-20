import { projectAccountDecisionRecommendation } from './accountDecisionRecommendationProjection'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import type { AccountRoster } from '../assault/types'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { type CultivationPriorityInput } from './teamDecisionAuthority'
import { isReviewedFallbackTeam } from './reviewedTeamRecommendationDisposition'
import { extractTeamStrengthMechanicFeatures } from './teamStrengthMechanicFeatures'
import { reviewedTeamAnalysis } from './reviewedTeamAnalysis'
import {
  hasDefaultTeamRecommendationEvidence,
  selectDefaultTeamRecommendationPool,
} from './defaultTeamRecommendationPolicy'
import { reviewedPreparedTeamCapabilities32 } from '../calculation/reviewedPreparedTeamBenchmark32'
import {
  authorComparisonMembership32Identity,
  reviewedAuthorComparisonMembership32,
} from './reviewedAuthorComparisonMembership32'
import { projectOutputPotentialBands } from './outputPotentialBand'
import { type RankedFormation } from './accountDecisionBands'
import type { AgentRealInvestmentDetail } from './accountCultivationRealInvestment'
import {
  Current31TeamIntrinsicIndexMismatchError,
  projectAccountIntrinsicCandidates,
} from './accountDecisionIntrinsicProjection'
import {
  baseComparator,
  confidenceOrder,
  ratingOrder,
  compareAccountCultivationState,
  projectCurrent31TeamStrengthOrder,
  resolveComparableTeamCandidates,
  denseOrder,
  resolveMemberDisjointPortfolio,
} from './accountDecisionOrdering'
import {
  lightweightPriorityTier,
  evaluateAccountCultivationRealInvestment,
  evaluateAccountCultivationMarginalYield,
  compareCultivationPriorityPartialOrder,
  type AccountCultivationRealInvestment,
  type AccountCultivationMarginalYield,
} from './accountCultivationPriority'
export { refineCultivationPriorityWithTargetFit } from './accountCultivationPriority'
export { projectCurrent31TeamStrengthOrder } from './accountDecisionOrdering'

export const accountDecisionAuthorityContractId = 'soda-account-decision-authority/v1' as const

function hardConstraintBlockers(preference: TeamPortfolioPreference) {
  return preference.templateIds.length
    ? ['当前 exhaustive formation 尚无 templateId crosswalk；具名模板硬约束不能静默忽略。']
    : []
}

type AccountDecisionAuthorityInput = {
  rankedFormations: readonly RankedFormation[]
  roster: AccountRoster
  allocation: AccountBuildResult
  preference: TeamPortfolioPreference
  recommendationLimit?: number
  decisionIssueClassificationFingerprint?: string
  /** Validation oracle; production always uses the generated intrinsic index when current. */
  validationIntrinsicProjectionMode?: 'indexed' | 'direct'
}

function projectAccountDecisionAuthorityInternal(input: AccountDecisionAuthorityInput) {
  const blockers = hardConstraintBlockers(input.preference)
  if (input.rankedFormations.length === 0) {
    const empty = {
      contract: accountDecisionAuthorityContractId,
      status: 'empty' as const,
      blockers: ['当前账户没有可进入 Team Rating 的完整三人 formation。'],
      outputPotentialCohort: null,
      recommendations: [],
      consumerRecommendations: [],
      agentRecommendations: [],
      coverage: {
        inputFormationCount: 0,
        ratedFormationCount: 0,
        hardInvalidFormationCount: 0,
        requiredPortfolioTeamCount: input.preference.teamCount,
        requiredPortfolioCandidateCount: 0,
      },
    }
    return { ...empty, fingerprint: stableContentHash(empty) }
  }
  const benchmarkCandidates = input.rankedFormations.flatMap((candidate) =>
    candidate.planningDps === null
      ? []
      : [{ candidateId: candidate.candidateId, output: candidate.planningDps }],
  )
  const cohort = benchmarkCandidates.length
    ? projectOutputPotentialBands({
        gameVersion: currentVersionProjection.gameVersion,
        baselineId: currentNormalizedPlanningBaseline.baselineId,
        cohortId: `account:${input.allocation.inputHash}:owned-formations`,
        candidates: benchmarkCandidates,
      })
    : null
  if (blockers.length)
    return {
      contract: accountDecisionAuthorityContractId,
      status: 'blocked' as const,
      blockers,
      outputPotentialCohort: cohort,
      recommendations: [],
      consumerRecommendations: [],
      agentRecommendations: [],
      coverage: {
        inputFormationCount: input.rankedFormations.length,
        ratedFormationCount: 0,
        hardInvalidFormationCount: 0,
        requiredPortfolioTeamCount: input.preference.teamCount,
        requiredPortfolioCandidateCount: 0,
      },
      fingerprint: stableContentHash({ blockers, cohort: cohort?.fingerprint ?? null }),
    }
  const projected = projectAccountIntrinsicCandidates({
    rankedFormations: input.rankedFormations,
    roster: input.roster,
    allocation: input.allocation,
    preference: input.preference,
    cohort,
    mode: input.validationIntrinsicProjectionMode ?? 'indexed',
  })
  const recommendationLimit = input.recommendationLimit ?? 12
  if (!Number.isSafeInteger(recommendationLimit) || recommendationLimit < 0)
    throw new Error('BOX 推荐展示数量必须是非负整数。')
  const ownedAgentIds = input.roster.agents
    .filter((agent) => agent.owned)
    .map((agent) => agent.agentId)
  const explicitMembershipById = new Map(
    projected.flatMap((item) => {
      // Membership evidence cannot override invalid mechanics, hard player constraints,
      // or turn an unqualified source observation into a rated-strength claim.
      if (
        item.rating.status !== 'rated' ||
        item.rating.ratingBand !== 'Experimental' ||
        item.rating.confidence !== 'experimental'
      )
        return []
      const membership = reviewedAuthorComparisonMembership32(item.memberIds, ownedAgentIds)
      return membership ? [[item.candidate.candidateId, membership] as const] : []
    }),
  )
  // Availability of a named local finite model permits deliberate selection;
  // it is independent of community recognition, strength and rotation closure.
  const preparedBenchmarkIds = new Set(
    projected.flatMap((item) =>
      item.rating.status === 'rated' &&
      reviewedPreparedTeamCapabilities32.some(
        (capability) =>
          capability.memberIds.length === item.memberIds.length &&
          capability.memberIds.every(
            (id) => item.memberIds.includes(id) && ownedAgentIds.includes(id),
          ),
      )
        ? [item.candidate.candidateId]
        : [],
    ),
  )
  const teamStrengthRankById = projectCurrent31TeamStrengthOrder(
    projected.flatMap((item) =>
      item.rating.status === 'rated'
        ? [
            {
              candidateId: item.candidate.candidateId,
              memberIds: item.memberIds,
              bangbooId: item.candidate.bestBangbooId,
              teamRatingBand: item.rating.ratingBand,
            },
          ]
        : [],
    ),
  )
  const baseIntrinsicDisplayComparator = (
    left: (typeof projected)[number],
    right: (typeof projected)[number],
  ) => {
    if (left.rating.status !== 'rated') return right.rating.status === 'rated' ? 1 : 0
    if (right.rating.status !== 'rated') return -1
    return (
      (teamStrengthRankById.get(left.candidate.candidateId) ?? Number.MAX_SAFE_INTEGER) -
        (teamStrengthRankById.get(right.candidate.candidateId) ?? Number.MAX_SAFE_INTEGER) ||
      confidenceOrder(left.rating.confidence) - confidenceOrder(right.rating.confidence) ||
      Number(right.mechanicallyClosed) - Number(left.mechanicallyClosed) ||
      left.candidate.candidateId.localeCompare(right.candidate.candidateId)
    )
  }
  const sourceRecommendation = (item: (typeof projected)[number]) => {
    if (
      explicitMembershipById.has(item.candidate.candidateId) ||
      preparedBenchmarkIds.has(item.candidate.candidateId)
    )
      return false
    const independentRating =
      item.rating.status === 'rated' &&
      !item.inferredStrength &&
      item.rating.ratingBand !== 'Experimental' &&
      item.rating.confidence !== 'experimental'
    return (
      independentRating ||
      (item.mainstreamRecognition.status === 'confirmed' && !isReviewedFallbackTeam(item.memberIds))
    )
  }
  // Players choose an intrinsically strong team before requesting its gear fit.
  // Source preference refines a band; it cannot move a weaker band above it.
  const baseDefaultStrengthComparator = (
    left: (typeof projected)[number],
    right: (typeof projected)[number],
  ) => {
    if (left.rating.status !== 'rated' || right.rating.status !== 'rated')
      return baseIntrinsicDisplayComparator(left, right)
    return (
      ratingOrder(left.rating.ratingBand) - ratingOrder(right.rating.ratingBand) ||
      Number(sourceRecommendation(right)) - Number(sourceRecommendation(left)) ||
      baseIntrinsicDisplayComparator(left, right)
    )
  }
  const intrinsicOrdering = resolveComparableTeamCandidates(
    [...projected]
      .filter((item) => item.rating.status === 'rated')
      .sort(baseDefaultStrengthComparator),
    (item) =>
      JSON.stringify([
        item.rating.status === 'rated' ? item.rating.ratingBand : null,
        sourceRecommendation(item),
      ]),
    (item) => item.memberIds,
  )
  const allIntrinsicOrdered = intrinsicOrdering.ordered
  const intrinsicPositionById = new Map(
    allIntrinsicOrdered.map((item, index) => [item.candidate.candidateId, index]),
  )
  // This is traversal order, not a new strength estimate. Keep one frozen
  // order for candidate capping, portfolios and later recommendation projections.
  const intrinsicDisplayComparator = (
    left: (typeof projected)[number],
    right: (typeof projected)[number],
  ) =>
    (intrinsicPositionById.get(left.candidate.candidateId) ?? Number.MAX_SAFE_INTEGER) -
      (intrinsicPositionById.get(right.candidate.candidateId) ?? Number.MAX_SAFE_INTEGER) ||
    baseIntrinsicDisplayComparator(left, right)
  const defaultStrengthComparator = intrinsicDisplayComparator
  const withdrawnKeys = new Set(
    reviewedTeamAnalysis.records
      .filter((record) => record.withdrawn)
      .map((record) => [...record.memberIds].sort().join('|')),
  )
  const featureCache = new Map<string, ReturnType<typeof extractTeamStrengthMechanicFeatures>>()
  const recommendationPool = selectDefaultTeamRecommendationPool(
    allIntrinsicOrdered.map((item) => ({
      candidateId: item.candidate.candidateId,
      memberIds: item.memberIds,
      sourceRecommended: sourceRecommendation(item),
      explicitSelectionOnly:
        explicitMembershipById.has(item.candidate.candidateId) ||
        preparedBenchmarkIds.has(item.candidate.candidateId),
      inferredStrength: item.inferredStrength,
      ratingStatus: item.rating.status,
      ratingBand: item.rating.status === 'rated' ? item.rating.ratingBand : null,
      confidence: item.rating.status === 'rated' ? item.rating.confidence : null,
      mechanicallyClosed: item.mechanicallyClosed,
      recommendationScore: item.recommendationScore,
      withdrawn: withdrawnKeys.has([...item.memberIds].sort().join('|')),
      sourceExcluded: isReviewedFallbackTeam(item.memberIds),
    })),
    (candidate) => {
      const key = [...candidate.memberIds].sort().join('|')
      const features =
        featureCache.get(key) ?? extractTeamStrengthMechanicFeatures(candidate.memberIds)
      featureCache.set(key, features)
      return hasDefaultTeamRecommendationEvidence(features, candidate.memberIds)
        ? features.primaryOutputAgentId
        : null
    },
    { includePortfolioFallback: input.preference.teamCount > 1 },
  )
  const defaultRecommendation = (item: (typeof projected)[number]) =>
    recommendationPool.defaultIds.has(item.candidate.candidateId)
  const portfolioEligible = (item: (typeof projected)[number]) =>
    recommendationPool.eligibleIds.has(item.candidate.candidateId)
  const intrinsicOrdered = allIntrinsicOrdered.filter(defaultRecommendation)
  // A display limit cannot prove that the account has no disjoint full portfolio.
  const portfolioOrdered = allIntrinsicOrdered.filter(portfolioEligible)
  const longTermSelection = resolveMemberDisjointPortfolio(
    portfolioOrdered,
    input.preference.teamCount,
  )
  const longTermSelected = longTermSelection.selected
  const longTermSelectedIds = new Set(
    longTermSelected.map((candidate) => candidate.candidate.candidateId),
  )
  // Long-term targets are guaranteed in the consumer workset below. Default
  // cards keep their original count/three-per-carry policy even for a zero limit.
  const intrinsicShortlist = intrinsicOrdered.slice(0, recommendationLimit)
  const intrinsicShortlistIds = new Set(
    intrinsicShortlist.map((item) => item.candidate.candidateId),
  )
  const ordered = [...projected].sort(baseComparator)
  const realInvestmentCache = new Map<string, AccountCultivationRealInvestment>()
  const realInvestmentAgentCache = new Map<string, AgentRealInvestmentDetail>()
  const realInvestmentFor = (item: (typeof ordered)[number]) => {
    const missingDiscSlots = item.account.buildCompletionDistance.missingDiscSlots
    const cacheKey = JSON.stringify([
      item.memberIds.toSorted(),
      missingDiscSlots,
      item.account.potentialGaps.map((gap) => [gap.agentId, gap.current, gap.minimum]),
    ])
    const cached = realInvestmentCache.get(cacheKey)
    if (cached) return cached
    const realInvestment = evaluateAccountCultivationRealInvestment({
      memberIds: item.memberIds,
      roster: input.roster,
      agentInvestmentCache: realInvestmentAgentCache,
      ...(missingDiscSlots === null
        ? {}
        : {
            targetFit: {
              status: missingDiscSlots === 0 ? ('ready' as const) : ('partial' as const),
              uniqueDiscCount: Math.max(0, 18 - missingDiscSlots),
              gaps: [],
            },
          }),
      potentialGaps: item.account.potentialGaps,
    })
    realInvestmentCache.set(cacheKey, realInvestment)
    return realInvestment
  }
  const accountProjected = ordered.flatMap((item) => {
    if (item.rating.status !== 'rated') return []
    const missingDiscSlots = item.account.buildCompletionDistance.missingDiscSlots
    const realInvestment = realInvestmentFor(item)
    const account = {
      ...item.account,
      investmentCost:
        missingDiscSlots === null ? item.account.investmentCost : realInvestment.investmentCost,
    }
    return [
      {
        ...item,
        account,
        realInvestment,
        priorityTier: lightweightPriorityTier(item.rating, account),
      },
    ]
  })
  const accountPortfolioOrdered = accountProjected
    .filter((item) => portfolioEligible(item))
    .sort(
      (left, right) =>
        compareAccountCultivationState(left, right) || intrinsicDisplayComparator(left, right),
    )
  const currentSelection = resolveMemberDisjointPortfolio(
    accountPortfolioOrdered,
    input.preference.teamCount,
  )
  const currentSelected = currentSelection.selected
  const currentSelectedIds = new Set(
    currentSelected.map((candidate) => candidate.candidate.candidateId),
  )
  // Preserve rule/source discovery; inference alone must not expand eager detail work.
  let consumerWorkset = allIntrinsicOrdered.filter(
    (item) =>
      longTermSelectedIds.has(item.candidate.candidateId) ||
      currentSelectedIds.has(item.candidate.candidateId) ||
      intrinsicShortlistIds.has(item.candidate.candidateId) ||
      item.mechanicallyClosed ||
      item.mainstreamRecognition.status === 'confirmed' ||
      item.hasPreliminaryDirection ||
      explicitMembershipById.has(item.candidate.candidateId) ||
      preparedBenchmarkIds.has(item.candidate.candidateId) ||
      (item.rating.status === 'rated' &&
        !item.inferredStrength &&
        item.rating.ratingBand !== 'Experimental' &&
        item.rating.confidence !== 'experimental'),
  )
  // A BOX with no recognized recommendation still needs a bounded exact-team
  // direction. Keep the existing partial mechanic/rating evidence; these rows
  // never enter default strength recommendations or either required portfolio.
  if (consumerWorkset.length === 0) {
    const ruleAgentIds = new Set(current31TeamEngineD1Pack.agentRules.map((rule) => rule.agentId))
    const fallbackLimit = Math.max(recommendationLimit, input.preference.teamCount, 3)
    consumerWorkset = allIntrinsicOrdered
      .filter((item) =>
        item.memberIds.every(
          (agentId) => ownedAgentIds.includes(agentId) && ruleAgentIds.has(agentId),
        ),
      )
      .slice(0, fallbackLimit)
  }
  const consumerWorksetIds = new Set(consumerWorkset.map((item) => item.candidate.candidateId))
  const coverageOrder = [
    'new_required_team',
    'new_scenario',
    'redundancy',
    'none',
    'unknown',
  ] as const
  const enriched = accountProjected.map((item) => ({
    ...item,
    coverageGain: (currentSelectedIds.has(item.candidate.candidateId)
      ? 'new_required_team'
      : 'redundancy') as CultivationPriorityInput['coverageGain'],
  }))
  const marginalYieldByCandidateId = new Map<string, AccountCultivationMarginalYield>(
    enriched.map((item) => [
      item.candidate.candidateId,
      evaluateAccountCultivationMarginalYield({
        candidateId: item.candidate.candidateId,
        teamRating: item.rating,
        coverageGain: item.coverageGain,
        currentReadiness: item.account.currentReadiness,
        investmentCost: item.account.investmentCost,
        realInvestment: item.realInvestment,
      }),
    ]),
  )
  const marginalYieldOrder = (
    left: (typeof enriched)[number],
    right: (typeof enriched)[number],
  ) => {
    const categoryOrder: Record<AccountCultivationMarginalYield['yieldCategory'], number> = {
      immediate_high_impact: 0,
      high_efficiency_progression: 1,
      strategic_high_potential: 2,
      standard_development: 3,
      redundant_marginal: 4,
      unrealizable: 5,
    }
    const leftYield = marginalYieldByCandidateId.get(left.candidate.candidateId)!
    const rightYield = marginalYieldByCandidateId.get(right.candidate.candidateId)!
    const categoryDifference =
      categoryOrder[leftYield.yieldCategory] - categoryOrder[rightYield.yieldCategory]
    if (categoryDifference) return categoryDifference
    const partialOrder = compareCultivationPriorityPartialOrder(leftYield, rightYield)
    if (partialOrder.relation === 'left_dominates') return -1
    if (partialOrder.relation === 'right_dominates') return 1
    return 0
  }
  enriched.sort(
    (left, right) =>
      coverageOrder.indexOf(left.coverageGain) - coverageOrder.indexOf(right.coverageGain) ||
      marginalYieldOrder(left, right) ||
      compareAccountCultivationState(left, right) ||
      intrinsicDisplayComparator(left, right),
  )
  const cultivationOrder = denseOrder(
    enriched,
    (left, right) =>
      coverageOrder.indexOf(left.coverageGain) - coverageOrder.indexOf(right.coverageGain) ||
      marginalYieldOrder(left, right) ||
      compareAccountCultivationState(left, right) ||
      intrinsicDisplayComparator(left, right),
  )
  const cultivationRankById = new Map(
    cultivationOrder.map(({ item, rank }) => [item.candidate.candidateId, rank]),
  )
  const strengthFirstComparator = (
    left: (typeof enriched)[number],
    right: (typeof enriched)[number],
  ) => intrinsicDisplayComparator(left, right)
  const toRecommendation = (item: (typeof enriched)[number]) => {
    const recommendation = projectAccountDecisionRecommendation(item, {
      explicitMembershipById,
      preparedBenchmarkIds,
      teamStrengthRankById,
      cultivationRankById,
      validationIntrinsicProjectionMode: input.validationIntrinsicProjectionMode,
    })
    const marginalYield = marginalYieldByCandidateId.get(item.candidate.candidateId)
    return {
      ...recommendation,
      realInvestment: item.realInvestment,
      marginalYield,
      cultivationPriority: {
        ...recommendation.cultivationPriority,
        reasons: [...recommendation.cultivationPriority.reasons, ...item.realInvestment.reasons],
        tradeoffs: [
          ...recommendation.cultivationPriority.tradeoffs,
          ...item.realInvestment.tradeoffs,
        ],
      },
    }
  }
  // Owned BOX constrains membership; inventory costs stay outside intrinsic strength ordering.
  const recommendations = enriched
    .filter((item) => intrinsicShortlistIds.has(item.candidate.candidateId))
    .sort(defaultStrengthComparator)
    .slice(0, recommendationLimit)
    .map(toRecommendation)
  const consumerRecommendations = enriched
    .filter((item) => consumerWorksetIds.has(item.candidate.candidateId))
    .sort(strengthFirstComparator)
    .map(toRecommendation)
  const bestByAgent = new Map<string, (typeof enriched)[number]>()
  for (const item of [...enriched].sort(defaultStrengthComparator)) {
    if (!portfolioEligible(item)) continue
    if (item.rating.status !== 'rated') continue
    for (const agentId of item.memberIds) {
      if (!bestByAgent.has(agentId)) bestByAgent.set(agentId, item)
    }
  }
  const agentRecommendations = [...bestByAgent].map(([agentId, best]) => ({
    agentId,
    candidateId: best.candidate.candidateId,
    memberIds: best.memberIds,
    teamRating: best.rating.status === 'rated' ? best.rating.ratingBand : 'Experimental',
    confidence: best.rating.status === 'rated' ? best.rating.confidence : 'experimental',
    cultivationPriority: best.priorityTier,
  }))
  const hardInvalidFormationCount = projected.filter(
    (candidate) => candidate.rating.status === 'hard_invalid',
  ).length
  const result = {
    contract: accountDecisionAuthorityContractId,
    status: 'ready' as const,
    sideEffect: 'read_only' as const,
    explicitMembershipSourceIdentity: authorComparisonMembership32Identity,
    outputPotentialCohort: cohort,
    recommendations,
    consumerRecommendations,
    agentRecommendations,
    productionWorkset: {
      strategy: 'authority_exact_variant_intrinsic_rating' as const,
      candidateIds: consumerWorkset.map((item) => item.candidate.candidateId),
      complete:
        intrinsicShortlist.length === Math.min(recommendationLimit, intrinsicOrdered.length) &&
        [...longTermSelectedIds, ...currentSelectedIds].every((id) => consumerWorksetIds.has(id)),
    },
    longTermPortfolio: {
      kind: 'intrinsic_long_term_target' as const,
      candidateIds: longTermSelected.map((item) => item.candidate.candidateId),
      requestedTeamCount: input.preference.teamCount,
      selectionStatus: longTermSelection.status,
      boundary:
        '账户无关的长期理论阵容目标；只参与 Production Workset 覆盖，不进入当前 Cultivation Priority 的 coverageGain 或边际收益。',
    },
    currentPortfolio: {
      kind: 'account_bound_current_priority' as const,
      candidateIds: currentSelected.map((item) => item.candidate.candidateId),
      requestedTeamCount: input.preference.teamCount,
      selectionStatus: currentSelection.status,
      boundary:
        '在账户无关 Production Workset 内，当前账号组合优先考虑可成型性、投入与实体资产冲突；只有这里入选的队伍标记为 new_required_team。',
    },
    coverage: {
      inputFormationCount: input.rankedFormations.length,
      ratedFormationCount: projected.length - hardInvalidFormationCount,
      hardInvalidFormationCount,
      requiredPortfolioTeamCount: input.preference.teamCount,
      requiredPortfolioCandidateCount: currentSelected.length,
      longTermPortfolioCandidateCount: longTermSelected.length,
      currentPortfolioCandidateCount: currentSelected.length,
      decisionIssueClassificationFingerprint: input.decisionIssueClassificationFingerprint ?? null,
      sourceOrdering: intrinsicOrdering.diagnostics,
    },
    boundary:
      'Production Workset 与长期目标只由 Authority exact 3-agent + Bangboo Variant 的账户无关 Team Strength 定义；Team Engine 只能补充可执行元数据。Team Strength order 仅表示粗档，Cultivation Priority order 独立输出；来源替代偏好只调整同档同来源类别的可比候选，不生成数值强弱，candidateId 不代表更强。固定事件 numeric diagnostic 不进入评级。',
  }
  return { ...result, fingerprint: stableContentHash(result) }
}

export function projectAccountDecisionAuthority(input: AccountDecisionAuthorityInput) {
  try {
    return projectAccountDecisionAuthorityInternal(input)
  } catch (error) {
    if (
      (error instanceof Current31TeamIntrinsicIndexMismatchError ||
        (error instanceof Error && error.name === 'Current31TeamIntrinsicIndexMismatchError')) &&
      input.validationIntrinsicProjectionMode !== 'direct'
    )
      return projectAccountDecisionAuthorityInternal({
        ...input,
        validationIntrinsicProjectionMode: 'direct',
      })
    throw error
  }
}
