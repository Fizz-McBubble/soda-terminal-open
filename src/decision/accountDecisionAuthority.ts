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
  selectDefaultTeamRecommendationIds,
} from './defaultTeamRecommendationPolicy'
import { reviewedPreparedTeamCapabilities32 } from '../calculation/reviewedPreparedTeamBenchmark32'
import {
  authorComparisonMembership32Identity,
  reviewedAuthorComparisonMembership32,
} from './reviewedAuthorComparisonMembership32'
import { projectOutputPotentialBands } from './outputPotentialBand'
import { type RankedFormation } from './accountDecisionBands'
import {
  Current31TeamIntrinsicIndexMismatchError,
  projectAccountIntrinsicCandidates,
} from './accountDecisionIntrinsicProjection'
import {
  baseComparator,
  confidenceOrder,
  ratingOrder,
  readinessOrder,
  conflictOrder,
  investmentOrder,
  projectCurrent31TeamStrengthOrder,
  denseOrder,
  resolveMemberDisjointPortfolio,
} from './accountDecisionOrdering'
import { lightweightPriorityTier } from './accountCultivationPriority'
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
  const intrinsicDisplayComparator = (
    left: (typeof projected)[number],
    right: (typeof projected)[number],
  ) => {
    if (left.rating.status !== 'rated') return right.rating.status === 'rated' ? 1 : 0
    if (right.rating.status !== 'rated') return -1
    return (
      (teamStrengthRankById.get(left.candidate.candidateId) ?? Number.MAX_SAFE_INTEGER) -
        (teamStrengthRankById.get(right.candidate.candidateId) ?? Number.MAX_SAFE_INTEGER) ||
      (right.recommendationScore ?? -1) - (left.recommendationScore ?? -1) ||
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
  const defaultStrengthComparator = (
    left: (typeof projected)[number],
    right: (typeof projected)[number],
  ) => {
    if (left.rating.status !== 'rated' || right.rating.status !== 'rated')
      return intrinsicDisplayComparator(left, right)
    return (
      ratingOrder(left.rating.ratingBand) - ratingOrder(right.rating.ratingBand) ||
      Number(sourceRecommendation(right)) - Number(sourceRecommendation(left)) ||
      intrinsicDisplayComparator(left, right)
    )
  }
  const allIntrinsicOrdered = [...projected]
    .filter((item) => item.rating.status === 'rated')
    .sort(intrinsicDisplayComparator)
  const withdrawnKeys = new Set(
    reviewedTeamAnalysis.records
      .filter((record) => record.withdrawn)
      .map((record) => [...record.memberIds].sort().join('|')),
  )
  const featureCache = new Map<string, ReturnType<typeof extractTeamStrengthMechanicFeatures>>()
  const defaultRecommendationIds = selectDefaultTeamRecommendationIds(
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
      sourceExcluded:
        isReviewedFallbackTeam(item.memberIds) ||
        withdrawnKeys.has([...item.memberIds].sort().join('|')),
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
  )
  const defaultRecommendation = (item: (typeof projected)[number]) =>
    defaultRecommendationIds.has(item.candidate.candidateId)
  const intrinsicOrdered = allIntrinsicOrdered.filter(defaultRecommendation)
  const longTermSelection = resolveMemberDisjointPortfolio(
    intrinsicOrdered,
    input.preference.teamCount,
  )
  const longTermSelected = longTermSelection.selected
  const longTermSelectedIds = new Set(
    longTermSelected.map((candidate) => candidate.candidate.candidateId),
  )
  const intrinsicShortlist: Array<(typeof intrinsicOrdered)[number]> = []
  const intrinsicShortlistCandidateIds = new Set<string>()
  const shortlistOrder = [
    ...longTermSelected,
    ...intrinsicOrdered.filter((item) => !longTermSelectedIds.has(item.candidate.candidateId)),
  ].sort(defaultStrengthComparator)
  for (const item of shortlistOrder) {
    if (intrinsicShortlistCandidateIds.has(item.candidate.candidateId)) continue
    intrinsicShortlistCandidateIds.add(item.candidate.candidateId)
    intrinsicShortlist.push(item)
    if (intrinsicShortlist.length >= recommendationLimit) break
  }
  const intrinsicShortlistIds = new Set(
    intrinsicShortlist.map((item) => item.candidate.candidateId),
  )
  // Preserve rule/source discovery; inference alone must not expand eager detail work.
  let consumerWorkset = allIntrinsicOrdered.filter(
    (item) =>
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
    consumerWorkset = allIntrinsicOrdered
      .filter((item) =>
        item.memberIds.every(
          (agentId) => ownedAgentIds.includes(agentId) && ruleAgentIds.has(agentId),
        ),
      )
      .slice(0, recommendationLimit)
  }
  const consumerWorksetIds = new Set(consumerWorkset.map((item) => item.candidate.candidateId))
  const ordered = [...projected].sort(baseComparator)
  const tierOrder = ['ready_now', 'short_upgrade', 'strategic_build', 'experimental'] as const
  const accountProjected = ordered.flatMap((item) => {
    if (item.rating.status !== 'rated') return []
    return [
      {
        ...item,
        priorityTier: lightweightPriorityTier(item.rating, item.account),
      },
    ]
  })
  const accountPortfolioOrdered = accountProjected
    .filter(
      (item) => consumerWorksetIds.has(item.candidate.candidateId) && defaultRecommendation(item),
    )
    .sort(
      (left, right) =>
        tierOrder.indexOf(left.priorityTier) - tierOrder.indexOf(right.priorityTier) ||
        readinessOrder(left.account.currentReadiness) -
          readinessOrder(right.account.currentReadiness) ||
        investmentOrder(left.account.investmentCost) -
          investmentOrder(right.account.investmentCost) ||
        conflictOrder(left.account.assetConflict) - conflictOrder(right.account.assetConflict) ||
        intrinsicDisplayComparator(left, right),
    )
  const currentSelection = resolveMemberDisjointPortfolio(
    accountPortfolioOrdered,
    input.preference.teamCount,
  )
  const currentSelected = currentSelection.selected
  const currentSelectedIds = new Set(
    currentSelected.map((candidate) => candidate.candidate.candidateId),
  )
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
  enriched.sort(
    (left, right) =>
      tierOrder.indexOf(left.priorityTier) - tierOrder.indexOf(right.priorityTier) ||
      coverageOrder.indexOf(left.coverageGain) - coverageOrder.indexOf(right.coverageGain) ||
      baseComparator(left, right),
  )
  const cultivationOrder = denseOrder(
    enriched,
    (left, right) =>
      tierOrder.indexOf(left.priorityTier) - tierOrder.indexOf(right.priorityTier) ||
      coverageOrder.indexOf(left.coverageGain) - coverageOrder.indexOf(right.coverageGain) ||
      baseComparator(left, right),
  )
  const cultivationRankById = new Map(
    cultivationOrder.map(({ item, rank }) => [item.candidate.candidateId, rank]),
  )
  const strengthFirstComparator = (
    left: (typeof enriched)[number],
    right: (typeof enriched)[number],
  ) => intrinsicDisplayComparator(left, right)
  const toRecommendation = (item: (typeof enriched)[number]) =>
    projectAccountDecisionRecommendation(item, {
      explicitMembershipById,
      preparedBenchmarkIds,
      teamStrengthRankById,
      cultivationRankById,
      validationIntrinsicProjectionMode: input.validationIntrinsicProjectionMode,
    })
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
    if (!defaultRecommendation(item)) continue
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
        intrinsicShortlist.length === Math.min(recommendationLimit, intrinsicOrdered.length),
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
    },
    boundary:
      'Production Workset 与长期目标只由 Authority exact 3-agent + Bangboo Variant 的账户无关 Team Strength 定义；Team Engine 只能补充可执行元数据。Team Strength order 与 Cultivation Priority order 分别输出；无来源偏序关系的同档候选保持并列，candidateId 不代表更强。固定事件 numeric diagnostic 不进入评级。',
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
