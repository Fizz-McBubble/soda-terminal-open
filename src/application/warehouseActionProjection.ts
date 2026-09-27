import { savedDiscAgentIds } from '../warehouse/discWarehousePlanAssignments'
import { warehouseDevelopmentAdvice } from './warehouseDevelopmentAdvice'
import { warehouseRetentionBasis } from './warehouseRetention'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import type {
  WarehouseDiscCategory,
  WarehouseDiscDecision,
} from '../warehouse/discWarehouseAnalysis'
import { warehouseAnalysisRuleVersion } from '../warehouse/discWarehouseAnalysis'
import { authorityConsumerRecommendations } from './authorityConsumerRecommendations'
import type { AccountDecisionWorld } from './accountDecisionWorld'
import type { AccountPlanningDraft } from '../accounts/types'
import type { DriveDisc } from '../domain/schemas'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { warehousePlanReferences } from './warehousePlanReferences'
import {
  type WarehouseActionItem,
  type WarehouseActionKind,
  type WarehouseActionProjection,
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

type ReadyWorld = Extract<AccountDecisionWorld, { status: 'current' | 'stale' }>

function savedTeamStatus(
  draft: AccountPlanningDraft,
  discs: readonly DriveDisc[],
): 'ready' | 'needs_confirmation' | 'missing_equipment' {
  if (!resolvePlanningDiscReferences(draft).consistent) return 'needs_confirmation'
  const byId = new Map(discs.map((disc) => [disc.id, disc]))
  if (
    draft.warehouseRefs.length !== 18 ||
    new Set(draft.warehouseRefs).size !== 18 ||
    draft.warehouseRefs.some((id) => !byId.has(id))
  )
    return 'missing_equipment'
  const execution = draft.teamExecutionSnapshot
  const matchingExecution =
    execution &&
    execution.memberIds.length === 3 &&
    execution.memberIds.every((id) => draft.selection.agentIds.includes(id))
      ? execution
      : null
  if (
    matchingExecution?.status === 'missing_equipment' ||
    matchingExecution?.blockers.length ||
    matchingExecution?.members.some((member) => member.status === 'missing_equipment')
  )
    return 'missing_equipment'
  const loadouts =
    matchingExecution?.members.map((member) => ({
      agentId: member.agentId,
      discIds: member.suggested.discIds,
    })) ?? draft.candidateWarehouse?.loadouts
  if (!loadouts) return 'needs_confirmation'
  const assigned = loadouts.flatMap((loadout) => loadout.discIds)
  const complete =
    new Set(draft.selection.agentIds).size === 3 &&
    loadouts.length === 3 &&
    new Set(loadouts.map((loadout) => loadout.agentId)).size === 3 &&
    loadouts.every(
      (loadout) =>
        draft.selection.agentIds.includes(loadout.agentId) &&
        loadout.discIds.length === 6 &&
        loadout.discIds.every((id) => byId.has(id)) &&
        new Set(loadout.discIds.map((id) => byId.get(id)?.slot)).size === 6,
    ) &&
    assigned.length === 18 &&
    new Set(assigned).size === 18 &&
    new Set(draft.warehouseRefs).size === 18 &&
    assigned.every((id) => draft.warehouseRefs.includes(id))
  if (!complete) return 'missing_equipment'
  if (matchingExecution?.members.some((member) => member.status === 'needs_confirmation'))
    return 'needs_confirmation'
  return matchingExecution?.status ?? 'needs_confirmation'
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

function statusesFor(
  decision: WarehouseDiscDecision,
  input: { stale: boolean },
): WarehouseActionStatus[] {
  const statuses: WarehouseActionStatus[] = []
  if (decision.cleanupSafety.equipped) statuses.push('currently_equipped')
  if (decision.cleanupSafety.activePlanReferenced) statuses.push('active_plan_reference')
  if (decision.cleanupSafety.savedPlanReferenced) statuses.push('saved_plan_reference')
  if (decision.cleanupSafety.portfolioReferenced) statuses.push('selected_portfolio_reference')
  if (decision.cleanupSafety.alternativeSafe && decision.alternatives.length > 0)
    statuses.push('better_alternative')
  if (
    decision.reviewDirection ||
    decision.category === 'replaceable' ||
    !decision.cleanupSafety.complete
  )
    statuses.push('needs_review')
  if (input.stale) statuses.push('stale')
  return statuses
}

/**
 * Projects the already-captured Account Decision snapshot for the warehouse surface.
 * It deliberately only joins existing snapshot facts; it never invokes a warehouse
 * analyser, optimiser, Claim calculator, repository, or command.
 */
export function projectWarehouseActions(
  world: Pick<ReadyWorld, 'run' | 'status'>,
): WarehouseActionProjection {
  const { run } = world
  const snapshot = run.snapshot
  const stale =
    world.status === 'stale' || snapshot.warehouse.ruleVersion !== warehouseAnalysisRuleVersion
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
  const authorityByMembers = new Map<
    string,
    {
      teamRating: string
      confidence: string
      cultivationPriority: string
    }
  >()
  if (snapshot.decisionAuthority.status === 'ready') {
    for (const recommendation of authorityConsumerRecommendations(snapshot.decisionAuthority)) {
      if (recommendation.teamRating.status !== 'rated') continue
      const key = [...recommendation.memberIds].sort().join('|')
      if (authorityByMembers.has(key)) continue
      authorityByMembers.set(key, {
        teamRating: recommendation.teamRating.ratingBand,
        confidence: recommendation.teamRating.confidence,
        cultivationPriority: recommendation.cultivationPriority.tier,
      })
    }
  }
  const actions = snapshot.warehouse.decisions.flatMap((decision) => {
    const disc = discsById.get(decision.discId)
    // A snapshot only has decisions for the captured warehouse. Fail closed if a malformed
    // snapshot loses the physical object rather than inventing an identity for the page.
    if (!disc) return []
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
      const memberIds = [...draft.selection.agentIds] as [string, string, string]
      return [
        {
          candidateId: draft.solutionContext?.sourceCandidateId ?? draft.id,
          memberIds,
          status: savedTeamStatus(draft, run.input.warehouse.discs),
          decisionAuthority: authorityByMembers.get([...memberIds].sort().join('|')) ?? null,
        },
      ]
    })
    const usageAgentIds = uniqueInOrder([
      ...run.input.warehouse.roster.agents
        .filter((agent) => agent.owned && (agent.equippedDiscIds ?? []).includes(decision.discId))
        .map((agent) => agent.agentId),
      ...decision.planIds.flatMap((planId) => {
        const draft = draftsById.get(planId)
        return draft ? savedDiscAgentIds(draft, decision.discId) : []
      }),
    ])
    const affectedAgentIds = uniqueInOrder([...decision.fitAgentIds, ...usageAgentIds])
    const noCurrentFitReview =
      decision.reviewDirection === 'no_current_fit' &&
      decision.cleanupSafety.complete &&
      decision.cleanupSafety.noCurrentAccountFit &&
      decision.cleanupSafety.deleteAfterFeasible
    const needsReview =
      noCurrentFitReview || decision.category === 'replaceable' || !decision.cleanupSafety.complete
    // Stopping investment with a real covering replacement is a practical review
    // direction, not proof that even perfect future rolls would lose.
    const coveredStopInvestment =
      decision.category === 'replaceable' &&
      decision.cleanupSafety.complete &&
      decision.cleanupSafety.hasCoverageAlternative &&
      decision.cleanupSafety.alternativeSafe &&
      decision.alternatives.some((id) => id !== disc.id && discsById.has(id))
    const baseAction =
      coveredStopInvestment || noCurrentFitReview ? 'cleanup' : actionForCategory(decision.category)
    const protectedByCurrentDecision =
      (!decision.useAssessment &&
        (decision.cleanupSafety.rareUnique ||
          decision.cleanupSafety.scarceReserve ||
          decision.cleanupSafety.premiumReserve)) ||
      decision.cleanupSafety.equipped ||
      decision.cleanupSafety.activePlanReferenced ||
      decision.cleanupSafety.savedPlanReferenced ||
      decision.cleanupSafety.portfolioReferenced ||
      !decision.cleanupSafety.deleteAfterFeasible
    const action =
      stale ||
      ((baseAction === 'cleanup' || decision.category === 'replaceable') &&
        protectedByCurrentDecision)
        ? 'keep'
        : baseAction
    const retentionBasis =
      action === 'keep'
        ? stale
          ? ('unresolved' as const)
          : warehouseRetentionBasis(decision, accountAgentIds)
        : undefined
    const lowEffectiveRollsReview =
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
        ...(action === 'cleanup' && noCurrentFitReview
          ? { reviewBasis: 'no_current_fit' as const }
          : {}),
        ...(retentionBasis ? { retentionBasis } : {}),
        ...(lowEffectiveRollsReview ? { retentionReview: 'low_effective_rolls' as const } : {}),
        recommendationState: stale ? 'stale' : needsReview ? 'needs_review' : 'current',
        reasons: uniqueInOrder([
          ...(action === 'keep' && baseAction !== 'keep'
            ? [
                '当前实装、已保存方案、显式多队组合、数据时效或删除后可行性仍保护该实体盘，不建议处理。',
              ]
            : []),
          ...decision.reasons,
        ]),
        statuses: affectedPlanStatuses,
        compatibleAgentIds: uniqueInOrder(
          decision.useAssessment?.compatibleAgentIds ??
            decision.enhancementPotential.relevantAgentIds,
        ),
        retentionAgentIds: stale ? [] : uniqueInOrder(decision.fitAgentIds),
        usageAgentIds,
        affectedAgentIds,
        affectedPlans,
        affectedTeams,
        alternativeDiscIds: [...decision.alternatives],
        developmentAlternativeIds: stale
          ? []
          : [...(decision.enhancementPotential.developmentAlternativeIds ?? [])],
        ...(!stale && action !== 'cleanup'
          ? {
              developmentAdvice: warehouseDevelopmentAdvice(
                disc,
                decision.enhancementPotential,
                usageAgentIds,
                accountAgentIds,
                decision.useAssessment,
              ),
            }
          : {}),
      } satisfies WarehouseActionItem,
    ]
  })
  const counts: Record<WarehouseActionKind, number> = { keep: 0, enhance: 0, cleanup: 0 }
  for (const action of actions) counts[action.action] += 1
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
    referenceIssues: snapshot.warehouse.referenceIssues,
    actions,
  }
}
