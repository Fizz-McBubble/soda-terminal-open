import { currentCapabilityGapMatrix } from './currentCapabilityGapMatrix'
import { currentNonAgentFieldCompletenessMatrix } from './currentNonAgentFieldCompletenessMatrix'
import { current31CandidateUniverseAudit } from '../teamEngine/current31CandidateUniverseAudit'
import { currentBangbooMechanicContractIds } from '../calculation/currentBangbooMechanicContracts'
import {
  currentFormulaDriveDiscFourPieceContractIds,
  currentFormulaWEngineContractIds,
} from '../calculation/currentFormulaMechanicContracts'
import { currentAgentEventContracts } from '../calculation/currentAgentMechanicContracts'
import { currentReleasedIdentitySourceRegistry } from './currentReleasedIdentityMap'

const rows = currentNonAgentFieldCompletenessMatrix.rows

function statusCount(
  entries: readonly { fields: Readonly<Record<string, { status: string }>> }[],
  fieldIds: readonly string[],
  status: string,
) {
  return entries.reduce(
    (total, entry) =>
      total + fieldIds.filter((fieldId) => entry.fields[fieldId]?.status === status).length,
    0,
  )
}

function readyEntityCount(
  entries: readonly { fields: Readonly<Record<string, { status: string }>> }[],
  fieldIds: readonly string[],
) {
  return entries.filter((entry) =>
    fieldIds.every((fieldId) => entry.fields[fieldId]?.status === 'ready'),
  ).length
}

const sourceFactFields = {
  wEngines: ['identity', 'release', 'rarityAndSpecialty', 'level60StaticStats', 'passiveP1ToP5'],
  bangboos: ['identity', 'release', 'rarity', 'level60StatCurve', 'activeAndChainMultipliers'],
  driveDiscSets: ['identity', 'release', 'twoPieceEffect', 'fourPieceEffect'],
} as const

const sourceFactRequired =
  rows.wEngines.length * sourceFactFields.wEngines.length +
  rows.bangboos.length * sourceFactFields.bangboos.length +
  rows.driveDiscSets.length * sourceFactFields.driveDiscSets.length
const sourceFactReady =
  statusCount(rows.wEngines, sourceFactFields.wEngines, 'ready') +
  statusCount(rows.bangboos, sourceFactFields.bangboos, 'ready') +
  statusCount(rows.driveDiscSets, sourceFactFields.driveDiscSets, 'ready')
const sourceFactPromotionPending =
  statusCount(rows.wEngines, sourceFactFields.wEngines, 'candidate') +
  statusCount(rows.bangboos, sourceFactFields.bangboos, 'candidate') +
  statusCount(rows.driveDiscSets, sourceFactFields.driveDiscSets, 'candidate')
const sourceFactHardGaps =
  statusCount(rows.wEngines, sourceFactFields.wEngines, 'missing_after_reuse') +
  statusCount(rows.bangboos, sourceFactFields.bangboos, 'missing_after_reuse') +
  statusCount(rows.driveDiscSets, sourceFactFields.driveDiscSets, 'missing_after_reuse')

export const currentN4MechanicPatterns = Object.freeze([
  'always_on_modifier',
  'event_or_state_window',
  'threshold_or_range_gate',
  'capped_stack_or_counter',
  'compound_boolean_and_stack',
  'action_or_attribute_scoped_modifier',
  'team_aura_or_shared_effect',
  'team_composition_activation',
  'enemy_debuff_or_ignore',
  'resource_gain_or_regeneration',
  'shield_heal_or_mitigation',
  'proc_extra_hit_or_skill_event',
  'duration_cooldown_charge_or_summon_mutation',
] as const)

export const currentN4RequiredGenericOperators = Object.freeze([
  'linear_skill_level',
  'predicate_gate',
  'accumulator_and_window',
  'scoped_modifier_apply',
  'resource_and_sustain_apply',
  'damage_event_emit',
  'event_schedule_mutate',
] as const)

const currentCandidateFields =
  currentNonAgentFieldCompletenessMatrix.summary.wEngines.candidateFields +
  currentNonAgentFieldCompletenessMatrix.summary.bangboos.candidateFields +
  currentNonAgentFieldCompletenessMatrix.summary.driveDiscSets.candidateFields
const historicalSnapshotVersion = [3, 1] as const
const snapshotIds = new Set<string>(
  currentReleasedIdentitySourceRegistry.sources
    .filter((source) => {
      const version = /^(\d+)\.(\d+)$/.exec(source.sourceVersion)
      return (
        version &&
        (Number(version[1]) < historicalSnapshotVersion[0] ||
          (Number(version[1]) === historicalSnapshotVersion[0] &&
            Number(version[2]) <= historicalSnapshotVersion[1]))
      )
    })
    .flatMap((source) => [...source.stableIds]),
)
const postSnapshotIds = new Set<string>(
  currentReleasedIdentitySourceRegistry.sources
    .filter((source) => {
      const version = /^(\d+)\.(\d+)$/.exec(source.sourceVersion)
      return (
        version &&
        (Number(version[1]) > historicalSnapshotVersion[0] ||
          (Number(version[1]) === historicalSnapshotVersion[0] &&
            Number(version[2]) > historicalSnapshotVersion[1]))
      )
    })
    .flatMap((source) => [...source.stableIds])
    .filter((stableId) => !snapshotIds.has(stableId)),
)
const historicalCandidateFields = Object.values(rows)
  .flat()
  .filter((row) => !postSnapshotIds.has(row.stableId))
  .reduce(
    (total, row) =>
      total + Object.values(row.fields).filter((field) => field.status === 'candidate').length,
    0,
  )
const currentMissingFields =
  currentNonAgentFieldCompletenessMatrix.summary.wEngines.missingAfterReuseFields +
  currentNonAgentFieldCompletenessMatrix.summary.bangboos.missingAfterReuseFields +
  currentNonAgentFieldCompletenessMatrix.summary.driveDiscSets.missingAfterReuseFields

const mechanicAndCalculationBacklog =
  statusCount(rows.wEngines, ['triggerContract', 'calculationAdapter'], 'candidate') +
  statusCount(rows.bangboos, ['activation', 'suitability', 'calculationAdapter'], 'candidate') +
  statusCount(
    rows.bangboos,
    ['activation', 'suitability', 'calculationAdapter'],
    'missing_after_reuse',
  ) +
  statusCount(rows.driveDiscSets, ['fourPieceTriggerContract'], 'candidate')

const productionMediaCandidate =
  statusCount(rows.wEngines, ['media'], 'candidate') +
  statusCount(rows.bangboos, ['media'], 'candidate') +
  statusCount(rows.driveDiscSets, ['media'], 'candidate')
const productionMediaMissing =
  statusCount(rows.wEngines, ['media'], 'missing_after_reuse') +
  statusCount(rows.bangboos, ['media'], 'missing_after_reuse') +
  statusCount(rows.driveDiscSets, ['media'], 'missing_after_reuse')

const wEngineCalculationReady = statusCount(rows.wEngines, ['calculationAdapter'], 'ready')
const bangbooCalculationReady = statusCount(rows.bangboos, ['calculationAdapter'], 'ready')
const driveDiscCalculationReady = statusCount(
  rows.driveDiscSets,
  ['fourPieceTriggerContract'],
  'ready',
)
const agentCalculationReady = currentCapabilityGapMatrix.rows.filter(
  (row) => row.eventCalculation.status === 'ready',
).length

const nonAgentProductionGovernanceReady =
  readyEntityCount(rows.wEngines, ['identity', 'release', 'rarityAndSpecialty', 'media']) +
  readyEntityCount(rows.bangboos, ['identity', 'release', 'rarity', 'media']) +
  readyEntityCount(rows.driveDiscSets, ['identity', 'release', 'media'])

/**
 * Layered replacement for the old omnibus completeness interpretation.
 * The legacy field matrix remains an audit denominator, but candidate/missing
 * statuses are reclassified by ownership instead of being called data gaps.
 */
export const currentN4LayeredCoverage = Object.freeze({
  contract: 'soda-n4-layered-coverage/v1',
  gameVersion: '3.1-phase-ii',
  population: {
    agents: currentCapabilityGapMatrix.rows.length,
    wEngines: rows.wEngines.length,
    bangboos: rows.bangboos.length,
    driveDiscSets: rows.driveDiscSets.length,
    totalEntityTypes:
      currentCapabilityGapMatrix.rows.length +
      rows.wEngines.length +
      rows.bangboos.length +
      rows.driveDiscSets.length,
  },
  legacyFieldAudit: {
    historicalSnapshotVersion: historicalSnapshotVersion.join('.'),
    historicalCandidateSnapshot: 253,
    promotedSinceSnapshot: 253 - historicalCandidateFields,
    postSnapshotCandidateFields: currentCandidateFields - historicalCandidateFields,
    currentCandidateFields,
    currentMissingAfterReuseFields: currentMissingFields,
    boundary: 'Legacy field counts are audit evidence, not a single completion metric.',
  },
  sourceFactCoverage: {
    requiredFields: sourceFactRequired,
    readyAuthorityFields: sourceFactReady,
    authorityPromotionPending: sourceFactPromotionPending,
    hardSourceGaps: sourceFactHardGaps,
    availableFields: sourceFactReady + sourceFactPromotionPending,
  },
  mechanicContractCoverage: {
    sharedPatternCount: currentN4MechanicPatterns.length,
    patterns: currentN4MechanicPatterns,
    inventoryStatus: 'pattern_inventory_frozen',
    declarativeIrStatus: 'implemented',
    declarativeEntityContractCount:
      currentAgentEventContracts.length +
      currentFormulaWEngineContractIds.length +
      currentBangbooMechanicContractIds.length +
      currentFormulaDriveDiscFourPieceContractIds.length,
    calculationResolverAdoptionCount:
      currentAgentEventContracts.length +
      currentFormulaWEngineContractIds.length +
      currentBangbooMechanicContractIds.length +
      currentFormulaDriveDiscFourPieceContractIds.length,
    productionRegistryAdoptionCount:
      currentAgentEventContracts.length + currentFormulaWEngineContractIds.length,
    currentExecutableEvidence: {
      wEngineTriggerContracts: statusCount(rows.wEngines, ['triggerContract'], 'ready'),
      bangbooActivationContracts: statusCount(rows.bangboos, ['activation'], 'ready'),
      bangbooSuitabilityContracts: statusCount(rows.bangboos, ['suitability'], 'ready'),
      driveDiscFourPieceContracts: statusCount(
        rows.driveDiscSets,
        ['fourPieceTriggerContract'],
        'ready',
      ),
    },
  },
  formulaOperatorCoverage: {
    existingDamageFamilies: ['standard_direct_event_bundle', 'anomaly_disorder', 'rupture_sheer'],
    requiredNewGenericOperatorCount: currentN4RequiredGenericOperators.length,
    requiredNewGenericOperators: currentN4RequiredGenericOperators,
    implementedNewGenericOperatorCount: currentN4RequiredGenericOperators.length,
    entitySpecificAdaptersRequired: 0,
    boundary:
      'Existing handwritten adapters are compatibility fixtures; they do not justify one-adapter-per-entity expansion.',
  },
  entityCalculationCoverage: {
    ready: {
      agents: agentCalculationReady,
      wEngines: wEngineCalculationReady,
      bangboos: bangbooCalculationReady,
      driveDiscSets: driveDiscCalculationReady,
      total:
        agentCalculationReady +
        wEngineCalculationReady +
        bangbooCalculationReady +
        driveDiscCalculationReady,
    },
    required: {
      agents: currentCapabilityGapMatrix.rows.length,
      wEngines: rows.wEngines.length,
      bangboos: rows.bangboos.length,
      driveDiscSets: rows.driveDiscSets.length,
      total:
        currentCapabilityGapMatrix.rows.length +
        rows.wEngines.length +
        rows.bangboos.length +
        rows.driveDiscSets.length,
    },
    executableAgentRules: current31CandidateUniverseAudit.executableAgentRuleCount,
    planningContextBlueprints: {
      readyFormations:
        current31CandidateUniverseAudit.planningContextBlueprintAudit.formationBlueprintReadyCount,
      requiredFormations:
        current31CandidateUniverseAudit.planningContextBlueprintAudit.formationCount,
      sourceHardGaps:
        current31CandidateUniverseAudit.planningContextBlueprintAudit.sourceHardGapCount,
      boundary: current31CandidateUniverseAudit.planningContextBlueprintAudit.boundary,
    },
    normalizedDecisionScore: current31CandidateUniverseAudit.normalizedDecisionScoreAudit,
  },
  productionReadiness: {
    nonAgentGovernanceReadyEntities: nonAgentProductionGovernanceReady,
    nonAgentEntityTotal: rows.wEngines.length + rows.bangboos.length + rows.driveDiscSets.length,
    mediaCandidate: productionMediaCandidate,
    mediaMissing: productionMediaMissing,
    currentEndToEndReadyNonAgentEntities:
      currentNonAgentFieldCompletenessMatrix.summary.wEngines.completeEntities +
      currentNonAgentFieldCompletenessMatrix.summary.bangboos.completeEntities +
      currentNonAgentFieldCompletenessMatrix.summary.driveDiscSets.completeEntities,
  },
  backlogReclassification: {
    sourceFactAuthorityPromotion: sourceFactPromotionPending,
    mechanicFormulaAndEntityCalculation: mechanicAndCalculationBacklog,
    productionReadiness: productionMediaCandidate + productionMediaMissing,
    hardSourceGap: sourceFactHardGaps,
    totalOpenLegacyFields:
      sourceFactPromotionPending +
      mechanicAndCalculationBacklog +
      productionMediaCandidate +
      productionMediaMissing,
  },
  pipeline: [
    'upstream_source_facts',
    'mechanic_ir',
    'shared_operators',
    'entity_contracts',
    'calculation_ready',
  ],
} as const)
