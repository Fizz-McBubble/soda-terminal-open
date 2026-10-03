import type {
  AccountDecisionRun,
  DevelopmentCandidateAlternativesQueryResult,
  TargetTeamWarehouseFitQueryResult,
} from './calculationQueryContract'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { RemoteCalculationRequest, RemoteCalculationResult } from './remoteCalculationProtocol'
import type { SavedTeamReplayPresentation } from './publicSavedTeamReplay'
import type { SavedTeamSolutionComponents } from './publicSavedTeamSolutionComponents'
import type { DevelopmentWorkbenchRoutePresentation } from './publicDevelopmentWorkbenchRoute'
import type { TeamOverviewPresentationDto } from '../pages/teamLoadoutPresentationDto'
import type { TeamRoutePresentation } from '../pages/publicTeamRoutePresentation'
import type { WarehouseDiscTransitionUsesResult } from './calculationQueryContract'
import { packPublicWarehouseActions } from './publicWarehouseActionTransport'
import { commonAnomalySettlementQueryResultSchema32 } from './publicCommonAnomalySettlementQuery32'

/**
 * Browser transport boundary. The private service keeps the full captured run and solve; the public
 * browser receives only the fields real consumers read (display, validation, save and read-back).
 * The field list is derived from the audited public graph — `outputs/n5-gate-b-public-field-usage`
 * style recon per query kind — and pinned by `publicCalculationTransport.test.ts`.
 */
export function projectPublicCalculationResult(
  kind: RemoteCalculationRequest['query']['kind'],
  result: unknown,
): RemoteCalculationResult {
  switch (kind) {
    case 'common_anomaly_settlement32': {
      const view =
        result as import('./publicCommonAnomalySettlementQuery32').CommonAnomalySettlementQueryResult32
      const { contract, runId, metadata, fingerprint } = view
      return commonAnomalySettlementQueryResultSchema32.parse({
        contract,
        runId,
        metadata,
        result: view.result,
        fingerprint,
      })
    }
    case 'planning_benchmark32': {
      const view = result as import('./publicPlanningBenchmark32').PlanningBenchmarkResult32
      return {
        contract: view.contract,
        runId: view.runId,
        candidateId: view.candidateId,
        fitFingerprint: view.fitFingerprint,
        accountFingerprint: view.accountFingerprint,
        sourceBindingFingerprint: view.sourceBindingFingerprint,
        inputFingerprint: view.inputFingerprint,
        sideEffect: view.sideEffect,
        status: view.status,
        formalCycleReady: view.formalCycleReady,
        totalDamage: view.totalDamage,
        benchmarkDps: view.benchmarkDps,
        declaredDurationSeconds: view.declaredDurationSeconds,
        resultFingerprint: view.resultFingerprint,
        metadata:
          view.metadata === null
            ? null
            : {
                contract: view.metadata.contract,
                gameVersion: view.metadata.gameVersion,
                phaseId: view.metadata.phaseId,
                sourceFingerprint: view.metadata.sourceFingerprint,
                declaredDurationSeconds: view.metadata.declaredDurationSeconds,
                memberIds: [...view.metadata.memberIds],
                events: view.metadata.events.map((event) => ({
                  ownerAgentId: event.ownerAgentId,
                  eventId: event.eventId,
                  skillLevel: event.skillLevel,
                  requiresWindsweptObservation: event.requiresWindsweptObservation,
                  sourceRefs: [...event.sourceRefs],
                  conditions: event.conditions.map((condition) => ({
                    providerAgentId: condition.providerAgentId,
                    referenceKey: condition.referenceKey,
                    label: condition.label,
                    valueKind: condition.valueKind,
                    ...(condition.minimum === undefined ? {} : { minimum: condition.minimum }),
                    ...(condition.maximum === undefined ? {} : { maximum: condition.maximum }),
                    ...(condition.options === undefined
                      ? {}
                      : {
                          options: condition.options.map((option) => ({
                            value: option.value,
                            label: option.label,
                          })),
                        }),
                    sourceRefs: [...condition.sourceRefs],
                  })),
                })),
              },
        eventResults: view.eventResults.map((event) => ({
          occurrenceId: event.occurrenceId,
          ownerAgentId: event.ownerAgentId,
          eventId: event.eventId,
          atSeconds: event.atSeconds,
          snapshotAtSeconds: event.snapshotAtSeconds,
          totalDamage: event.totalDamage,
          runtimeHash: event.runtimeHash,
          sourceRefs: [...event.sourceRefs],
        })),
        includedEffectKeys: [...view.includedEffectKeys],
        excludedEffects: view.excludedEffects.map((effect) => ({
          effectKey: effect.effectKey,
          reason: effect.reason,
          fields: [...effect.fields],
          sourceRefs: [...effect.sourceRefs],
        })),
        gaps: [...view.gaps],
        missingContext: [...view.missingContext],
      }
    }
    case 'reviewed_incremental_event32': {
      const view =
        result as import('./publicReviewedIncrementalEvent32').ReviewedIncrementalEventResult32Dto
      const {
        contract,
        runId,
        inputFingerprint,
        resultFingerprint,
        sideEffect,
        subject,
        status,
        formalSingleEvent,
        expectedDamage,
        gaps,
      } = view
      return {
        contract,
        runId,
        inputFingerprint,
        resultFingerprint,
        sideEffect,
        subject,
        status,
        formalSingleEvent,
        expectedDamage,
        gaps,
      }
    }
    case 'account_decision':
      return projectPublicAccountDecisionRun(result as AccountDecisionRun)
    case 'target_team_warehouse_fit':
      return projectPublicTargetTeamFit(result as TargetTeamWarehouseFitQueryResult)
    case 'team_overview_presentation': {
      const view = result as TeamOverviewPresentationDto
      const { contract, runId, accountId, inputFingerprint, context, overviewModel } = view
      return { contract, runId, accountId, inputFingerprint, context, overviewModel }
    }
    case 'team_route_presentation': {
      const view = result as TeamRoutePresentation
      const {
        contract,
        runId,
        accountId,
        inputFingerprint,
        candidateId,
        team,
        targetCandidateId,
        discOnlyCandidate,
        automaticBangboo,
        playerConfirmableBangbooOptions,
        ratingAnalysis,
        recommendationScore,
        teamRatingLabel,
        alternativeTeams,
      } = view
      return {
        contract,
        runId,
        accountId,
        inputFingerprint,
        candidateId,
        team,
        targetCandidateId,
        ...(discOnlyCandidate ? { discOnlyCandidate } : {}),
        automaticBangboo,
        playerConfirmableBangbooOptions,
        ratingAnalysis,
        recommendationScore,
        teamRatingLabel,
        alternativeTeams,
      }
    }
    case 'saved_team_plan_replay': {
      const view = result as SavedTeamReplayPresentation
      const { contract, runId, accountId, inputFingerprint, planId, planHash, status } = view
      return {
        contract,
        runId,
        accountId,
        inputFingerprint,
        planId,
        planHash,
        status,
        match: view.match
          ? {
              buildIntent: {
                fingerprint: view.match.buildIntent.fingerprint,
                exactTeam: { candidateId: view.match.buildIntent.exactTeam.candidateId },
              },
              effectiveEquipmentParameters: view.match.effectiveEquipmentParameters,
              accountFactBinding: view.match.accountFactBinding,
            }
          : null,
      } as RemoteCalculationResult
    }
    case 'saved_team_solution_components': {
      const view = result as SavedTeamSolutionComponents
      const {
        contract,
        runId,
        accountId,
        capturedInputFingerprint,
        projectedInputHash,
        nonPlanningComponents,
      } = view
      return {
        contract,
        runId,
        accountId,
        capturedInputFingerprint,
        projectedInputHash,
        nonPlanningComponents,
      }
    }
    case 'development_candidate_alternatives':
      return projectPublicDevelopmentAlternatives(
        result as DevelopmentCandidateAlternativesQueryResult,
      )
    case 'development_workbench_route': {
      const view = result as DevelopmentWorkbenchRoutePresentation
      const {
        contract,
        runId,
        accountId,
        inputFingerprint,
        selection,
        status,
        selectedDiscFingerprint,
        source,
        panel,
        setRecommendations,
        recordedEvaluation,
        discFacts,
        workbench,
        graduationPanel,
      } = view
      return {
        contract,
        runId,
        accountId,
        inputFingerprint,
        selection,
        status,
        selectedDiscFingerprint,
        source,
        panel,
        setRecommendations,
        recordedEvaluation,
        discFacts,
        workbench,
        graduationPanel,
      }
    }
    case 'warehouse_disc_transition_uses': {
      const view = result as WarehouseDiscTransitionUsesResult
      const { runId, inputFingerprint, discId, accountId, sideEffect, checkedAgentCount, uses } =
        view
      return { runId, inputFingerprint, discId, accountId, sideEffect, checkedAgentCount, uses }
    }
  }
}

function projectPublicAccountDecisionRun(run: AccountDecisionRun): RemoteCalculationResult {
  const {
    runId,
    capturedAt,
    inputFingerprint,
    claimStatus,
    decisionAuthority,
    warehouseActions,
    developmentDirectory,
    developmentWorkbenchPresentation,
    teamPresentation,
  } = run
  // The browser keeps its own captured input (the remote client restores it after the response), so
  // `input` never travels. The captured decision travels as a display/validation subset: every field
  // kept here was enumerated from the audited public graph
  // (`outputs/n5-gate-b-public-field-usage.mjs`); the private research facts stay server side.
  const snapshot = {
    // Read-only proof travels with the run so a consumer can state the capture wrote nothing.
    sideEffect: run.snapshot?.sideEffect ?? ('read_only' as const),
    fingerprint: { inputHash: run.inputFingerprint },
    claims: { overall: { status: run.claimStatus } },
    decisionAuthority: run.decisionAuthority,
    hardConstraints: {
      active: run.snapshot?.hardConstraints?.active ?? [],
      canRestoreDefault: run.snapshot?.hardConstraints?.canRestoreDefault ?? false,
    },
    portfolioInput: {
      preference: { teamCount: run.snapshot?.portfolioInput?.preference?.teamCount ?? 1 },
    },
    allocation: {
      global: run.snapshot?.allocation?.global ?? [],
      diagnostics: run.snapshot?.allocation?.diagnostics ?? [],
    },
  }
  return {
    runId,
    capturedAt,
    inputFingerprint,
    claimStatus,
    decisionAuthority,
    snapshot,
    ...(warehouseActions ? { warehouseActions: packPublicWarehouseActions(warehouseActions) } : {}),
    ...(developmentDirectory ? { developmentDirectory } : {}),
    ...(developmentWorkbenchPresentation ? { developmentWorkbenchPresentation } : {}),
    ...(teamPresentation ? { teamPresentation } : {}),
  } as RemoteCalculationResult
}

function projectCandidatePlan(plan: CandidateWarehousePlan): CandidateWarehousePlan {
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

function projectPublicTargetTeamFit(
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

function projectPublicDevelopmentAlternatives(
  result: DevelopmentCandidateAlternativesQueryResult,
): RemoteCalculationResult {
  const {
    contract,
    runId,
    capturedAt,
    inputFingerprint,
    comparisonContract,
    comparisonFingerprint,
    comparisonOptions,
    candidateParametersByRank,
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
    comparisonFingerprint,
    comparisonOptions,
    candidateParametersByRank,
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
