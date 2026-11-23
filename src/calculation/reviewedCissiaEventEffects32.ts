import encyclopedia from '../gameDataPacks/data/current-encyclopedia-display.3.3.json'
import { resolveCurrentAgentEvent } from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { SourceBackedEquipmentModifierBucket } from './currentPlanningDamageModifiers'

/** The retained English file has CRLF on disk. Its LF-normalized SHA matches
 * the existing source pin; the raw byte hash is recorded separately, never
 * substituted for the old pin. Current Chinese 3.3 agrees on these clauses. */
export const reviewedCissiaSource32 = Object.freeze({
  englishCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  englishLfSha256: '85d236f69f5ddcaf25998a07eaf58c5be7ee5d2dd4cf9ea7d4bcaa476ec51484',
  englishRetainedRawSha256: '983d0eaf576ecef50e064173d8ab05cdbc62ee586794f470111ef79d1fbc8cc9',
  chineseVersion: '3.3',
  chineseSha256: 'b3657d1b2e408d136d61d47d3e8bb80d5bd6498fb61930dc8478dfd5c0eb8375',
  sourceRefs: [
    'frzyc/genshin-optimizer@3456cd0f6f5bea10e168074502460dac2fcd6df4:libs/zzz/dm-localization/assets/locales/en/char_Cissia_gen.json#LF-sha256=85d236f69f5ddcaf25998a07eaf58c5be7ee5d2dd4cf9ea7d4bcaa476ec51484',
    'https://static.nanoka.cc/zzz/3.3/zh/character/1521.json#sha256=b3657d1b2e408d136d61d47d3e8bb80d5bd6498fb61930dc8478dfd5c0eb8375',
    'Cissia:core.desc[0..6][2..3];mindscapes[1..2];basic.CorrodeBone.desc[1];basic.BasicAttackSerpentsKiss.desc[6]',
  ],
})

export type ReviewedCissiaEventObservation32 = {
  ownerAgentId: string
  eventId: string
  venomBuffWindowActive: boolean
  corrodeCritStacks: number
  /** Explicit event observation, not implied by a complete packet or old
   * personal-window default. The caller binds every event separately. */
  sourceRefs: readonly string[]
}

/** Supplemental event-specific clauses; the existing shared blueprint owns
 * core DEF ignore and ability crit damage. No duplicate defense bucket here. */
export function bindReviewedCissiaEventEffects32(input: {
  provider: PlanningEffectRuntimeMember
  memberIds: readonly string[]
  event: PlanningEventUsage
  observation: ReviewedCissiaEventObservation32
}) {
  const fail = (reason: string) => ({ status: 'unsupported' as const, blockers: [reason] })
  const { provider, event, observation } = input
  const row = encyclopedia.agents.find((a) => a.stableId === 'agent-cissia')
  if (row?.source.sha256 !== reviewedCissiaSource32.chineseSha256)
    return fail('cissia_reviewed_current_source_changed')
  if (
    provider.agentId !== 'agent-cissia' ||
    !input.memberIds.includes(provider.agentId) ||
    !input.memberIds.includes(event.ownerAgentId) ||
    new Set(input.memberIds).size !== input.memberIds.length ||
    observation.ownerAgentId !== event.ownerAgentId ||
    observation.eventId !== event.eventId ||
    typeof observation.venomBuffWindowActive !== 'boolean' ||
    !Number.isInteger(observation.corrodeCritStacks) ||
    observation.corrodeCritStacks < 0 ||
    observation.corrodeCritStacks > 3 ||
    !observation.sourceRefs.length ||
    observation.sourceRefs.some((ref) => !ref.trim()) ||
    !Number.isInteger(provider.coreLevel) ||
    provider.coreLevel < 1 ||
    provider.coreLevel > 7 ||
    !Number.isInteger(provider.mindscape) ||
    provider.mindscape < 0 ||
    provider.mindscape > 6 ||
    !Number.isInteger(event.occurrenceCount) ||
    event.occurrenceCount < 1 ||
    (event.ownerAgentId === 'agent-cissia' && event.occurrenceCount !== 1)
  )
    return fail('cissia_event_observation_or_identity_invalid')
  const source = resolveCurrentAgentEvent({
    stableId: event.ownerAgentId,
    eventId: event.eventId,
    skillLevel: event.skillLevel,
  })
  if (source.status !== 'supported') return fail('cissia_recipient_source_event_unavailable')
  const own = event.ownerAgentId === provider.agentId
  if (own && provider.skillLevels.basic !== event.skillLevel && event.eventId.startsWith('basic.'))
    return fail('cissia_source_skill_level_mismatch')
  const bone = own && event.eventId === 'basic.CorrodeBone.hit-0'
  const kiss = own && event.eventId === 'basic.BasicAttackSerpentsKiss.hit-0'
  if (
    bone &&
    (source.source.formulaSha256 !==
      'A6D650C19881D1FEDC2FC0DCD028420E438603A437A32E04F7E5E9109FA56597' ||
      source.eventModifierRefs.length !== 0)
  )
    return fail('cissia_corrode_source_changed_recheck_additional_coefficient_no_double_count')
  const buckets: SourceBackedEquipmentModifierBucket[] = []
  const refs = [
    ...reviewedCissiaSource32.sourceRefs,
    ...observation.sourceRefs,
    `${source.source.formulaPath}#${source.source.formulaSha256}`,
  ]
  const add = (
    effect: string,
    application: SourceBackedEquipmentModifierBucket['application'],
    value: number,
    attribute: string | null = null,
  ) => {
    buckets.push({
      bucketId: `cissia:${effect}:${event.ownerAgentId}:${event.eventId}`,
      effectKey: `agent-cissia:reviewed_${effect}32`,
      providerAgentId: provider.agentId,
      applicationScope: 'generic',
      boundEventId: event.eventId,
      recipientAgentIds: [event.ownerAgentId],
      receiverPath: null,
      action: null,
      damageType: null,
      attribute,
      value,
      application,
      sourceRefs: refs,
    })
  }
  // M1 RES ignore is stated independently of the Venom duration clause.
  // It applies only to Electric damage and is not gated by a generic window.
  if (provider.mindscape >= 1 && source.attribute === 'electric')
    add('m1_electric_resistance_ignore', 'resistance_ignore', 0.05 + (bone ? 0.1 : 0), 'electric')
  if (own) add('corrode_crit_stacks', 'crit_rate', 0.06 * observation.corrodeCritStacks)
  if (kiss && provider.mindscape >= 2) add('m2_serpents_kiss_damage', 'damage_bonus', 0.35)
  const additionalAttackMultiplier = bone
    ? [2.27, 2.45, 2.63, 2.81, 2.99, 3.17, 3.35][provider.coreLevel - 1]!
    : 0
  if (bone) {
    if (!Number.isFinite(source.damageMultiplier) || source.damageMultiplier <= 0)
      return fail('cissia_corrode_base_coefficient_invalid')
    // Same event, ATK basis and downstream modifiers: (base + core) / base
    // consumes the source's additional ATK multiplier through the existing
    // event formula exactly once, without a second hit or frozen final ATK.
    add(
      'core_corrode_attack_coefficient',
      'motion_value_multiplier',
      (source.damageMultiplier + additionalAttackMultiplier) / source.damageMultiplier,
    )
  }
  return {
    status: 'supported' as const,
    buckets,
    additionalAttackMultiplier,
    sourceDamageMultiplier: source.damageMultiplier,
    completeAttackMultiplier: source.damageMultiplier + additionalAttackMultiplier,
    observation,
    sourceRefs: refs,
  }
}
