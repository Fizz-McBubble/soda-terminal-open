import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type {
  DevelopmentCandidateAlternativesQueryResult,
  TargetTeamWarehouseFitQueryResult,
} from './calculationQueryContract'
import type { RemoteCalculationResult } from './remoteCalculationProtocol'

export function projectCandidatePlan(plan: CandidateWarehousePlan): CandidateWarehousePlan {
  const {
    scope,
    agentIds,
    loadouts,
    totalScore,
    gaps,
    solver,
    boundary,
    panelObjectiveNote,
    inventoryTransition,
  } = plan
  return {
    scope,
    agentIds,
    loadouts,
    totalScore,
    alternatives: [],
    gaps,
    ...(solver
      ? {
          solver: {
            method: solver.method,
            exactWithinModel: solver.exactWithinModel,
            domain: solver.domain,
          },
        }
      : {}),
    boundary,
    ...(panelObjectiveNote ? { panelObjectiveNote } : {}),
    ...(inventoryTransition ? { inventoryTransition } : {}),
  }
}

export function projectPublicTargetTeamFit(
  fit: TargetTeamWarehouseFitQueryResult,
): RemoteCalculationResult {
  const {
    contract,
    candidateId,
    memberIds,
    status,
    solverMethod,
    exactWithinModel,
    discCount,
    uniqueDiscCount,
    totalScore,
    gaps,
    warehousePlan,
    equipmentRecommendations,
    sideEffect,
    boundary,
    portfolioContinuationEligible,
    effectiveEquipmentParameters,
    accountFactBinding,
    targetExecution,
    teamExecutionPresentation,
    accountBoundBenchmark,
  } = fit
  return {
    scenarioSelection: fit.scenarioSelection,
    scenarioIdentity: fit.scenarioIdentity,
    eventConditionDeclarationsByAgentId: fit.eventConditionDeclarationsByAgentId,
    eventConditionDeclarationsIdentity: fit.eventConditionDeclarationsIdentity,
    contract,
    candidateId,
    memberIds,
    status,
    solverMethod,
    exactWithinModel,
    discCount,
    uniqueDiscCount,
    totalScore,
    gaps,
    warehousePlan: warehousePlan ? projectCandidatePlan(warehousePlan) : undefined,
    equipmentRecommendations,
    sideEffect,
    boundary,
    portfolioContinuationEligible,
    effectiveEquipmentParameters,
    accountFactBinding,
    targetExecution,
    teamExecutionPresentation,
    accountBoundBenchmark: accountBoundBenchmark
      ? {
          ...(accountBoundBenchmark.koledaFixedEventConditionsMetadata32
            ? {
                koledaFixedEventConditionsMetadata32:
                  accountBoundBenchmark.koledaFixedEventConditionsMetadata32,
              }
            : {}),
          equipmentModifierProjection: accountBoundBenchmark.equipmentModifierProjection
            ? {
                wEngines: accountBoundBenchmark.equipmentModifierProjection.wEngines.map(
                  (item) => ({
                    passiveStatus: item.passiveStatus,
                  }),
                ),
              }
            : null,
        }
      : undefined,
    buildIntent: fit.buildIntent
      ? {
          contract: fit.buildIntent.contract,
          scope: fit.buildIntent.scope,
          resourcePolicy: fit.buildIntent.resourcePolicy,
          fingerprint: fit.buildIntent.fingerprint,
          exactTeam: {
            candidateId: fit.buildIntent.exactTeam.candidateId,
            bangbooId: fit.buildIntent.exactTeam.bangbooId,
          },
        }
      : undefined,
  } as RemoteCalculationResult
}

export function projectPublicDevelopmentAlternatives(
  result: DevelopmentCandidateAlternativesQueryResult,
): RemoteCalculationResult {
  const {
    contract,
    runId,
    capturedAt,
    inputFingerprint,
    comparisonContract,
    resourceGrantDeclaration32,
    scenarioSelection,
    scenarioIdentity,
    eventConditionDeclarationsByAgentId,
    eventConditionDeclarationsIdentity,
    comparisonFingerprint,
    comparisonOptions,
    candidateParametersByRank,
    candidateSearch,
    candidateSearchByRank,
    accountId,
    agentId,
    status,
    sideEffect,
    baseline,
    candidates,
    valueBenchmarks,
    gaps,
    presentation,
    panelPresentation,
  } = result
  return {
    contract,
    runId,
    capturedAt,
    inputFingerprint,
    comparisonContract,
    resourceGrantDeclaration32,
    scenarioSelection,
    scenarioIdentity,
    eventConditionDeclarationsByAgentId,
    eventConditionDeclarationsIdentity,
    comparisonFingerprint,
    comparisonOptions,
    candidateParametersByRank,
    candidateSearch,
    candidateSearchByRank,
    accountId,
    agentId,
    status,
    sideEffect,
    buildIntent: {
      contract: result.buildIntent.contract,
      scope: result.buildIntent.scope,
      fingerprint: result.buildIntent.fingerprint,
    },
    baseline,
    candidates: candidates.map(projectCandidatePlan),
    valueBenchmarks,
    gaps,
    presentation,
    panelPresentation,
  } as RemoteCalculationResult
}
