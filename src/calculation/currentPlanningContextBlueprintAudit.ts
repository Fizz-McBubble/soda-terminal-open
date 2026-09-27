import { current31LegalAgentFormations } from '../teamEngine/current31LegalCandidateUniverse'
import { currentAgentPlanningEffectBlueprintCoverage } from './currentAgentPlanningEffectBlueprint'
import { currentAgentEventContracts } from './currentAgentMechanicContracts'
import { currentPlanningInteractionFixtureAudit } from './currentPlanningInteractionFixtures'
import { currentPlanningInteractionMechanicIRAudit } from './currentPlanningInteractionMechanicIR'

const allAgentsBlueprintReady =
  currentAgentEventContracts.length === 58 &&
  currentAgentEventContracts.every((contract) => contract.eventContract.events.length > 0) &&
  currentAgentPlanningEffectBlueprintCoverage.agentCount === 58
const formationBlueprintReadyCount = allAgentsBlueprintReady
  ? current31LegalAgentFormations.length
  : 0
const effectBindingCount = allAgentsBlueprintReady
  ? ((currentAgentPlanningEffectBlueprintCoverage.upstreamEffectCount +
      currentAgentPlanningEffectBlueprintCoverage.reviewedPotentialEffectCount) *
      (58 - 1) *
      (58 - 2)) /
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
      '342_frozen_upstream_plus_1_reviewed_potential_expression_shared_ir_ready_runtime_contract_required',
    entityEquipmentAndFinalStats: 'account_snapshot_input_required',
    resourceStateTransition: 'shared_operator_ready_source_contract_required',
    fieldTimeOpportunityCost: 'shared_operator_ready_source_contract_required',
    offFieldSharedDamage: 'shared_operator_ready_source_contract_required',
    chainUltimateConversion: 'shared_operator_ready_source_contract_required',
  },
  boundary:
    'All legal identity formations can enter the shared compiler and six team-interaction operators are structurally executable. The current entity corpus collapses to shared Mechanic IR requirement patterns without dedicated adapters. The locked upstream formula AST remains 342 effects: 303 direct expressions and 39 generic conditionals compiled as declarative PlanningBaseline inputs. A separate reviewed 3.1 Jane potential expression uses the same deterministic IR but does not claim an upstream AST, whole-mechanic coverage, DPS completion, or a Formal CalculationContext. Two upstream TODO boundaries remain explicit and fail closed only when selected. No expression is promoted to a production value until runtime dependencies, activation windows and duration are bound. Semantic fixtures never enter production and missing source-backed contracts fail closed.',
})
