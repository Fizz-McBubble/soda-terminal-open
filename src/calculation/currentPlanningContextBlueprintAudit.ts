import {
  current31LegalAgentFormations,
  current31LegalCandidateUniverse,
} from '../teamEngine/current31LegalCandidateUniverse'
import { currentAgentPlanningEffectBlueprintCoverage } from './currentAgentPlanningEffectBlueprint'
import { currentAgentEventContracts } from './currentAgentMechanicContracts'
import { currentPlanningInteractionFixtureAudit } from './currentPlanningInteractionFixtures'
import { currentPlanningInteractionMechanicIRAudit } from './currentPlanningInteractionMechanicIR'

const population = current31LegalCandidateUniverse.legality.agentCount
const allAgentsBlueprintReady =
  currentAgentEventContracts.length === population &&
  currentAgentEventContracts.every((contract) => contract.eventContract.events.length > 0) &&
  currentAgentPlanningEffectBlueprintCoverage.agentCount === population
const formationBlueprintReadyCount = allAgentsBlueprintReady
  ? current31LegalAgentFormations.length
  : 0
const effectBindingCount = allAgentsBlueprintReady
  ? ((currentAgentPlanningEffectBlueprintCoverage.upstreamEffectCount +
      currentAgentPlanningEffectBlueprintCoverage.reviewedPotentialEffectCount) *
      (population - 1) *
      (population - 2)) /
    2
  : 0

export const currentPlanningContextBlueprintAudit = Object.freeze({
  contract: 'soda-current-planning-context-blueprint-audit/v1',
  formationCount: current31LegalAgentFormations.length,
  formationBlueprintReadyCount,
  effectBindingCount,
  sourceHardGapCount: current31LegalAgentFormations.length - formationBlueprintReadyCount,
  dedicatedAdapterCount: 0,
  interactionOperators: {
    implementedCount: currentPlanningInteractionFixtureAudit.implementedOperatorCount,
    structurallyCoveredCount: currentPlanningInteractionFixtureAudit.coveredOperatorCount,
    representativeFixtureCount: currentPlanningInteractionFixtureAudit.representativeFixtureCount,
    productionNumericFixtureCount:
      currentPlanningInteractionFixtureAudit.productionNumericFixtureCount,
    engineeringBacklogCount:
      currentPlanningInteractionFixtureAudit.implementedOperatorCount -
      currentPlanningInteractionFixtureAudit.coveredOperatorCount,
    formationStructuralReadyCount: currentPlanningInteractionFixtureAudit.completeStructuralCoverage
      ? current31LegalAgentFormations.length
      : 0,
    productionNumericReadyFormationCount: 0,
    sharedMechanicPatternCount:
      currentPlanningInteractionMechanicIRAudit.sharedMechanicPatternCount,
    sourceHardGapCount: currentPlanningInteractionMechanicIRAudit.sourceHardGapCount,
    mechanicIrEntityCount: currentPlanningInteractionMechanicIRAudit.entityCount,
    namedResourceEntityCount: currentPlanningInteractionMechanicIRAudit.namedResourceEntityCount,
    resourceCalculationReadyEntityCount:
      currentPlanningInteractionMechanicIRAudit.resourceCalculationReadyEntityCount,
    partialResourceTransitionEntityCount:
      currentPlanningInteractionMechanicIRAudit.partialResourceTransitionEntityCount,
    incompleteResourceCandidateEntityCount:
      currentPlanningInteractionMechanicIRAudit.incompleteResourceCandidateEntityCount,
    effectOrStateParameterOnlyEntityCount:
      currentPlanningInteractionMechanicIRAudit.effectOrStateParameterOnlyEntityCount,
    fieldTimeHeuristicSourceEntityCount:
      currentPlanningInteractionMechanicIRAudit.fieldTimeHeuristicSourceEntityCount,
    fieldTimeBaselineObservationRequiredEntityCount:
      currentPlanningInteractionMechanicIRAudit.fieldTimeBaselineObservationRequiredEntityCount,
    specialInteractionCapabilityEntityCount:
      currentPlanningInteractionMechanicIRAudit.specialInteractionCapabilityEntityCount,
  },
  effectExpressions: {
    effectCount: currentAgentPlanningEffectBlueprintCoverage.effectCount,
    upstreamEffectCount: currentAgentPlanningEffectBlueprintCoverage.upstreamEffectCount,
    reviewedPotentialEffectCount:
      currentAgentPlanningEffectBlueprintCoverage.reviewedPotentialEffectCount,
    upstreamExpressionAvailableCount:
      currentAgentPlanningEffectBlueprintCoverage.upstreamNumericExpressionAvailableCount,
    declarativeBaselineInputCount:
      currentAgentPlanningEffectBlueprintCoverage.declarativeBaselineInputExpressionCount,
    upstreamDeclarativeBaselineInputCount:
      currentAgentPlanningEffectBlueprintCoverage.upstreamDeclarativeBaselineInputExpressionCount,
    reviewedDeclarativeBaselineInputCount:
      currentAgentPlanningEffectBlueprintCoverage.reviewedDeclarativeBaselineInputExpressionCount,
    todoBoundaryCount: currentAgentPlanningEffectBlueprintCoverage.todoBoundaryExpressionCount,
    missingExpressionCount:
      currentAgentPlanningEffectBlueprintCoverage.missingNumericExpressionCount,
    sharedIrReadyCount: currentAgentPlanningEffectBlueprintCoverage.sharedExpressionIrReadyCount,
    sharedIrPendingCount:
      currentAgentPlanningEffectBlueprintCoverage.sharedExpressionIrPendingCount,
    productionRuntimeReadyCount:
      currentAgentPlanningEffectBlueprintCoverage.productionExpressionRuntimeReadyCount,
    productionNumericReadyCount: 0,
  },
  compilerDimensions: {
    eventOwnerAndOperand: 'ready',
    effectOwnerTargetAndSnapshotPolicy: 'ready',
    eventOccurrenceAndDuration: 'shared_operator_ready_source_contract_required',
    effectActivationValueAndCoverage:
      'current_upstream_and_reviewed_expression_shared_ir_ready_runtime_contract_required',
    entityEquipmentAndFinalStats: 'account_snapshot_input_required',
    resourceStateTransition: 'shared_operator_ready_source_contract_required',
    fieldTimeOpportunityCost: 'shared_operator_ready_source_contract_required',
    offFieldSharedDamage: 'shared_operator_ready_source_contract_required',
    chainUltimateConversion: 'shared_operator_ready_source_contract_required',
  },
  boundary:
    'Formation and expression counts follow the current released identity and source catalogs. Shared IR and six interaction operators remain separate from numerical readiness: runtime dependencies, activation windows and duration must be bound. Reviewed prose effects do not claim upstream AST authority. Semantic fixtures never enter production; missing source-backed contracts remain blocked.',
})
