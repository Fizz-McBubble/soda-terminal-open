import { stableContentHash } from '../gameDataPacks/types'
import phoenixAnomalyCritData33 from '../gameDataPacks/data/reviewed-phoenix-anomaly-crit.3.3.json' with { type: 'json' }

export const phoenixAnomalyCritIdentity33 = Object.freeze({
  family: 'phoenix_scorch_anomaly_crit',
  version: '3.3-increment-preview',
  providerManifestSha256: phoenixAnomalyCritData33.providerManifestSha256,
  sources: phoenixAnomalyCritData33.sources,
  parameters: phoenixAnomalyCritData33.parameters,
  boundary: phoenixAnomalyCritData33.boundary,
})

export const phoenixAnomalyCritHash33 = stableContentHash(phoenixAnomalyCritIdentity33)

export type PhoenixCoreLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type PhoenixMindscape = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type PhoenixAnomalyDamageKind = 'ordinary_anomaly' | 'phoenix_abloom' | 'other_agent_abloom'
export type PhoenixAbloomInstance =
  | 'basic_purifying_flame'
  | 'ultimate_soul_searching_blaze'
  | 'm4_extra'
  | 'unknown'
export type ExistingAnomalyCritSource = 'none' | 'unknown' | 'jane_assault_crit' | (string & {})

export const PHOENIX_CORE_ANOMALY_CRIT_DMG_TABLE: Readonly<Record<PhoenixCoreLevel, number>> =
  Object.freeze({ ...phoenixAnomalyCritData33.parameters.anomalyCritDamage.coreLevelTable })

export type PhoenixScorchStateObservation = {
  active: boolean
  targetId: string
  eventId: string
  appliedAtSeconds?: number
  currentAtSeconds?: number
  refreshedAtSeconds?: number
  controlledSameEvent?: boolean
}

export type PhoenixAnomalyCritInput = {
  sourceIdentityHash: string
  targetId: string
  eventId: string
  phoenix: {
    coreLevel: PhoenixCoreLevel
    mindscape: PhoenixMindscape
    initialAnomalyMastery: number
    additionalAbilityActive: boolean
  }
  scorchState: PhoenixScorchStateObservation
  damageKind: PhoenixAnomalyDamageKind
  /** The source grants +40% to these two original skill instances, not all owner damage. */
  phoenixAbloomInstance?: PhoenixAbloomInstance
  existingAnomalyCritSource: ExistingAnomalyCritSource
}

export type PhoenixAnomalyCritSupportedDetails = {
  baseCritRate: number
  masteryCritRateBonus: number
  coreCritDamage: number
  additionalAbilityCritDamageBonus: number
  m1CritDamageBonus: number
  phoenixAbloomCritDamageBonus: number
  effectiveCritRate: number
  effectiveCritDamage: number
}

export type PhoenixAnomalyCritResult =
  | {
      status: 'supported'
      anomalyCritRate: number
      anomalyCritDamage: number
      details: PhoenixAnomalyCritSupportedDetails
      sourceIdentityHash: string
      targetId: string
      eventId: string
    }
  | {
      status: 'not_applicable'
      reason: 'target_not_scorched' | 'scorch_duration_expired'
      anomalyCritRate: 0
      anomalyCritDamage: 0
      targetId: string
      eventId: string
    }
  | {
      status: 'unsupported'
      reason: string
      blockers: string[]
    }

const failUnsupported = (reason: string, blockers: string[]): PhoenixAnomalyCritResult => ({
  status: 'unsupported',
  reason,
  blockers: [...new Set(blockers)],
})

/**
 * Calculates Phoenix's Scorch-enabled anomaly critical hit rate and critical damage.
 * Validates temporal validity (20s duration with refresh support), single-event bindings,
 * and fail-closed handling for unknown or stacking anomaly crit sources (e.g. Jane).
 */
export function calculatePhoenixAnomalyCrit33(
  input: PhoenixAnomalyCritInput,
): PhoenixAnomalyCritResult {
  if (input.sourceIdentityHash !== phoenixAnomalyCritHash33) {
    return failUnsupported('source_identity_mismatch', [
      `expected ${phoenixAnomalyCritHash33}, received ${input.sourceIdentityHash}`,
    ])
  }

  if (!input.targetId?.trim() || !input.eventId?.trim()) {
    return failUnsupported('missing_event_identity', [
      'A non-empty target and event identity are required.',
    ])
  }

  const { coreLevel, mindscape, initialAnomalyMastery, additionalAbilityActive } = input.phoenix
  if (
    typeof additionalAbilityActive !== 'boolean' ||
    typeof input.scorchState.active !== 'boolean'
  ) {
    return failUnsupported('unknown_mechanic_state', [
      'Additional ability and Scorch activation must be explicitly true or false.',
    ])
  }
  if (!Number.isInteger(coreLevel) || coreLevel < 1 || coreLevel > 7) {
    return failUnsupported('invalid_phoenix_core_level', [
      `core level must be integer 1-7, received ${coreLevel}`,
    ])
  }
  if (!Number.isInteger(mindscape) || mindscape < 0 || mindscape > 6) {
    return failUnsupported('invalid_phoenix_mindscape', [
      `mindscape must be integer 0-6, received ${mindscape}`,
    ])
  }
  if (!Number.isFinite(initialAnomalyMastery) || initialAnomalyMastery < 0) {
    return failUnsupported('invalid_initial_anomaly_mastery', [
      `initial anomaly mastery must be non-negative finite number, received ${initialAnomalyMastery}`,
    ])
  }

  if (
    input.damageKind !== 'ordinary_anomaly' &&
    input.damageKind !== 'phoenix_abloom' &&
    input.damageKind !== 'other_agent_abloom'
  ) {
    return failUnsupported('unsupported_damage_kind', [
      `damageKind must be ordinary_anomaly, phoenix_abloom, or other_agent_abloom, received ${input.damageKind}`,
    ])
  }
  if (
    input.damageKind === 'phoenix_abloom' &&
    input.phoenixAbloomInstance !== 'basic_purifying_flame' &&
    input.phoenixAbloomInstance !== 'ultimate_soul_searching_blaze'
  ) {
    return failUnsupported('unreviewed_phoenix_abloom_instance', [
      'The +40% grant names the original Purifying Flame and Soul-Searching Blaze Abloom instances. M4 extra and unidentified instances have no reviewed inheritance rule.',
    ])
  }

  if (input.existingAnomalyCritSource === 'unknown') {
    return failUnsupported('unknown_existing_anomaly_crit_source', [
      'existing anomaly crit source is unknown; cannot assume 0 or unverified stacking',
    ])
  }
  if (input.existingAnomalyCritSource === 'jane_assault_crit') {
    return failUnsupported('unsupported_existing_anomaly_crit_stacking:jane_assault_crit', [
      'stacking of Jane assault crit and Phoenix scorch crit is unproven without controlled evidence',
    ])
  }
  if (input.existingAnomalyCritSource !== 'none') {
    return failUnsupported(
      `unsupported_existing_anomaly_crit_stacking:${input.existingAnomalyCritSource}`,
      [`unsupported existing anomaly crit stacking: ${input.existingAnomalyCritSource}`],
    )
  }

  if (input.scorchState.targetId !== input.targetId) {
    return failUnsupported('mismatched_scorch_target_binding', [
      `scorch targetId ${input.scorchState.targetId} does not match event targetId ${input.targetId}`,
    ])
  }
  if (input.scorchState.eventId !== input.eventId) {
    return failUnsupported('mismatched_scorch_event_binding', [
      `scorch eventId ${input.scorchState.eventId} does not match event eventId ${input.eventId}`,
    ])
  }

  if (!input.scorchState.active) {
    return {
      status: 'not_applicable',
      reason: 'target_not_scorched',
      anomalyCritRate: 0,
      anomalyCritDamage: 0,
      targetId: input.targetId,
      eventId: input.eventId,
    }
  }

  const { appliedAtSeconds, currentAtSeconds, refreshedAtSeconds, controlledSameEvent } =
    input.scorchState
  const hasTimeline =
    appliedAtSeconds !== undefined ||
    currentAtSeconds !== undefined ||
    refreshedAtSeconds !== undefined
  // A same-event assertion may supply an otherwise absent timeline. It cannot
  // override a supplied, contradictory or expired timeline.
  if (controlledSameEvent !== true || hasTimeline) {
    if (typeof appliedAtSeconds !== 'number' || typeof currentAtSeconds !== 'number') {
      return failUnsupported('uncontrolled_scorch_temporal_state', [
        'scorchState must provide either controlledSameEvent: true or explicit appliedAtSeconds and currentAtSeconds',
      ])
    }
    if (
      !Number.isFinite(appliedAtSeconds) ||
      !Number.isFinite(currentAtSeconds) ||
      appliedAtSeconds < 0 ||
      currentAtSeconds < 0
    ) {
      return failUnsupported('invalid_scorch_timeline', [
        'appliedAtSeconds and currentAtSeconds must be non-negative finite numbers',
      ])
    }
    if (currentAtSeconds < appliedAtSeconds) {
      return failUnsupported('invalid_scorch_timeline', [
        `currentAtSeconds (${currentAtSeconds}) cannot precede appliedAtSeconds (${appliedAtSeconds})`,
      ])
    }

    let effectiveStart = appliedAtSeconds
    if (typeof refreshedAtSeconds === 'number') {
      if (
        !Number.isFinite(refreshedAtSeconds) ||
        refreshedAtSeconds < appliedAtSeconds ||
        currentAtSeconds < refreshedAtSeconds
      ) {
        return failUnsupported('invalid_scorch_refresh_timeline', [
          `refreshedAtSeconds (${refreshedAtSeconds}) must be between appliedAtSeconds (${appliedAtSeconds}) and currentAtSeconds (${currentAtSeconds})`,
        ])
      }
      effectiveStart = refreshedAtSeconds
    }

    const elapsed = currentAtSeconds - effectiveStart
    if (elapsed >= phoenixAnomalyCritData33.parameters.scorchDurationSeconds) {
      return {
        status: 'not_applicable',
        reason: 'scorch_duration_expired',
        anomalyCritRate: 0,
        anomalyCritDamage: 0,
        targetId: input.targetId,
        eventId: input.eventId,
      }
    }
  }

  const rateParameters = phoenixAnomalyCritData33.parameters.anomalyCritRate
  const damageParameters = phoenixAnomalyCritData33.parameters.anomalyCritDamage
  const baseCritRate = rateParameters.base
  const excessMastery = Math.max(0, initialAnomalyMastery - rateParameters.anomalyMasteryThreshold)
  const masteryCritRateBonus = Math.min(
    rateParameters.maxCritRate - baseCritRate,
    +(excessMastery * rateParameters.gainPerMasteryOverThreshold).toFixed(6),
  )
  const effectiveCritRate = Math.min(
    rateParameters.maxCritRate,
    +(baseCritRate + masteryCritRateBonus).toFixed(6),
  )

  const coreCritDamage = PHOENIX_CORE_ANOMALY_CRIT_DMG_TABLE[coreLevel]
  const additionalAbilityCritDamageBonus = additionalAbilityActive
    ? damageParameters.additionalAbilityBonus
    : 0
  const m1CritDamageBonus = mindscape >= 1 ? damageParameters.mindscapeM1Bonus : 0
  const phoenixAbloomCritDamageBonus =
    input.damageKind === 'phoenix_abloom' ? damageParameters.phoenixAbloomBonus : 0
  const effectiveCritDamage = +(
    coreCritDamage +
    additionalAbilityCritDamageBonus +
    m1CritDamageBonus +
    phoenixAbloomCritDamageBonus
  ).toFixed(6)

  return {
    status: 'supported',
    anomalyCritRate: effectiveCritRate,
    anomalyCritDamage: effectiveCritDamage,
    details: {
      baseCritRate,
      masteryCritRateBonus,
      coreCritDamage,
      additionalAbilityCritDamageBonus,
      m1CritDamageBonus,
      phoenixAbloomCritDamageBonus,
      effectiveCritRate,
      effectiveCritDamage,
    },
    sourceIdentityHash: input.sourceIdentityHash,
    targetId: input.targetId,
    eventId: input.eventId,
  }
}
