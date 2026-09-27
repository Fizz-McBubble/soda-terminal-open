import type { AccountRoster } from '../assault/types'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import type { AccountBuildResult } from '../optimizer/optimizeAccountBuilds'
import type { TeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import {
  createCultivationPriorityInput,
  teamDecisionAuthorityContractId,
  type CultivationPriorityInput,
} from './teamDecisionAuthority'
import { evaluateCurrent31TeamRating } from './current31TeamRating'
import { reviewedTeamCombatEvidence } from './reviewedTeamCombatEvidence'
import { isReviewedFallbackTeam } from './reviewedTeamRecommendationDisposition'
import { teamBangbooActivationAlternatives } from './teamBangbooActivationAlternatives'
import { projectOutputPotentialBands } from './outputPotentialBand'
import { type RankedFormation } from './accountDecisionBands'
import {
  assertIntrinsicSummaryMatchesCurrentRating,
  Current31TeamIntrinsicIndexMismatchError,
  intrinsicRatingBenchmark,
  projectAccountIntrinsicCandidates,
} from './accountDecisionIntrinsicProjection'
import {
  baseComparator,
  confidenceOrder,
  readinessOrder,
  conflictOrder,
  investmentOrder,
  projectCurrent31TeamStrengthOrder,
  denseOrder,
  selectMemberDisjointPortfolio,
} from './accountDecisionOrdering'
import {
  createPriorityResult,
  lightweightPriorityTier,
  marginalGain,
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
  const defaultRecommendation = (item: (typeof projected)[number]) => {
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
  const allIntrinsicOrdered = [...projected]
    .filter((item) => item.rating.status === 'rated')
    .sort(intrinsicDisplayComparator)
  const intrinsicOrdered = allIntrinsicOrdered.filter(defaultRecommendation)
  const longTermSelected = selectMemberDisjointPortfolio(
    intrinsicOrdered,
    input.preference.teamCount,
  )
  const longTermSelectedIds = new Set(
    longTermSelected.map((candidate) => candidate.candidate.candidateId),
  )
  const intrinsicShortlist: Array<(typeof intrinsicOrdered)[number]> = []
  const intrinsicShortlistCandidateIds = new Set<string>()
  for (const item of [
    ...longTermSelected,
    ...intrinsicOrdered.filter((item) => !longTermSelectedIds.has(item.candidate.candidateId)),
  ]) {
    if (intrinsicShortlistCandidateIds.has(item.candidate.candidateId)) continue
    intrinsicShortlistCandidateIds.add(item.candidate.candidateId)
    intrinsicShortlist.push(item)
    if (intrinsicShortlist.length >= recommendationLimit) break
  }
  const intrinsicShortlistIds = new Set(
    intrinsicShortlist.map((item) => item.candidate.candidateId),
  )
  // Preserve rule/source discovery; inference alone must not expand eager detail work.
  const consumerWorkset = allIntrinsicOrdered.filter(
    (item) =>
      intrinsicShortlistIds.has(item.candidate.candidateId) ||
      item.mechanicallyClosed ||
      item.mainstreamRecognition.status === 'confirmed' ||
      item.hasPreliminaryDirection ||
      (item.rating.status === 'rated' &&
        !item.inferredStrength &&
        item.rating.ratingBand !== 'Experimental' &&
        item.rating.confidence !== 'experimental'),
  )
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
  const currentSelected = selectMemberDisjointPortfolio(
    accountPortfolioOrdered,
    input.preference.teamCount,
  )
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
  const toRecommendation = (item: (typeof enriched)[number]) => {
    const current = evaluateCurrent31TeamRating({
      candidateId: item.candidate.candidateId,
      memberIds: item.memberIds,
      bangbooId: item.candidate.bestBangbooId,
      outputPotentialBand: 'unknown',
      benchmark: intrinsicRatingBenchmark,
    })
    if (current.rating.status !== 'rated')
      throw new Error(`短名单 Team Rating 与全域投影不一致：${item.candidate.candidateId}。`)
    if (input.validationIntrinsicProjectionMode !== 'direct')
      assertIntrinsicSummaryMatchesCurrentRating(item.memberIds, current)
    const priorityInput = createCultivationPriorityInput({
      contract: teamDecisionAuthorityContractId,
      candidateId: item.candidate.candidateId,
      teamRating: current.rating,
      ...item.account,
      marginalAccountGain: marginalGain(current.rating, item.coverageGain),
      coverageGain: item.coverageGain,
    })
    return {
      candidateId: item.candidate.candidateId,
      teamStrengthOrder: teamStrengthRankById.get(item.candidate.candidateId) ?? null,
      cultivationPriorityOrder: cultivationRankById.get(item.candidate.candidateId) ?? null,
      memberIds: item.memberIds,
      bangbooId: item.candidate.bestBangbooId,
      benchmarkOutput: item.candidate.planningDps,
      ...(item.candidate.bestBangbooId
        ? {}
        : {
            // Activation-only choices are not ranked recommendations. Check at
            // one star so the preview never assumes an unconfirmed star upgrade.
            bangbooAlternativeIds: teamBangbooActivationAlternatives(item.memberIds),
          }),
      outputPotential: item.output,
      featureVector: current.featureVector,
      teamRating: current.rating,
      mechanicValidity: current.mechanicValidity,
      combatEvidence: reviewedTeamCombatEvidence(item.memberIds, item.candidate.bestBangbooId),
      mechanicRating: current.mechanicRating,
      referencePerformance: current.referencePerformance,
      metaCalibration: current.metaCalibration,
      mainstreamRecognition: current.mainstreamRecognition,
      accountInputs: {
        ...item.account,
        marginalAccountGain: priorityInput.marginalAccountGain,
        coverageGain: priorityInput.coverageGain,
      },
      cultivationPriority: createPriorityResult(priorityInput),
    }
  }
  // Owned BOX constrains membership; inventory costs stay outside intrinsic strength ordering.
  const recommendations = enriched
    .filter((item) => intrinsicShortlistIds.has(item.candidate.candidateId))
    .sort(strengthFirstComparator)
    .slice(0, recommendationLimit)
    .map(toRecommendation)
  const consumerRecommendations = enriched
    .filter((item) => consumerWorksetIds.has(item.candidate.candidateId))
    .sort(strengthFirstComparator)
    .map(toRecommendation)
  const bestByAgent = new Map<string, (typeof enriched)[number]>()
  for (const item of [...enriched].sort(strengthFirstComparator)) {
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
      boundary:
        '账户无关的长期理论阵容目标；只参与 Production Workset 覆盖，不进入当前 Cultivation Priority 的 coverageGain 或边际收益。',
    },
    currentPortfolio: {
      kind: 'account_bound_current_priority' as const,
      candidateIds: currentSelected.map((item) => item.candidate.candidateId),
      requestedTeamCount: input.preference.teamCount,
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
