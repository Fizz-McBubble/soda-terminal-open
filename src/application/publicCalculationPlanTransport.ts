import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type {
  DevelopmentCandidateAlternativesQueryResult,
  TargetTeamWarehouseFitQueryResult,
} from './calculationQueryContract'
import type { RemoteCalculationResult } from './remoteCalculationProtocol'
import { luminizeEquipmentSnapshotSchema32 } from './publicLuminizeComparison32'
import { resourceTimelineDeclarationSchema32 } from '../calculation/resourceTimelineDeclarationContract32'
import {
  publicDevelopmentWEngineComparison,
  publicDevelopmentWEngineOption,
} from './publicDevelopmentWEngineComparison'
import type { ValueBenchmarkComparison } from '../calculation/valueBenchmarkComparison'

const publicValueBenchmarkKeys = [
  'contract',
  'evidencePolicy',
  'status',
  'comparable',
  'sideEffect',
  'changedDimensions',
  'attribution',
  'comparabilityKey',
  'baseline',
  'candidate',
  'totalDamageDelta',
  'totalDamagePercentDelta',
  'planningDpsDelta',
  'planningDpsPercentDelta',
  'coverage',
  'comparisonBasis',
  'verdict',
  'candidateDisposition',
  'direction',
  'reasons',
  'boundary',
  'fingerprint',
  'luminizeComparison32',
] as const

function projectPublicValueBenchmark(value: ValueBenchmarkComparison | undefined) {
  if (!value || value.contract !== 'soda-value-benchmark-comparison/v1') return undefined
  return Object.fromEntries(
    publicValueBenchmarkKeys.filter((key) => key in value).map((key) => [key, value[key]]),
  ) as ValueBenchmarkComparison
}

function projectPublicTargetTeamCalculationProjection32(
  projection: TargetTeamWarehouseFitQueryResult['accountBoundBenchmark']['calculationProjection'],
) {
  if (!projection) return null
  if (projection.status === 'unsupported')
    return {
      status: projection.status,
      blockers: projection.blockers,
      fingerprint: projection.fingerprint,
    } as const
  return {
    status: projection.status,
    resourceObservationHash: projection.resourceObservationHash,
    selectedActionResourceProduction32: projection.selectedActionResourceProduction32,
    memberSourceResourceProduction32: projection.memberSourceResourceProduction32,
    ...('resourceTimeline32' in projection
      ? { resourceTimeline32: projection.resourceTimeline32 }
      : {}),
  }
}

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
    valueBenchmark,
    accountBoundBenchmark,
  } = fit
  const publicValueBenchmark = projectPublicValueBenchmark(valueBenchmark)
  return {
    scenarioSelection: fit.scenarioSelection,
    ...(fit.standardReference32 ? { standardReference32: fit.standardReference32 } : {}),
    ...(fit.standardReferenceRequest32
      ? { standardReferenceRequest32: fit.standardReferenceRequest32 }
      : {}),
    ...(fit.declaredEventBenchmark32
      ? { declaredEventBenchmark32: fit.declaredEventBenchmark32 }
      : {}),
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
    ...(publicValueBenchmark ? { valueBenchmark: publicValueBenchmark } : {}),
    accountBoundBenchmark: accountBoundBenchmark
      ? {
          ...(accountBoundBenchmark.sourceInputFingerprint === undefined
            ? {}
            : { sourceInputFingerprint: accountBoundBenchmark.sourceInputFingerprint }),
          ...(accountBoundBenchmark.resourceTimelineDeclaration32 === undefined
            ? {}
            : {
                resourceTimelineDeclaration32:
                  accountBoundBenchmark.resourceTimelineDeclaration32 === null
                    ? null
                    : resourceTimelineDeclarationSchema32.parse(
                        accountBoundBenchmark.resourceTimelineDeclaration32,
                      ),
                resourceTimelineDeclarationIdentity32:
                  accountBoundBenchmark.resourceTimelineDeclarationIdentity32,
              }),
          calculationProjection: projectPublicTargetTeamCalculationProjection32(
            accountBoundBenchmark.calculationProjection,
          ),
          ...(accountBoundBenchmark.luminizeSnapshot32 === undefined
            ? {}
            : {
                luminizeSnapshot32: luminizeEquipmentSnapshotSchema32.parse(
                  accountBoundBenchmark.luminizeSnapshot32,
                ),
              }),
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
    wEngineComparison,
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
    comparisonOptions: comparisonOptions
      ? {
          reviewedEvent32: comparisonOptions.reviewedEvent32,
          potentialSupported: comparisonOptions.potentialSupported,
          wEngines: comparisonOptions.wEngines.map(publicDevelopmentWEngineOption),
        }
      : undefined,
    ...(wEngineComparison
      ? { wEngineComparison: publicDevelopmentWEngineComparison(wEngineComparison) }
      : {}),
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
