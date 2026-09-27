import {
  getL3AgentDevelopmentEvidence,
  type L3AgentDevelopmentEvidence,
} from './l3ProductionProjection'
import { stableContentHash } from './types'
import type { TeamPredicate } from '../teamEngine/contracts'
import { prydwenSource } from './reviewedExternalSupportContract'
import type {
  EvidenceRow,
  FactDefinition,
  RequiredRow,
  ReviewedExternalSupportChannel,
  ReviewedExternalSupportFact,
} from './reviewedExternalSupportContract'
import { additionalSupportDefinitions } from './reviewedExternalSupportAdditional'
import target31Fields from './data/reviewed-external-support-target31.3.1.json'
export type {
  ReviewedExternalSupportChannel,
  ReviewedSupportEligibility,
  ReviewedSupportSource,
  ReviewedExternalSupportEffect,
  ReviewedExternalSupportFact,
} from './reviewedExternalSupportContract'

const sunnaCore =
  '{"tiers":6,"max_core_panel":{"base_atk_bonus":75,"percent_atk_bonus":0.21},"passive":{"claw_sharpener_cap":6,"cat_gaze_duration_seconds":12,"team_atk_ratio":0.3,"team_atk_cap":1050}}'
const zhaoCore =
  '{"tiers":6,"max_core_panel":{"base_atk_bonus":75,"max_hp_bonus":0.18},"passive":{"frostbite_cap":100,"active_hit_gain":6,"active_hit_cooldown_seconds":3,"ether_veil_seconds":40,"team_atk_bonus":1000,"team_atk_seconds":50}}'
const sunnaAdditionalPredicate: TeamPredicate = {
  kind: 'category_sum_minimum',
  agentId: 'agent-sunna',
  terms: [
    { kind: 'specialty', value: 'damage' },
    { kind: 'faction', value: '妄想天使' },
  ],
  minimum: 1,
  dynamicTerms: [],
}
const normaAdditionalPredicate: TeamPredicate = {
  kind: 'category_sum_minimum',
  agentId: 'agent-norma',
  terms: [
    { kind: 'specialty', value: 'damage' },
    { kind: 'specialty', value: 'rupture' },
    { kind: 'faction', value: '罗斯凯利法·外务筹策局' },
  ],
  minimum: 1,
  dynamicTerms: [],
}
const normaAdditionalEligibility = {
  minimumMindscape: 0,
  additionalAbilityRequired: true,
  teamPredicate: normaAdditionalPredicate,
  requiresCombatTrigger: true,
  magnitudeBoundary: 'core_independent',
} as const

const sunnaSource = (location: string, unit: string) =>
  prydwenSource('sunna', '2.6', location, unit)
const zhaoSource = (location: string, unit: string) => prydwenSource('zhao', '2.5', location, unit)
const normaSource = (location: string, unit: string) =>
  prydwenSource('norma', '3.0', location, unit)

const definitions: readonly FactDefinition[] = [
  {
    agentId: 'agent-sunna',
    targetVersionStatus: 'selected_3.1_fields_compared',
    requiredRows: [
      {
        recordId:
          'MECHANICS_AND_FORMULAS:mech-sunna-angelic-chordination:physical_support_cat_gaze_trigger_owner:physical_support_cat_gaze_trigger_owner',
        fieldPath: 'physical_support_cat_gaze_trigger_owner',
        sourceIds: [
          'qq-sheet-2.6-r14028417-local-archive',
          'honeyhunter-sunna-current-2026-08-05',
          'prydwen-sunna-2.6-2026-08-05',
        ],
        evidenceLocator: 'SOURCE_REGISTRY:prydwen-sunna-2.6-2026-08-05#core-passive',
        value:
          "Characters in Angelic Chord-ination gain ATK equal to 30% of Sunna's initial ATK, capped by core level; max-core cap is 1050 at 3500 initial ATK",
        gameVersion: null,
        unit: null,
      },
      {
        recordId: 'ENTITY_FACTS:fact-sunna-core-levels:core.levels:batch-agents-2.6-r3d',
        fieldPath: 'core.levels',
        sourceIds: ['honeyhunter-sunna-current-2026-08-05'],
        evidenceLocator: 'SOURCE_REGISTRY:honeyhunter-sunna-current-2026-08-05#core-skill',
        value: sunnaCore,
        gameVersion: '2.6',
        unit: 'none',
      },
    ],
    effects: [
      {
        channel: 'attack_from_source_initial_attack',
        recipient: 'team_state_members',
        trigger: 'Sunna EX Special activates Angelic Chord-ination',
        stateId: 'angelic-chordination',
        value: {
          sourceInitialAttackRatio: 0.3,
          maxCoreCap: 1050,
          initialAttackAtMaxCoreCap: 3500,
        },
        durationSeconds: 40,
        levelBoundary:
          'The cap varies by core level. Only the maximum-core cap is admitted; lower-level caps are not present in this projection.',
        consumerBoundary:
          'Recipient is limited to characters in Angelic Chord-ination. The source says ATK without identifying a Combat ATK stage.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: false,
          teamPredicate: null,
          runtimeStateIds: ['angelic-chordination'],
          requiresCombatTrigger: true,
          magnitudeBoundary: 'max_core_only',
        },
        reviewedSource: sunnaSource(
          'Kit > Core Passive Lv. 1 and EX Special Attack: Bubblegum Barrage; max-core cap cross-checked against L3 core.levels',
          '30% initial ATK; max-core cap 1050 ATK; state duration 40 s',
        ),
      },
      {
        channel: 'enemy_stun_damage_multiplier',
        recipient: 'enemy',
        trigger:
          'With Sunna Additional Ability active, a character inside Ether Veil: Delusion Reprise hits the enemy.',
        stateId: 'ether-veil-delusion-reprise',
        value: { enemyStunDamageMultiplierBonusRatio: 0.3 },
        durationSeconds: 40,
        levelBoundary: 'This Additional Ability is independent of core level.',
        consumerBoundary:
          'Enemy Stun DMG Multiplier only; it is not global team DMG or DEF reduction. BOX does not assume veil or buff uptime.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: true,
          teamPredicate: sunnaAdditionalPredicate,
          runtimeStateIds: ['ether-veil-delusion-reprise'],
          requiresCombatTrigger: true,
          magnitudeBoundary: 'core_independent',
        },
        reviewedSource: sunnaSource(
          "Kit > Additional Ability: Daydreamer's Counterpoint",
          '+30% enemy Stun DMG Multiplier for 40 s after qualifying hit',
        ),
      },
    ],
    boundary:
      'Historical 2.6 rows remain source-bound; selected 3.1 max-core and Additional fields match the pinned snapshot. BOX still uses qualitative team ATK and Stun-window capacity, not uptime or Formal damage.',
  },
  {
    agentId: 'agent-zhao',
    targetVersionStatus: 'selected_3.1_fields_compared',
    requiredRows: [
      {
        recordId:
          'MECHANICS_AND_FORMULAS:mech-zhao-frostbite-wellspring:initial_hp_frostbite_wellspring_team_support:initial_hp_frostbite_wellspring_team_support',
        fieldPath: 'initial_hp_frostbite_wellspring_team_support',
        sourceIds: [
          'qq-sheet-2.6-r14028417-local-archive',
          'honeyhunter-zhao-current-2026-08-05',
          'prydwen-zhao-current-2026-08-05',
        ],
        evidenceLocator: 'SOURCE_REGISTRY:honeyhunter-zhao-current-2026-08-05#core-skill',
        value:
          'Frostbite caps at 100; active-character hits grant 6 once per 3s; consuming full Frostbite activates Ether Veil: Wellspring for 40s',
        gameVersion: null,
        unit: null,
      },
      {
        recordId:
          'MECHANICS_AND_FORMULAS:mech-zhao-initial-hp-support:initial_hp_frostbite_wellspring_team_support:initial_hp_frostbite_wellspring_team_support',
        fieldPath: 'initial_hp_frostbite_wellspring_team_support',
        sourceIds: [
          'qq-sheet-2.6-r14028417-local-archive',
          'honeyhunter-zhao-current-2026-08-05',
          'prydwen-zhao-current-2026-08-05',
        ],
        evidenceLocator: 'SOURCE_REGISTRY:prydwen-zhao-current-2026-08-05#core-passive',
        value:
          'Max core grants 1.4% CRIT Rate per 1000 initial Max HP; Ether Veil activation grants team 1000 Combat ATK for 50s; Additional Ability scales team DMG from initial HP up to 40% at 27000',
        gameVersion: null,
        unit: null,
      },
      {
        recordId: 'ENTITY_FACTS:fact-zhao-core-levels:core.levels:batch-agents-2.5-r3e',
        fieldPath: 'core.levels',
        sourceIds: ['honeyhunter-zhao-current-2026-08-05'],
        evidenceLocator: 'SOURCE_REGISTRY:honeyhunter-zhao-current-2026-08-05#core-skill',
        value: zhaoCore,
        gameVersion: 'current',
        unit: 'none',
      },
    ],
    effects: [
      {
        channel: 'combat_attack_flat',
        recipient: 'team',
        trigger: 'Full Frostbite is consumed and Ether Veil: Wellspring is activated.',
        value: { maxCoreFlatCombatAttack: 1000 },
        durationSeconds: 50,
        levelBoundary:
          'The retained wording is a maximum-core value. No lower-core magnitude is admitted.',
        consumerBoundary:
          'This is a finite Combat ATK channel. Frostbite cadence and rotation uptime remain outside this fact.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: false,
          teamPredicate: null,
          runtimeStateIds: [],
          requiresCombatTrigger: true,
          magnitudeBoundary: 'max_core_only',
        },
        reviewedSource: zhaoSource(
          'Kit > Core Passive (max-core magnitude in L3 core.levels); Review > Core Passive & Additional Ability',
          '1000 Combat ATK at max core; 50 s',
        ),
      },
      {
        channel: 'all_damage_bonus',
        recipient: 'team',
        trigger: 'Zhao Additional Ability is active while Zhao is within any Ether Veil.',
        value: {
          additionalAbilityBaseRatio: 0.1,
          additionalAbilityMaximumRatio: 0.4,
          initialMaxHpAboveBase: 15000,
          initialMaxHpPerAdditionalPercent: 400,
          initialMaxHpAtMaximum: 27000,
        },
        durationSeconds: null,
        levelBoundary:
          'This Additional Ability is not core-level dependent. Source base, step, and ceiling are retained for provenance; BOX only admits channel presence and does not interpolate HP values.',
        consumerBoundary:
          'Expose channel presence and a source-bound ceiling only. BOX does not calculate HP thresholds, intermediate values, or Ether Veil uptime.',
        eligibility: {
          minimumMindscape: 0,
          additionalAbilityRequired: true,
          teamPredicate: {
            kind: 'category_sum_minimum',
            agentId: 'agent-zhao',
            terms: [
              { kind: 'specialty', value: 'damage' },
              { kind: 'specialty', value: 'anomaly' },
              { kind: 'specialty', value: 'support' },
            ],
            minimum: 1,
            dynamicTerms: [],
          },
          runtimeStateIds: ['any-ether-veil'],
          requiresCombatTrigger: false,
          magnitudeBoundary: 'core_independent',
        },
        reviewedSource: zhaoSource(
          'Kit > Additional Ability: Crystallization',
          '10% base team DMG; +1 percentage point per 400 initial Max HP above 15000; 40% cap at 27000',
        ),
      },
    ],
    boundary:
      'Historical unnumbered rows remain source-bound; selected 3.1 max-core and Additional fields match the pinned snapshot. No uptime, HP interpolation, rotation or DPS claim is made.',
  },
  {
    agentId: 'agent-norma',
    targetVersionStatus: 'selected_3.1_fields_compared',
    requiredRows: [
      {
        recordId:
          'MECHANICS_AND_FORMULAS:mech-norma-tech-divide:direct_stun_window:direct_stun_window',
        fieldPath: 'direct_stun_window',
        sourceIds: [
          'prydwen-norma-2026-07-29',
          'icyveins-norma-team-2026-07-28',
          'honeyhunter-norma-current-2026-08-05',
        ],
        evidenceLocator: 'SOURCE_REGISTRY:prydwen-norma-2026-07-29#additional-ability:94-103',
        value:
          'Norma, creations or Combat Bangboo apply 1 stack per 0.5s; each stack +3% Stun DMG Multiplier, max 10; any stack extends Stun by 2s; clear after recovery',
        gameVersion: null,
        unit: null,
      },
      {
        recordId:
          'ENTITY_FACTS:fact-norma-formula-family:mechanics.formula_family:batch-agent-norma-r2d',
        fieldPath: 'mechanics.formula_family',
        sourceIds: ['honeyhunter-norma-current-2026-08-05'],
        evidenceLocator: 'SOURCE_REGISTRY:honeyhunter-norma-current-2026-08-05#mechanics:367-446',
        value: 'direct_stun_window',
        gameVersion: '3.0',
        unit: 'none',
      },
    ],
    effects: [
      {
        channel: 'enemy_stun_damage_multiplier',
        recipient: 'enemy',
        trigger:
          'Additional Ability active through an Attack, Rupture, or same-faction teammate; hits must come from Norma, her creations, or a Combat Bangboo.',
        value: { ratioPerStack: 0.03, maximumStacks: 10, minimumSecondsBetweenStacks: 0.5 },
        durationSeconds: null,
        levelBoundary: 'The retained Additional Ability fact has no core-level dependency.',
        consumerBoundary:
          'The source calls this Stun DMG Multiplier. It is not admitted as global team damage or enemy DEF reduction.',
        eligibility: {
          ...normaAdditionalEligibility,
          runtimeStateIds: ['tech-divide-on-enemy'],
        },
        reviewedSource: normaSource(
          'Kit > Additional Ability: Advantage in Numbers, Tech Divide',
          '+3 percentage points Stun DMG Multiplier per stack; max 10 stacks; 0.5 s stack interval',
        ),
      },
      {
        channel: 'enemy_stun_duration',
        recipient: 'enemy',
        trigger: 'At least one admitted Tech Divide stack is present during the Stun window.',
        value: { extensionSeconds: 2 },
        durationSeconds: null,
        levelBoundary: 'The retained Additional Ability fact has no core-level dependency.',
        consumerBoundary:
          'The extension is a Stun-window property and does not stack with similar duration effects. Tech Divide clears on Stun recovery. BOX does not simulate stack ownership or Combat Bangboo cadence.',
        eligibility: {
          ...normaAdditionalEligibility,
          runtimeStateIds: ['tech-divide-on-enemy', 'enemy-becomes-stunned'],
        },
        reviewedSource: normaSource(
          'Kit > Additional Ability: Advantage in Numbers, Tech Divide',
          '+2 s Stun duration; non-stacking with similar effects',
        ),
      },
      {
        channel: 'all_damage_bonus',
        recipient: 'team',
        trigger: 'Norma Additional Ability is active while En-Nah Barrage is active.',
        stateId: 'en-nah-barrage',
        value: { teamDamageBonusRatio: 0.2 },
        durationSeconds: null,
        levelBoundary: 'The Additional Ability DMG bonus is independent of core level.',
        consumerBoundary:
          'The 20% team DMG bonus only exists in the En-Nah Barrage state; BOX does not assume its uptime.',
        eligibility: {
          ...normaAdditionalEligibility,
          runtimeStateIds: ['en-nah-barrage'],
        },
        reviewedSource: normaSource(
          'Kit > Additional Ability: Advantage in Numbers, En-Nah Barrage; EX Special Attack: En-Nah Barrage',
          '+20% team DMG while state is active; base state 32 s, extendable',
        ),
      },
    ],
    boundary:
      'Historical 3.0 rows remain source-bound; selected 3.1 Additional fields match the pinned snapshot. BOX uses channel presence without numeric or uptime simulation; unrelated core conversion values remain excluded.',
  },
  ...additionalSupportDefinitions,
] as const

function sameStrings(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  )
}

function matchesRequiredRow(actual: EvidenceRow, required: RequiredRow) {
  return (
    actual.recordId === required.recordId &&
    actual.fieldPath === required.fieldPath &&
    actual.evidenceLocator === required.evidenceLocator &&
    actual.value === required.value &&
    actual.gameVersion === required.gameVersion &&
    actual.unit === required.unit &&
    sameStrings(actual.sourceIds, required.sourceIds)
  )
}

export function compileReviewedExternalSupportFacts(
  evidenceProvider: (
    agentId: string,
  ) => L3AgentDevelopmentEvidence | null = getL3AgentDevelopmentEvidence,
): readonly ReviewedExternalSupportFact[] {
  return definitions.flatMap((definition) => {
    const evidence = evidenceProvider(definition.agentId)
    if (!evidence) return []
    const sourceRows = [...evidence.verifiedFacts, ...evidence.candidateFacts]
    const matches = definition.requiredRows.map((required) =>
      sourceRows.filter((actual) => matchesRequiredRow(actual, required)),
    )
    if (matches.some((rows) => rows.length !== 1)) return []
    const rows = matches.map((row) => row[0]!)
    const targetReview = target31Fields.rows.find((row) => row.agentId === definition.agentId)
    if (!targetReview) throw new Error(`Missing selected 3.1 support fields: ${definition.agentId}`)
    const fact: ReviewedExternalSupportFact = {
      schema: 'soda-reviewed-external-support-fact/v2',
      agentId: definition.agentId,
      status: 'source_bound_candidate',
      intendedTargetGameVersion: '3.1',
      targetVersionStatus: definition.targetVersionStatus,
      targetVersionReview: {
        url: `https://static.nanoka.cc/zzz/3.1/zh/character/${targetReview.gameId}.json`,
        sourceVersion: '3.1',
        checkedAt: target31Fields.checkedAt,
        contentSha256: targetReview.sha256,
        selectedFields: targetReview.checks.map((check) => ({
          locator: check.locator,
          coreLevel: check.level,
        })),
        matchedClauses: targetReview.checks.reduce(
          (count, check) => count + check.contains.length,
          0,
        ),
        boundary: target31Fields.boundary,
      },
      sourcePackageId: evidence.packageId,
      sourcePackageSha256: evidence.manifestSha256,
      sourceRecordIds: rows.map((row) => row.recordId),
      sourceFieldPaths: rows.map((row) => row.fieldPath),
      sourceIds: [...new Set(rows.flatMap((row) => row.sourceIds))],
      sourceLocators: rows.map((row) => row.evidenceLocator as string),
      sourceVersions: [
        ...new Set(rows.flatMap((row) => (row.gameVersion ? [row.gameVersion] : []))),
      ],
      sourceUnits: rows.map((row) => row.unit),
      sourceEvidenceHash: stableContentHash(rows),
      effects: definition.effects,
      boundary: definition.boundary,
    }
    return [Object.freeze(fact)]
  })
}

export const reviewedExternalSupportFacts = Object.freeze(compileReviewedExternalSupportFacts())

export function getReviewedExternalSupportFact(
  agentId: string,
): ReviewedExternalSupportFact | null {
  return reviewedExternalSupportFacts.find((fact) => fact.agentId === agentId) ?? null
}

export function getReviewedExternalSupportChannels(
  agentId: string,
): readonly ReviewedExternalSupportChannel[] {
  return getReviewedExternalSupportFact(agentId)?.effects.map((effect) => effect.channel) ?? []
}

export const reviewedExternalSupportFactsFingerprint = stableContentHash(
  reviewedExternalSupportFacts,
)
