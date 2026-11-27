import { buildWarehouseCopyDemandCounts, copyGroupKey } from './warehouseCopyDemandCounts'
import { deriveSubStatHistory } from '../evaluation/subStatHistory'
import { resolveWarehouseDemandContexts } from './warehouseDemandContexts'
import { assessWarehouseUses } from './warehouseUseAssessment'
import { warehouseUsePolicyVersion } from './warehouseDiscQuality'
import { warehouseAnalysisRuleVersion } from './warehousePolicyVersion'
import { assessWarehouse } from './absoluteDiscRetentionKernel'
import { retentionUseGuidance, retentionUseMatchesRecommendedSet } from './warehouseRetentionGuidance'
import {
  absoluteDiscRetentionCatalog,
  absoluteDiscRetentionCatalogHash,
  absoluteDiscRetentionPolicy,
  toAbsoluteRetentionDisc,
  warehouseInvestmentBranchByProfileId,
} from './absoluteDiscRetentionCatalog'
import {
  eligibleInvestmentContextsByBranch,
  investmentTrialContextIds,
} from './warehouseInvestmentBranch'
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import { createDiscEnhancementEvaluator } from './discEnhancementPotential'
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

const retentionProfiles = new Map(
  absoluteDiscRetentionCatalog.profiles.map((profile) => [profile.id, profile]),
)

/**
 * A pure, account-scoped decision service. It intentionally has no repository
 * calls: analysis cannot write, lock, tag, equip, delete, or save any asset.
 */
export function analyzeAccountWarehouse(input: WarehouseAnalysisInput): WarehouseAnalysisSnapshot {
  const discsById = new Map(input.discs.map((disc) => [disc.id, disc]))
  // Keep every entity available for reference checks, but only confirmed S discs
  // may produce quality, replacement or cleanup recommendations.
  const eligibleDiscs = input.discs.filter((disc) => disc.rarity === 'S')
  const refs = new Map<string, string[]>()
  for (const draft of input.drafts) {
    for (const discId of resolvePlanningDiscReferences(draft).referenceIds)
      refs.set(discId, [...(refs.get(discId) ?? []), draft.id])
  }
  const activePlanIdSet = new Set(
    Object.values(input.activePlanIds ?? {}).filter((id): id is string => Boolean(id)),
  )
  // Ownership controls demand, but cannot erase an existing concrete equipment reference.
  const equippedDiscIds = input.roster.agents.flatMap((agent) => agent.equippedDiscIds ?? [])
  const equipped = new Set(equippedDiscIds)
  const protectedPortfolioDiscIds = new Set(
    input.protectedSimultaneousDemands?.flatMap((demand) => demand.discIds) ?? [],
  )
  const hasProtectedSimultaneousDemands = Boolean(input.protectedSimultaneousDemands?.length)
  const absoluteRetention = assessWarehouse(
    eligibleDiscs.map(toAbsoluteRetentionDisc),
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
  const { physicalCopiesByKey, protectedDemandByKey } = buildWarehouseCopyDemandCounts(
    eligibleDiscs,
    discsById,
    protectedDemandContexts,
  )
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
      input.roster.agents.some((agent) => !agent.owned && Boolean(agent.equippedDiscIds?.length)) ||
      equippedDiscIds.some((id) => !discsById.has(id)) ||
      new Set(equippedDiscIds).size !== equippedDiscIds.length,
    simultaneousNeedsReview: !protectedDemandCoverageComplete || !currentDemandSafe,
  }
  const demand = resolveWarehouseDemandContexts(input)
  const completeFitCoverage =
    demand.coverageComplete && input.roster.agents.some((agent) => agent.owned)
  const uses = assessWarehouseUses(eligibleDiscs, demand.contexts, completeFitCoverage)
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
        eligibleDiscs,
      ),
    }))
  const investmentContexts = eligibleInvestmentContextsByBranch(demand.contexts)
  const evaluateEnhancement = createDiscEnhancementEvaluator(eligibleDiscs)
  const decisions = eligibleDiscs.map<WarehouseDiscDecision>((disc, discIndex) => {
    const retention = absoluteRetention[discIndex]!
    const useAssessment = uses.get(disc.id)!
    const finiteLuminizeUse = useAssessment.completeBuildImprovements?.some(
      (row) => row.objectiveScope === 'finite_luminize_static_preparation',
    )
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
    // A repeated physical ID is not two independently identifiable assets.
    const protectedDemandReferencesResolved =
      capturedDiscIdCounts.get(disc.id) === 1 && (!directlyProtected || allDemandReferencesResolved)
    const enhancementPotential = evaluateEnhancement({
      disc,
      history: subStatHistory,
      agents: potentialAgents,
      profileCoverageComplete: completeFitCoverage,
      investmentContextIds: investmentTrialContextIds(
        retention,
        warehouseInvestmentBranchByProfileId,
        investmentContexts,
      ),
    })
    const proposedAction = directlyProtected
      ? {
          kind: 'keep' as const,
          targetLevel: null,
          detail: protectionReasons.join(''),
          stopWhen:
            retention.qualityDisposition === 'cleanup_candidate'
              ? '当前保护不改变盘面品质；解除全部保护后仍需人工复核，不能直接清理。'
              : '当前保护不改变盘面品质；保护生效期间保留此盘，不会自动清理。',
        }
      : !protectedDemandReferencesResolved || !protectedDemandCoverageComplete || !currentDemandSafe
        ? {
            kind: 'check_condition' as const,
            targetLevel: null,
            detail: !protectedDemandReferencesResolved
              ? '此盘实体标识重复或引用未闭合；先核对实体身份与使用记录。'
              : '先核对选定队伍的同时用盘范围与实体引用。',
            stopWhen: '用盘范围未闭合时暂停清理。',
          }
        : useAssessment.completeBuildImprovements?.length
          ? {
              basis: finiteLuminizeUse
                ? ('finite_luminize_static_preparation_positive_use' as const)
                : ('complete_build_positive_use' as const),
              kind: 'keep' as const,
              targetLevel: null,
              detail: finiteLuminizeUse
                ? '在已保存的辉映比较条件下，同槽替换可提高该项收益，作为备选盘保留。'
                : '已核对完整配装的同槽替换收益，作为该方案的备选盘保留。',
              stopWhen: '此用途只适用于对应配装与条件，不改变盘面品质，也不作为其他盘的清理依据。',
            }
          : retention.nextAction.kind === 'try_upgrade' &&
              enhancementPotential.investmentContextCanImprove !== true
            ? {
                kind: 'check_condition' as const,
                targetLevel: null,
                detail: '此盘先作为储备观察。当前构筑还没有确认可改善的装备缺口。',
                stopWhen: '核对角色、构筑条件和同槽装备后，再决定是否尝试下一强化节点。',
              }
            : retention.nextAction
    const copyKey = copyGroupKey(disc)
    const physicalCopyCount = physicalCopiesByKey.get(copyKey) ?? 0
    const protectedDemandCount = protectedDemandByKey.get(copyKey) ?? 0
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
          : useAssessment.completeBuildImprovements?.length
            ? 'targeted_keep'
            : retention.qualityDisposition === 'cleanup_candidate' &&
                complete &&
                deleteAfterFeasible
              ? 'cleanup_candidate'
              : retention.qualityDisposition === 'keep'
                ? 'targeted_keep'
                : 'enhance_watch'
    const nextAction =
      proposedAction.kind === 'manual_cleanup' && category !== 'cleanup_candidate'
        ? {
            kind: 'complete_data' as const,
            targetLevel: null,
            detail: '先核对盘的套装身份与当前分析依据。',
            stopWhen: '资料与保护条件核对完成前暂停清理。',
          }
        : proposedAction
    const leadingUses = [...retention.evidence]
      .filter((evidence) => retentionUseMatchesRecommendedSet(disc.setId, evidence))
      .sort(
        (left, right) =>
          Number(right.useState === 'valid') - Number(left.useState === 'valid') ||
          Number(right.mainFit === 'valid' && right.setFit === 'valid') -
            Number(left.mainFit === 'valid' && left.setFit === 'valid') ||
          Number(retention.witnessProfileIds.includes(right.profileId)) -
            Number(retention.witnessProfileIds.includes(left.profileId)) ||
          right.currentScore - left.currentScore ||
          left.profileId.localeCompare(right.profileId),
      )
      .map((evidence) => {
        const profile = retentionProfiles.get(evidence.profileId)
        const guidance = retentionUseGuidance(disc, evidence, profile, absoluteDiscRetentionPolicy)
        return {
          profileId: evidence.profileId,
          profileLabel: guidance?.profileLabel ?? null,
          profileDimensions: [...(guidance?.profileDimensions ?? [])],
          ...(evidence.branchSetPlan ? { branchSetPlan: evidence.branchSetPlan } : {}),
          agentId: evidence.agentId,
          mainFit: evidence.mainFit,
          setFit: evidence.setFit,
          recommendationSetFit: evidence.recommendationSetFit,
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
          guidance,
        }
      })
    const fitAgentIds = [
      ...new Set([...retention.ownedUseAgentIds, ...retention.unownedUseAgentIds]),
    ]
    const unresolvedFitAgentIds = [
      ...new Set(
        leadingUses
          .filter((evidence) => evidence.useState === 'missing_fact')
          .map((evidence) => evidence.agentId),
      ),
    ]
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
        unresolvedFitAgentIds,
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
      unresolvedFitAgentIds,
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
        ...(enhancementPotential.potentialEvaluated && !enhancementPotential.usedGenericFallback
          ? { betterSameClassCount: enhancementPotential.candidateAlternativeIds.length }
          : {}),
        hasCoverageAlternative: enhancementPotential.coverageAlternativeIds.length > 0,
        rareUnique: isRareUnique(disc, physicalCopyCount),
        scarceReserve: false,
        premiumReserve: retention.qualityDisposition === 'keep',
        significantFit: fitAgentIds.length > 0,
        alternativeSafe: false,
        complete,
        potentialEvaluated: enhancementPotential.potentialEvaluated,
        optimisticCeilingDominated: enhancementPotential.optimisticCeilingDominated,
        noCurrentAccountFit:
          retention.sourceCoverage === 'complete' &&
          Boolean(retention.reviewedUseScope) &&
          retention.ownedUseAgentIds.length === 0,
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
    dataVersion:
      input.dataVersion ??
      `${absoluteDiscRetentionCatalog.assessmentGameVersion}-candidate-warehouse`,
    assetSnapshot,
    planSnapshot,
    createdAt: input.now ?? new Date().toISOString(),
    decisions,
    referenceIssues,
    affectedPlanIds: [...new Set(decisions.flatMap((decision) => decision.planIds))],
    counts,
  }
}
