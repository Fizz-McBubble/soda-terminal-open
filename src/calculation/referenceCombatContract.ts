import { z } from 'zod'
import { resolvedCombatSettlementSchema } from './resolvedCombatSettlement'

const id = z.string().trim().min(1)
const finite = z.number().finite()
const nonnegative = finite.nonnegative()
const refs = z.array(id).min(1)
const window = { start: nonnegative, end: finite.positive() }
const ordinaryAnomalySnapshotSchema = z.object({
  attackerLevel: z.number().int().min(1).max(60), attack: finite.positive(),
  anomalyProficiency: nonnegative, anomalyBaseBonus: finite, flatAnomalyDamage: finite,
  anomalyCritRate: nonnegative, anomalyCritDamage: nonnegative, damageBonus: finite,
  buffBonus: finite, directDamageBonus: finite, defenseIgnore: finite,
  penetrationRatio: nonnegative, penetrationFlat: nonnegative, resistanceIgnore: finite,
}).strict()

export const referenceCombatStatsSchema = z
  .object({
    attack: finite.positive(),
    baseAttack: finite.positive().optional(),
    defense: finite.positive().optional(),
    baseDefense: finite.positive().optional(),
    lacerationDamage: nonnegative.optional(),
    sharpDamageBonus: finite.optional(),
    critRate: nonnegative,
    critDamage: nonnegative,
    anomalyProficiency: nonnegative,
    penetrationRatio: nonnegative,
    penetrationFlat: nonnegative,
    damageBonus: nonnegative,
    sheerForce: finite.positive().optional(),
    sheerForceAttackRatio: nonnegative.optional(),
  })
  .strict()

export const referenceModifierKeys = [
  'attackPercent',
  'attackFlat',
  'defensePercent',
  'defenseFlat',
  'lacerationDamage',
  'sharpDamageBonus',
  'flatDamage',
  'critRate',
  'critDamage',
  'damageBonus',
  'anomalyProficiency',
  'anomalyBaseBonus',
  'flatAnomalyDamage',
  'buffBonus',
  'directDamageBonus',
  'anomalyCritRate',
  'anomalyCritDamage',
  'vulnerability',
  'defenseReduction',
  'defenseIgnore',
  'resistanceReduction',
  'resistanceIgnore',
  'penetrationRatio',
  'penetrationFlat',
  'sheerForce',
  'sheerDamageBonus',
] as const

/** A declared, finite rotation. No account inventory, Bangboo or automatic APL input. */
export const referenceCombatInputSchema = z
  .object({
    caseId: id,
    // Optional for legacy calculation drafts; required for rating evidence.
    playId: id.optional(),
    gameVersion: id,
    protocolId: id,
    buildPolicyId: id,
    scenario: z
      .object({
        id,
        durationSeconds: finite.positive(),
        enemyDefense: nonnegative,
        enemyResistance: finite,
      })
      .strict(),
    sources: z
      .array(
        z
          .object({
            id,
            kind: z.enum([
              'verified_definition',
              'reference_policy',
              'unverified',
              'semantic_fixture',
            ]),
            sourceVersion: id,
            targetVersion: id,
            ref: id,
            continuityRef: id.optional(),
          })
          .strict(),
      )
      .min(1),
    members: z
      .array(
        z
          .object({
            agentId: id,
            level: z.number().int().min(1).max(60),
            buildPolicyId: id,
            buildHash: id,
            stats: referenceCombatStatsSchema,
            sourceRefs: refs,
          })
          .strict(),
      )
      .length(3),
    actions: z
      .array(
        z
          .object({
            id,
            ownerAgentId: id,
            ...window,
            // A swap cancel may end field occupancy before its damage animation ends.
            fieldEnd: nonnegative,
            sourceRefs: refs,
          })
          .strict(),
      )
      .min(1),
    events: z
      .array(
        z
          .object({
            id,
            actionId: id,
            ownerAgentId: id,
            at: nonnegative,
            // Native landing order resolves contacts sharing the same timestamp.
            contactOrder: z.number().int().nonnegative().optional(),
            kind: z.enum(['direct', 'anomaly', 'sheer', 'sharp']),
            scalingAttribute: z.enum(['attack', 'defense', 'sheerForce']).optional(),
            attribute: z.enum(['physical', 'fire', 'ice', 'electric', 'ether', 'wind']).optional(),
            multiplier: finite.positive(),
            hitCount: z.number().int().positive(),
            tags: z.array(id),
            // Anomaly/disorder can retain the original owner's attacker snapshot.
            snapshotAt: nonnegative.optional(),
            ownership: z.enum(['action_owner', 'sourced_off_field']).optional(),
            delayed: z.boolean().optional(),
            mechanicId: id.optional(),
            // Complete rotation adapters supply forward state operands. This
            // path is exclusive with the older effects/snapshot adapter.
            settlement: resolvedCombatSettlementSchema.optional(),
            // Accepted strength-bearing buildup and its original attacker state.
            // Other anomaly families require their own source-qualified adapter.
            anomalyContributions: z.array(z.object({
              id, ownerAgentId: id, buildup: finite.positive(), snapshotAt: nonnegative,
              snapshot: ordinaryAnomalySnapshotSchema, sourceRefs: refs,
            }).strict()).min(1).optional(),
            anomalyDomain: z.discriminatedUnion('kind', [
              z.object({kind:z.literal('ordinary'),anomalyBonus:finite,resistanceReduction:finite,
                anomalyCritRate:nonnegative,anomalyCritDamage:nonnegative}).strict(),
              z.object({kind:z.literal('wind'),baseMultiplier:finite.positive(),anomalyBonus:finite,
                resistanceReduction:finite,anomalyCritRate:nonnegative,anomalyCritDamage:nonnegative}).strict(),
              z.object({kind:z.literal('vortex'),baseMultiplier:finite.positive(),remainingSeconds:nonnegative,additionalMotionValue:finite,
                anomalyBonus:finite,resistanceReduction:finite,anomalyCritRate:nonnegative,
                anomalyCritDamage:nonnegative,refringeMultiplier:finite.positive()}).strict(),
            ]).optional(),
            sourceRefs: refs,
          })
          .strict(),
      )
      .min(1),
    effects: z.array(
      z
        .object({
          id,
          providerAgentId: id,
          activationActionId: id.optional(),
          initial: z.boolean().optional(),
          stackGroup: id.optional(),
          stacking: z.enum(['add', 'refresh', 'max']).optional(),
          maxStacks: z.number().int().positive().optional(),
          recipientAgentIds: z.array(id).min(1),
          ...window,
          requiredTags: z.array(id),
          modifiers: z
            .array(z.object({ key: z.enum(referenceModifierKeys), value: finite }).strict())
            .min(1),
          sourceRefs: refs,
        })
        .strict(),
    ),
    stunWindows: z.array(
      z
        .object({
          ...window,
          activationActionId: id.optional(),
          // A natural stun starts after this contact resolves.
          activationEventId: id.optional(),
          initial: z.boolean().optional(),
          multiplier: finite.min(1),
          sourceRefs: refs,
        })
        .strict(),
    ),
    resources: z.array(
      z
        .object({
          id,
          ownerAgentId: id,
          initial: nonnegative,
          minimum: nonnegative,
          maximum: nonnegative,
          sourceRefs: refs,
        })
        .strict(),
    ),
    resourceChanges: z.array(
      z
        .object({
          id,
          actionId: id,
          resourceId: id,
          at: nonnegative,
          // Explicit ordering for gain/cost at the same instant; array order is irrelevant.
          order: z.number().int().nonnegative(),
          phase: z.enum(['during', 'completion']).optional(),
          ownership: z.enum(['action_owner', 'sourced_off_field']).optional(),
          mechanicId: id.optional(),
          delta: finite,
          sourceRefs: refs,
        })
        .strict(),
    ),
    requiredMechanics: z.array(id),
    coveredMechanics: z.array(id),
    missingInputs: z.array(id),
  })
  .strict()

export type ReferenceCombatInput = z.infer<typeof referenceCombatInputSchema>
export type ReferenceCombatStats = z.infer<typeof referenceCombatStatsSchema>
export type ReferenceModifierKey = (typeof referenceModifierKeys)[number]
export type ReferenceCombatEvent = ReferenceCombatInput['events'][number]

export type ReferenceCombatResult = {
  caseId: string
  status: 'computed' | 'unsupported'
  gameVersion: string
  comparisonKey: string | null
  inputHash: string | null
  totalDamage: number | null
  // Computed does not mean independently validated, nor does it assign a team tier.
  evidenceStatus: 'declared_inputs' | 'unverified_inputs'
  memberDamage: Array<{ agentId: string; damage: number }>
  trace: Array<{
    eventId: string
    ownerAgentId: string
    at: number
    expectedDamage: number
    /** Mixed snapshot arithmetic has no proven per-agent damage allocation. */
    unattributed?: true
    damageOwnerAgentId?: string
    appliedEffectIds: string[]
    stunMultiplier: number
    sourceRefs: string[]
  }>
  resourceLedger: Array<{ resourceId: string; at: number; changeId: string; valueAfter: number }>
  unattributedDamage?: number
  blockers: string[]
  assumptions: string[]
}
