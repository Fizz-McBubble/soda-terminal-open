import { savedDiscAgentIds } from '../warehouse/discWarehousePlanAssignments'
import { warehouseDevelopmentAdvice } from './warehouseDevelopmentAdvice'
import { warehouseCompleteBuildUseAgentIds, warehouseRetentionBasis } from './warehouseRetention'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import type {
  WarehouseDiscCategory,
  WarehouseDiscDecision,
} from '../warehouse/discWarehouseAnalysis'
import { warehouseAnalysisRuleVersion } from '../warehouse/discWarehouseAnalysis'
import { authorityConsumerRecommendations } from './authorityConsumerRecommendations'
import type { AccountDecisionRun } from './calculationQueryContract'
import { savedTeamStatus } from './warehouseSavedTeamStatus'
import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
import { savedTeamRatedPlayId } from '../accounts/savedTeamRatingPlayIdentity'
import { warehousePlanReferences } from './warehousePlanReferences'
import { retentionUseMatchesRecommendedSet } from '../warehouse/warehouseRetentionGuidance'
import {
  type WarehouseActionItem,
  type WarehouseActionKind,
  type WarehouseActionNextStep,
  type WarehouseActionProjection,
  type WarehouseActionRecommendationBasis,
  type WarehouseActionStatus,
} from './warehouseActionContract'

export { warehouseActionLabels } from './warehouseActionContract'
export type {
  WarehouseActionItem,
  WarehouseActionKind,
  WarehouseActionProjection,
  WarehouseActionRecommendationState,
  WarehouseActionStatus,
} from './warehouseActionContract'

type WarehouseSource = AccountDecisionRun['snapshot']
type WarehouseProjectionRun = {
  runId: string
  input: Pick<AccountDecisionRun['input'], 'warehouse' | 'drafts'>
  snapshot: Pick<WarehouseSource, 'warehouse' | 'sideEffect'> & {
    account: Pick<WarehouseSource['account'], 'accountId'>
    fingerprint: Pick<WarehouseSource['fingerprint'], 'inputHash'>
    claims: { warehouse: Pick<WarehouseSource['claims']['warehouse'], 'status' | 'summary'> }
    decisionAuthority?: WarehouseSource['decisionAuthority']
  }
}

function actionForCategory(category: WarehouseDiscCategory): WarehouseActionKind {
  if (category === 'cleanup_candidate') return 'cleanup'
  if (category === 'replaceable') return 'enhance'
  if (category === 'enhance_watch') return 'enhance'
  return 'keep'
}

function uniqueInOrder(values: string[]) {
  return [...new Set(values)]
}

function evidenceNeedsReview(decision: WarehouseDiscDecision) {
  const independentTrial =
    decision.absoluteRetention?.disposition === 'observe' &&
    decision.absoluteRetention.reasonKind === 'try_next_upgrade' &&
    decision.absoluteRetention.nextAction?.kind === 'try_upgrade' &&
    decision.absoluteRetention.leadingUses.some(
      (use) =>
        decision.absoluteRetention?.witnessProfileIds?.includes(use.profileId) &&
        use.useState === 'valid' &&
        retentionUseMatchesRecommendedSet(use.guidance?.currentSet?.id, use),
    )
  return Boolean(
    decision.reviewDirection ||
    (decision.absoluteRetention
      ? decision.absoluteRetention.disposition === 'review' ||
        decision.absoluteRetention.policyCalibration !== 'approved' ||
        (decision.absoluteRetention.sourceCoverage !== 'complete' && !independentTrial) ||
        (decision.absoluteRetention.disposition === 'cleanup_candidate' &&
          !decision.cleanupSafety.complete) ||
        decision.absoluteRetention.nextAction?.kind === 'complete_data' ||
        decision.absoluteRetention.nextAction?.kind === 'check_condition' ||
        decision.absoluteRetention.nextAction?.kind === 'review_quality'
      : decision.category === 'replaceable' || !decision.cleanupSafety.complete),
  )
}

function statusesFor(
  decision: WarehouseDiscDecision,
  input: { stale: boolean },
): WarehouseActionStatus[] {
  const statuses: WarehouseActionStatus[] = []
  if (decision.cleanupSafety.favorite) statuses.push('favorite')
  if (decision.cleanupSafety.equipped) statuses.push('currently_equipped')
  if (decision.cleanupSafety.activePlanReferenced) statuses.push('active_plan_reference')
  if (decision.cleanupSafety.savedPlanReferenced) statuses.push('saved_plan_reference')
  if (decision.cleanupSafety.portfolioReferenced) statuses.push('selected_portfolio_reference')
  if (
    !decision.absoluteRetention &&
    decision.cleanupSafety.alternativeSafe &&
    decision.alternatives.length > 0
  )
    statuses.push('better_alternative')
  if (evidenceNeedsReview(decision)) statuses.push('needs_review')
  if (input.stale) statuses.push('stale')
  return statuses
}

function currentNextStep(
  decision: WarehouseDiscDecision,
  action: WarehouseActionKind,
  explicitlyProtected: boolean,
  hasCompleteBuildUse: boolean,
  needsReview: boolean,
): WarehouseActionNextStep {
  if (explicitlyProtected) {
    return {
      kind: 'keep',
      targetLevel: null,
      detail: '保留这张盘。',
      stopWhen: '',
    }
  }
  if (hasCompleteBuildUse) {
    return {
      kind: 'keep',
      targetLevel: null,
      detail: '按已核对的完整配装用途保留；继续投入前先核对对应方案条件。',
      stopWhen: '对应配装条件或实体分配变化后重新分析。',
    }
  }
  if (decision.absoluteRetention?.nextAction) {
    const { kind, targetLevel, detail, stopWhen } = decision.absoluteRetention.nextAction
    if (
      (kind !== 'manual_cleanup' || action === 'cleanup') &&
      (!needsReview || ['complete_data', 'check_condition', 'review_quality'].includes(kind))
    )
      return { kind, targetLevel, detail, stopWhen }
  }
  if (decision.reviewDirection === 'no_current_fit') {
    return {
      kind: 'complete_data',
      targetLevel: null,
      detail: '当前记录找不到适合用途，也未证明无人使用；先核对实际装备与保存方案记录。',
      stopWhen: '使用记录和适用分支未核对前暂停清理。',
    }
  }
  if (needsReview) {
    const missingSource =
      decision.absoluteRetention &&
      (decision.absoluteRetention.sourceCoverage !== 'complete' ||
        decision.absoluteRetention.policyCalibration !== 'approved')
    return {
      kind: missingSource ? 'complete_data' : 'check_condition',
      targetLevel: null,
      detail: '先保留，暂不继续强化。',
      stopWhen: '',
    }
  }
  if (action === 'cleanup') {
    return {
      kind: 'manual_cleanup',
      targetLevel: null,
      detail: '可列为清理候选。',
      stopWhen: '清理前在游戏内确认未装备，并检查方案使用情况。',
    }
  }
  if (action === 'enhance')
    return decision.absoluteRetention
      ? {
          kind: 'check_condition',
          targetLevel: null,
          detail: '先核对构筑条件和当前装备缺口。',
          stopWhen: '',
        }
      : {
          kind: 'try_upgrade',
          targetLevel: null,
          detail: '结合当前配装决定是否继续强化。',
          stopWhen: '用途条件或投入价值变化时重新分析。',
        }
  return {
    kind: 'keep',
    targetLevel: null,
    detail: '保留这张盘。',
    stopWhen: '',
  }
}

/**
 * Projects the already-captured Account Decision snapshot for the warehouse surface.
 * It deliberately only joins existing snapshot facts; it never invokes a warehouse
 * analyser, optimiser, Claim calculator, repository, or command.
 */
export function projectWarehouseActions(world: {
  run: WarehouseProjectionRun
  status: 'current' | 'stale'
}): WarehouseActionProjection {
  const { run } = world
  const snapshot = run.snapshot
  const warehouse = snapshot.warehouse
  if (!warehouse) throw new Error('仓库分析尚未完成。')
  const ruleVersionChanged = warehouse.ruleVersion !== warehouseAnalysisRuleVersion
  const stale = world.status === 'stale' || ruleVersionChanged
  const freshnessReason =
    world.status === 'stale'
      ? ('account_changed' as const)
      : ruleVersionChanged
        ? ('analysis_rule_changed' as const)
        : ('current_snapshot' as const)
  const discsById = new Map(run.input.warehouse.discs.map((disc) => [disc.id, disc]))
  const accountAgentIds = new Set(
    [
      ...run.input.warehouse.roster.agents
        .filter((agent) => agent.owned)
        .map((agent) => agent.agentId),
      ...run.input.drafts.flatMap((draft) => draft.selection.agentIds),
    ].map(resolveCurrentReleasedIdentity),
  )
  const draftsById = new Map(run.input.drafts.map((draft) => [draft.id, draft]))
  type AffectedTeam = WarehouseActionItem['affectedTeams'][number]
  const savedTeams = new Map<string, AffectedTeam>()
  const equippedOwners = new Map<string, string[]>()
  for (const agent of run.input.warehouse.roster.agents) {
    if (!agent.owned) continue
    for (const discId of new Set(agent.equippedDiscIds ?? [])) {
      const owners = equippedOwners.get(discId)
      if (owners) owners.push(agent.agentId)
      else equippedOwners.set(discId, [agent.agentId])
    }
  }
  const recommendations = stale ? [] : authorityConsumerRecommendations(snapshot.decisionAuthority)
  const recommendationByCandidate = new Map(recommendations.map((row) => [row.candidateId, row]))
  const actions = warehouse.decisions.flatMap((decision) => {
    const disc = discsById.get(decision.discId)
    // A snapshot only has decisions for the captured warehouse. Fail closed if a malformed
    // snapshot loses the physical object rather than inventing an identity for the page.
    if (!disc || disc.rarity !== 'S') return []
    const affectedPlans = warehousePlanReferences(
      decision.planIds.flatMap((id) => {
        const draft = draftsById.get(id)
        return draft ? [draft] : []
      }),
      decision.activePlanIds,
    )
    const affectedPlanStatuses = statusesFor(decision, { stale }).filter((status) => {
      if (status === 'active_plan_reference') return affectedPlans.some((plan) => plan.active)
      if (status === 'saved_plan_reference') return affectedPlans.length > 0
      return true
    })
    const affectedTeams = decision.planIds.flatMap((planId) => {
      const draft = draftsById.get(planId)
      if (draft?.kind !== 'team' || draft.selection.agentIds.length !== 3) return []
      const existing = savedTeams.get(planId)
      if (existing) return [existing]
      const memberIds = [...draft.selection.agentIds] as [string, string, string]
      const candidateId = draft.solutionContext?.sourceCandidateId ?? draft.id
      const recommendation = recommendationByCandidate.get(candidateId)
      const playId = savedTeamRatedPlayId(draft)
      const samePlay =
        draft.solutionContext?.ratedTeamPlayId === undefined ||
        (playId &&
          recommendation?.playDirection &&
          canonicalTeamPlayIdentity(recommendation.playDirection) === playId)
      const team: AffectedTeam = {
        planId,
        candidateId,
        memberIds,
        status: savedTeamStatus(draft, discsById),
        decisionAuthority:
          recommendation?.teamRating.status === 'rated' &&
          samePlay &&
          [...recommendation.memberIds].sort().join('|') === [...memberIds].sort().join('|')
            ? {
                teamRating: recommendation.teamRating.ratingBand,
                confidence: recommendation.teamRating.confidence,
                cultivationPriority: recommendation.cultivationPriority.tier,
              }
            : null,
      }
      savedTeams.set(planId, team)
      return [team]
    })
    const usageAgentIds = uniqueInOrder([
      ...(equippedOwners.get(decision.discId) ?? []),
      ...decision.planIds.flatMap((planId) => {
        const draft = draftsById.get(planId)
        return draft ? savedDiscAgentIds(draft, decision.discId) : []
      }),
    ])
    const completeBuildUseAgentIds = stale ? [] : warehouseCompleteBuildUseAgentIds(decision)
    const affectedAgentIds = uniqueInOrder([
      ...decision.fitAgentIds,
      ...usageAgentIds,
      ...completeBuildUseAgentIds,
    ])
    const baseAction = actionForCategory(decision.category)
    const cleanupBlocked =
      baseAction === 'cleanup' &&
      (!decision.cleanupSafety.complete ||
        !decision.cleanupSafety.deleteAfterFeasible ||
        (decision.absoluteRetention?.disposition ?? 'cleanup_candidate') !== 'cleanup_candidate')
    const needsReview = evidenceNeedsReview(decision) || cleanupBlocked
    const explicitlyProtected =
      decision.cleanupSafety.favorite ||
      decision.cleanupSafety.equipped ||
      decision.cleanupSafety.activePlanReferenced ||
      decision.cleanupSafety.savedPlanReferenced ||
      decision.cleanupSafety.portfolioReferenced
    const action =
      stale || explicitlyProtected || completeBuildUseAgentIds.length
        ? 'keep'
        : needsReview && baseAction === 'cleanup'
          ? 'enhance'
          : baseAction
    const retentionBasis =
      !stale && action === 'keep' ? warehouseRetentionBasis(decision, accountAgentIds) : undefined
    const recommendationBasis: WarehouseActionRecommendationBasis = explicitlyProtected
      ? 'explicit_protection'
      : completeBuildUseAgentIds.length
        ? 'recorded_use'
        : needsReview
          ? 'evidence_review'
          : decision.absoluteRetention
            ? 'absolute_quality'
            : 'unresolved'
    const finalRecommendation = stale
      ? null
      : {
          action,
          state: needsReview ? ('needs_review' as const) : ('current' as const),
          basis: recommendationBasis,
        }
    const nextStep: WarehouseActionNextStep = stale
      ? {
          kind: 'reanalyze',
          targetLevel: null,
          detail: '账户或分析版本已变化；先重新分析，旧方向不能作为当前建议执行。',
          stopWhen: '重新分析完成前暂停清理和投入决定。',
        }
      : currentNextStep(
          decision,
          action,
          explicitlyProtected,
          completeBuildUseAgentIds.length > 0,
          needsReview,
        )
    const decisionProfileIds = uniqueInOrder([
      ...(decision.absoluteRetention?.witnessProfileIds ?? []),
    ])
    if (
      decision.absoluteRetention?.bestUseProfileId &&
      !decisionProfileIds.includes(decision.absoluteRetention.bestUseProfileId)
    )
      decisionProfileIds.push(decision.absoluteRetention.bestUseProfileId)
    const profileEvidence = decision.absoluteRetention?.leadingUses ?? []
    const useRecorded =
      usageAgentIds.length > 0 ||
      decision.planIds.length > 0 ||
      affectedPlans.length > 0 ||
      affectedTeams.length > 0
    const evidenceState = stale
      ? ('stale' as const)
      : needsReview
        ? ('needs_review' as const)
        : (decision.absoluteRetention?.sourceCoverage ??
              (decision.cleanupSafety.complete ? 'complete' : 'partial')) === 'complete'
          ? ('complete' as const)
          : ('partial' as const)
    const lowEffectiveRollsReview =
      !decision.absoluteRetention &&
      !stale &&
      action === 'keep' &&
      retentionBasis === 'other_agent_fit' &&
      decision.cleanupSafety.complete &&
      !decision.cleanupSafety.equipped &&
      !decision.cleanupSafety.activePlanReferenced &&
      !decision.cleanupSafety.savedPlanReferenced &&
      !decision.cleanupSafety.portfolioReferenced &&
      !decision.cleanupSafety.referenced &&
      usageAgentIds.length === 0 &&
      decision.planIds.length === 0 &&
      decision.enhancementPotential.remainingRollOpportunities === 0 &&
      decision.enhancementPotential.communityViable === false
    return [
      {
        disc: {
          id: disc.id,
          setId: disc.setId,
          slot: disc.slot,
          level: disc.level,
          mainStat: disc.mainStat,
        },
        action,
        ...(decision.absoluteRetention ? { absoluteRetention: decision.absoluteRetention } : {}),
        cleanupAssessment: decision.cleanupSafety,
        ...(retentionBasis ? { retentionBasis } : {}),
        ...(!decision.absoluteRetention && decision.reviewDirection === 'no_current_fit'
          ? { reviewBasis: 'no_current_fit' as const }
          : {}),
        ...(lowEffectiveRollsReview ? { retentionReview: 'low_effective_rolls' as const } : {}),
        recommendationState: stale ? 'stale' : needsReview ? 'needs_review' : 'current',
        finalRecommendation,
        nextStep,
        evidenceState,
        decisiveProfileIds: decisionProfileIds,
        profileEvidence,
        usage: {
          state: useRecorded ? 'recorded' : 'not_recorded',
          agentIds: usageAgentIds,
          planIds: uniqueInOrder(decision.planIds),
        },
        freshness: {
          state: stale ? 'stale' : 'current',
          reason: freshnessReason,
        },
        reasons: uniqueInOrder(decision.reasons),
        statuses: affectedPlanStatuses,
        compatibleAgentIds: uniqueInOrder([
          ...completeBuildUseAgentIds,
          ...(decision.absoluteRetention
            ? [
                ...decision.absoluteRetention.ownedUseAgentIds,
                ...decision.absoluteRetention.unownedUseAgentIds,
              ]
            : (decision.useAssessment?.compatibleAgentIds ??
              decision.enhancementPotential.relevantAgentIds)),
        ]),
        retentionAgentIds: stale
          ? []
          : uniqueInOrder([
              ...completeBuildUseAgentIds,
              ...(!decision.absoluteRetention || decision.absoluteRetention.disposition === 'keep'
                ? decision.fitAgentIds
                : []),
            ]),
        usageAgentIds,
        affectedAgentIds,
        affectedPlans,
        affectedTeams,
        alternativeDiscIds: [...decision.alternatives],
        developmentAlternativeIds:
          stale || (decision.absoluteRetention && action !== 'keep')
            ? []
            : [...(decision.enhancementPotential.developmentAlternativeIds ?? [])],
        ...(!stale &&
        action === 'keep' &&
        (!decision.absoluteRetention || decision.absoluteRetention.disposition === 'keep')
          ? {
              developmentAdvice: warehouseDevelopmentAdvice(
                disc,
                decision.enhancementPotential,
                usageAgentIds,
                accountAgentIds,
                decision.useAssessment,
                decision.absoluteRetention,
              ),
            }
          : {}),
      } satisfies WarehouseActionItem,
    ]
  })
  const counts: Record<WarehouseActionKind, number> = { keep: 0, enhance: 0, cleanup: 0 }
  for (const action of actions) {
    if (action.finalRecommendation) counts[action.finalRecommendation.action] += 1
  }
  return {
    runId: run.runId,
    fingerprint: snapshot.fingerprint.inputHash,
    accountId: snapshot.account.accountId,
    state: stale ? 'stale' : 'current',
    sideEffect: snapshot.sideEffect,
    claim: {
      status: snapshot.claims.warehouse.status,
      summary: snapshot.claims.warehouse.summary,
    },
    counts,
    referenceIssues: warehouse.referenceIssues,
    actions,
  }
}
