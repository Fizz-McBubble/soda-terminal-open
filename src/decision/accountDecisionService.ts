import { warehouseDecisionDemand } from './warehouseDecisionDemand'
import { currentSavedTeamBuildIntents } from './savedTeamBuildIntent'
import { enumerateActiveTeamHardConstraints } from '../accounts/teamPortfolioPreference'
import { currentBangbooDirectory } from '../assault/catalog'
import { contentHash } from '../evaluation/contentHash'
import { currentDataAuthorityId } from '../gameDataPacks/currentDataAuthorityIdentity'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { type AccountBuildResult, optimizeAccountBuilds } from '../optimizer/optimizeAccountBuilds'
import { analyzeAccountWarehouse } from '../warehouse/discWarehouseAnalysis'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { solveTeamEngine } from '../teamEngine/solveTeamEngine'
import type { TeamEngineBoxInput } from '../teamEngine/contracts'
import { deriveTeamEngineCoverageDiagnostics } from '../teamEngine/coverageDiagnostics'
import { teamEngineRecommendationsForCoordinationWithDiagnostics } from './teamEngineDecisionAdapter'
import { commonForbiddenClaims } from './accountDecisionClaimBoundaries'
import { dataDecisionClaim, formalDamageDecisionClaim } from './accountDecisionCapabilityClaims'
import { coordinateDecisionPortfolio } from './accountDecisionCoordination'
import { compilePortfolioBuildIntent } from './buildIntent'
import { activePlansForCoordination } from './accountDecisionPlanning'
import {
  planningDpsReadyOwnedAgentIds,
  projectAccountBoxPlanning,
} from './accountDecisionPlanningDps'
import {
  accountDecisionFingerprintContract,
  buildAccountDecisionInputFingerprint,
  resolveDecisionProfiles,
  type AccountDecisionFingerprint,
} from './accountDecisionFingerprint'
import { allocationTargetCandidates, uniqueInOrder } from './accountDecisionCandidatePriority'
import {
  projectSimultaneousTeamExecutionPortfolio,
  projectTeamExecutions,
} from './teamExecutionProjection'
import { assemblePlanningCandidateEvaluations } from './planningCandidateEvaluationAssembler'
import { projectAccountPlanningEvaluations } from './accountDecisionPlanningEvaluationProjection'
import { current31CandidateUniverseAudit } from '../teamEngine/current31CandidateUniverseAudit'
import { projectCurrent31ProductionDecisionUniverse } from './productionDecisionUniverse'
import { projectAccountDecisionAuthority } from './accountDecisionAuthority'
import { FullTeamIndexesRequired, ownedAdmittedBoxFormations } from './currentBoxTeamAdmission'
import { usesTeamStartupIntrinsicIndex } from './current31TeamIntrinsicIndex'
import {
  allocationClaim,
  coordinationClaim,
  overallClaim,
  teamEngineClaim,
} from './accountDecisionClaims'
import { authorityExecutionCandidates } from './accountDecisionAuthorityExecutionCandidates'
import { authorityPortfolioCandidates } from './authorityPortfolioCandidates'
import {
  createAccountTeamEngineBoxInput,
  createAuthorityExecutionVariantResolver,
} from './authorityExecutionVariantResolver'
import {
  accountDecisionContractVersion,
  accountDecisionRevision,
  type AccountDecisionSnapshot,
  type BuildAccountDecisionInput,
} from './accountDecisionSnapshotContract'

export { coordinateDecisionPortfolio }
export {
  accountDecisionContractVersion,
  accountDecisionRevision,
  type AccountDecisionSnapshot,
  type BuildAccountDecisionInput,
  type DecisionClaim,
  type DecisionClaimStatus,
} from './accountDecisionSnapshotContract'
export {
  accountDecisionFingerprintContract,
  buildAccountDecisionInputFingerprint,
  type AccountDecisionFingerprint,
}

/**
 * The application boundary for account decisions. It composes existing data and algorithms but
 * never persists a plan or mutates account assets; pages may save only after a separate user action.
 */
export function buildAccountDecisionSnapshot(
  input: BuildAccountDecisionInput & { deferWarehouseAnalysis?: false },
): AccountDecisionSnapshot & { warehouse: NonNullable<AccountDecisionSnapshot['warehouse']> }
export function buildAccountDecisionSnapshot(
  input: BuildAccountDecisionInput,
): AccountDecisionSnapshot
export function buildAccountDecisionSnapshot({
  warehouse,
  profiles: suppliedProfiles,
  drafts,
  activePlanIds,
  developmentPriorityAgentIds = [],
  preference,
  optimizerOptions = {},
  capturedAt,
  planningDpsEvaluations = [],
  planningCandidateAuthorities,
  deferDiagnosticInference,
  deferWarehouseAnalysis,
  preferBoxAdmission,
}: BuildAccountDecisionInput): AccountDecisionSnapshot {
  if (!warehouse.accountId) throw new Error('决策服务只接受具名活动账户，不能回退到旧表。')

  const { ownedAgentIds, profiles } = resolveDecisionProfiles(warehouse, suppliedProfiles)
  const preferredAgentIds = uniqueInOrder(developmentPriorityAgentIds)
  const fingerprint = buildAccountDecisionInputFingerprint({
    warehouse,
    profiles,
    drafts,
    activePlanIds,
    developmentPriorityAgentIds,
    preference,
    optimizerOptions,
  })
  // A normal account read already orders discs by id. Keep the legacy
  // order-sensitive hash for callers that pass in a different order.
  const discsAreOrdered = warehouse.discs.every(
    (disc, index) => index === 0 || warehouse.discs[index - 1]!.id.localeCompare(disc.id) <= 0,
  )
  const warehouseHash = discsAreOrdered
    ? fingerprint.components.warehouseHash
    : contentHash(warehouse.discs)
  const rosterHash = fingerprint.components.rosterHash
  const currentPlanIdsByAgent = { ...activePlanIds, ...preference.planIdsByAgent }
  // Allocation is deferred for interactive browser analysis. Its preliminary
  // team solve has no consumer until a full allocation is requested.
  const allocationPriority = () => {
    const bangbooCandidateIds = currentBangbooDirectory
      .filter((bangboo) => bangboo.releaseState === 'released')
      .map((bangboo) => bangboo.id)
    const baseTeamEngine = solveTeamEngine(current31TeamEngineD1Pack, {
      ownedAgentIds,
      bangbooCandidateIds,
      preferredAgentIds,
      agentStateById: Object.fromEntries(
        warehouse.roster.agents.map((agent) => [
          agent.agentId,
          { mindscape: agent.mindscape, potentialImage: agent.potentialImage },
        ]),
      ),
      cultivationByAgentId: Object.fromEntries(
        ownedAgentIds.map((agentId) => [
          agentId,
          profiles.some((profile) => profile.agentId === agentId) ? 'developing' : 'unbuilt',
        ]),
      ),
    })
    return uniqueInOrder(
      allocationTargetCandidates(baseTeamEngine, preference).flatMap(
        (candidate) => candidate.memberIds,
      ),
    )
  }
  const allocation: AccountBuildResult = deferDiagnosticInference
    ? {
        independent: [],
        global: [],
        gaps: {},
        conflicts: {},
        independentUnavailableAgentIds: [],
        globalUnavailableAgentIds: [],
        unavailableAgentIds: [],
        diagnostics: [],
        warehouseHash,
        inputHash: fingerprint.inputHash,
        elapsedMs: 0,
        exactWithinModel: false,
        deferred: true,
        boundary: '先从通用榜单选择队伍；选定后按当前仓库计算配装。',
      }
    : optimizeAccountBuilds(warehouse.discs, profiles, {
        ...optimizerOptions,
        // This allocation serves downstream execution/readiness. Numeric candidate scoring reads the
        // independent per-agent projections instead, so Team Engine order cannot feed its own rating.
        priorityAgentIds: uniqueInOrder([
          ...allocationPriority(),
          ...(optimizerOptions.priorityAgentIds ?? []),
        ]),
      })
  // Template ids are exact portfolio selections, but the exhaustive Authority
  // deliberately has no legacy Engine-template crosswalk.  Do not let that
  // diagnostic blocker erase the Authority variants needed to replay the
  // selected identity; the real template constraint remains intact below in
  // `coordinateDecisionPortfolio`.
  const authorityPreference = preference.templateIds.length
    ? { ...preference, templateIds: [] }
    : preference
  let admitted =
    preferBoxAdmission &&
    preference.teamCount === 1 &&
    !preference.templateIds.length &&
    !preference.fixedAgentIds.length &&
    !preference.fixedBangbooIds.length
      ? ownedAdmittedBoxFormations(new Set(ownedAgentIds))
      : undefined
  if (!admitted?.length) admitted = undefined
  if (!admitted && usesTeamStartupIntrinsicIndex()) throw new FullTeamIndexesRequired()
  let exhaustiveCandidateScoring = projectCurrent31ProductionDecisionUniverse(
    warehouse.roster,
    admitted,
  )
  const decide = () =>
    projectAccountDecisionAuthority({
      deferDiagnosticInference,
      rankedFormations: exhaustiveCandidateScoring.authorityFormations,
      roster: warehouse.roster,
      allocation,
      preference: authorityPreference,
      decisionIssueClassificationFingerprint:
        exhaustiveCandidateScoring.coverage.decisionIssueClassification.fingerprint,
    })
  let decisionAuthority = decide()
  if (
    admitted &&
    (decisionAuthority.status !== 'ready' || !decisionAuthority.recommendations.length)
  ) {
    if (usesTeamStartupIntrinsicIndex()) throw new FullTeamIndexesRequired()
    admitted = undefined
    exhaustiveCandidateScoring = projectCurrent31ProductionDecisionUniverse(warehouse.roster)
    decisionAuthority = decide()
  }
  const exhaustiveScoreByMembers = new Map(
    exhaustiveCandidateScoring.rankedFormations.map((candidate) => [
      [...candidate.memberIds].sort().join('|'),
      candidate,
    ]),
  )
  const calibrationRanked = current31TeamEngineD1Pack.kernels
    .flatMap((kernel) =>
      kernel.eligibleThirdAgentIds.flatMap((thirdAgentId) => {
        const memberIds = [...kernel.coreAgentIds, thirdAgentId] as [string, string, string]
        const score = exhaustiveScoreByMembers.get([...memberIds].sort().join('|'))
        return score
          ? [
              {
                candidateId: `${kernel.kernelId}:${memberIds.join('+')}`,
                memberIds,
                planningDps: score.planningDps,
              },
            ]
          : []
      }),
    )
    .sort(
      (left, right) =>
        right.planningDps - left.planningDps || left.candidateId.localeCompare(right.candidateId),
    )
    .map((candidate, index) => ({
      rank: index + 1,
      candidateId: candidate.candidateId,
      memberIds: candidate.memberIds,
    }))
  const teamEngineInput: TeamEngineBoxInput = createAccountTeamEngineBoxInput({
    warehouse,
    profiles,
    allocation,
    developmentPriorityAgentIds: preferredAgentIds,
  })
  const teamEngine = solveTeamEngine(current31TeamEngineD1Pack, teamEngineInput)
  const coordinationProjection = teamEngineRecommendationsForCoordinationWithDiagnostics({
    result: teamEngine,
    pack: current31TeamEngineD1Pack,
    preference,
    currentPlanIdsByAgent,
  })
  const portfolioProjection = authorityPortfolioCandidates({
    authority: decisionAuthority,
    roster: warehouse.roster,
    engineMatches: coordinationProjection.candidates,
    engineCandidates: teamEngine.recommendations,
    // A stored player selection may name an Authority exact variant rather than
    // its legacy Engine equivalent. Keep that exact identity through the
    // allocation/protection replay instead of silently substituting the kernel.
    requestedCandidateIds: preference.templateIds,
  })
  const engineTeams = portfolioProjection.candidates
  const teamEngineCoverage = deriveTeamEngineCoverageDiagnostics({
    result: teamEngine,
    pack: current31TeamEngineD1Pack,
    boxInput: teamEngineInput,
  })
  const activePlansByAgent = activePlansForCoordination(drafts, preference, allocation)
  const coordinateForTeamCount = (teamCount: number) =>
    coordinateDecisionPortfolio(
      {
        portfolioInput: {
          candidates: engineTeams,
          activePlansByAgent,
          preferredAgentIds,
          preference: { ...preference },
        },
      },
      compilePortfolioBuildIntent({ teamCount }),
    )
  const coordinationByTeamCount = {
    1: coordinateForTeamCount(1),
    2: coordinateForTeamCount(2),
    3: coordinateForTeamCount(3),
  }
  const coordination =
    preference.teamCount === 1 || preference.teamCount === 2 || preference.teamCount === 3
      ? coordinationByTeamCount[preference.teamCount]
      : coordinateForTeamCount(preference.teamCount)
  const authorityCandidates = authorityExecutionCandidates(
    decisionAuthority,
    teamEngine.recommendations,
    createAuthorityExecutionVariantResolver({
      pack: current31TeamEngineD1Pack,
      boxInput: teamEngineInput,
      baseCandidates: teamEngine.recommendations,
    }),
  )
  const executionInput = {
    candidates: [...teamEngine.recommendations, ...authorityCandidates],
    allocation,
    roster: warehouse.roster,
    drafts,
    activePlanIds: currentPlanIdsByAgent,
  }
  const teamExecutions = projectTeamExecutions(executionInput)
  const planningDpsAssembly = assemblePlanningCandidateEvaluations({
    candidates: teamEngine.recommendations,
    executions: teamExecutions,
    roster: warehouse.roster,
    discs: warehouse.discs,
    authorityByCandidate: planningCandidateAuthorities,
  })
  const { evaluations, normalizedBangbooBlockers } = projectAccountPlanningEvaluations({
    accountId: warehouse.accountId,
    fingerprint,
    roster: warehouse.roster,
    discs: warehouse.discs,
    capturedAt: capturedAt ?? warehouse.roster.updatedAt,
    candidates: teamEngine.recommendations,
    executions: teamExecutions,
    suppliedEvaluations: planningDpsEvaluations,
  })
  const boxPlanning = projectAccountBoxPlanning({
    accountId: warehouse.accountId,
    fingerprint,
    teamEngine,
    evaluations,
    assemblyBlockersByCandidate: {
      ...Object.fromEntries(planningDpsAssembly.map((item) => [item.candidateId, item.blockers])),
      ...normalizedBangbooBlockers,
    },
    exhaustiveCoverage: exhaustiveCandidateScoring.coverage,
    calibrationRanked,
  })
  const boxNumericDecision = boxPlanning.decision
  const teamExecutionPortfoliosByTeamCount = {
    1: projectSimultaneousTeamExecutionPortfolio({
      ...executionInput,
      candidates: portfolioProjection.executionCandidates,
      coordination: coordinationByTeamCount[1],
      requestedTeamCount: 1,
    }),
    2: projectSimultaneousTeamExecutionPortfolio({
      ...executionInput,
      candidates: portfolioProjection.executionCandidates,
      coordination: coordinationByTeamCount[2],
      requestedTeamCount: 2,
    }),
    3: projectSimultaneousTeamExecutionPortfolio({
      ...executionInput,
      candidates: portfolioProjection.executionCandidates,
      coordination: coordinationByTeamCount[3],
      requestedTeamCount: 3,
    }),
  }
  const savedTeamBuildIntentsByDraftId = deferWarehouseAnalysis
    ? undefined
    : currentSavedTeamBuildIntents(drafts, { decisionAuthority, teamEngine, allocation }, warehouse)
  const warehouseAnalysis = deferWarehouseAnalysis
    ? undefined
    : analyzeAccountWarehouse({
        accountId: warehouse.accountId,
        discs: warehouse.discs,
        roster: warehouse.roster,
        drafts,
        activePlanIds: currentPlanIdsByAgent,
        priorityAgentIds: preferredAgentIds,
        savedTeamBuildIntentsByDraftId: savedTeamBuildIntentsByDraftId!,
        ...warehouseDecisionDemand(
          preference,
          coordination,
          portfolioProjection.candidates,
          drafts,
        ),
        dataVersion: currentVersionProjection.packageVersion,
        now: capturedAt,
      })
  const physicalDiscReferences = allocation.global.flatMap((loadout) =>
    loadout.discs.map((choice) => choice.disc.id),
  )
  const planningDpsReadyAgentIds = planningDpsReadyOwnedAgentIds(ownedAgentIds)
  const teamEngineDecisionClaim = teamEngineClaim(teamEngine)
  const coordinationDecisionClaim = coordinationClaim(coordination)
  const allocationDecisionClaim = allocationClaim(
    allocation,
    profiles.length,
    ownedAgentIds,
    profiles.map((profile) => profile.agentId),
  )
  const formalDamageClaim = formalDamageDecisionClaim()
  const planningDpsClaim = boxPlanning.claim

  return {
    contractVersion: accountDecisionContractVersion,
    revision: accountDecisionRevision,
    sideEffect: 'read_only',
    account: {
      accountId: warehouse.accountId,
      warehouseDiscCount: warehouse.discs.length,
      warehouseHash,
      rosterHash,
    },
    data: {
      gameVersion: currentVersionProjection.gameVersion,
      packageId: currentVersionProjection.packageId,
      packageVersion: currentVersionProjection.packageVersion,
      lifecycle: currentVersionProjection.lifecycle,
      fieldBoundary: currentVersionProjection.fieldBoundary,
      authorityId: currentDataAuthorityId,
    },
    fingerprint,
    warehouse: warehouseAnalysis,
    allocation,
    teamEngine,
    teamEngineCoverage,
    coordination,
    coordinationByTeamCount,
    teamExecutions,
    teamExecutionPortfoliosByTeamCount,
    planningDpsAssembly,
    boxNumericDecision,
    candidateUniverseCoverage: {
      legalAgentFormationCount: current31CandidateUniverseAudit.legalUniverse.agentFormationCount,
      formationBangbooCandidateCount:
        current31CandidateUniverseAudit.legalUniverse.formationBangbooCandidateCount,
      normalizedScoredFormationCount:
        current31CandidateUniverseAudit.normalizedDecisionScoreAudit.scoredFormationCount,
      normalizedScoredFormationBangbooCandidateCount:
        current31CandidateUniverseAudit.normalizedDecisionScoreAudit
          .scoredFormationBangbooCandidateCount,
      exhaustiveAccountFormationCount: exhaustiveCandidateScoring.coverage.eligibleFormationCount,
      exhaustiveEvaluatedFormationBangbooCandidateCount:
        exhaustiveCandidateScoring.coverage.formationBangbooCandidateCount,
      exhaustiveScoredFormationBangbooCandidateCount:
        exhaustiveCandidateScoring.coverage.scoredFormationBangbooCandidateCount,
      sourceBackedBangbooRecommendationCount:
        exhaustiveCandidateScoring.coverage.sourceBackedBangbooRecommendationCount,
      exhaustiveUnsupportedBangbooCandidateCount:
        exhaustiveCandidateScoring.coverage.unsupportedBangbooCandidateCount,
      exhaustiveBangbooBlockerCounts: exhaustiveCandidateScoring.coverage.bangbooBlockerCounts,
      exhaustiveDecisionIssueClassification:
        exhaustiveCandidateScoring.coverage.decisionIssueClassification,
      mechanicClosedAtBaseCount: exhaustiveCandidateScoring.coverage.mechanicClosedAtBaseCount,
      limitedButNotPrunedCount: exhaustiveCandidateScoring.coverage.limitedButNotPrunedCount,
      curatedProductionCandidateCount: teamEngine.recommendations.length,
      accountBoundProductionCandidateCount: boxNumericDecision.ranked.length,
      status: exhaustiveCandidateScoring.coverage.complete
        ? 'source_backed_asset_bound_complete_authority_reopened'
        : 'reopened_missing_asset_bindings',
      boundary: exhaustiveCandidateScoring.boundary,
    },
    exhaustiveCandidateScoring: {
      coverage: exhaustiveCandidateScoring.coverage,
      topRankedFormations: exhaustiveCandidateScoring.rankedFormations.slice(0, 50),
      fingerprint: exhaustiveCandidateScoring.fingerprint,
      boundary: exhaustiveCandidateScoring.boundary,
    },
    decisionAuthority,
    ...(admitted ? { boxAdmissionScoped: true as const } : {}),
    hardConstraints: {
      active: enumerateActiveTeamHardConstraints(preference),
      canRestoreDefault:
        enumerateActiveTeamHardConstraints(preference).length > 0 || preference.teamCount !== 1,
    },
    portfolioInput: {
      candidates: engineTeams,
      activePlansByAgent,
      preferredAgentIds,
      preference: { ...preference },
    },
    claims: {
      overall: overallClaim({
        allocation: allocationDecisionClaim,
        teamEngine: teamEngineDecisionClaim,
        coordination: coordinationDecisionClaim,
        formalDamage: formalDamageClaim,
        planningDps: planningDpsClaim,
      }),
      data: dataDecisionClaim(),
      warehouse: warehouseAnalysis
        ? {
            status: 'limited',
            summary: `已分析完整 ${warehouseAnalysis.decisions.length} 张仓库盘；清理结论仅为人工复核候选。`,
            allows: ['解释分类、方案引用、替代盘与强化潜力'],
            forbids: commonForbiddenClaims,
            blockers: [],
          }
        : {
            status: 'limited',
            summary: '仓库全量分析按需生成；清理结论仅为人工复核候选。',
            allows: ['按需请求完整仓库分析、解释分类、方案引用、替代盘与强化潜力'],
            forbids: commonForbiddenClaims,
            blockers: [],
          },
      allocation: allocationDecisionClaim,
      teamEngine: teamEngineDecisionClaim,
      coordination: coordinationDecisionClaim,
      formalDamage: formalDamageClaim,
      planningDps: planningDpsClaim,
    },
    explanation: {
      ownedAgentCount: ownedAgentIds.length,
      calculableAgentCount: profiles.length,
      profileCoverageGapCount: Math.max(0, ownedAgentIds.length - profiles.length),
      scheduledAgentCount: allocation.global.length,
      unavailableAgentCount: allocation.globalUnavailableAgentIds.length,
      physicalDiscReferenceCount: physicalDiscReferences.length,
      uniquePhysicalDiscReferenceCount: new Set(physicalDiscReferences).size,
      warehouseCoverageComplete: warehouseAnalysis
        ? warehouseAnalysis.decisions.length === warehouse.discs.length
        : false,
      planningDpsReadyAgentCount: planningDpsReadyAgentIds.length,
      planningDpsReadyAgentIds,
    },
  }
}
