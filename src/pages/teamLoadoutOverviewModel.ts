import {
  authorityOnlyPresentationMetadata,
  recommendationItem,
  targetFitBangbooPresentation,
} from './teamLoadoutRecommendationItem'
export { unselectedBangbooReason } from './teamLoadoutRecommendationItem'
import type { AccountPlanningDraft } from '../accounts/types'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { getAgentName } from '../application/publicRosterNames'
import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
import {
  playerFacingExecutionBlocker,
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
import { resolveTeamPresentationFamily } from './teamSourceFamilyProjection'
import { authorityConsumerRecommendations } from '../application/authorityConsumerRecommendations'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import {
  compareTeamRecommendations,
  orderRecommendationFamilies,
} from './teamRecommendationOrdering'
import { projectTeamLoadoutCompletionCandidates } from './teamLoadoutCompletionCandidates'
import type {
  TeamLoadoutOverviewFamily,
  TeamLoadoutOverviewGroup,
  TeamLoadoutOverviewItem,
  TeamLoadoutOverviewModel,
  TeamLoadoutVisibleAnswer,
} from './teamLoadoutOverviewTypes'
export type * from './teamLoadoutOverviewTypes'

type BuildOverviewModelInput = {
  decision: AccountDecisionSnapshot
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

export function familyFromVariants(
  familyKey: string,
  variants: TeamLoadoutOverviewItem[],
): TeamLoadoutOverviewFamily {
  const ordered = [...variants].sort(
    variants.some((item) => item.kind === 'saved')
      ? (left, right) =>
          right.recommendationRank - left.recommendationRank || left.id.localeCompare(right.id)
      : compareTeamRecommendations,
  )
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

/**
 * A target fit is an exact, user-requested result from the same analysis run.
 * Project it onto that exact variant without changing source rank, score, or family identity.
 */
export function projectTargetTeamFitsIntoOverviewModel(
  model: TeamLoadoutOverviewModel,
  targetTeamFits: Readonly<Record<string, TargetTeamWarehouseFitQueryResult>>,
): TeamLoadoutOverviewModel {
  const fits = Object.values(targetTeamFits)
  if (!fits.length) return model
  const exactMembersKey = (ids: readonly string[]) =>
    ids.length === 3 && new Set(ids).size === 3 ? [...ids].sort().join('|') : null
  const groups = model.groups.map((group) => ({
    ...group,
    items: group.items.map((family) => {
      let checkedVariant: TeamLoadoutOverviewItem | undefined
      const variants = family.variants.map((variant) => {
        const sourceFit = fits.find(
          (candidate) =>
            candidate.candidateId === variant.detailCandidateId ||
            candidate.candidateId === variant.candidateId,
        )
        // Older pages can return a duplicate candidate removed by exact-trio
        // deduplication. Within this analysis run, recover only the same three
        // members; another third member or an unrelated saved plan is not a match.
        const memberKey = exactMembersKey(variant.agentIds)
        const fit =
          sourceFit ??
          (variant.kind !== 'saved' && memberKey
            ? fits.find((candidate) => exactMembersKey(candidate.memberIds) === memberKey)
            : undefined)
        if (!fit) return variant
        const summary = presentTeamExecutionSummary(fit.targetExecution)
        const concreteGaps = [...fit.warehousePlan.gaps, ...fit.targetExecution.blockers].map(
          playerFacingExecutionBlocker,
        )
        const projected = {
          ...variant,
          ...targetFitBangbooPresentation(fit, variant),
          kind:
            summary.status === 'direct' || summary.status === 'adjust' ? 'buildable' : 'progress',
          stateLabel: summary.statusLabel,
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
        } satisfies TeamLoadoutOverviewItem
        checkedVariant ??= projected
        return projected
      })
      if (!checkedVariant) return family
      const rebuilt = familyFromVariants(family.variants[0]!.familyKey, variants)
      return {
        ...rebuilt,
        id: family.id,
        stateLabel:
          variants.length > 1
            ? `${checkedVariant.stateLabel} · ${variants.length} 种搭配`
            : checkedVariant.stateLabel,
        reason: checkedVariant.reason,
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

export function buildTeamLoadoutOverviewModel({
  decision,
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
      savedPlanItem(plan, {
        currentAuthority: currentAuthorityForSavedPlan(plan, decision.decisionAuthority),
        currentTeamRating: currentTeamRatingForSavedPlan(plan, decision.decisionAuthority),
        availableDiscIds,
        warehouse,
      }),
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
  const families = recommendationFamilies(recommendations)
  const hardPreference = decision.portfolioInput.preference
  const satisfiesHardPreference = (family: TeamLoadoutOverviewFamily) =>
    family.variants.some(
      (variant) =>
        hardPreference.fixedAgentIds.every((agentId) => variant.agentIds.includes(agentId)) &&
        hardPreference.fixedBangbooIds.every((bangbooId) => variant.bangbooId === bangbooId) &&
        (hardPreference.templateIds.length === 0 ||
          hardPreference.templateIds.includes(variant.candidateId ?? '')),
    )
  // Authority order already combines Team Strength with the account cultivation tie-breaks.
  // Execution is retained as a card state, never as a second ranking or a reason to hide an
  // owned exact Authority direction from the primary BOX journey.
  const visibleRecommendationFamilies = families.filter(satisfiesHardPreference)
  const restrictedFamilies = families.filter((family) => !satisfiesHardPreference(family))
  const savedFamilies = saved.map((item) => familyFromVariants(item.familyKey, [item]))
  const completionCandidates = ownedAgentIds
    ? projectTeamLoadoutCompletionCandidates({
        rejected: decision.teamEngine.rejected ?? [],
        ownedAgentIds,
        availableAgentIds,
        pack: current31TeamEngineD1Pack,
      })
    : []
  const contextDecision = recommendations.find((item) =>
    contextAgentId ? item.agentIds.includes(contextAgentId) : false,
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
  const visibleBlockers = [
    ...new Set([
      ...claim.blockers.map(visibleDecisionText),
      ...decision.claims.teamEngine.blockers.map(visibleDecisionText),
      ...decision.claims.coordination.blockers.map(visibleDecisionText),
      ...(decision.decisionAuthority.status === 'ready'
        ? []
        : decision.decisionAuthority.blockers.map(visibleDecisionText)),
    ]),
  ]
  const restrictedByHardConstraints =
    decision.hardConstraints.active.length > 0 && visibleRecommendationFamilies.length === 0
  const answer = {
    status: claim.status,
    title: visibleRecommendationFamilies.length
      ? '当前 BOX 已形成队伍建议'
      : claim.status === 'unsupported'
        ? '当前 BOX 暂无队伍建议'
        : claim.status === 'limited'
          ? '当前 BOX 只有待培养方向'
          : '当前 BOX 暂无队伍建议',
    summary: visibleRecommendationFamilies.length
      ? '优先推荐有攻略支持的队伍，选定后搭配装备。'
      : '可查看下方培养方向，或调整固定成员与邦布。',
    // Once this Run has a real executable answer, capability-boundary diagnostics belong in the
    // selected team detail/Evidence instead of displacing the overview's primary decision.
    blockers: visibleRecommendationFamilies.length ? [] : visibleBlockers,
    boundary: visibleDecisionText([...new Set(claim.forbids)].join('；')),
    fingerprint: decision.fingerprint.inputHash,
  } satisfies TeamLoadoutVisibleAnswer
  const groups = (
    [
      {
        kind: 'recommended',
        label: '当前推荐',
        description: '按评级与评分从高到低排列，选定后搭配装备。',
        items: visibleRecommendationFamilies,
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
  ).filter((group) => group.items.length || (group.completionCandidates?.length ?? 0) > 0)
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
          familyCount: families.length,
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
          familyCount: families.length,
          adapterDroppedCount: 0,
          numericCandidateCount: decision.decisionAuthority.coverage.ratedFormationCount,
          numericLegalCandidateCount: decision.decisionAuthority.coverage.inputFormationCount,
        },
    groups,
    initialSelectedId:
      visibleRecommendationFamilies[0]?.id ??
      (contextDecision
        ? `family:${contextDecision.familyKey}`
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
