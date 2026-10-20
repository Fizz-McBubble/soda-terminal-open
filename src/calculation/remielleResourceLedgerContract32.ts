import { z } from 'zod'
import { contentHash } from '../application/contentHash'
import { historicalLuminizeSettlementSchema32 } from './luminizeSettlementContract32'
import { reviewedLumifluxMechanicsIdentity32 } from './reviewedLumifluxMechanics32'

const finite = z.number().finite().nonnegative()
const id = z.string().trim().min(1)
const refs = z.array(id).min(1)
export const regularFlare = historicalLuminizeSettlementSchema32.shape.voidflares.element
const stamp = { id, atSeconds: finite }
const action = z.enum([
  'basic.leap.hit1',
  'basic.leap.hit2',
  'basic.leap.hit3',
  'basic.leap.hit4',
  'basic.solo_dance',
  'basic.rainbow',
  'basic.fleeting',
  'ultimate',
])
export const event = z.discriminatedUnion('kind', [
  z.object({ ...stamp, kind: z.literal('battle_entry'), investigationZone: z.boolean() }).strict(),
  z.object({ ...stamp, kind: z.literal('combat_exit') }).strict(),
  z
    .object({
      ...stamp,
      kind: z.literal('special_completed'),
      stanceShift: z.boolean(),
      hitStunnedEnemy: z.boolean(),
    })
    .strict(),
  z.object({ ...stamp, kind: z.literal('switch_out'), specialEventId: id.optional() }).strict(),
  z
    .object({
      ...stamp,
      kind: z.literal('switch_in'),
      method: z.enum(['normal', 'chain']),
      assistHit: z.boolean(),
      reflectionAfterAssist: z.enum(['present', 'absent', 'unknown']),
    })
    .strict(),
  z.object({ ...stamp, kind: z.literal('teammate_refringe'), flare: regularFlare }).strict(),
  z
    .object({ ...stamp, kind: z.literal('completed_action'), actionKey: action, hit: z.boolean() })
    .strict(),
  // This is an effective resource-clock increment, not a wall-clock inference.
  z
    .object({ ...stamp, kind: z.literal('phase_clock'), elapsedSeconds: finite.positive() })
    .strict(),
  // Autonomous outcomes must be observed/declared; M2 never synthesizes a cadence.
  z
    .object({
      ...stamp,
      kind: z.literal('autonomous_hit'),
      /** Actual Remielle Phase Flow bullet event; timestamps remain explicit observations. */
      animationEventId: z.literal('RemielleOrigin_Skill01_AirState_Back_Explode_01').optional(),
      targetId: id,
      lumifluxPoints: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    })
    .strict(),
])

export const declaredRemielleResourceLedgerSchema32 = z
  .object({
    contract: z.literal('soda-declared-remielle-resource-ledger32/v1'),
    sourceIdentityHash: id,
    rulesIdentityHash: id,
    sourceRefs: refs,
    durationSeconds: finite.positive(),
    initialRadiance: finite,
    memberAgentIds: z.array(id).min(2).max(3),
    mindscape: finite.int().max(6),
    initial: z
      .object({
        inCombat: z.boolean(),
        onField: z.boolean(),
        luminousReflection: z.enum(['present', 'absent', 'unknown']),
        voidflares: z.array(regularFlare).max(3),
      })
      .strict(),
    events: z.array(event),
  })
  .strict()

export type DeclaredRemielleResourceLedger32 = z.infer<
  typeof declaredRemielleResourceLedgerSchema32
>
export const remielleResourceLedgerRules32 = Object.freeze({
  source: reviewedLumifluxMechanicsIdentity32.source,
  voidflareCap: 3,
  refringesToUnlockAssist: 3,
  entrySpecialFlareInvestigationCooldown: 180,
  m1AssistDecibelGain: 200,
  m1AssistDecibelCooldown: 18,
  m6SpecialFlareStrength: 0.25,
  mindscapeTwoAutonomousDamage: {
    amplifyRatio: 0.25,
    abloomDamageRatio: 3.3,
    defenseIgnoreRatio: 0.15,
    defenseIgnoreCondition:
      'target has RemielleOrigin_FadingTarget; attacker specialty is anomaly; damage type is AbnormalDamage',
    cadenceSeconds: null,
    source: [
      {
        path: 'Data/_unsorted/RemielleOrigin_Talent_02.json',
        sha256: 'B150801A301B6EFD1BFF9DFFD9143770E47E69654411B2A005F5AA1418BEF9EB',
        locator:
          '/AbilitySpecials/AS_AmplifyRatio_Talent02; /Modifiers/Remielle_Talent02_TeamModifier',
      },
      {
        path: 'Data/_unsorted/RemielleOrigin_CardS3_Base_01.json',
        sha256: '44E8FF0DB894FAB8E0CBC9360CD7A6DCB1A5107AA240412DB23A25B85BDBA42E',
        locator: '/AbilitySpecials/AS_Abloom_DamageRatio',
      },
    ],
    boundary:
      'M2 damage amplification and conditional defense ignore are sourced; autonomous attack cadence remains null and the total anomaly damage still requires target, AP and additional runtime inputs.',
  },
  locators: [
    'special.SpecialAttackOdeToDawnRadiantTurn.desc.0-4',
    'core.desc.*.1,4',
    'assist.AssistFlowerFeatherDance.desc.1',
    'chain.ChainAttackInterwovenDanceSteps.desc.2',
    'mindscapes.1.desc',
    'mindscapes.4.desc',
    'mindscapes.6.desc',
  ],
  cadence: {
    status: 'version_conflict',
    text: 'M2 increases autonomous frequency',
    observation:
      'Leifa v3.1.0 Release 2026-07-27: roughly 5 seconds; M2 frequency increase not observed',
    currentRelease: {
      url: 'https://zzz.gachabase.net/agents/1581/remielle/release/3.2.0/19437730?lang=en',
      designRevision: 19437730,
      resourceRevision: 19437730,
      pageSha256: 'A57B299788CAEB2A6501004E77FD58F73987B3E4D80AAB34E205CD2568A78D48',
      text: 'M2 states that Phase Flow autonomous attack frequency increases; no numeric interval is present.',
      numericInterval: null,
    },
    intervalSeconds: null,
  },
  autonomousAction: {
    eventId: 'RemielleOrigin_Skill01_AirState_Back_Explode_01',
    role: 'Phase Flow Skill01 AirState_Back bullet explosion; observed event only',
    source: [
      {
        path: 'Data/_unsorted/RemielleOrigin_CardS3_Base_01.json',
        blobSha1: '5770030691362130f2e94c59a7f029efe5aa2817',
        sha256: '44E8FF0DB894FAB8E0CBC9360CD7A6DCB1A5107AA240412DB23A25B85BDBA42E',
        locator:
          '/AbilityMixins/0/ConfigList/0/AnimatorStateName; /Modifiers/CardS3Base01_Explode01_HitListener/OnHitOther/0/Predicates/0/AnimEventIDs/0',
      },
      {
        path: 'Data/_unsorted/RemielleOrigin_Skill01_AirState_Back_Bullet.json',
        blobSha1: 'ee6671f1a47459cbeb74266e7fc72e054495fc23',
        sha256: '75D9C61E19B619A4BD60F9C599A16371382CFC5C9772291A4129ADE9F311C6A6',
        locator: '/AbilityMixins/0/BulletMixin/ExplodeAnimEventID',
      },
      {
        path: 'Data/_unsorted/RemielleOrigin_Skill01_AirState_Back_BulletEmitter.json',
        blobSha1: '8f477300d492a629a4829b33aaa7d7cdba2f8b76',
        sha256: 'E6C2468C34ED87863D04593A87BE897103D94199B54F3210C1CA155256027A93',
        locator: '/AbilityMixins/0/BulletEmitterMixin/BulletAbilityName',
      },
      {
        path: 'Data/_unsorted/RemielleOrigin_AirMode_BackStage.json',
        blobSha1: '454dba70418ef5d53937a8cf35c4f88de96ae4fd',
        sha256: 'B7D5028B481FDF165BE48C720770BDAA67BD399D4CC7C0AAD29EED8C93DEC6BB',
        locator:
          '/AbilityMixins/8-11/ConfigList/0/AnimatorStateName; /DefaultModifier/OnAttackLanded/0-3/Predicates/0/AnimEventIDs',
      },
    ],
    boundary:
      'The bound explosion has a 330% Abloom coefficient. Event selection probability, target-selection policy, total damage, and attack cadence remain separate unresolved inputs.',
  },
} as const)

export const remielleResourceLedgerRulesHash32 = contentHash(remielleResourceLedgerRules32)
