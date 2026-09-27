import { warehouseDecisionDemand } from './warehouseDecisionDemand'
import { enumerateActiveTeamHardConstraints } from '../accounts/teamPortfolioPreference'
import { currentBangbooDirectory } from '../assault/catalog'
import { contentHash } from '../evaluation/contentHash'
import { currentDataAuthorityProjection } from '../gameDataPacks/currentDataAuthorityProjection'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { optimizeAccountBuilds } from '../optimizer/optimizeAccountBuilds'
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
import { assembleCunningHaresP0DecisionEvaluation } from './cunningHaresP0DecisionAssembler'
import { evaluateNormalizedPlanningCandidate } from './normalizedPlanningCandidateEvaluator'
import { current31CandidateUniverseAudit } from '../teamEngine/current31CandidateUniverseAudit'
import { projectCurrent31ProductionDecisionUniverse } from './exhaustiveAccountCandidateScoring'
import { projectAccountDecisionAuthority } from './accountDecisionAuthority'
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
  const warehouseHash = contentHash(warehouse.discs)
  const rosterHash = fingerprint.components.rosterHash
  const currentPlanIdsByAgent = { ...activePlanIds, ...preference.planIdsByAgent }
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
  const candidatePriorityAgentIds = uniqueInOrder(
    allocationTargetCandidates(baseTeamEngine, preference).flatMap(
      (candidate) => candidate.memberIds,
    ),
  )
  const allocation = optimizeAccountBuilds(warehouse.discs, profiles, {
    ...optimizerOptions,
    // This allocation serves downstream execution/readiness. Numeric candidate scoring reads the
    // independent per-agent projections instead, so Team Engine order cannot feed its own rating.
    priorityAgentIds: uniqueInOrder([
      ...candidatePriorityAgentIds,
      ...(optimizerOptions.priorityAgentIds ?? []),
    ]),
  })
  const exhaustiveCandidateScoring = projectCurrent31ProductionDecisionUniverse(warehouse.roster)
  // Template ids are exact portfolio selections, but the exhaustive Authority
  // deliberately has no legacy Engine-template crosswalk.  Do not let that
  // diagnostic blocker erase the Authority variants needed to replay the
  // selected identity; the real template constraint remains intact below in
  // `coordinateDecisionPortfolio`.
  const authorityPreference = preference.templateIds.length
    ? { ...preference, templateIds: [] }
    : preference
  const decisionAuthority = projectAccountDecisionAuthority({
    rankedFormations: exhaustiveCandidateScoring.authorityFormations,
    roster: warehouse.roster,
    allocation,
    preference: authorityPreference,
    decisionIssueClassificationFingerprint:
      exhaustiveCandidateScoring.coverage.decisionIssueClassification.fingerprint,
  })
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
  const assembledP0Evaluations = teamEngine.recommendations.flatMap((candidate) => {
    const evaluation = assembleCunningHaresP0DecisionEvaluation({
      accountId: warehouse.accountId!,
      rosterHash: fingerprint.components.rosterHash,
      warehouseHash: fingerprint.components.warehouseHash,
      planningHash: fingerprint.components.planningHash,
      capturedAt: capturedAt ?? warehouse.roster.updatedAt,
      candidate,
      execution: teamExecutions.find((item) => item.candidateId === candidate.candidateId),
      roster: warehouse.roster,
      discs: warehouse.discs,
    })
    return evaluation ? [evaluation] : []
  })
  const suppliedEvaluationIds = new Set(
    planningDpsEvaluations.flatMap((evaluation) =>
      typeof evaluation === 'object' &&
      evaluation !== null &&
      'candidateId' in evaluation &&
      typeof (evaluation as { candidateId?: unknown }).candidateId === 'string'
        ? [(evaluation as { candidateId: string }).candidateId]
        : [],
    ),
  )
  const p0EvaluationIds = new Set(
    assembledP0Evaluations.map((evaluation) => evaluation.candidateId),
  )
  const normalizedBangbooBlockers: Record<string, string[]> = {}
  const normalizedEvaluations = teamEngine.recommendations.flatMap((candidate) => {
    if (
      suppliedEvaluationIds.has(candidate.candidateId) ||
      p0EvaluationIds.has(candidate.candidateId)
    )
      return []
    const evaluation = evaluateNormalizedPlanningCandidate({
      accountId: warehouse.accountId!,
      rosterHash: fingerprint.components.rosterHash,
      warehouseHash: fingerprint.components.warehouseHash,
      planningHash: fingerprint.components.planningHash,
      capturedAt: capturedAt ?? warehouse.roster.updatedAt,
      candidate,
      execution: teamExecutions.find((item) => item.candidateId === candidate.candidateId),
      roster: warehouse.roster,
      discs: warehouse.discs,
      onUnsupportedBangboo: (blockers) => {
        normalizedBangbooBlockers[candidate.candidateId] = blockers
      },
    })
    return evaluation ? [evaluation] : []
  })
  const boxPlanning = projectAccountBoxPlanning({
    accountId: warehouse.accountId,
    fingerprint,
    teamEngine,
    evaluations: [...planningDpsEvaluations, ...assembledP0Evaluations, ...normalizedEvaluations],
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
  const warehouseAnalysis = analyzeAccountWarehouse({
    accountId: warehouse.accountId,
    discs: warehouse.discs,
    roster: warehouse.roster,
    drafts,
    activePlanIds: currentPlanIdsByAgent,
    priorityAgentIds: preferredAgentIds,
    ...warehouseDecisionDemand(preference, coordination, portfolioProjection.candidates, drafts),
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
      authorityId: currentDataAuthorityProjection.authorityId,
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
      boundary:
        '完整 legal formation identity 已进入账户无关 Team Rating；生产 Query 不在线执行 Exhaustive numeric Oracle。快照只返回 intrinsic shortlist，不自动执行实体盘或音擎求解；目标队伍必须由显式 Calculation/Query 调用。',
    },
    exhaustiveCandidateScoring: {
      coverage: exhaustiveCandidateScoring.coverage,
      topRankedFormations: exhaustiveCandidateScoring.rankedFormations.slice(0, 50),
      fingerprint: exhaustiveCandidateScoring.fingerprint,
      boundary: exhaustiveCandidateScoring.boundary,
    },
    decisionAuthority,
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
      warehouse: {
        status: 'limited',
        summary: `已分析完整 ${warehouseAnalysis.decisions.length} 张仓库盘；清理结论仅为人工复核候选。`,
        allows: ['解释分类、方案引用、替代盘与强化潜力'],
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
      warehouseCoverageComplete: warehouseAnalysis.decisions.length === warehouse.discs.length,
      planningDpsReadyAgentCount: planningDpsReadyAgentIds.length,
      planningDpsReadyAgentIds,
    },
  }
}
