import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import { authorityConsumerRecommendations } from '../application/authorityConsumerRecommendations'
import { resolveCurrent31TeamFamily } from '../decision/current31TeamCoreAggregation'
import { evaluateCurrent31TeamRating } from '../decision/current31TeamRating'
import { playerFacingAgentLabel, playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { savedPlanDisplayName } from '../application/savedPlanDisplayName'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { savedPlanGraduationCompletion } from './savedPlanGraduationCompletion'
import { attachSavedTeamDiscCompletion, savedTeamDiscCompletion } from './savedTeamDiscCompletion'
import { targetTeamBangbooOptions } from '../decision/targetTeamSourceBangbooOptions'

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
  let current: ReturnType<typeof evaluateCurrent31TeamRating>
  try {
    current = evaluateCurrent31TeamRating({
      candidateId: `saved-team-rating:${sortedMemberIds.join('+')}`,
      memberIds: sortedMemberIds,
      bangbooId: null,
      outputPotentialBand: 'unknown',
      benchmark: {
        status: 'unavailable',
        baselineId: null,
        outputIndex: null,
        unsupportedIssueIds: [],
        explanation: '保存方案仅复算当前三人参考评级，不借用历史配装 Benchmark。',
      },
    })
  } catch {
    return null
  }
  if (
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

/**
 * Persisted rows have carried the same historical entity links in more than one compatible
 * projection. Keep their union for read-only restore; filtering against the current warehouse
 * would silently turn a recorded 18-disc plan into a shorter plan.
 */
function savedPlanHistoricalDiscReferenceStatus(plan: AccountPlanningDraft) {
  const candidateWarehouseDiscIds =
    plan.candidateWarehouse?.loadouts.flatMap((loadout) => loadout.discIds) ?? []
  const executionMemberDiscIds =
    plan.teamExecutionSnapshot?.members.flatMap((member) => member.suggested.discIds) ?? []
  const portfolioExecutionDiscIds =
    plan.teamPortfolioSnapshot?.executions.flatMap((execution) => execution.physicalDiscIds) ?? []
  const portfolioMemberDiscIds =
    plan.teamPortfolioSnapshot?.executions.flatMap((execution) =>
      execution.members.flatMap((member) => member.suggested.discIds),
    ) ?? []
  const projections = [
    plan.warehouseRefs,
    candidateWarehouseDiscIds,
    ...(plan.teamExecutionSnapshot?.physicalDiscIds
      ? [plan.teamExecutionSnapshot.physicalDiscIds]
      : []),
    executionMemberDiscIds,
    ...(plan.teamPortfolioSnapshot?.uniquePhysicalDiscIds
      ? [plan.teamPortfolioSnapshot.uniquePhysicalDiscIds]
      : []),
    portfolioExecutionDiscIds,
    portfolioMemberDiscIds,
  ].filter((discIds) => discIds.length > 0)
  const normalized = projections.map((discIds) => [...new Set(discIds)].toSorted())
  const baseline = normalized[0]?.join('|') ?? ''
  return {
    references: [...new Set(projections.flat())],
    conflict: normalized.slice(1).some((discIds) => discIds.join('|') !== baseline),
  }
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
        execution.bangbooId ? playerFacingBangbooLabel(execution.bangbooId) : '未纳入',
      )
      .join(' · ')
  return plan.selection.bangbooId
    ? playerFacingBangbooLabel(plan.selection.bangbooId)
    : '邦布待选择'
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

export function savedPlanHistoricalDiscRefs(plan: AccountPlanningDraft) {
  return savedPlanHistoricalDiscReferenceStatus(plan).references
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
  const degradedCount =
    plan.candidateWarehouse?.loadouts.filter((loadout) => loadout.degraded).length ?? 0
  const quantitativeCompletion = (() => {
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
      ? [`还需补齐 ${expectedMemberCount - savedMemberIds.length} 名队伍成员`]
      : []),
    ...(historicalDiscRefs.length === expectedDiscCount
      ? []
      : [`当前保存了 ${historicalDiscRefs.length}/${expectedDiscCount} 张不同驱动盘`]),
    ...(historicalDiscReferences.conflict
      ? ['保存记录中的驱动盘信息不一致；已完整保留，需重新匹配后才能作为当前方案。']
      : []),
    ...(unavailableDiscCount
      ? [
          `已保存的驱动盘中有 ${unavailableDiscCount} 张当前不在仓库；原记录已保留，未自动缩减或替换。`,
        ]
      : []),
    ...(plan.teamPortfolioSnapshot || plan.selection.bangbooId || plan.teamAccountFactBinding
      ? []
      : ['尚未保存邦布方向']),
    ...(degradedCount ? [`${degradedCount} 名成员需要复核仓库替代盘`] : []),
  ]
  return {
    id: `saved:${plan.id}`,
    candidateId: null,
    detailCandidateId: null,
    kind: 'saved',
    familyKey: `saved:${plan.id}`,
    title: savedPlanDisplayName(plan),
    agentIds: savedMemberIds,
    deploymentOrder: plan.teamExecutionSnapshot?.deploymentOrder,
    coreAgentIds: savedMemberIds.slice(0, 2),
    mechanism: '已保存的队伍配装',
    bangbooId: plan.teamPortfolioSnapshot ? null : plan.selection.bangbooId,
    bangbooLabel: savedPlanBangbooLabel(plan),
    bangbooSuggestions: targetTeamBangbooOptions({ memberIds: savedMemberIds }).map(
      ({ bangbooId, defaultStars, recommendationReason }) => ({
        bangbooId,
        defaultStars,
        recommendationReason,
      }),
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
  }
}
