import type { DriveDisc } from '../domain/schemas'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { resolveWarehouseDemandContexts } from './warehouseDemandContexts'
import { assessWarehouseUses, warehouseUseReasons } from './warehouseUseAssessment'
import {
  warehouseUsePolicyVersion,
  assessWarehouseContextQuality,
  warehouseQualityIsAdmitted,
} from './warehouseDiscQuality'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import { evaluateDiscEnhancementPotential } from './discEnhancementPotential'
import { prepareDiscReplacementObjective } from './discReplacementObjective'
import {
  type WarehouseDiscCategory,
  type WarehouseDiscDecision,
  type WarehouseAnalysisSnapshot,
  type WarehouseAnalysisInput,
  discQuality,
  isRareUnique,
  hasAdoptedCurrentSetIdentity,
} from './discWarehouseEvidence'
export {
  type WarehouseDiscCategory,
  warehouseCategoryLabels,
  type WarehouseDiscDecision,
  type WarehouseAnalysisSnapshot,
  type WarehouseAnalysisInput,
} from './discWarehouseEvidence'

export const warehouseAnalysisRuleVersion = 'warehouse-analysis-r3.27-replacement-witness'

/**
 * A pure, account-scoped decision service. It intentionally has no repository
 * calls: analysis cannot write, lock, tag, equip, delete, or save any asset.
 */
export function analyzeAccountWarehouse(input: WarehouseAnalysisInput): WarehouseAnalysisSnapshot {
  const discsById = new Map(input.discs.map((disc) => [disc.id, disc]))
  const copyGroupKey = (disc: DriveDisc) => `${disc.setId}|${disc.slot}|${disc.mainStat}`
  const refs = new Map<string, string[]>()
  for (const draft of input.drafts) {
    for (const discId of resolvePlanningDiscReferences(draft).referenceIds)
      refs.set(discId, [...(refs.get(discId) ?? []), draft.id])
  }
  const activePlanIdSet = new Set(
    Object.values(input.activePlanIds ?? {}).filter((id): id is string => Boolean(id)),
  )
  const equippedDiscIds = input.roster.agents.flatMap((agent) =>
    agent.owned ? (agent.equippedDiscIds ?? []) : [],
  )
  const equipped = new Set(equippedDiscIds)
  const protectedPortfolioDiscIds = new Set(
    input.protectedSimultaneousDemands?.flatMap((demand) => demand.discIds) ?? [],
  )
  const hasProtectedSimultaneousDemands = Boolean(input.protectedSimultaneousDemands?.length)
  // A reservation is meaningful only when the caller has explicitly established its coverage.  Treating
  // an omitted attestation as complete would let a partially computed portfolio make unrelated copies
  // look disposable. Every reserved ID must resolve unambiguously in this snapshot, and a selected
  // multi-team portfolio cannot use one disc twice.
  const protectedDemandCoverageComplete = hasProtectedSimultaneousDemands
    ? input.protectedDemandCoverageComplete === true
    : input.protectedDemandCoverageComplete !== false
  const protectedDemandDiscIds =
    input.protectedSimultaneousDemands?.flatMap((demand) => demand.discIds) ?? []
  // Independent saved plans may share discs. Equipment and each individual plan must
  // still resolve to distinct physical objects; missing references hide unknown demand.
  const protectedDemandContexts = [
    { id: 'current-equipment', discIds: equippedDiscIds },
    ...input.drafts.flatMap((draft) =>
      resolvePlanningDiscReferences(draft).sources.map(({ source, ids }) => ({
        id: `saved-plan:${draft.id}:${source}`,
        discIds: ids,
      })),
    ),
    { id: 'simultaneous-demands', discIds: protectedDemandDiscIds },
  ]
  const allDemandDiscIds = protectedDemandContexts.flatMap((demand) => demand.discIds)
  const capturedDiscIdCounts = new Map<string, number>()
  for (const disc of input.discs)
    capturedDiscIdCounts.set(disc.id, (capturedDiscIdCounts.get(disc.id) ?? 0) + 1)
  const hasMissingProtectedDemandReference = allDemandDiscIds.some(
    (discId) => !discsById.has(discId),
  )
  const hasDuplicateProtectedDemandReference = protectedDemandContexts.some(
    (demand) => new Set(demand.discIds).size !== demand.discIds.length,
  )
  const hasDuplicateCapturedDemandReference = [...capturedDiscIdCounts.values()].some(
    (count) => count > 1,
  )
  const hasConflictingSavedReferences = input.drafts.some(
    (draft) => !resolvePlanningDiscReferences(draft).consistent,
  )
  const protectedDemandReferencesResolved =
    !hasConflictingSavedReferences &&
    !hasMissingProtectedDemandReference &&
    !hasDuplicateProtectedDemandReference &&
    !hasDuplicateCapturedDemandReference
  // Missing IDs are absent assets, not claims on every unrelated current disc.
  // Preserve every surviving reference and report stale plans separately. A selected
  // simultaneous portfolio remains gated until its concrete demand is resolved.
  const currentDemandSafe =
    !hasDuplicateCapturedDemandReference &&
    protectedDemandDiscIds.every((id) => discsById.has(id)) &&
    new Set(protectedDemandDiscIds).size === protectedDemandDiscIds.length
  const referenceIssues = {
    savedPlanIds: input.drafts
      .filter((draft) => {
        if (draft.kind !== 'team') return false
        const refs = resolvePlanningDiscReferences(draft)
        return !refs.consistent || refs.referenceIds.some((id) => !discsById.has(id))
      })
      .map((draft) => draft.id),
    equipmentNeedsReview:
      equippedDiscIds.some((id) => !discsById.has(id)) ||
      new Set(equippedDiscIds).size !== equippedDiscIds.length,
    simultaneousNeedsReview: !protectedDemandCoverageComplete || !currentDemandSafe,
  }
  const demand = resolveWarehouseDemandContexts(input)
  const completeFitCoverage =
    demand.coverageComplete && input.roster.agents.some((agent) => agent.owned)
  const uses = assessWarehouseUses(input.discs, demand.contexts, completeFitCoverage)
  const potentialAgents = demand.contexts
    .filter((context) => context.eligibility === 'eligible')
    .map((context) => ({
      agentId: context.agentId,
      contextId: context.id,
      constraint: context.constraint,
      replacementObjective: prepareDiscReplacementObjective(
        context.agentId,
        input.roster.agents.find(
          (agent) => resolveCurrentReleasedIdentity(agent.agentId) === context.agentId,
        ),
        input.discs,
      ),
    }))
  const decisions = input.discs.map<WarehouseDiscDecision>((disc) => {
    const useAssessment = uses.get(disc.id)!
    const adoptedSetIdentity = hasAdoptedCurrentSetIdentity(disc.setId)
    const subStatHistory = deriveSubStatHistory(disc)
    const planIds = refs.get(disc.id) ?? []
    const activePlanIds = planIds.filter((id) => activePlanIdSet.has(id))
    const portfolioReferenced = protectedPortfolioDiscIds.has(disc.id)
    const directlyProtected = equipped.has(disc.id) || planIds.length > 0 || portfolioReferenced
    const enhancementPotential = evaluateDiscEnhancementPotential({
      disc,
      allDiscs: input.discs,
      history: subStatHistory,
      agents: potentialAgents,
      profileCoverageComplete: completeFitCoverage,
    })
    const objectiveUse =
      useAssessment.status === 'cleanup' && useAssessment.basis === 'surplus'
        ? demand.contexts.find((context) => {
            if (context.demand !== 'active' || context.eligibility !== 'eligible') return false
            if (
              !potentialAgents.find((agent) => agent.contextId === context.id)?.replacementObjective
            )
              return false
            const quality = assessWarehouseContextQuality(disc, context)
            if (!quality || !warehouseQualityIsAdmitted(quality)) return false
            return (
              enhancementPotential.undominatedAgentIds.includes(context.agentId) &&
              !enhancementPotential.coverageAlternativeIds.length &&
              input.discs.some(
                (other) =>
                  other.id !== disc.id &&
                  copyGroupKey(other) === copyGroupKey(disc) &&
                  uses.get(other.id)?.contextId === context.id &&
                  uses.get(other.id)?.status !== 'cleanup',
              )
            )
          })
        : undefined
    if (objectiveUse) {
      const quality = assessWarehouseContextQuality(disc, objectiveUse)!
      Object.assign(useAssessment, {
        status: quality.worthInvestment ? 'develop' : 'keep',
        basis: 'active_use',
        agentId: objectiveUse.agentId,
        contextId: objectiveUse.id,
        effectiveRolls: quality.effectiveRolls,
        worthInvestment: quality.worthInvestment,
        retainedAgentIds: [objectiveUse.agentId],
      })
    }
    const copyKey = copyGroupKey(disc)
    const physicalCopyCount = input.discs.filter((item) => copyGroupKey(item) === copyKey).length
    const protectedDemandCount = protectedDemandContexts.reduce(
      (highest, context) =>
        Math.max(
          highest,
          context.discIds.filter((id) => {
            const demanded = discsById.get(id)
            return demanded ? copyGroupKey(demanded) === copyKey : false
          }).length,
        ),
      0,
    )
    const availableCopiesAfterDelete = Math.max(0, physicalCopyCount - 1)
    const deleteAfterFeasible =
      protectedDemandCoverageComplete &&
      currentDemandSafe &&
      !directlyProtected &&
      availableCopiesAfterDelete >= protectedDemandCount
    const complete =
      completeFitCoverage &&
      adoptedSetIdentity &&
      protectedDemandCoverageComplete &&
      currentDemandSafe &&
      useAssessment.status !== 'verify'
    const category: WarehouseDiscCategory =
      equipped.has(disc.id) || activePlanIds.length > 0 || portfolioReferenced
        ? 'current_plan_key'
        : directlyProtected
          ? 'targeted_keep'
          : !complete
            ? 'targeted_keep'
            : useAssessment.status === 'cleanup' && deleteAfterFeasible
              ? 'cleanup_candidate'
              : useAssessment.status === 'develop'
                ? 'enhance_watch'
                : 'targeted_keep'
    const fitAgentIds = useAssessment.retainedAgentIds
    return {
      discId: disc.id,
      category,
      useAssessment,
      reasons: [
        ...(equipped.has(disc.id) ? ['当前正在装备。'] : []),
        ...(planIds.length ? ['已保存方案正在使用。'] : []),
        ...(portfolioReferenced ? ['选定队伍正在使用。'] : []),
        warehouseUseReasons[useAssessment.basis],
        ...(!adoptedSetIdentity ? ['套装资料待确认，暂留核对。'] : []),
        ...(!protectedDemandCoverageComplete || !currentDemandSafe
          ? ['队伍用盘记录待确认，暂留核对。']
          : []),
      ],
      fitAgentIds,
      planIds,
      activePlanIds,
      alternatives: enhancementPotential.coverageAlternativeIds,
      badges: fitAgentIds.length >= 2 && discQuality(disc) >= 42 ? ['account_premium'] : [],
      subStatHistory,
      enhancementPotential,
      cleanupSafety: {
        equipped: equipped.has(disc.id),
        referenced: planIds.length > 0,
        activePlanReferenced: activePlanIds.length > 0,
        savedPlanReferenced: planIds.length > 0,
        portfolioReferenced,
        protectedDemandCount,
        protectedDemandCoverageComplete,
        protectedDemandReferencesResolved,
        physicalCopyCount,
        availableCopiesAfterDelete,
        deleteAfterFeasible,
        hasBetterAlternative: enhancementPotential.candidateAlternativeIds.length > 0,
        hasCoverageAlternative: enhancementPotential.coverageAlternativeIds.length > 0,
        rareUnique: isRareUnique(disc, input.discs),
        scarceReserve: false,
        premiumReserve: useAssessment.basis === 'quality_reserve',
        significantFit: fitAgentIds.length > 0,
        alternativeSafe: false,
        complete,
        potentialEvaluated: enhancementPotential.potentialEvaluated,
        optimisticCeilingDominated: enhancementPotential.optimisticCeilingDominated,
        noCurrentAccountFit: useAssessment.basis === 'no_current_use',
        nonViableEmbryo:
          useAssessment.basis === 'poor_seed' || useAssessment.basis === 'failed_rolls',
        badEmbryoCleanupSafe:
          complete &&
          deleteAfterFeasible &&
          (useAssessment.basis === 'poor_seed' || useAssessment.basis === 'failed_rolls'),
        cleanupEvidenceComplete: complete && useAssessment.status === 'cleanup',
        adoptedSetIdentity,
      },
      strength: fitAgentIds.length ? 'candidate' : 'limited',
    } satisfies WarehouseDiscDecision
  })
  // An alternative must survive this same batch. Candidate rows never prove
  // each other's deletion, and a list of compatible discs is not a replacement.
  // Exact replacement additionally needs one distinct surviving entity for every
  // simultaneous protected use. An empty use scope cannot prove replacement.
  const survivingIds = new Set(
    decisions
      .filter((decision) => decision.category !== 'cleanup_candidate')
      .map((decision) => decision.discId),
  )
  for (const decision of decisions) {
    decision.alternatives = decision.alternatives.filter((id) => survivingIds.has(id))
    decision.cleanupSafety.hasCoverageAlternative = decision.alternatives.length > 0
    const survivingAlternativeCount = new Set(decision.alternatives).size
    decision.cleanupSafety.alternativeSafe =
      decision.cleanupSafety.protectedDemandCount > 0 &&
      survivingAlternativeCount >= decision.cleanupSafety.protectedDemandCount &&
      decision.cleanupSafety.availableCopiesAfterDelete >=
        decision.cleanupSafety.protectedDemandCount &&
      decision.cleanupSafety.protectedDemandCoverageComplete &&
      decision.cleanupSafety.protectedDemandReferencesResolved &&
      decision.cleanupSafety.deleteAfterFeasible &&
      !decision.cleanupSafety.equipped &&
      !decision.cleanupSafety.activePlanReferenced &&
      !decision.cleanupSafety.savedPlanReferenced &&
      !decision.cleanupSafety.portfolioReferenced
  }
  const counts = {
    account_premium: 0,
    current_plan_key: 0,
    targeted_keep: 0,
    enhance_watch: 0,
    replaceable: 0,
    cleanup_candidate: 0,
  } satisfies Record<WarehouseDiscCategory, number>
  for (const decision of decisions) counts[decision.category] += 1
  const assetSnapshot = stableContentHash({
    demand: demand.contentHash,
    warehouseUsePolicyVersion,
    replacementObjectives: potentialAgents.flatMap(({ agentId, replacementObjective }) =>
      replacementObjective ? [{ agentId, replacementObjective }] : [],
    ),
    discs: input.discs.map((disc) => ({
      id: disc.id,
      version: disc.discVersion ?? disc.updatedAt,
      tags: disc.tags,
    })),
    roster: input.roster.agents.map((agent) => ({
      agentId: resolveCurrentReleasedIdentity(agent.agentId),
      owned: agent.owned,
      equippedDiscIds: agent.equippedDiscIds ?? [],
    })),
  })
  const planSnapshot = stableContentHash({
    drafts: input.drafts.map((draft) => ({
      id: draft.id,
      updatedAt: draft.updatedAt,
      refs: resolvePlanningDiscReferences(draft),
    })),
    protectedSimultaneousDemands: input.protectedSimultaneousDemands ?? [],
    protectedDemandCoverageComplete,
  })
  return {
    accountId: input.accountId,
    ruleVersion: warehouseAnalysisRuleVersion,
    dataVersion: input.dataVersion ?? '3.1-candidate-warehouse',
    assetSnapshot,
    planSnapshot,
    createdAt: input.now ?? new Date().toISOString(),
    decisions,
    referenceIssues,
    affectedPlanIds: [...new Set(decisions.flatMap((decision) => decision.planIds))],
    counts,
  }
}
