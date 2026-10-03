import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import { getAgentName } from '../application/publicRosterNames'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { defaultSchemeBangbooId, teamRecommendationFamilyKey } from './teamLoadoutDecisionViewModel'
import { visibleDecisionText } from './teamLoadoutVisibleDecisionText'
import { resolveCurrent31TeamFamily } from '../decision/current31TeamCoreAggregation'
import { resolveTeamPresentationFamily } from './teamSourceFamilyProjection'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewModel'
import { reviewedTeamCombatEvidence } from '../decision/reviewedTeamCombatEvidence'
import { targetTeamBangbooOptions } from '../decision/targetTeamSourceBangbooOptions'
import { isReviewedFallbackTeam } from '../decision/reviewedTeamRecommendationDisposition'
import { reviewedTeamPreferences } from '../decision/reviewedTeamPreferences'

/** Returning from a fit shows the actual scheme choice without changing its source rating. */
export function targetFitBangbooPresentation(
  fit: TargetTeamWarehouseFitQueryResult,
  variant: TeamLoadoutOverviewItem,
): Partial<TeamLoadoutOverviewItem> {
  const bangbooId = fit.effectiveEquipmentParameters?.bangbooId
  if (!bangbooId) return {}
  return {
    bangbooId,
    deploymentOrder: fit.targetExecution.deploymentOrder,
    bangbooLabel: playerFacingBangbooLabel(bangbooId),
    bangbooReason: null,
    bangbooAlternativeIds: fit.equipmentRecommendations.bangboo.alternativeBangbooIds,
    bangbooAuthority: bangbooId === variant.bangbooId ? variant.bangbooAuthority : 'unknown',
    combatEvidence: reviewedTeamCombatEvidence(variant.agentIds, bangbooId),
  }
}

type AuthorityRecommendation = Extract<
  AccountDecisionSnapshot['decisionAuthority'],
  { status: 'ready' }
>['recommendations'][number]

export function unselectedBangbooReason(
  selection: TeamEngineCandidate['bangbooSelection'] | undefined,
) {
  if (!selection) return '本队还没选邦布，进入配装后查看可选搭配。'
  switch (selection.status) {
    case 'no_activation_match':
      return '暂时没找到满足本队加成条件的邦布，可以调整队员后再试。'
    case 'activation_unknown':
      return '邦布加成条件的资料不全，暂时无法判断哪些适合本队。'
    case 'not_evaluated':
      return visibleDecisionText(selection.reason)
    case 'no_authoritative_recommendation':
      return selection.bangbooIds.length
        ? '有能触发额外加成的邦布，进入配装后选择要使用的那只。'
        : '暂时无法确定合适的邦布，还需要核对搭配资料。'
    case 'compatible_fallback':
      return `可用邦布：${playerFacingBangbooLabel(selection.bangbooId)}；进入配装后查看额外能力条件。`
    case 'selected':
      return '本队还没选邦布，进入配装后选择。'
  }
}

export function authorityOnlyPresentationMetadata(
  authority: AuthorityRecommendation,
): TeamEngineCandidate {
  // The Authority owns this exact identity. This deliberately contains only
  // display/execution metadata; it never redefines or filters the Authority set.
  return {
    candidateId: authority.candidateId,
    kernelId: null,
    familyId: resolveCurrent31TeamFamily(authority.memberIds).familyId,
    label: authority.memberIds.map(getAgentName).join(' · '),
    memberIds: [authority.memberIds[0], authority.memberIds[1], authority.memberIds[2]],
    bangbooId: authority.bangbooId,
    bangbooSelection: authority.bangbooId
      ? { status: 'selected', bangbooId: authority.bangbooId }
      : authority.bangbooAlternativeIds?.length
        ? { status: 'no_authoritative_recommendation', bangbooIds: authority.bangbooAlternativeIds }
        : { status: 'not_evaluated', reason: '这套队伍还没有确定邦布。' },
    scenarioTags: [],
    classification: 'transitional',
    strengthTier: null,
    metaBand: null,
    score: 0,
    preferredAgentCount: 0,
    claim: authority.bangbooId ? '为这支队伍搭配装备。' : '选择邦布，再搭配装备。',
    failures: [],
    trace: [],
    sourceIds: [],
  }
}

export function recommendationItem(
  decision: AccountDecisionSnapshot,
  recommendation: AccountDecisionSnapshot['teamEngine']['recommendations'][number],
  authority:
    | Extract<
        AccountDecisionSnapshot['decisionAuthority'],
        { status: 'ready' }
      >['recommendations'][number]
    | null,
  index: number,
  authorityCount: number,
): TeamLoadoutOverviewItem {
  const favoriteAgentIds = recommendation.memberIds.filter((agentId) =>
    decision.portfolioInput.preferredAgentIds.includes(agentId),
  )
  const sourceSchemeBangbooId = authority
    ? authority.bangbooId
    : defaultSchemeBangbooId(recommendation)
  // The fit route uses the same exact-trio shortlist when no source default was
  // bound. Fill the initial card from it without changing the candidate identity.
  const bangbooOptions = authority?.authorComparisonMembership
    ? []
    : targetTeamBangbooOptions({ memberIds: recommendation.memberIds })
  const defaultOptions = sourceSchemeBangbooId ? [] : bangbooOptions
  const automaticBangbooId = defaultOptions[0]?.bangbooId ?? null
  const schemeBangbooId = sourceSchemeBangbooId ?? automaticBangbooId
  const detailCandidateId =
    authority &&
    !authority.bangbooId &&
    (recommendation.bangbooSelection?.status === 'selected' ||
      recommendation.bangbooSelection?.status === 'no_authoritative_recommendation' ||
      recommendation.bangbooSelection?.status === 'compatible_fallback') &&
    decision.teamEngine.recommendations.some(
      (candidate) => candidate.candidateId === recommendation.candidateId,
    )
      ? recommendation.candidateId
      : (authority?.candidateId ?? recommendation.candidateId)
  const hardPreference = decision.portfolioInput.preference
  const memberKey = [...recommendation.memberIds].sort().join('|')
  const preferredOverMemberKeys = reviewedTeamPreferences
    .forTeam(recommendation.memberIds)
    .filter((fact) => [...fact.preferredMemberIds].sort().join('|') === memberKey)
    .map((fact) => [...fact.alternativeMemberIds].sort().join('|'))
  const hardPreferenceSatisfied =
    hardPreference.fixedAgentIds.every((agentId) => recommendation.memberIds.includes(agentId)) &&
    hardPreference.fixedBangbooIds.every((bangbooId) => schemeBangbooId === bangbooId) &&
    (hardPreference.templateIds.length === 0 ||
      hardPreference.templateIds.includes(recommendation.candidateId))
  // Global account allocation is not a warehouse fit for this selected trio.
  // Only projectTargetTeamFitsIntoOverviewModel may add a concrete fit state.
  const gaps = [
    ...recommendation.failures.map((failure) => visibleDecisionText(failure.detail)),
    ...(!hardPreferenceSatisfied ? ['这支队伍不满足你设置的固定条件，请调整固定成员或邦布。'] : []),
  ]
  return {
    id: `decision:${authority?.candidateId ?? recommendation.candidateId}`,
    candidateId: authority?.candidateId ?? recommendation.candidateId,
    detailCandidateId,
    kind: 'direction',
    // Family identity is source-backed. Availability remains a variant property,
    // so a build direction cannot become a second visual family merely because it
    // has not closed the same physical-equipment gate yet.
    familyKey: teamRecommendationFamilyKey(recommendation),
    title: recommendation.label,
    agentIds: [...recommendation.memberIds],
    coreAgentIds: [...resolveTeamPresentationFamily(recommendation.memberIds).coreAgentIds],
    mechanism: visibleDecisionText(
      recommendation.trace.find((step) => step.stage === 'pair_synergy')?.detail ??
        recommendation.claim,
    ),
    bangbooId: schemeBangbooId,
    bangbooAlternativeIds: automaticBangbooId
      ? defaultOptions.slice(1).map((option) => option.bangbooId)
      : (authority?.bangbooAlternativeIds ??
        (recommendation.bangbooSelection && 'bangbooIds' in recommendation.bangbooSelection
          ? recommendation.bangbooSelection.bangbooIds
          : [])),
    bangbooSuggestions: bangbooOptions.map(({ bangbooId, defaultStars, recommendationReason }) => ({
      bangbooId,
      defaultStars,
      recommendationReason,
    })),
    bangbooLabel: schemeBangbooId ? playerFacingBangbooLabel(schemeBangbooId) : '邦布待确认',
    bangbooReason: schemeBangbooId
      ? null
      : unselectedBangbooReason(recommendation.bangbooSelection),
    stateLabel: '待配装',
    reason: '成员已齐，可开始配装。',
    why: visibleDecisionText(recommendation.claim),
    readiness: '待配装',
    gaps: [...new Set(gaps)],
    advice: !hardPreferenceSatisfied
      ? '先调整当前固定条件，再生成本队配装。'
      : !schemeBangbooId
        ? '选择邦布并生成本队配装。'
        : '为本队搭配装备。',
    boundary: visibleDecisionText(decision.claims.teamEngine.forbids.join('；')),
    primaryLabel: '搭配装备',
    destination: `/loadouts/team/${encodeURIComponent(detailCandidateId)}`,
    // Account Decision is the player-facing order. Benchmark output remains supporting evidence
    // and must never become a hidden tie-break in the BOX projection.
    recommendationRank: authority ? authorityCount - index : -index,
    preferredOverMemberKeys,
    executionStatus: null,
    primaryActions: [],
    impacts: [],
    bangbooAuthority: automaticBangbooId
      ? 'compatible'
      : recommendation.bangbooSelection?.status === 'selected'
        ? 'authoritative'
        : recommendation.bangbooSelection?.status === 'compatible_fallback'
          ? 'compatible'
          : 'unknown',
    favoriteMatchCount: favoriteAgentIds.length,
    favoriteLabel: favoriteAgentIds.length
      ? `包含收藏：${favoriteAgentIds.map(getAgentName).join('、')}`
      : null,
    favoriteReason: favoriteAgentIds.length
      ? '收藏不改变队伍评级，也不要求每队都包含收藏角色。'
      : null,
    planningDps: authority?.benchmarkOutput ?? null,
    planningDpsStatus: authority?.benchmarkOutput === null || !authority ? 'unsupported' : 'ready',
    cultivationPriority: authority?.cultivationPriority.tier ?? null,
    teamRatingBand: authority?.teamRating.ratingBand ?? null,
    confidence: authority?.teamRating.confidence ?? null,
    ratingAnalysis: authority?.metaCalibration?.analysis ?? null,
    recommendationScore: authority?.metaCalibration?.recommendationScore ?? null,
    inferredStrength: authority?.metaCalibration?.authority === 'model_inference',
    inferredPrimaryOutputAgentId:
      authority?.metaCalibration?.inference?.primaryOutputAgentId ?? null,
    mechanicValidity: authority?.mechanicValidity ?? null,
    combatEvidence: authority?.combatEvidence ?? null,
    versionPosition: authority?.metaCalibration?.versionPosition ?? null,
    referencePerformanceStatus: authority?.referencePerformance?.status ?? null,
    calibrationStatus: authority?.metaCalibration?.status ?? null,
    outputPotentialBand: authority?.outputPotential?.band ?? null,
    teamStrengthOrder: authority?.teamStrengthOrder ?? null,
    cultivationPriorityOrder: authority?.cultivationPriorityOrder ?? null,
    authorityReasons: authority?.cultivationPriority.reasons ?? [],
    authorityTradeoffs: authority?.cultivationPriority.tradeoffs ?? [],
    authorityNextAction: authority?.cultivationPriority.nextAction ?? null,
    sourceConfirmed:
      !authority?.authorComparisonMembership &&
      !authority?.hasPreparedBenchmark32 &&
      authority?.mainstreamRecognition?.status === 'confirmed',
    ...(authority?.hasPreparedBenchmark32 ? { hasPreparedBenchmark32: true } : {}),
    ...(authority?.authorComparisonMembership
      ? { authorComparisonMembership: authority.authorComparisonMembership }
      : {}),
    fallbackOnly: isReviewedFallbackTeam(recommendation.memberIds),
    sourceConditions:
      authority?.authorComparisonMembership?.conditions ??
      authority?.mainstreamRecognition?.conditions ??
      [],
    sourceBangbooOptionIds: authority?.mainstreamRecognition?.sourceBangbooOptionIds ?? [],
    historicalReferenceOnly: authority?.mainstreamRecognition?.historicalReferenceOnly ?? false,
  }
}
