import rawGameData from '../data/game-data.json'
import rawDriveDiscData from '../data/drive-disc-data.v1.json'
import { buildKnowledge30Formal, rotation30Formal, visualCatalog30Formal } from './baseline'
import { currentVersionProjection } from './currentVersionProjection'
import { graduationCandidateProfileProjectionIdentity } from './graduationCandidateProfileProjection'
import { l3BoxTeamTemplateProjectionIdentity } from './l3BoxTeamTemplateProjection'
import { l3ProductionProjectionIdentity } from './l3ProductionProjection'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { current31VariantBangbooRecommendationSet } from '../decision/current31VariantBangbooRecommendation'
import { current31StrengthGoldSet } from '../decision/current31StrengthGoldSet'
import reviewedTeamGuideVerification from './data/reviewed-team-guide-verification.3.1.json'
import { reviewedTeamDiscDirections } from './reviewedTeamDiscConditions'
import { reviewedSourceTeamObservations32Identity } from './reviewedSourceTeamObservations32'
import { reviewedWEngineReceiverSemantics32Identity } from '../calculation/reviewedWEngineReceiverSemanticsIdentity32'
import { planningEffectResolutionIdentity32 } from '../calculation/currentPlanningEffectResolutionIdentity32'
import reviewedTeamPerformance from './data/reviewed-team-performance.3.1.json'
import { currentFieldAuthority } from './currentFieldAuthority'
import { currentBuildAuthority } from './currentBuildAuthority'
import { currentDriveDiscRecommendationCatalogIdentity } from './currentDriveDiscRecommendationCatalog'
import { planningFormulaFamilyRegistry } from '../calculation/planningFormulaFamilies'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { currentPlanningBaselineAgentObservations } from '../calculation/currentPlanningBaselineObservations'
import { currentAgentDecisionMechanicContracts } from '../calculation/currentAgentDecisionMechanicContracts'
import { currentAgentEventContracts } from '../calculation/currentAgentMechanicContracts'
import { currentWEngineStaticCatalog } from './currentWEngineStaticCatalog'
import { currentBangbooNumericCatalog } from './currentBangbooNumericCatalog'
import { currentDriveDiscFormulaCatalog } from './currentDriveDiscFormulaCatalog'
import { reviewedPotentialDefinitions } from './reviewedPotentialDefinitions'
import { reviewedPotentialParameterBlueprints } from '../calculation/reviewedPotentialEffectBlueprints'
import {
  planningDirectBillySupportAdoption,
  planningDirectNekomataEventAdoption,
} from '../calculation/planningDirectSupportAdoption'
import { planningSheerManatoSupportAdoption } from '../calculation/planningSheerSupportAdoption'
import { planningAnomalyPiperSupportAdoption } from '../calculation/planningAnomalySupportAdoption'
import { stableContentHash } from './types'
import { reviewedMenuBaseStatsIdentity } from './panel/reviewedMenuBaseStats'
import { incremental32RecoveryPolicy } from './incremental32RecoveryPolicy'
import {
  sourceBoundSheerForceHash32,
  sourceBoundSheerForceIdentity32,
} from '../calculation/currentSourceBoundSheerForceIdentity32'
import {
  currentCoreGrowthHash32,
  currentCoreGrowthIdentity32,
} from './panel/currentCoreGrowthIdentity32'
import {
  incrementalFormalCapabilitySummary32,
  reviewedCalculationCapabilities32,
} from './reviewedEventCapabilities32'

/**
 * PC2-DATA1's single runtime-readable map of the installed data authorities.
 * Compatibility catalogues are named explicitly so their older game version cannot be mistaken
 * for the current player-facing version or for Formal calculation authority.
 */
export const currentDataAuthorityProjection = {
  schema: 'soda-current-data-authority/v1',
  authorityId: 'pc2-data1-current-authority-r1',
  currentVersion: currentVersionProjection,
  versionGate: {
    authorityId: currentFieldAuthority.id,
    targetVersion: currentFieldAuthority.targetVersion,
    fingerprint: currentFieldAuthority.fingerprint,
    coverage: currentFieldAuthority.coverage,
    resolver: 'exact_version_first',
    sourceVersionIsApplicability: false,
  },
  currentBuildKnowledge: {
    authorityId: currentBuildAuthority.id,
    gameVersion: currentBuildAuthority.gameVersion,
    scopeManifestId: currentBuildAuthority.scopeManifestId,
    contentHash: currentBuildAuthority.contentHash,
    coverage: currentBuildAuthority.coverage,
    authority: 'unique_current_build_guidance_and_completeness',
    calculationBoundary: 'real_account_snapshot_required_no_guidance_defaults',
  },
  driveDiscRecommendations: currentDriveDiscRecommendationCatalogIdentity,
  verifiedIncrementalCalculation: {
    gameVersion: '3.2',
    recoveryPolicy: incremental32RecoveryPolicy,
    ...incrementalFormalCapabilitySummary32,
    contentHash: stableContentHash(reviewedCalculationCapabilities32),
    records: reviewedCalculationCapabilities32.map((record) => ({
      subjectId: record.agentId,
      eventId: record.eventId,
      formulaFamily: record.family,
      capability: record.capability,
      contextScope: record.contextScope,
      sourceCommit: record.source.commit,
      evidenceRefs: record.evidenceRefs,
      validationRef: record.validationRef,
      contentHash: record.contentHash,
    })),
    boundary:
      'Named single-event, prepared personal and exact three-member fixed models; declared scope, duration and effect coverage, no automatic arbitrary-team or legacy promotion.',
  },
  staticPlanningCalculation: {
    registrySchema: planningFormulaFamilyRegistry.schema,
    gameVersion: planningFormulaFamilyRegistry.gameVersion,
    contentHash: planningFormulaFamilyRegistry.contentHash,
    executableFamilyCount: planningFormulaFamilyRegistry.families.filter(
      (family) => family.status !== 'unsupported',
    ).length,
    currentSupportedSubjectCount: planningFormulaFamilyRegistry.families.reduce(
      (count, family) => count + family.currentSubjectIds.length,
      0,
    ),
    modelGradeEventSubjectCount: planningFormulaFamilyRegistry.families.reduce(
      (count, family) => count + family.modelGradeEventSubjectIds.length,
      0,
    ),
    firstEventAdoptionId: planningDirectBillySupportAdoption.adoptionId,
    firstEventAdoptionHash: planningDirectBillySupportAdoption.contentHash,
    secondEventAdoptionId: planningDirectNekomataEventAdoption.adoptionId,
    secondEventAdoptionHash: planningDirectNekomataEventAdoption.contentHash,
    thirdEventAdoptionId: planningSheerManatoSupportAdoption.adoptionId,
    thirdEventAdoptionHash: planningSheerManatoSupportAdoption.contentHash,
    fourthEventAdoptionId: planningAnomalyPiperSupportAdoption.adoptionId,
    fourthEventAdoptionHash: planningAnomalyPiperSupportAdoption.contentHash,
    // These are the exact frozen inputs read by target-team and saved-plan re-analysis. Keeping
    // their identities in the public data authority makes any adopted source, canonical, or
    // derived planning change invalidate an older saved result through the shared input hash.
    runtimeInputs: {
      sourceBoundStatConversions: {
        sheerForce: {
          identity: sourceBoundSheerForceIdentity32,
          contentHash: sourceBoundSheerForceHash32,
        },
        coreGrowth: { identity: currentCoreGrowthIdentity32, contentHash: currentCoreGrowthHash32 },
        publishedMenuBases: reviewedMenuBaseStatsIdentity,
      },
      reviewedIncrementalEvents: {
        gameVersion: '3.2',
        contentHash: stableContentHash({
          records: reviewedCalculationCapabilities32,
          recoveryPolicy: incremental32RecoveryPolicy,
        }),
      },
      reviewedEquipmentReceiverSemantics32: reviewedWEngineReceiverSemantics32Identity,
      eventEffectResolution32: planningEffectResolutionIdentity32,
      // Hash adopted values as well as declared source identities: a changed projection must
      // invalidate results even if an upstream manifest's identity has not been refreshed.
      numericInputs: {
        contentHash: stableContentHash({
          agents: currentAgentEventContracts,
          wEngines: currentWEngineStaticCatalog.items,
          bangboos: currentBangbooNumericCatalog.items,
          driveDiscSets: currentDriveDiscFormulaCatalog.items,
        }),
      },
      baseline: {
        baselineId: currentNormalizedPlanningBaseline.baselineId,
        contentHash: stableContentHash(currentNormalizedPlanningBaseline),
        sourcePackHash: currentNormalizedPlanningBaseline.sourcePackHash,
        formulaHash: currentNormalizedPlanningBaseline.formulaHash,
      },
      effectBlueprints: {
        contentHash: stableContentHash(currentAgentPlanningEffectBlueprints),
        effectCount: currentAgentPlanningEffectBlueprints.length,
      },
      potentialDefinitions: {
        consumerRevision: 'fixed-event-potential-binding/v1',
        contentHash: stableContentHash({
          definitions: reviewedPotentialDefinitions,
          parameters: reviewedPotentialParameterBlueprints,
        }),
        agentCount: reviewedPotentialDefinitions.length,
      },
      baselineObservations: {
        contentHash: stableContentHash(currentPlanningBaselineAgentObservations),
        agentCount: currentPlanningBaselineAgentObservations.length,
      },
      decisionMechanics: {
        contentHash: stableContentHash(currentAgentDecisionMechanicContracts),
        agentCount: currentAgentDecisionMechanicContracts.length,
      },
    },
    authority: 'formula_family_and_runtime_adapter_registry_not_account_result',
  },
  supportingPacks: {
    buildKnowledge: {
      packageId: buildKnowledge30Formal.id,
      packageVersion: buildKnowledge30Formal.packageVersion,
      gameVersion: buildKnowledge30Formal.gameVersion,
      authority: 'legacy_source_adapter_only',
    },
    rotation: {
      packageId: rotation30Formal.id,
      packageVersion: rotation30Formal.packageVersion,
      gameVersion: rotation30Formal.gameVersion,
      authority: 'scenario_compatibility_only',
    },
    visualCatalog: {
      packageId: visualCatalog30Formal.id,
      packageVersion: visualCatalog30Formal.packageVersion,
      gameVersion: visualCatalog30Formal.gameVersion,
      authority: 'visual_catalog_only',
    },
  },
  staticCompatibility: {
    gameData: {
      identity: 'app/src/data/game-data.json',
      schemaVersion: rawGameData.schemaVersion,
      gameVersion: rawGameData.gameVersion,
      authority: 'legacy_static_catalog_only',
    },
    driveDiscRules: {
      identity: 'app/src/data/drive-disc-data.v1.json',
      schemaVersion: rawDriveDiscData.schemaVersion,
      gameVersion: rawDriveDiscData.gameVersion,
      dataVersion: rawDriveDiscData.dataVersion,
      contentHash: rawDriveDiscData.contentHash,
      authority: 'disc_rules_and_import_identity_only',
    },
  },
  l3Consumers: {
    assetMaintenance: l3ProductionProjectionIdentity.consumers.asset_maintenance,
    agentDevelopmentAndTopN: l3ProductionProjectionIdentity.consumers.agent_development_and_top_n,
    boxTeamRecommendation: l3BoxTeamTemplateProjectionIdentity,
    graduationCandidateProfiles: graduationCandidateProfileProjectionIdentity,
  },
  teamEngineRecommendation: {
    source: 'app/src/teamEngine/current31D1Pack.ts',
    consumerRevision: 'strength-first-independent-of-account-build/v5',
    contentHash: stableContentHash(current31TeamEngineD1Pack),
    exactVariantDefaultsHash: stableContentHash(current31VariantBangbooRecommendationSet),
    teamDiscConditionsHash: stableContentHash(reviewedTeamDiscDirections),
    sourceComparisonSetups32: reviewedSourceTeamObservations32Identity,
    strengthCalibrationHash: stableContentHash({
      cases: current31StrengthGoldSet.cases,
      supplements: current31StrengthGoldSet.versionedTeamStrengthSupplements,
      observations: reviewedTeamPerformance,
      guideVerification: reviewedTeamGuideVerification,
    }),
    contract: current31TeamEngineD1Pack.contract,
    gameVersion: current31TeamEngineD1Pack.gameVersion,
    kernelCount: current31TeamEngineD1Pack.kernels.length,
    familyCount: new Set(current31TeamEngineD1Pack.kernels.map((kernel) => kernel.familyId)).size,
    authority: 'current_team_engine_and_exact_source_directions',
    l3Boundary:
      'Exact source directions support warehouse planning without inventing Engine scenarios; source observations do not establish strength, damage or optimality.',
  },
  boundary: {
    formalReady: incrementalFormalCapabilitySummary32.activeTuples,
    fixedCycleReady: incrementalFormalCapabilitySummary32.activeFixedCycleTuples,
    legacyL3FormalPromotion: false,
    importEnabled: false,
    accountWrites: false,
    statement:
      'Formal readiness counts only the named verified capability records. Candidate L3 sidecars and Team Engine recommendations do not gain Formal or Import authority; fixed-cycle readiness is counted separately.',
  },
} as const
