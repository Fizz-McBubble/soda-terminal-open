import { assignMechanisticSystemRankOrder } from './teamSystemRankOrder'
export { compareProfilesForOrder } from './teamSystemRankOrder'
import type {
  TeamOutputModuleResolution,
  TeamPrimaryOutputKind,
} from '../gameDataPacks/teamOutputModuleContract'
import { compareTeamRankingMethod, type TeamRankingMethodInput } from './teamRankingMethod'
import type { TeamStrengthMechanicFeatures } from './teamStrengthMechanicFeatures'
import {
  teamStrengthStandardFiniteEventConditionsContract,
  teamStrengthStandardFiniteEventConditionsScenario,
} from './teamStrengthStandardFiniteEventConditions'
import {
  compareTeamSameCoreOutput,
  projectTeamSameCoreOutput,
  type TeamSameCoreOutputEvidence,
  snapshotTeamSameCoreRanking,
  compareTeamSameCoreRankingSnapshots,
  type TeamSameCoreRankingSnapshot,
} from './teamSameCoreOutputComparison'
import {
  teamSameCoreApplicableCoordinatesContract,
  teamSameCoreApplicableCoordinatesPolicy,
} from './teamSameCoreApplicableCoordinates'
import type { DeclaredTeamStrengthSupportInput } from './teamStrengthSupportContribution'
import { declaredPrimaryEventCapacity } from './teamSystemDeclaredPrimaryEventCapacity'

export const teamSystemRankingMethodContract = 'soda-team-system-ranking-method/v6' as const

export const teamSystemRankingMethodPolicy = Object.freeze({
  contract: teamSystemRankingMethodContract,
  authority: 'mechanistic_dominance_within_system',
  productionEligible: false,
  crossSystemComparison: 'forbidden',
  score: 'dominance-depth-not-player-facing',
  tie: 'profile-and-categorical-mechanic-disagreement-stays-tied',
  orderingEvidence:
    'event-scope-valid-capacity-dominance-confirmed-by-categorical-mechanic-dominance',
  sameCoreOrderingEvidence:
    'joint-declared-event-settlement-with-common-member-source-invariants-and-no-mechanic-regression',
  capacityRelativeTolerance: 0.05,
  finiteEventConditionContract: teamStrengthStandardFiniteEventConditionsContract,
  finiteEventConditionScenario: teamStrengthStandardFiniteEventConditionsScenario,
  applicableCoordinateContract: teamSameCoreApplicableCoordinatesContract,
  applicableCoordinateSystems: teamSameCoreApplicableCoordinatesPolicy.systems,
  classification:
    'reviewed exact-team output module first; otherwise source formula family and positive output-capacity evidence',
  excludedInputs: [
    'source-tier',
    'publisher',
    'popularity',
    'editorial-label',
    'account-state',
    'representative-character-preference',
    'legacy-regression-score',
  ],
  boundary:
    'A team receives a dense ordinal only inside one primary output system. Same-owner, same-event replacements may receive a conditional finite-output priority from joint source settlement; support capacities and execution priors alone never establish it. Partial or missing event evidence remains unknown. This is not a complete-team output or DPS order. No cross-system order or player-facing number is created.',
} as const)

export type TeamSystemClassificationBasis =
  | 'reviewed_exact_team_output_module'
  | 'primary_special_output_family'
  | 'anomaly_output_capacity'
  | 'standard_direct_output'

export type TeamSystemClassification =
  | {
      status: 'classified'
      system: TeamPrimaryOutputKind
      basis: TeamSystemClassificationBasis
    }
  | {
      status: 'unsupported'
      reason: 'no_primary_output' | 'mechanic_evidence_missing' | 'no_classifiable_output'
    }

function systemForFormulaFamily(formulaFamily: string | null | undefined) {
  if (!formulaFamily) return null
  if (formulaFamily === 'sharp_damage' || formulaFamily === 'laceration_damage') return 'sharp'
  if (
    formulaFamily === 'sheer_damage' ||
    formulaFamily === 'rupture_sheer' ||
    formulaFamily === 'hp_scaled_sheer_damage'
  )
    return 'rupture'
  if (
    formulaFamily === 'standard_direct_damage' ||
    formulaFamily === 'standard_direct_event_bundle' ||
    formulaFamily === 'direct_damage'
  )
    return 'direct_damage'
  return null
}

export function classifyTeamOutputSystem(input: {
  outputModule?: TeamOutputModuleResolution | null
  primaryOutputAgentId?: string | null
  primaryOutputSpecialty?: string | null
  primaryDamageFormulaFamily?: string | null
  primaryAnomalyBuildup?: number
  differentAttributeAnomalyPair?: boolean
  compatibleAnomalyCapability?: number
  anomalyProficiencyGain?: number
  anomalyMasteryGain?: number
}): TeamSystemClassification {
  if (input.outputModule?.status === 'classified')
    return {
      status: 'classified',
      system: input.outputModule.module.primaryOutputKind,
      basis: 'reviewed_exact_team_output_module',
    }
  if (!input.primaryOutputAgentId) return { status: 'unsupported', reason: 'no_primary_output' }
  if (!input.primaryDamageFormulaFamily)
    return { status: 'unsupported', reason: 'mechanic_evidence_missing' }

  const formulaSystem = systemForFormulaFamily(input.primaryDamageFormulaFamily)
  if (formulaSystem === 'sharp' || formulaSystem === 'rupture')
    return {
      status: 'classified',
      system: formulaSystem,
      basis: 'primary_special_output_family',
    }

  const anomalyEvidence = [
    input.primaryOutputSpecialty === 'anomaly',
    (input.primaryAnomalyBuildup ?? 0) > 0,
    input.differentAttributeAnomalyPair === true,
    (input.compatibleAnomalyCapability ?? 0) > 0,
    (input.anomalyProficiencyGain ?? 0) > 0 || (input.anomalyMasteryGain ?? 0) > 0,
  ].filter(Boolean).length
  if (input.primaryOutputSpecialty === 'anomaly' && anomalyEvidence >= 2)
    return {
      status: 'classified',
      system: 'attribute_anomaly',
      basis: 'anomaly_output_capacity',
    }

  if (formulaSystem === 'direct_damage')
    return {
      status: 'classified',
      system: 'direct_damage',
      basis: 'standard_direct_output',
    }
  return { status: 'unsupported', reason: 'no_classifiable_output' }
}

export type TeamSystemRankingProfile = {
  system: TeamPrimaryOutputKind
  /** Representative action coordinates are comparable only for the same output actor. */
  primaryOutputAgentId?: string | null
  /** The team's maximum buildup may belong to a teammate; bind the actual owner's packet. */
  primaryEventCapacity?: { eventPacketIdentity: string; value: number } | null
  /** Opt-in complete declaration; per-provider contact maxima cannot replace it. */
  sameCoreOutput?: TeamSameCoreOutputEvidence
  sameCoreComparison?: TeamSameCoreRankingSnapshot
  /** Coordinates without complete source coverage are excluded from dominance. */
  unknownPositiveCapacityIndices?: readonly number[]
  positiveCapacities: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  executionBurdens: readonly [number, number, number]
}

const capacityRelativeTolerance = teamSystemRankingMethodPolicy.capacityRelativeTolerance

function featureValue(
  features: TeamStrengthMechanicFeatures,
  name: (typeof features.featureNames)[number],
) {
  const index = features.featureNames.indexOf(name)
  return index < 0 ? 0 : (features.values[index] ?? 0)
}

function maximum(...values: number[]) {
  return Math.max(0, ...values.filter(Number.isFinite))
}

export function createTeamSystemRankingProfile(
  system: TeamPrimaryOutputKind,
  features: TeamStrengthMechanicFeatures,
  sameCoreOutputInput?: DeclaredTeamStrengthSupportInput,
  settledSameCoreOutput?: TeamSameCoreOutputEvidence,
): TeamSystemRankingProfile {
  const sameCoreOutput =
    settledSameCoreOutput ??
    (sameCoreOutputInput ? projectTeamSameCoreOutput(sameCoreOutputInput) : undefined)
  const direct = featureValue(features, 'direct_action_scale')
  const anomaly = featureValue(features, 'anomaly_action_buildup')
  const rupture = featureValue(features, 'rupture_action_multiplier')
  const sharp = featureValue(features, 'sharp_action_scale')
  const aftershock = maximum(
    featureValue(features, 'source_self_aftershock_damage_capacity'),
    featureValue(features, 'compatible_aftershock_damage_capability'),
    featureValue(features, 'source_self_aftershock_daze_capacity'),
  )
  const primaryOutput =
    system === 'direct_damage'
      ? direct
      : system === 'attribute_anomaly'
        ? anomaly
        : system === 'rupture'
          ? maximum(rupture, featureValue(features, 'source_primary_action_capacity'))
          : system === 'sharp'
            ? sharp
            : aftershock
  const secondaryOutput =
    system === 'direct_damage'
      ? featureValue(features, 'second_direct_action_scale')
      : system === 'attribute_anomaly'
        ? featureValue(features, 'second_anomaly_action_buildup')
        : system === 'sharp'
          ? featureValue(features, 'laceration_action_multiplier')
          : featureValue(features, 'second_background_action_scale')
  const sourcePrimarySupport = maximum(
    featureValue(features, 'source_support_primary_recipient_first_provider_gain'),
    featureValue(features, 'source_support_primary_recipient_second_provider_gain'),
  )
  const supportCoverage = maximum(
    featureValue(features, 'compatible_damage_capability'),
    featureValue(features, 'compatible_attack_capability'),
    featureValue(features, 'compatible_critical_capability'),
    system === 'attribute_anomaly'
      ? featureValue(features, 'compatible_anomaly_proficiency_capability')
      : 0,
    system === 'attribute_anomaly'
      ? featureValue(features, 'compatible_anomaly_mastery_capability')
      : 0,
    system === 'rupture' ? featureValue(features, 'compatible_sheer_force_capability') : 0,
    system === 'sharp'
      ? maximum(
          featureValue(features, 'compatible_sharp_capability'),
          featureValue(features, 'compatible_laceration_capability'),
        )
      : 0,
    system === 'aftershock'
      ? maximum(
          featureValue(features, 'compatible_aftershock_damage_capability'),
          featureValue(features, 'compatible_aftershock_critical_capability'),
          featureValue(features, 'compatible_aftershock_defense_reduction_capability'),
        )
      : 0,
    featureValue(features, 'compatible_multi_provider_capacity'),
  )
  const secondarySupport = featureValue(
    features,
    'source_support_secondary_recipient_first_provider_gain',
  )
  const stunAction = featureValue(features, 'stun_action_scale')
  const stunSupport = featureValue(features, 'source_support_stun_capacity')
  const selfBuildup =
    system === 'attribute_anomaly'
      ? featureValue(features, 'source_self_anomaly_accumulation_capacity')
      : 0
  const potentialDamageBonus = featureValue(features, 'reference_potential_damage_bonus')
  const primarySelfEffectGain = (application: string) =>
    maximum(
      ...(features.sourceCapacityEvidence?.effects ?? [])
        .filter(
          (effect) =>
            effect.providerAgentId === features.primaryOutputAgentId &&
            effect.recipientAgentId === features.primaryOutputAgentId &&
            effect.application === application,
        )
        .map((effect) => effect.relativeGain ?? 0),
    )
  const selfDamageGain = primarySelfEffectGain('damage_bonus')
  const selfCritRateGain = primarySelfEffectGain('crit_rate')
  const selfCritDamageGain = primarySelfEffectGain('crit_damage')
  const primaryAction = features.sourceCapacityEvidence?.actions.find(
    (action) => action.agentId === features.primaryOutputAgentId,
  )
  return {
    system,
    primaryOutputAgentId: features.primaryOutputAgentId,
    ...(sameCoreOutput ? { sameCoreOutput } : {}),
    primaryEventCapacity: sameCoreOutput
      ? declaredPrimaryEventCapacity(sameCoreOutput)
      : primaryAction?.eventPacketIdentity &&
          primaryAction.value !== null &&
          Number.isFinite(primaryAction.value)
        ? { eventPacketIdentity: primaryAction.eventPacketIdentity, value: primaryAction.value }
        : null,
    unknownPositiveCapacityIndices: [8],
    positiveCapacities: [
      primaryOutput,
      secondaryOutput,
      sourcePrimarySupport,
      supportCoverage,
      secondarySupport,
      stunAction,
      stunSupport,
      selfBuildup,
      potentialDamageBonus,
      selfDamageGain,
      selfCritRateGain,
      selfCritDamageGain,
    ],
    executionBurdens: [
      featureValue(features, 'field_time_excess'),
      featureValue(features, 'inactive_additional_ability_fraction'),
      featureValue(features, 'unmet_resource_fraction'),
    ],
  }
}

function compareTolerantCapacity(left: number, right: number) {
  const scale = Math.max(1, Math.abs(left), Math.abs(right))
  const difference = left - right
  return Math.abs(difference) <= scale * capacityRelativeTolerance ? 0 : difference
}

export function compareTeamSystemRankingProfiles(
  left: TeamSystemRankingProfile,
  right: TeamSystemRankingProfile,
): 'left' | 'right' | 'tie' | 'incomparable' {
  if (left.system !== right.system) return 'incomparable'
  // Different source packets have no shared duration/resource denominator.
  // Comparing only their remaining support coordinates cannot repair that gap.
  if (
    left.primaryOutputAgentId &&
    right.primaryOutputAgentId &&
    left.primaryOutputAgentId !== right.primaryOutputAgentId
  )
    return 'incomparable'
  const leftOutput = left.sameCoreComparison ?? left.sameCoreOutput
  const rightOutput = right.sameCoreComparison ?? right.sameCoreOutput
  if (leftOutput || rightOutput) {
    if (
      !leftOutput ||
      !rightOutput ||
      leftOutput.result.status !== 'supported' ||
      rightOutput.result.status !== 'supported' ||
      leftOutput.outputSystem !== left.system ||
      rightOutput.outputSystem !== right.system ||
      !left.primaryOutputAgentId ||
      left.primaryOutputAgentId !== right.primaryOutputAgentId ||
      !left.primaryEventCapacity ||
      !right.primaryEventCapacity ||
      leftOutput.input.subjectAgentId !== left.primaryOutputAgentId ||
      rightOutput.input.subjectAgentId !== right.primaryOutputAgentId ||
      leftOutput.eventPacketIdentity !== left.primaryEventCapacity.eventPacketIdentity ||
      rightOutput.eventPacketIdentity !== right.primaryEventCapacity.eventPacketIdentity
    )
      return 'incomparable'
    const relation =
      left.sameCoreComparison || right.sameCoreComparison
        ? compareTeamSameCoreRankingSnapshots(
            left.sameCoreComparison ?? snapshotTeamSameCoreRanking(left.sameCoreOutput!),
            right.sameCoreComparison ?? snapshotTeamSameCoreRanking(right.sameCoreOutput!),
          )
        : compareTeamSameCoreOutput(left.sameCoreOutput!, right.sameCoreOutput!).relation
    if (relation === 'incomparable') return relation
    // Burdens can veto a priority; they never generate output or efficiency.
    if (
      [...left.executionBurdens, ...right.executionBurdens].some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    )
      return 'incomparable'
    const winner = relation === 'left' ? left : right
    const loser = relation === 'left' ? right : left
    if (
      relation !== 'tie' &&
      winner.executionBurdens.some((value, index) => value > loser.executionBurdens[index]!)
    )
      return 'incomparable'
    return relation
  }
  let leftPositive = false
  let rightPositive = false
  let leftBurden = false
  let rightBurden = false
  for (let index = 0; index < left.positiveCapacities.length; index += 1) {
    const leftUnknown = left.unknownPositiveCapacityIndices?.includes(index) ?? false
    const rightUnknown = right.unknownPositiveCapacityIndices?.includes(index) ?? false
    if (leftUnknown || rightUnknown) {
      if (leftUnknown !== rightUnknown) return 'incomparable'
      continue
    }
    if (
      (index <= 1 || index === 5) &&
      left.primaryOutputAgentId &&
      right.primaryOutputAgentId &&
      left.primaryOutputAgentId !== right.primaryOutputAgentId
    )
      continue
    const difference = compareTolerantCapacity(
      left.positiveCapacities[index]!,
      right.positiveCapacities[index]!,
    )
    if (difference > 0) leftPositive = true
    if (difference < 0) rightPositive = true
    if (leftPositive && rightPositive) return 'incomparable'
  }
  for (let index = 0; index < left.executionBurdens.length; index += 1) {
    const leftValue = left.executionBurdens[index]!
    const rightValue = right.executionBurdens[index]!
    if (leftValue < rightValue) leftBurden = true
    if (rightValue < leftValue) rightBurden = true
    if (leftBurden && rightBurden) return 'incomparable'
  }
  const sameOutputActor =
    left.primaryOutputAgentId &&
    right.primaryOutputAgentId &&
    left.primaryOutputAgentId === right.primaryOutputAgentId
  const samePrimaryAction =
    left.primaryEventCapacity && right.primaryEventCapacity
      ? left.primaryEventCapacity.eventPacketIdentity ===
          right.primaryEventCapacity.eventPacketIdentity &&
        compareTolerantCapacity(
          left.primaryEventCapacity.value,
          right.primaryEventCapacity.value,
        ) === 0
      : compareTolerantCapacity(left.positiveCapacities[0]!, right.positiveCapacities[0]!) === 0
  if (
    sameOutputActor &&
    (left.primaryEventCapacity === null ||
      right.primaryEventCapacity === null ||
      (left.primaryEventCapacity &&
        right.primaryEventCapacity &&
        left.primaryEventCapacity.eventPacketIdentity !==
          right.primaryEventCapacity.eventPacketIdentity))
  )
    return 'incomparable'
  const nonPrimaryEvidenceDiffers =
    left.positiveCapacities
      .slice(1)
      .some(
        (value, index) =>
          !(
            left.unknownPositiveCapacityIndices?.includes(index + 1) &&
            right.unknownPositiveCapacityIndices?.includes(index + 1)
          ) && compareTolerantCapacity(value, right.positiveCapacities[index + 1]!) !== 0,
      ) || left.executionBurdens.some((value, index) => value !== right.executionBurdens[index])
  if (sameOutputActor && samePrimaryAction && nonPrimaryEvidenceDiffers) return 'incomparable'
  if (leftPositive && !rightPositive && !rightBurden) return 'left'
  if (rightPositive && !leftPositive && !leftBurden) return 'right'
  if (leftBurden && !rightBurden && !rightPositive) return 'left'
  if (rightBurden && !leftBurden && !leftPositive) return 'right'
  return leftPositive || rightPositive || leftBurden || rightBurden ? 'incomparable' : 'tie'
}

export function compareTeamSystemRankingCandidates(
  left: TeamSystemRankingProfile,
  right: TeamSystemRankingProfile,
  leftMechanic?: TeamRankingMethodInput,
  rightMechanic?: TeamRankingMethodInput,
): 'left' | 'right' | 'tie' | 'incomparable' {
  const profile = compareTeamSystemRankingProfiles(left, right)
  if (profile === 'tie' || profile === 'incomparable') return profile
  if (!leftMechanic || !rightMechanic) return 'incomparable'
  const mechanic = compareTeamRankingMethod(leftMechanic, rightMechanic)
  // Equal categorical mechanisms need not distinguish two settled packets.
  // Unsupported, opposing or traded-off mechanisms still veto the priority.
  if (
    (left.sameCoreComparison || left.sameCoreOutput) &&
    (right.sameCoreComparison || right.sameCoreOutput)
  )
    return mechanic === profile || mechanic === 'tie' ? profile : 'incomparable'
  if (mechanic === 'left' || mechanic === 'right')
    return mechanic === profile ? profile : 'incomparable'
  return 'tie'
}

export function assignMechanisticSystemRanks(
  rows: Parameters<typeof assignMechanisticSystemRankOrder>[0],
  compare: Parameters<typeof assignMechanisticSystemRankOrder>[1] = (left, right) =>
    compareTeamSystemRankingProfiles(left.profile, right.profile),
  options: { sameOwnerOnly?: boolean } = {},
) {
  return assignMechanisticSystemRankOrder(rows, compare, options)
}
