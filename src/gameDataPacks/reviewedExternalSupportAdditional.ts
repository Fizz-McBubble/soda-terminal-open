import type { TeamPredicate } from '../teamEngine/contracts'
import { prydwenSource, type FactDefinition } from './reviewedExternalSupportContract'

const nangongAdditional: TeamPredicate = {
  kind: 'category_sum_minimum',
  agentId: 'agent-nangong',
  terms: [
    { kind: 'specialty', value: 'anomaly' },
    { kind: 'faction', value: '妄想天使' },
  ],
  minimum: 1,
  dynamicTerms: [],
}
const cissiaAdditional: TeamPredicate = {
  kind: 'category_sum_minimum',
  agentId: 'agent-cissia',
  terms: [
    { kind: 'specialty', value: 'stun' },
    { kind: 'attribute', value: 'electric' },
  ],
  minimum: 1,
  dynamicTerms: [],
}
const nangongSource = (location: string, unit: string) =>
  prydwenSource('nangong-yu', '2.7', location, unit)
const cissiaSource = (location: string, unit: string) =>
  prydwenSource('cissia', '2.7', location, unit)

export const additionalSupportDefinitions: readonly FactDefinition[] = [
  {
    agentId: 'agent-nangong',
    targetVersionStatus: 'selected_3.1_fields_compared',
    requiredRows: [
      {
        recordId: 'ENTITY_FACTS:fact-nangong-core-levels:core.levels:batch-agents-2.7-r3c',
        fieldPath: 'core.levels',
        sourceIds: ['honeyhunter-nangong-2.7.5-2026-08-05'],
        evidenceLocator: 'SOURCE_REGISTRY:honeyhunter-nangong-2.7.5-2026-08-05#core-skill',
        value:
          '{"tiers":6,"max_core_panel":{"base_atk_bonus":75,"anomaly_mastery_bonus":36},"passive":{"anomaly_proficiency_bonus":120,"impact_per_initial_am_above_110":1,"downbeats_cap":100,"downbeats_initial":30,"vibrato_cap":4}}',
        gameVersion: '2.7',
        unit: 'none',
      },
      {
        recordId:
          'MECHANICS_AND_FORMULAS:mech-nangong-downbeats-polarity:ether_stun_anomaly_vibrato_polarity_disorder:ether_stun_anomaly_vibrato_polarity_disorder',
        fieldPath: 'ether_stun_anomaly_vibrato_polarity_disorder',
        sourceIds: ['honeyhunter-nangong-2.7.5-2026-08-05', 'prydwen-nangong-2.7-2026-06-23'],
        evidenceLocator: 'SOURCE_REGISTRY:prydwen-nangong-2.7-2026-06-23#review:unique-mechanic',
        value:
          'Downbeats start 30, cap 100, restore 3.8/s plus 12 on anomaly with 6s cooldown; Dance Prowess permits Polarity Disorder under anomaly+stun gate',
        gameVersion: null,
        unit: null,
      },
    ],
    effects: [
      {
        channel: 'all_damage_bonus',
        recipient: 'team',
        trigger:
          'Nangong Yu Basic Attack: Adorable Explosive Impact or EX Special: The Unbearable Weight of Love hits an enemy.',
        value: { coreLevel1TeamDamageRatio: 0.13 },
        durationSeconds: 30,
        levelBoundary:
          '13% is explicitly Core Lv. 1 in the reviewed Kit. Higher-core magnitude is not admitted; the review describes a 25% max-core value separately.',
        consumerBoundary:
          'Core team DMG exists at M0 without Additional activation. BOX records presence, not magnitude or rotation uptime.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: false,
          teamPredicate: null,
          runtimeStateIds: [],
          requiresCombatTrigger: true,
          magnitudeBoundary: 'core_level_1_only',
        },
        reviewedSource: nangongSource(
          'Kit > Core Passive: Prodigious Idol, Lv. 1',
          '+13% team DMG at Core Lv. 1 for 30 s; hit refreshes duration',
        ),
      },
      {
        channel: 'enemy_stun_damage_multiplier',
        recipient: 'enemy',
        trigger:
          'The third Adorable Explosive Impact hit or Ultimate hits an enemy, applying Misstep.',
        stateId: 'misstep-on-enemy',
        value: { enemyStunDamageMultiplierBonusRatio: 0.3 },
        durationSeconds: null,
        levelBoundary: 'Additional Ability is independent of core level.',
        consumerBoundary:
          'Enemy Stun DMG Multiplier only; Misstep clears on Stun recovery and cannot trigger twice on the same enemy before that recovery.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: true,
          teamPredicate: nangongAdditional,
          runtimeStateIds: ['misstep-on-enemy'],
          requiresCombatTrigger: true,
          magnitudeBoundary: 'core_independent',
        },
        reviewedSource: nangongSource(
          'Kit > Additional Ability: Angel Captain, Misstep',
          '+30% enemy Stun DMG Multiplier until Stun recovery',
        ),
      },
      {
        channel: 'enemy_stun_duration',
        recipient: 'enemy',
        trigger: 'An enemy carrying Misstep becomes Stunned.',
        stateId: 'misstep-on-enemy',
        value: { extensionSeconds: 3 },
        durationSeconds: null,
        levelBoundary: 'Additional Ability is independent of core level.',
        consumerBoundary:
          'Enemy Stun duration only; it does not stack with similar effects, and Misstep clears on recovery.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: true,
          teamPredicate: nangongAdditional,
          runtimeStateIds: ['misstep-on-enemy', 'enemy-becomes-stunned'],
          requiresCombatTrigger: true,
          magnitudeBoundary: 'core_independent',
        },
        reviewedSource: nangongSource(
          'Kit > Additional Ability: Angel Captain, Misstep',
          '+3 s enemy Stun duration; non-stacking with similar effects',
        ),
      },
    ],
    boundary:
      'Historical 2.7 rows remain source-bound; selected 3.1 Core Lv. 1/max-core and Additional fields match the pinned snapshot. No full-kit, Formal, rotation or uptime claim.',
  },
  {
    agentId: 'agent-cissia',
    targetVersionStatus: 'selected_3.1_fields_compared',
    requiredRows: [
      {
        recordId: 'ENTITY_FACTS:fact-cissia-core-levels:core.levels:batch-agents-2.7-r3c',
        fieldPath: 'core.levels',
        sourceIds: ['honeyhunter-cissia-2.7.5-2026-08-05'],
        evidenceLocator: 'SOURCE_REGISTRY:honeyhunter-cissia-2.7.5-2026-08-05#core-skill',
        value:
          '{"tiers":6,"max_core_panel":{"base_atk_bonus":75,"base_energy_regen_bonus":0.36},"passive":{"venom_cap":6,"initial_venom":3,"consume_interval_seconds":5,"def_ignore_base":0.06,"def_ignore_cap":0.25}}',
        gameVersion: '2.7',
        unit: 'none',
      },
      {
        recordId:
          'MECHANICS_AND_FORMULAS:mech-cissia-venom-corrode-bone:electric_direct_crit_venom_corrode_bone:electric_direct_crit_venom_corrode_bone',
        fieldPath: 'electric_direct_crit_venom_corrode_bone',
        sourceIds: ['honeyhunter-cissia-2.7.5-2026-08-05', 'prydwen-cissia-2.7-2026-06-14'],
        evidenceLocator: 'SOURCE_REGISTRY:honeyhunter-cissia-2.7.5-2026-08-05#core-skill',
        value:
          'start with 3 Venom; consume 1 every 5s; excess Venom triggers Corrode Bone; every 6 Venom gained grants Serpentine Shadow',
        gameVersion: null,
        unit: null,
      },
    ],
    effects: [
      {
        channel: 'electric_defense_ignore',
        recipient: 'team',
        recipientAttribute: 'electric',
        trigger: 'Cissia has Venom, or the 30 s linger after Venom is depleted remains active.',
        stateId: 'venom-or-30s-linger',
        value: { coreLevel1ElectricDefenseIgnoreBaseRatio: 0.03 },
        durationSeconds: 30,
        levelBoundary:
          '3% base and 12.88% ceiling are Kit Core Lv. 1; L3 max-core 6% base and 25% cap are a different level. BOX does not combine or interpolate them.',
        consumerBoundary:
          'Only Electric damage dealt by squad members ignores enemy DEF; never global DEF reduction or non-Electric damage. No uptime or Energy Regen calculation.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: false,
          teamPredicate: null,
          runtimeStateIds: ['venom-or-30s-linger'],
          requiresCombatTrigger: false,
          magnitudeBoundary: 'core_level_1_only',
        },
        reviewedSource: cissiaSource(
          'Kit > Core Passive: Fatal Concoction, Lv. 1',
          'Electric DMG ignores 3% enemy DEF at Core Lv. 1; +0.52 percentage points per 0.12 initial Energy Regen above 1.4, cap 12.88%; 30 s linger',
        ),
      },
      {
        channel: 'critical_damage_bonus',
        recipient: 'team',
        trigger: 'Cissia Additional Ability active and Venom exists, or its 30 s linger remains.',
        stateId: 'venom-or-30s-linger',
        value: { teamCriticalDamageBonusRatio: 0.4 },
        durationSeconds: 30,
        levelBoundary: 'Additional Ability is independent of core level.',
        consumerBoundary:
          'Team CRIT DMG is 40%; Cissia personal additional 10% is excluded from the team value. BOX does not assume Venom uptime.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: true,
          teamPredicate: cissiaAdditional,
          runtimeStateIds: ['venom-or-30s-linger'],
          requiresCombatTrigger: false,
          magnitudeBoundary: 'core_independent',
        },
        reviewedSource: cissiaSource(
          'Kit > Additional Ability: Festering Venom',
          '+40% team CRIT DMG while Venom exists and for 30 s after depletion; Cissia alone gains another 10%',
        ),
      },
    ],
    boundary:
      'Historical 2.7 rows remain source-bound; selected 3.1 Core Lv. 1/max-core and Additional fields match the pinned snapshot. Electric-only scope, level split, and candidate/uptime limits remain; no Formal or exact DPS claim.',
  },
] as const
