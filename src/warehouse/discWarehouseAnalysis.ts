import type { DriveDisc } from '../domain/schemas'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { resolveWarehouseDemandContexts } from './warehouseDemandContexts'
import { assessWarehouseUses } from './warehouseUseAssessment'
import { warehouseUsePolicyVersion } from './warehouseDiscQuality'
import { warehouseAnalysisRuleVersion } from './warehousePolicyVersion'
import { assessWarehouse } from './absoluteDiscRetentionKernel'
import {
  absoluteDiscRetentionCatalog,
  absoluteDiscRetentionCatalogHash,
  absoluteDiscRetentionPolicy,
  toAbsoluteRetentionDisc,
} from './absoluteDiscRetentionCatalog'
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

export { warehouseAnalysisRuleVersion } from './warehousePolicyVersion'

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
  const absoluteRetention = assessWarehouse(
    input.discs.map(toAbsoluteRetentionDisc),
    absoluteDiscRetentionCatalog,
    absoluteDiscRetentionPolicy,
    {
      protectedIds: [
        ...new Set([
          ...equipped,
          ...refs.keys(),
          ...protectedPortfolioDiscIds,
          ...input.discs.filter((disc) => disc.favorite).map((disc) => disc.id),
        ]),
      ],
      ownedAgentIds: input.roster.agents
        .filter((agent) => agent.owned)
        .map((agent) => resolveCurrentReleasedIdentity(agent.agentId)),
    },
  )
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
  const hasConflictingSavedReferences = input.drafts.some(
    (draft) => !resolvePlanningDiscReferences(draft).consistent,
  )
  const allDemandReferencesResolved =
    !hasConflictingSavedReferences &&
    !hasMissingProtectedDemandReference &&
    !hasDuplicateProtectedDemandReference
  // Missing IDs are absent assets, not claims on every unrelated current disc.
  // Preserve every surviving reference and report stale plans separately. A selected
  // simultaneous portfolio remains gated until its concrete demand is resolved.
  const currentDemandSafe =
    protectedDemandDiscIds.every((id) => discsById.has(id) && capturedDiscIdCounts.get(id) === 1) &&
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
  const decisions = input.discs.map<WarehouseDiscDecision>((disc, discIndex) => {
    const retention = absoluteRetention[discIndex]!
    const useAssessment = uses.get(disc.id)!
    const adoptedSetIdentity = hasAdoptedCurrentSetIdentity(disc.setId)
    const subStatHistory = deriveSubStatHistory(disc)
    const planIds = refs.get(disc.id) ?? []
    const activePlanIds = planIds.filter((id) => activePlanIdSet.has(id))
    const portfolioReferenced = protectedPortfolioDiscIds.has(disc.id)
    const directlyProtected =
      disc.favorite || equipped.has(disc.id) || planIds.length > 0 || portfolioReferenced
    const protectionReasons = [
      ...(disc.favorite ? ['已收藏，按明确保留意图保护。'] : []),
      ...(equipped.has(disc.id) ? ['当前正在装备。'] : []),
      ...(planIds.length ? ['已保存方案正在使用。'] : []),
      ...(portfolioReferenced ? ['选定队伍正在使用。'] : []),
    ]
    const nextAction = directlyProtected
      ? {
          kind: 'keep' as const,
          targetLevel: null,
          detail: protectionReasons.join(''),
          stopWhen:
            retention.qualityDisposition === 'cleanup_candidate'
              ? '当前保护不改变盘面品质；解除全部保护后仍需人工复核，不能直接清理。'
              : '当前保护不改变盘面品质；保护生效期间保留此盘，不会自动清理。',
        }
      : !protectedDemandCoverageComplete || !currentDemandSafe
        ? {
            kind: 'check_condition' as const,
            targetLevel: null,
            detail: '先核对选定队伍的同时用盘范围与实体引用。',
            stopWhen: '用盘范围未闭合时暂停清理。',
          }
        : retention.nextAction
    // References name physical entities. A stale saved ID never reserves every unrelated copy.
    const protectedDemandReferencesResolved =
      capturedDiscIdCounts.get(disc.id) === 1 && (!directlyProtected || allDemandReferencesResolved)
    const enhancementPotential = evaluateDiscEnhancementPotential({
      disc,
      allDiscs: input.discs,
      history: subStatHistory,
      agents: potentialAgents,
      profileCoverageComplete: completeFitCoverage,
    })
    const copyKey = copyGroupKey(disc)
    const physicalCopyCount = input.discs.filter((item) => copyGroupKey(item) === copyKey).length
    const protectedDemandCount = protectedDemandContexts.reduce(
      (highest, context) =>
        Math.max(
          highest,
          [...new Set(context.discIds)].filter((id) => {
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
      protectedDemandReferencesResolved
    const complete =
      retention.sourceCoverage === 'complete' &&
      absoluteDiscRetentionPolicy.calibration === 'approved' &&
      adoptedSetIdentity &&
      protectedDemandCoverageComplete &&
      currentDemandSafe &&
      protectedDemandReferencesResolved &&
      retention.qualityDisposition !== 'review'
    const category: WarehouseDiscCategory =
      equipped.has(disc.id) || activePlanIds.length > 0 || portfolioReferenced
        ? 'current_plan_key'
        : directlyProtected
          ? 'targeted_keep'
          : retention.qualityDisposition === 'cleanup_candidate' && complete && deleteAfterFeasible
            ? 'cleanup_candidate'
            : retention.qualityDisposition === 'keep'
              ? 'targeted_keep'
              : 'enhance_watch'
    const fitAgentIds = [
      ...new Set([...retention.ownedUseAgentIds, ...retention.unownedUseAgentIds]),
    ]
    const leadingUses = [...retention.evidence]
      .filter(
        (evidence) => evidence.setFit !== 'incompatible' && evidence.mainFit !== 'incompatible',
      )
      .sort(
        (left, right) =>
          Number(retention.witnessProfileIds.includes(right.profileId)) -
            Number(retention.witnessProfileIds.includes(left.profileId)) ||
          Number(right.mainFit === 'valid' && right.setFit === 'valid') -
            Number(left.mainFit === 'valid' && left.setFit === 'valid') ||
          right.currentScore - left.currentScore ||
          left.profileId.localeCompare(right.profileId),
      )
      .filter(
        (evidence, index, all) =>
          all.findIndex((row) => row.agentId === evidence.agentId) === index,
      )
      .slice(0, 3)
      .map((evidence) => ({
        profileId: evidence.profileId,
        agentId: evidence.agentId,
        mainFit: evidence.mainFit,
        setFit: evidence.setFit,
        twoPieceFit: evidence.twoPieceFit,
        fourPieceFit: evidence.fourPieceFit,
        currentScore: evidence.currentScore,
        possibleFinalScore: evidence.possibleFinalScore,
        functionalMain: evidence.functionalMain,
        cutoffs: evidence.cutoffs,
        sourceIds: evidence.sourceIds,
        useState: evidence.useState,
        functionalState: evidence.functionalState,
        functionDetail: evidence.functionDetail,
        investment: evidence.investment,
        weightEvidence: evidence.weightEvidence,
        blockers: evidence.blockers,
      }))
    return {
      discId: disc.id,
      category,
      absoluteRetention: {
        disposition: retention.qualityDisposition,
        policyId: retention.policyId,
        policyCalibration: absoluteDiscRetentionPolicy.calibration,
        sourceCoverage:
          retention.sourceCoverage === 'complete' && adoptedSetIdentity ? 'complete' : 'partial',
        branchCount: retention.evidence.length,
        bestUseProfileId: retention.bestUseProfileId,
        bestUseScore: retention.bestUseScore,
        ownedUseAgentIds: [...retention.ownedUseAgentIds],
        unownedUseAgentIds: [...retention.unownedUseAgentIds],
        reasonKind: retention.reasonKind,
        nextAction,
        blockedBy: [
          ...retention.blockedBy,
          ...(!protectedDemandCoverageComplete || !currentDemandSafe
            ? [
                {
                  kind: 'reference' as const,
                  field: 'simultaneousDemand',
                  predicateId: 'reference:simultaneousDemand',
                  detail: '选定的同时用盘范围或实体引用尚未闭合；先核对队伍用盘记录。',
                  sourceIds: [],
                },
              ]
            : []),
        ],
        witnessProfileIds: retention.witnessProfileIds,
        reviewedUseScope: retention.reviewedUseScope,
        leadingUses,
      },
      useAssessment,
      reasons: [
        ...protectionReasons,
        ...(!directlyProtected ? [nextAction.detail] : []),
        nextAction.stopWhen,
        ...(absoluteDiscRetentionPolicy.calibration !== 'approved'
          ? ['生产品质阈值尚待独立逐盘样本校准，暂不生成清理候选。']
          : []),
        ...(retention.reasons.includes('rarity_cleanup_threshold_not_calibrated')
          ? ['该稀有度尚无独立阈值校准，不生成清理候选。']
          : []),
        ...(!adoptedSetIdentity ? ['套装资料待确认，暂留核对。'] : []),
        ...(!protectedDemandCoverageComplete || !currentDemandSafe
          ? ['队伍用盘记录待确认，暂留核对。']
          : []),
      ],
      fitAgentIds,
      planIds,
      activePlanIds,
      alternatives: enhancementPotential.coverageAlternativeIds,
      badges: [],
      subStatHistory,
      enhancementPotential,
      cleanupSafety: {
        favorite: disc.favorite,
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
        premiumReserve: retention.qualityDisposition === 'keep',
        significantFit: fitAgentIds.length > 0,
        alternativeSafe: false,
        complete,
        potentialEvaluated: enhancementPotential.potentialEvaluated,
        optimisticCeilingDominated: enhancementPotential.optimisticCeilingDominated,
        noCurrentAccountFit: retention.ownedUseAgentIds.length === 0,
        nonViableEmbryo: retention.qualityDisposition === 'cleanup_candidate',
        badEmbryoCleanupSafe: category === 'cleanup_candidate',
        cleanupEvidenceComplete: category === 'cleanup_candidate',
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
    absoluteDiscRetentionCatalogHash,
    absoluteDiscRetentionPolicy,
    replacementObjectives: potentialAgents.flatMap(({ agentId, replacementObjective }) =>
      replacementObjective ? [{ agentId, replacementObjective }] : [],
    ),
    discs: input.discs.map((disc) => ({
      id: disc.id,
      version: disc.discVersion ?? disc.updatedAt,
      tags: disc.tags,
      favorite: disc.favorite,
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
