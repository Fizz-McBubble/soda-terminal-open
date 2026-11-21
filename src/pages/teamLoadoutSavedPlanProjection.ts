import type { AccountPlanningDraft } from '../accounts/types'
import { savedPlanHistoricalDiscReferenceStatus } from './savedTeamHistoricalDiscRefs'
export { savedPlanHistoricalDiscRefs } from './savedTeamHistoricalDiscRefs'
import { savedTeamRatedPlayId } from '../accounts/savedTeamRatingPlayIdentity'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import { publicVersionIdentity } from '../application/publicVersionIdentity'
import { authorityConsumerRecommendations } from '../application/authorityConsumerRecommendations'
import { resolveCurrent31TeamFamily } from '../decision/current31TeamCoreAggregation'
import { lookupCurrent31TeamIntrinsicDetails } from '../decision/current31TeamIntrinsicIndex'
import {
  currentGenericTeamRankingStatus,
  lookupCurrentGenericTeamRanking,
  lookupGraduatedScoreForSelection,
} from '../decision/teamGenericRanking'
import { selectSavedDefaultTeamAdmissionPlay } from '../decision/defaultTeamAdmissionPlay'
import { projectGenericTeamRating } from '../decision/teamGenericRankingMethod'
import { playerFacingAgentLabel, playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { savedPlanDisplayName } from '../application/savedPlanDisplayName'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { savedPlanGraduationCompletion } from './savedPlanGraduationCompletion'
import { attachSavedTeamDiscCompletion, savedTeamDiscCompletion } from './savedTeamDiscCompletion'
import { teamOverviewBangbooSuggestions } from './teamOverviewBangbooSuggestions'
import { resolveReviewedTeamOutputModule } from '../gameDataPacks/reviewedTeamOutputModuleEvidence'
import { resolveTeamMechanismDirection } from '../decision/teamMechanismDirection'
import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
import type { FiniteTeamPlay } from '../domain/finiteTeamPlayContract'

type AuthorityRecommendation = Extract<
  AccountDecisionSnapshot['decisionAuthority'],
  { status: 'ready' }
>['recommendations'][number]

function sameStableIds(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every((value) => right.includes(value))
  )
}

export function currentPlayForSavedPlan(
  plan: AccountPlanningDraft,
  activePlay?: FiniteTeamPlay | null,
) {
  const members = plan.selection.agentIds
  if (plan.teamPortfolioSnapshot || members.length !== 3 || new Set(members).size !== 3) return null
  const direction = resolveTeamMechanismDirection(members)
  const context = plan.solutionContext
  if (context?.ratedTeamPlayId !== undefined) {
    const playId = savedTeamRatedPlayId(plan)
    if (
      !playId ||
      plan.kind !== 'team' ||
      plan.state !== 'saved' ||
      plan.teamExecutionSnapshot?.authorComparisonMembership ||
      context.scope !== 'team_joint' ||
      context.gameVersion !== publicVersionIdentity.gameVersion
    )
      return null
    const play = direction.variants.find((variant) => canonicalTeamPlayIdentity(variant) === playId)
    return play && lookupGraduatedScoreForSelection(members, play) ? play : null
  }
  const ratedCount = direction.variants.filter((play) =>
    lookupGraduatedScoreForSelection(members, play),
  ).length
  if (ratedCount > 1) return null
  const activeId = activePlay && canonicalTeamPlayIdentity(activePlay)
  const matchingActivePlay =
    activeId && direction.variants.find((play) => canonicalTeamPlayIdentity(play) === activeId)
  return (
    matchingActivePlay ||
    selectSavedDefaultTeamAdmissionPlay(
      members,
      direction,
      currentGenericTeamRankingStatus.contentHash,
    )
  )
}

/**
 * Saved names and old candidate IDs are history, not an authority identity. Restoring current
 * equipment and Bangboo context requires an exact three-member plus Bangboo variant, with the
 * resolved core checked against accidental family-level inheritance. Team Rating is resolved by
 * the separate exact-three function below.
 */
export function currentAuthorityForSavedPlan(
  plan: AccountPlanningDraft,
  decisionAuthority: AccountDecisionSnapshot['decisionAuthority'],
): AuthorityRecommendation | null {
  // A simultaneous portfolio contains several exact teams. It must not borrow
  // one current three-member rating for the entire saved implementation.
  if (plan.teamPortfolioSnapshot) return null
  const savedMemberIds = plan.selection.agentIds
  const savedBangbooId = plan.selection.bangbooId
  if (
    savedMemberIds.length === 3 &&
    savedBangbooId === null &&
    plan.teamAccountFactBinding &&
    plan.teamExecutionSnapshot?.authorComparisonMembership
  ) {
    const matches = authorityConsumerRecommendations(decisionAuthority).filter(
      (candidate) =>
        candidate.authorComparisonMembership?.fingerprint ===
          plan.teamAccountFactBinding?.sourceFingerprint &&
        sameStableIds(savedMemberIds, candidate.memberIds),
    )
    return matches.length === 1 ? matches[0]! : null
  }
  if (savedMemberIds.length !== 3 || !savedBangbooId || new Set(savedMemberIds).size !== 3)
    return null
  const savedMembers = savedMemberIds as [string, string, string]
  const savedCoreIds = resolveCurrent31TeamFamily(savedMembers).coreAgentIds
  const matches = authorityConsumerRecommendations(decisionAuthority).filter((candidate) => {
    if (candidate.bangbooId !== savedBangbooId || !sameStableIds(savedMembers, candidate.memberIds))
      return false
    const candidateCoreIds = resolveCurrent31TeamFamily(candidate.memberIds).coreAgentIds
    return sameStableIds(savedCoreIds, candidateCoreIds)
  })
  // An ambiguous current Authority must never lend a saved plan a first-match rating.
  return matches.length === 1 ? matches[0]! : null
}

export function currentTeamRatingForSavedPlan(
  plan: AccountPlanningDraft,
  decisionAuthority?: AccountDecisionSnapshot['decisionAuthority'],
) {
  if (plan.teamPortfolioSnapshot) return null
  const memberIds = plan.selection.agentIds
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) return null
  const sortedMemberIds = [...memberIds].sort() as [string, string, string]
  const indexed = lookupCurrent31TeamIntrinsicDetails(
    sortedMemberIds,
    `saved-team-rating:${sortedMemberIds.join('+')}`,
  )
  const current = indexed
    ? {
        ...indexed,
        rating: projectGenericTeamRating(
          indexed.rating,
          lookupCurrentGenericTeamRanking(sortedMemberIds),
        ),
      }
    : null
  if (
    !current ||
    current.rating.status !== 'rated' ||
    current.mechanicValidity === 'invalid' ||
    current.rating.ratingBand === 'Experimental' ||
    current.rating.confidence === 'experimental'
  )
    return null

  const authorityRatings = authorityConsumerRecommendations(decisionAuthority)
    .filter((candidate) => sameStableIds(sortedMemberIds, candidate.memberIds))
    .filter(
      (candidate) =>
        candidate.teamRating.status === 'rated' &&
        candidate.mechanicValidity !== 'invalid' &&
        candidate.teamRating.ratingBand !== 'Experimental' &&
        candidate.teamRating.confidence !== 'experimental',
    )
    .map((candidate) => ({
      band: candidate.teamRating.status === 'rated' ? candidate.teamRating.ratingBand : null,
      score: candidate.metaCalibration?.recommendationScore ?? null,
    }))
  const distinctAuthorityRatings = new Set(
    authorityRatings.map(({ band, score }) => `${band}:${score ?? 'none'}`),
  )
  if (distinctAuthorityRatings.size > 1) return null
  const authorityRating = authorityRatings[0]
  if (
    authorityRating &&
    (authorityRating.band !== current.rating.ratingBand ||
      authorityRating.score !== (current.metaCalibration.recommendationScore ?? null))
  )
    return null
  return current
}

function savedPlanMemberIds(plan: AccountPlanningDraft) {
  return plan.teamPortfolioSnapshot
    ? plan.teamPortfolioSnapshot.executions.flatMap((execution) => execution.memberIds)
    : plan.selection.agentIds
}

function savedPlanBangbooLabel(plan: AccountPlanningDraft) {
  if (plan.teamPortfolioSnapshot)
    return plan.teamPortfolioSnapshot.executions
      .map((execution) =>
        execution.bangbooId ? playerFacingBangbooLabel(execution.bangbooId) : '未记录',
      )
      .join(' · ')
  return plan.selection.bangbooId
    ? playerFacingBangbooLabel(plan.selection.bangbooId)
    : '邦布未记录'
}

function savedPlanBangbooStars(plan: AccountPlanningDraft, bangbooId: string | null) {
  if (!bangbooId) return undefined
  const parameterStars =
    plan.teamEquipmentParameters?.bangbooId === bangbooId
      ? plan.teamEquipmentParameters.bangbooStars
      : undefined
  const snapshotStars =
    plan.teamExecutionSnapshot?.bangbooId === bangbooId
      ? plan.teamExecutionSnapshot.bangbooStar
      : undefined
  const stars = parameterStars ?? snapshotStars
  return Number.isInteger(stars) && stars !== undefined && stars >= 1 && stars <= 5
    ? (stars as 1 | 2 | 3 | 4 | 5)
    : undefined
}

function savedPlanExpectedDiscCount(plan: AccountPlanningDraft) {
  return plan.teamPortfolioSnapshot ? plan.teamPortfolioSnapshot.requestedTeamCount * 18 : 18
}

function savedPlanReason(plan: AccountPlanningDraft, historicalDiscReferenceCount: number) {
  const members = savedPlanMemberIds(plan).map(playerFacingAgentLabel).join(' · ')
  const bangboo = savedPlanBangbooLabel(plan)
  const portfolioPrefix = plan.teamPortfolioSnapshot
    ? `已保存 ${plan.teamPortfolioSnapshot.requestedTeamCount} 队 · `
    : ''
  const references = historicalDiscReferenceCount
    ? `已保存 ${historicalDiscReferenceCount} 张不同驱动盘`
    : '成员与方案方向已保存'
  return `${portfolioPrefix}${members || '成员待补齐'} · ${bangboo} · ${references}`
}

export function isContextSavedPlan(
  plan: AccountPlanningDraft,
  contextPlanId?: string | null,
  contextDiscId?: string | null,
  contextAgentId?: string | null,
) {
  return (
    plan.id === contextPlanId ||
    Boolean(contextDiscId && plan.warehouseRefs.includes(contextDiscId)) ||
    Boolean(contextAgentId && plan.selection.agentIds.includes(contextAgentId))
  )
}

export function savedPlanItem(
  plan: AccountPlanningDraft,
  options: {
    currentAuthority?: AuthorityRecommendation | null
    currentTeamRating?: ReturnType<typeof currentTeamRatingForSavedPlan>
    availableDiscIds?: readonly string[]
    warehouse?: Pick<CoreWarehouse, 'roster' | 'discs'>
  } = {},
): TeamLoadoutOverviewItem {
  const currentTeamRating =
    options.currentTeamRating === undefined
      ? currentTeamRatingForSavedPlan(plan)
      : options.currentTeamRating
  const historicalDiscReferences = savedPlanHistoricalDiscReferenceStatus(plan)
  const historicalDiscRefs = historicalDiscReferences.references
  const savedMemberIds = savedPlanMemberIds(plan)
  const expectedMemberCount = plan.teamPortfolioSnapshot
    ? plan.teamPortfolioSnapshot.requestedTeamCount * 3
    : 3
  const expectedDiscCount = savedPlanExpectedDiscCount(plan)
  const unavailableDiscCount = options.availableDiscIds
    ? historicalDiscRefs.filter((discId) => !options.availableDiscIds!.includes(discId)).length
    : 0
  const quantitativeCompletion = (() => {
    const executions =
      plan.teamPortfolioSnapshot?.executions ??
      (plan.teamExecutionSnapshot ? [plan.teamExecutionSnapshot] : [])
    if (
      !executions.length ||
      executions.some(
        (execution) =>
          execution.members?.length !== 3 ||
          execution.members.some(
            (member) =>
              !member.cultivation ||
              member.suggested?.wEngine?.level == null ||
              member.suggested.wEngine.ascension == null ||
              member.suggested.wEngine.refinement == null,
          ),
      )
    )
      return null
    try {
      return savedPlanGraduationCompletion(plan, options.warehouse)
    } catch {
      // Preserve legacy saved rows whose execution snapshot cannot be projected quantitatively.
      return null
    }
  })()
  const graduationCompletion = attachSavedTeamDiscCompletion(
    quantitativeCompletion,
    savedTeamDiscCompletion(plan),
  )
  const gaps = [
    ...(savedMemberIds.length < expectedMemberCount
      ? [`方案未记录 ${expectedMemberCount - savedMemberIds.length} 名成员`]
      : []),
    ...(historicalDiscRefs.length === expectedDiscCount
      ? []
      : [`当前保存了 ${historicalDiscRefs.length}/${expectedDiscCount} 张不同驱动盘`]),
    ...(historicalDiscReferences.conflict ? ['保存记录中的驱动盘信息不一致，请重新匹配。'] : []),
    ...(unavailableDiscCount
      ? [`已保存的驱动盘中有 ${unavailableDiscCount} 张当前不在仓库。`]
      : []),
    ...(plan.teamPortfolioSnapshot || plan.selection.bangbooId || plan.teamAccountFactBinding
      ? []
      : ['邦布未记录']),
  ]
  const savedBangbooStars = plan.teamPortfolioSnapshot
    ? undefined
    : savedPlanBangbooStars(plan, plan.selection.bangbooId)
  return {
    id: `saved:${plan.id}`,
    candidateId: null,
    detailCandidateId: null,
    kind: 'saved',
    familyKey: `saved:${plan.id}`,
    title: savedPlanDisplayName(plan),
    agentIds: savedMemberIds,
    formedTeamReference: plan.solutionContext?.formedTeamReference,
    deploymentOrder: plan.teamExecutionSnapshot?.deploymentOrder,
    coreAgentIds: savedMemberIds.slice(0, 2),
    mechanism: '已保存的队伍配装',
    outputModule:
      savedMemberIds.length === 3
        ? (resolveReviewedTeamOutputModule(savedMemberIds as [string, string, string]) ?? null)
        : null,
    bangbooId: plan.teamPortfolioSnapshot ? null : plan.selection.bangbooId,
    bangbooLabel: savedPlanBangbooLabel(plan),
    ...(savedBangbooStars ? { bangbooStars: savedBangbooStars } : {}),
    bangbooSuggestions: teamOverviewBangbooSuggestions(
      savedMemberIds,
      plan.selection.bangbooId,
      savedBangbooStars,
    ),
    stateLabel: '用户已保存',
    reason: savedPlanReason(plan, historicalDiscRefs.length),
    why: '这是你之前保存的队伍和装备。',
    readiness: gaps.length
      ? historicalDiscReferences.conflict || historicalDiscRefs.length > expectedDiscCount
        ? '已保存的驱动盘数量或记录不一致，需要重新匹配。原方案仍保留。'
        : '方案可恢复，部分配装仍需复核。'
      : '已保存的方案可打开查看。',
    gaps,
    advice: '打开后可查看或调整这份方案；查看新的队伍建议，请返回配队页重新分析。',
    boundary: '装备按保存时的记录展示；评级按当前版本的精确三人组合显示。',
    primaryLabel: '打开已保存方案',
    destination: `/loadouts/plans/${encodeURIComponent(plan.id)}`,
    recommendationRank: 0,
    executionStatus: null,
    primaryActions: [],
    impacts: [],
    bangbooAuthority: options.currentAuthority ? 'authoritative' : 'unknown',
    favoriteMatchCount: 0,
    favoriteLabel: null,
    favoriteReason: null,
    // Team Rating is an identity-scoped current reference. A benchmark additionally depends on
    // the exact equipment parameters and physical-disc input, so saved history stays unsupported
    // until a separately proven same-fingerprint contract exists.
    planningDps: null,
    planningDpsStatus: 'unsupported',
    cultivationPriority: options.currentAuthority?.cultivationPriority.tier ?? null,
    teamRatingBand:
      currentTeamRating?.rating.status === 'rated' ? currentTeamRating.rating.ratingBand : null,
    confidence:
      currentTeamRating?.rating.status === 'rated' ? currentTeamRating.rating.confidence : null,
    ratingAnalysis: currentTeamRating?.metaCalibration.analysis ?? null,
    recommendationScore: currentTeamRating?.metaCalibration.recommendationScore ?? null,
    graduationCompletion,
    mechanicValidity: currentTeamRating?.mechanicValidity ?? null,
    versionPosition: currentTeamRating?.metaCalibration.versionPosition ?? null,
    referencePerformanceStatus: currentTeamRating?.referencePerformance.status ?? null,
    calibrationStatus: currentTeamRating?.metaCalibration.status ?? null,
    outputPotentialBand: options.currentAuthority?.outputPotential?.band ?? null,
    teamStrengthOrder: options.currentAuthority?.teamStrengthOrder ?? null,
    cultivationPriorityOrder: options.currentAuthority?.cultivationPriorityOrder ?? null,
    authorityReasons: options.currentAuthority?.cultivationPriority.reasons ?? [],
    authorityTradeoffs: options.currentAuthority?.cultivationPriority.tradeoffs ?? [],
    authorityNextAction: options.currentAuthority?.cultivationPriority.nextAction ?? null,
    // Current source conditions do not turn a historical save into a current recommendation.
    playDirection: currentPlayForSavedPlan(plan, options.currentAuthority?.playDirection),
  }
}
