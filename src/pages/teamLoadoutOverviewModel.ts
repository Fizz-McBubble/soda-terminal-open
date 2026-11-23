import { withTeamGuidePreferencePresentations } from '../decision/teamGuidePreferencePresentation'
import {
  authorityOnlyPresentationMetadata,
  recommendationItem,
  targetFitBangbooPresentation,
  withCurrentTeamSystemRanking,
} from './teamLoadoutRecommendationItem'
export { unselectedBangbooReason } from './teamLoadoutRecommendationItem'
import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { getAgentName } from '../application/publicRosterNames'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import type { TeamLoadoutCapturedFit } from './teamLoadoutOverviewTypes'
import {
  playerFacingExecutionBlocker,
  presentTeamExecution,
  presentTeamExecutionSummary,
} from './teamExecutionPresentation'
import { defaultSchemeBangbooId } from './teamLoadoutDecisionViewModel'
import {
  currentAuthorityForSavedPlan,
  currentTeamRatingForSavedPlan,
  isContextSavedPlan,
  savedPlanItem,
} from './teamLoadoutSavedPlanProjection'
import { visibleDecisionText } from './teamLoadoutVisibleDecisionText'
import { authorityConsumerRecommendations } from '../application/authorityConsumerRecommendations'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { orderRecommendationFamilies } from './teamRecommendationOrdering'
import { familyFromVariants } from './teamLoadoutFamily'
export { familyFromVariants } from './teamLoadoutFamily'
import { projectTeamLoadoutCompletionCandidates } from './teamLoadoutCompletionCandidates'
import { genericTeamRatingScopeCopy } from './teamRatingText'
import { referenceRecommendationFamilies } from './teamRecommendationVisibility'
import { currentTeamCultivation, formedCultivationGaps } from '../application/formedCultivationGaps'
import type {
  TeamLoadoutOverviewGroup,
  TeamLoadoutOverviewItem,
  TeamLoadoutOverviewModel,
  TeamLoadoutVisibleAnswer,
} from './teamLoadoutOverviewTypes'
export type * from './teamLoadoutOverviewTypes'

type BuildOverviewModelInput = {
  decision: AccountDecisionSnapshot
  /** Saved teams retain their exact authority from the full BOX before reservations. */
  savedPlanDecision?: AccountDecisionSnapshot
  savedPlans: AccountPlanningDraft[]
  warehouse?: Pick<CoreWarehouse, 'roster' | 'discs'>
  /**
   * The adapter supplies the current BOX roster. Without it, completion facts
   * deliberately stay hidden instead of inferring ownership from rejections.
   */
  ownedAgentIds?: readonly string[]
  /** Members still allowed to participate after optional remaining-BOX reservations. */
  availableAgentIds?: readonly string[]
  /** Current warehouse identity is used only to disclose missing historical saved references. */
  availableDiscIds?: readonly string[]
  contextAgentId?: string | null
  contextPlanId?: string | null
  contextDiscId?: string | null
}

/**
 * A target fit is an exact, user-requested result from the same analysis run.
 * Project it onto that exact variant without changing source rank, score, or family identity.
 */
export function projectTargetTeamFitsIntoOverviewModel(
  model: TeamLoadoutOverviewModel,
  targetTeamFits: Readonly<Record<string, TeamLoadoutCapturedFit>>,
  warehouse?: CoreWarehouse,
): TeamLoadoutOverviewModel {
  const fits = Object.values(targetTeamFits)
  if (!fits.length) return model
  const exactMembersKey = (ids: readonly string[]) =>
    ids.length === 3 && new Set(ids).size === 3 ? [...ids].sort().join('|') : null
  const groups = model.groups.map((group) => ({
    ...group,
    items: group.items.map((family) => {
      let changed = false
      const variants = family.variants.map((variant) => {
        const memberKey = exactMembersKey(variant.agentIds)
        const sourceFit = fits.find(
          (candidate) =>
            memberKey !== null &&
            (candidate.candidateId === variant.detailCandidateId ||
              candidate.candidateId === variant.candidateId) &&
            exactMembersKey(candidate.memberIds) === memberKey &&
            exactMembersKey(candidate.targetExecution?.memberIds ?? []) === memberKey,
        )
        // Older pages can return a duplicate candidate removed by exact-trio
        // deduplication. Within this analysis run, recover only the same three
        // members; another third member or an unrelated saved plan is not a match.
        const legacyMatches =
          !sourceFit && variant.kind !== 'saved' && memberKey
            ? fits.filter(
                (candidate) =>
                  exactMembersKey(candidate.memberIds) === memberKey &&
                  exactMembersKey(candidate.targetExecution?.memberIds ?? []) === memberKey,
              )
            : []
        const fit = sourceFit ?? (legacyMatches.length === 1 ? legacyMatches[0] : undefined)
        if (!fit) return variant
        const summary = presentTeamExecutionSummary(fit.targetExecution, warehouse)
        const concreteGaps = [...fit.warehousePlan.gaps, ...fit.targetExecution.blockers].map(
          playerFacingExecutionBlocker,
        )
        const projected = {
          ...variant,
          ...targetFitBangbooPresentation(fit, variant),
          kind:
            variant.kind === 'saved'
              ? 'saved'
              : summary.status === 'direct' || summary.status === 'adjust'
                ? 'buildable'
                : 'progress',
          stateLabel: variant.kind === 'saved' ? '已保存' : summary.statusLabel,
          reason: summary.headline,
          readiness: summary.headline,
          gaps: [...new Set(concreteGaps)],
          advice: summary.primaryActions[0]
            ? `下一步：${summary.primaryActions[0]}。`
            : summary.status === 'build'
              ? '调整配装条件后重新搭配。'
              : '查看配装并确认。',
          executionStatus: summary.status,
          primaryActions: summary.primaryActions,
          impacts: summary.impacts,
          ...(warehouse
            ? {
                memberEquipment: presentTeamExecution(
                  fit.targetExecution,
                  warehouse,
                  fit.warehousePlan.loadouts,
                ).members,
              }
            : {}),
        } satisfies TeamLoadoutOverviewItem
        changed = true
        return projected
      })
      if (!changed) return family
      const rebuilt = familyFromVariants(family.variants[0]!.familyKey, variants)
      return {
        ...rebuilt,
        id: family.id,
      }
    }),
  }))
  return { ...model, groups }
}

function recommendationFamilies(recommendations: TeamLoadoutOverviewItem[]) {
  const grouped = new Map<string, TeamLoadoutOverviewItem[]>()
  const seenMemberSets = new Set<string>()
  for (const recommendation of recommendations) {
    // Authority order is already established. A reordered trio or a different
    // Bangboo is the same recommendation, not another member variant. Keep the
    // first complete row; never merge fields or choose the largest rating.
    const memberKey = [...recommendation.agentIds].sort().join('|')
    if (seenMemberSets.has(memberKey)) continue
    seenMemberSets.add(memberKey)
    const family = grouped.get(recommendation.familyKey) ?? []
    family.push(recommendation)
    grouped.set(recommendation.familyKey, family)
  }
  return orderRecommendationFamilies(
    [...grouped.entries()].map(([familyKey, variants]) => familyFromVariants(familyKey, variants)),
  )
}

function recommendedFamilies(items: TeamLoadoutOverviewItem[]) {
  const admitted = items.filter((item) => item.defaultEligible === true)
  if (!admitted.length || admitted.length === items.length) return recommendationFamilies(items)
  const defaults = recommendationFamilies(admitted)
  const supplementary = new Map(
    recommendationFamilies(items.filter((item) => item.defaultEligible !== true)).map((family) => [
      family.id,
      family,
    ]),
  )
  const combined = defaults.map((family) => {
    const extra = supplementary.get(family.id)
    if (!extra) return family
    supplementary.delete(family.id)
    const exactTeams = new Set(
      family.variants.map((variant) => [...variant.agentIds].sort().join('|')),
    )
    return {
      ...family,
      variants: [
        ...family.variants,
        ...extra.variants.filter(
          (variant) => !exactTeams.has([...variant.agentIds].sort().join('|')),
        ),
      ],
    }
  })
  return [...combined, ...supplementary.values()]
}

export function buildTeamLoadoutOverviewModel({
  decision,
  savedPlanDecision = decision,
  savedPlans,
  warehouse,
  ownedAgentIds,
  availableAgentIds,
  availableDiscIds,
  contextAgentId,
  contextPlanId,
  contextDiscId,
}: BuildOverviewModelInput): TeamLoadoutOverviewModel {
  const saved = savedPlans
    .filter((plan) => plan.kind === 'team')
    .sort(
      (left, right) =>
        Number(isContextSavedPlan(right, contextPlanId, contextDiscId, contextAgentId)) -
          Number(isContextSavedPlan(left, contextPlanId, contextDiscId, contextAgentId)) ||
        right.updatedAt.localeCompare(left.updatedAt),
    )
    .map((plan) =>
      withCurrentTeamSystemRanking(
        savedPlanItem(plan, {
          currentAuthority: currentAuthorityForSavedPlan(plan, savedPlanDecision.decisionAuthority),
          currentTeamRating: currentTeamRatingForSavedPlan(
            plan,
            savedPlanDecision.decisionAuthority,
          ),
          availableDiscIds,
          warehouse,
        }),
      ),
    )
  const memberKey = (memberIds: readonly string[]) => [...memberIds].sort().join('|')
  const engineByMembers = new Map<
    string,
    AccountDecisionSnapshot['teamEngine']['recommendations']
  >()
  for (const engine of decision.teamEngine.recommendations) {
    const key = memberKey(engine.memberIds)
    engineByMembers.set(key, [...(engineByMembers.get(key) ?? []), engine])
  }
  const allAuthorityRecommendations = authorityConsumerRecommendations(decision.decisionAuthority)
  const authorityRecommendations = allAuthorityRecommendations
  const authorityReady = decision.decisionAuthority.status === 'ready'
  const recommendations = (() => {
    if (!authorityReady)
      return decision.teamEngine.recommendations.map((engine, index) =>
        recommendationItem(decision, engine, null, index, 0),
      )

    const authorityItems = authorityRecommendations.map((authority, index, authorities) => {
      const exactEngine = (engineByMembers.get(memberKey(authority.memberIds)) ?? []).find(
        (item) =>
          authority.bangbooId
            ? defaultSchemeBangbooId(item) === authority.bangbooId
            : item.bangbooSelection?.status === 'selected' ||
              item.bangbooSelection?.status === 'no_authoritative_recommendation' ||
              item.bangbooSelection?.status === 'compatible_fallback',
      )
      return recommendationItem(
        decision,
        exactEngine ?? authorityOnlyPresentationMetadata(authority),
        authority,
        index,
        authorities.length,
      )
    })
    return authorityItems
  })()
  for (const item of [...recommendations, ...saved]) {
    if (warehouse)
      item.currentMemberCultivation = currentTeamCultivation(item.agentIds, warehouse.roster)
    if (warehouse && item.formedTeamReference)
      item.formedCultivationGaps = formedCultivationGaps(item.formedTeamReference, warehouse.roster)
  }
  const hardPreference = decision.portfolioInput.preference
  const eligible = recommendations.filter(
    (variant) =>
      hardPreference.fixedAgentIds.every((agentId) => variant.agentIds.includes(agentId)) &&
      hardPreference.fixedBangbooIds.every((bangbooId) => variant.bangbooId === bangbooId) &&
      (!hardPreference.templateIds.length ||
        hardPreference.templateIds.includes(variant.candidateId ?? '')),
  )
  // Select exact trios before deduplication: a later Bangboo/template may satisfy the lock.
  const visibleRecommendationFamilies = recommendedFamilies(eligible)
  const referenceFamilies = referenceRecommendationFamilies(visibleRecommendationFamilies)
  const eligibleTrios = new Set(eligible.map((item) => memberKey(item.agentIds)))
  const restrictedFamilies = recommendationFamilies(
    recommendations.filter((item) => !eligibleTrios.has(memberKey(item.agentIds))),
  ).map((family) => ({ ...family, id: `development:${family.id}` }))
  const savedFamilies = saved.map((item) => familyFromVariants(item.familyKey, [item]))
  const familyCount = new Set(
    [...visibleRecommendationFamilies, ...restrictedFamilies].map(
      (family) => family.variants[0]!.familyKey,
    ),
  ).size
  const completionCandidates = ownedAgentIds
    ? projectTeamLoadoutCompletionCandidates({
        ownedAgentIds,
        availableAgentIds,
        rosterAgents: warehouse?.roster.agents,
        pack: current31TeamEngineD1Pack,
      })
    : []
  const contextFamily =
    contextAgentId &&
    restrictedFamilies.find((family) =>
      family.variants.some((item) => item.agentIds.includes(contextAgentId)),
    )
  const contextSaved = saved.find((item) =>
    savedPlans.some(
      (plan) =>
        item.id === `saved:${plan.id}` &&
        (plan.id === contextPlanId ||
          Boolean(contextDiscId && plan.warehouseRefs.includes(contextDiscId))),
    ),
  )
  const claim = decision.claims.overall
  const restrictedByHardConstraints =
    decision.hardConstraints.active.length > 0 && visibleRecommendationFamilies.length === 0
  const answer = {
    status: claim.status,
    title: visibleRecommendationFamilies.length
      ? '当前账户已形成队伍建议'
      : claim.status === 'unsupported'
        ? '当前账户暂无队伍建议'
        : claim.status === 'limited' && (restrictedFamilies.length || completionCandidates.length)
          ? '当前账户只有待培养方向'
          : '当前账户暂无队伍建议',
    summary: visibleRecommendationFamilies.length
      ? '优先推荐有搭配资料支持的队伍，选定后可继续搭配装备。'
      : restrictedFamilies.length || completionCandidates.length
        ? '可查看下方培养方向，或调整固定成员与邦布。'
        : ownedAgentIds && ownedAgentIds.length < 3
          ? '已记录的代理人不足三名，请先在资产中补充已拥有代理人。'
          : '本次暂无推荐队伍。',
    blockers: [],
    boundary: visibleDecisionText([...new Set(claim.forbids)].join('；')),
    fingerprint: decision.fingerprint.inputHash,
  } satisfies TeamLoadoutVisibleAnswer
  const groups = (
    [
      {
        kind: 'recommended',
        label: '当前推荐',
        description: `${genericTeamRatingScopeCopy.listDescription}同档无已发布关系时保持并列。`,
        items: visibleRecommendationFamilies,
        referenceItems: referenceFamilies,
      },
      {
        kind: 'saved',
        label: '已保存方案',
        description: '你主动保存的队伍，可继续查看和调整。',
        items: savedFamilies,
      },
      {
        kind: 'development',
        label: '培养方向',
        description: restrictedByHardConstraints
          ? '当前固定条件下暂时不能使用。'
          : restrictedFamilies.length
            ? '这些方向与当前固定条件不符，调整条件后可再分析。'
            : completionCandidates.length
              ? '以下搭配仍缺成员；已拥有成员的队伍请看上方推荐。'
              : '当前账户还没有可继续培养的队伍方向。',
        items: restrictedFamilies,
        completionCandidates,
      },
    ] satisfies TeamLoadoutOverviewGroup[]
  ).filter(
    (group) =>
      group.items.length ||
      (group.referenceItems?.length ?? 0) > 0 ||
      (group.completionCandidates?.length ?? 0) > 0,
  )
  return {
    answer,
    coverage: decision.teamEngineCoverage
      ? {
          available: true,
          ownedAgentCount: decision.teamEngineCoverage.input.ownedAgentCount,
          ownedAgentRuleCount: decision.teamEngineCoverage.source.ownedAgentRuleCount,
          ownedAgentRuleGapCount: decision.teamEngineCoverage.source.ownedAgentRuleGapCount,
          recommendationCount:
            decision.decisionAuthority.status === 'ready' ? allAuthorityRecommendations.length : 0,
          rejectedCount: decision.teamEngineCoverage.stages.rejected.total,
          familyCount,
          adapterDroppedCount: decision.teamEngineCoverage.adapter.droppedRecommendations,
          numericCandidateCount: decision.decisionAuthority.coverage.ratedFormationCount,
          numericLegalCandidateCount: decision.decisionAuthority.coverage.inputFormationCount,
        }
      : {
          available: false,
          ownedAgentCount: new Set(
            [
              ...decision.teamEngine.recommendations,
              ...(decision.teamEngine.rejected ?? []),
            ].flatMap((candidate) => candidate.memberIds),
          ).size,
          ownedAgentRuleCount: 0,
          ownedAgentRuleGapCount: 0,
          recommendationCount:
            decision.decisionAuthority.status === 'ready' ? allAuthorityRecommendations.length : 0,
          rejectedCount: decision.teamEngine.rejected?.length ?? 0,
          familyCount,
          adapterDroppedCount: 0,
          numericCandidateCount: decision.decisionAuthority.coverage.ratedFormationCount,
          numericLegalCandidateCount: decision.decisionAuthority.coverage.inputFormationCount,
        },
    groups: withTeamGuidePreferencePresentations(groups),
    initialSelectedId:
      visibleRecommendationFamilies[0]?.id ??
      (contextFamily
        ? contextFamily.id
        : contextSaved
          ? `family:${contextSaved.familyKey}`
          : (savedFamilies[0]?.id ?? restrictedFamilies[0]?.id ?? null)),
    contextNote: contextAgentId
      ? `已带入 ${getAgentName(contextAgentId)} 的当前上下文`
      : contextDiscId
        ? '正在查看这张驱动盘可能影响的队伍'
        : contextPlanId
          ? '已带入上游保存方案'
          : null,
  }
}
