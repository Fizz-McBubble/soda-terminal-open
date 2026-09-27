import { stableContentHash } from './types'

/** Review of generic upstream slots, not a new numerical team-buff engine. */
export type ReviewedGenericEffectDisposition = {
  agentId: string
  genericSlots: readonly ('team_dmg_' | 'enemy_defRed_')[]
  disposition: 'typed_external_effect_pending_consumer' | 'personal_only_in_reviewed_m0'
  targetVersionStatus: 'source_kit_review_not_pinned_to_3.1' | 'released_page_conflict'
  source: {
    url: string
    locator: string
    lastKitReviewPatch: string | null
    observedOn: '2026-09-23'
  }
  facts: readonly {
    channel: string
    recipient: 'self' | 'enemy' | 'team_specific_damage'
    mindscapeMinimum: number
    trigger: string
    value: Readonly<Record<string, number | string | boolean>>
    boundary: string
  }[]
}

/**
 * The locked formula exposes team_dmg_ and enemy_defRed_ as writable generic
 * inputs for these agents. Their names alone do not identify an M0 team effect.
 * Keep real but unmodeled channels separate from reviewed personal-only kits.
 */
export const reviewedGenericEffectDispositions: readonly ReviewedGenericEffectDisposition[] = [
  {
    agentId: 'agent-pyrois',
    genericSlots: ['team_dmg_', 'enemy_defRed_'],
    disposition: 'typed_external_effect_pending_consumer',
    targetVersionStatus: 'source_kit_review_not_pinned_to_3.1',
    source: {
      url: 'https://www.prydwen.gg/zenless/characters/pyrois',
      locator: 'Kit > Ultimate: Eternal Imprisonment; Additional Ability: Glorious Legion',
      lastKitReviewPatch: '3.0',
      observedOn: '2026-09-23',
    },
    facts: [
      {
        channel: 'enemy_stun_window_transaction',
        recipient: 'enemy',
        mindscapeMinimum: 0,
        trigger: 'right-branch Ultimate activates on currently Stunned enemies',
        value: { extendCurrentStunSeconds: 3, finishingHitEndsStruckTargetStun: true },
        boundary:
          'Both the extension and the finishing-hit termination are required. No free team-wide Stun duration or generic damage/DEF benefit is admitted.',
      },
      {
        channel: 'self_critical_damage',
        recipient: 'self',
        mindscapeMinimum: 0,
        trigger: 'Additional Ability active with another Stun or Support teammate',
        value: { criticalDamageRatio: 0.4 },
        boundary: 'Personal CRIT DMG is not a generic external support effect.',
      },
    ],
  },
  {
    agentId: 'agent-velina',
    genericSlots: ['team_dmg_', 'enemy_defRed_'],
    disposition: 'typed_external_effect_pending_consumer',
    targetVersionStatus: 'source_kit_review_not_pinned_to_3.1',
    source: {
      url: 'https://www.prydwen.gg/zenless/characters/velina',
      locator: 'Kit > Core Passive: Breeze in Bloom; Additional Ability: Mystery Hunt; M1',
      lastKitReviewPatch: '3.0',
      observedOn: '2026-09-23',
    },
    facts: [
      {
        channel: 'anomaly_buildup_resistance_reduction',
        recipient: 'enemy',
        mindscapeMinimum: 0,
        trigger: 'Sweeping Cyclone hits; Chromatic Tint requires a resolved attribute',
        value: {
          coreRatio: 0.07,
          additionalRatio: 0.07,
          activeAdditionalTotalRatio: 0.14,
          durationSeconds: 35,
          windOrResolvedTintAttribute: true,
        },
        boundary:
          'Additional Ability must activate for the second 7%. The tinted attribute needs combat context; buildup RES is not damage RES, DEF reduction, or a 14% damage bonus.',
      },
      {
        channel: 'wind_damage_resistance_ignore',
        recipient: 'team_specific_damage',
        mindscapeMinimum: 1,
        trigger: 'eligible Windswept damage at M1',
        value: { windResistanceIgnoreRatio: 0.2 },
        boundary: 'M1 damage-channel RES ignore cannot be treated as an M0 team debuff.',
      },
    ],
  },
  {
    agentId: 'agent-starlight-billy',
    genericSlots: ['team_dmg_', 'enemy_defRed_'],
    disposition: 'personal_only_in_reviewed_m0',
    targetVersionStatus: 'source_kit_review_not_pinned_to_3.1',
    source: {
      url: 'https://www.prydwen.gg/zenless/characters/billy-starlight',
      locator: "Kit > Core Passive: Knight's Resolve; Additional Ability: Blazing Starlight",
      lastKitReviewPatch: '2.8',
      observedOn: '2026-09-23',
    },
    facts: [
      {
        channel: 'self_sheer_damage',
        recipient: 'self',
        mindscapeMinimum: 0,
        trigger: 'Billy deals Physical Sheer damage',
        value: { ignoresEnemyDefense: true },
        boundary:
          'Sheer damage bypasses DEF for Billy; the enemy does not receive a team-wide DEF reduction.',
      },
      {
        channel: 'self_skill_damage',
        recipient: 'self',
        mindscapeMinimum: 0,
        trigger: 'Additional Ability active and qualifying attacks grant Starlight stacks',
        value: { ratioPerStack: 0.2, maximumStacks: 2, durationSeconds: 45 },
        boundary: 'Starlight increases only Billy’s listed skills, not team damage.',
      },
    ],
  },
  {
    agentId: 'agent-sigrid',
    genericSlots: ['team_dmg_', 'enemy_defRed_'],
    disposition: 'personal_only_in_reviewed_m0',
    targetVersionStatus: 'released_page_conflict',
    source: {
      url: 'https://www.icy-veins.com/zenless-zone-zero/sigrid-profile-skills-mindscapes',
      locator:
        'Additional Ability: Legion of the Skies; released search view and older page view differ',
      lastKitReviewPatch: null,
      observedOn: '2026-09-23',
    },
    facts: [
      {
        channel: 'self_attack_and_conditional_damage',
        recipient: 'self',
        mindscapeMinimum: 0,
        trigger:
          'another Support or Stun teammate; damage condition additionally requires Contamination',
        value: { maximumLevelAttackFlat: 840, contaminationDamageRatio: 0.15 },
        boundary:
          'The reviewed scope supplies personal ATK and conditional personal damage only. The page-version conflict prevents a target-pinned numerical claim.',
      },
    ],
  },
] as const

export function getReviewedGenericEffectDisposition(agentId: string, effectId: string) {
  return (
    reviewedGenericEffectDispositions.find(
      (item) => item.agentId === agentId && item.genericSlots.some((slot) => slot === effectId),
    ) ?? null
  )
}

export const reviewedGenericEffectDispositionsFingerprint = stableContentHash(
  reviewedGenericEffectDispositions,
)
