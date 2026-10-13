import { stableContentHash } from '../gameDataPacks/types'

/**
 * Hash the installed implementation, not a manually maintained revision. Raw imports
 * keep this identity independent of the expression/runtime execution import graph.
 * This bounded closure covers template and potential preparation, functional
 * capacities, their condition/action/equipment helpers and support target rules.
 * Numeric agent/equipment catalogues, potential definitions/parameter blueprints
 * and baseline values are already hashed by currentDataAuthorityProjection.
 * Source-only edits also invalidate: conservative re-analysis is preferable to
 * retaining an unverified saved result after a rule deployment.
 */
const sources = import.meta.glob<string>(
  [
    './reviewedTemplatePreparedEvents32.ts',
    './reviewedTemplateEventConditions32.ts',
    './currentPlanningScenario32.ts',
    './reviewedTemplateMechanicEffects32.ts',
    './reviewedPotentialPreparedEvents32.ts',
    './currentPotentialEventActions32.ts',
    './potentialApplicationBinding.ts',
    './reviewedPotentialSourceClosure32.ts',
    '../assault/agentCapabilities.ts',
    './reviewedPotentialTeamAction32.ts',
    './reviewedFunctionalCapacity32.ts',
    './reviewedFunctionalInitialImpact32.ts',
    './reviewedFunctionalSource32.ts',
    './reviewedFunctionalEquipmentDependencies32.ts',
    './functionalPlanningEffectScope32.ts',
    './currentPlanningWEngineDependencies32.ts',
    './currentCombatPlanningModifierTargets.ts',
    './sourceDazeCapacity32.ts',
    './sourceEnergyRecoveryRate32.ts',
    './planningNaturalEnergyModifiers32.ts',
    './reviewedBenShieldCapacity32.ts',
    './reviewedSupportTargetCapacity32.ts',
    './reviewedPotentialFunctionalEffects32.ts',
    './currentPlanningDamageModifiers.ts',
    './currentPlanningEffectExpressions.ts',
    './targetTeamEquipmentModifierProjection.ts',
    './currentBangbooPlanningAdapter.ts',
    './currentBangbooMechanicContracts.ts',
    './currentBangbooBaseUtilityContracts.ts',
    './currentBangbooBaseUtilityTypes.ts',
    './currentBangbooUtilityProjection.ts',
    './currentBangbooUtilityProjectionTypes.ts',
    './currentBangbooBaseUtilityPresentation.ts',
    './currentBangbooFixedUtilityCapacity.ts',
    './currentBangbooMechanicDefinitions.ts',
    './currentBangbooCompositionIdentity.ts',
    '../gameDataPacks/reviewedAgentAttackTypes32.ts',
    '../gameDataPacks/data/reviewed-agent-attack-types32.v1.json',
    '../decision/bangbooCompositionIdentity.ts',
    '../decision/targetTeamSourceBangbooOptions.ts',
    '../decision/bangbooTeamFit.ts',
    '../decision/targetTeamBangbooShortlist.ts',
    '../gameDataPacks/currentBangbooNumericCatalog.ts',
    './reviewedCommonAnomalySettlement32.ts',
    '../application/publicCommonAnomalySettlement32.ts',
    './reviewedPreparedAnomalyDeclarations32.ts',
    './reviewedPreparedAnomalyObjective32.ts',
    './reviewedPreparedAnomalyModifiers32.ts',
    './reviewedPreparedAnomalyValidation32.ts',
    './reviewedPreparedAnomalyEquipment32.ts',
    './currentCommonAnomalySettlement32.ts',
    './currentCommonAnomalySettlementIdentity32.ts',
    './anomalyDamageCore.ts',
    '../decision/targetTeamPlanningContext.ts',
    '../decision/incremental32PlanningSourceSelection.ts',
    '../decision/targetTeamPlanningMembers.ts',
    '../decision/accountDecisionRecommendationProjection.ts',
    '../decision/teamStrengthMemberFacts.ts',
    '../decision/developmentValueBenchmarkRuntime.ts',
    '../decision/developmentValueBenchmarkProjection.ts',
    '../decision/targetTeamAssignmentObjective.ts',
    '../decision/developmentCandidateRefinement.ts',
    '../decision/developmentDynamicSearch.ts',
    '../decision/targetTeamValueBenchmark.ts',
    '../decision/targetTeamAccountBoundBenchmark.ts',
    '../decision/developmentValueBenchmark.ts',
    '../gameDataPacks/data/reviewed-external-support-target31.3.1.json',
  ],
  { eager: true, query: '?raw', import: 'default' },
)

export const currentPlanningConsumerPolicyIdentity32 = Object.freeze({
  contract: 'installed-prepared-and-functional-consumer-policy/v1',
  sourceHashes: Object.fromEntries(
    Object.entries(sources)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, source]) => [path, stableContentHash(source.replaceAll('\r\n', '\n'))]),
  ),
})
