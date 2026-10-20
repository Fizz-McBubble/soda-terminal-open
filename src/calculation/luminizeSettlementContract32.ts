import { z } from 'zod'
import { reviewedLumifluxMechanicsHash32 } from './reviewedLumifluxMechanics32'

const finite = z.number().finite()
const id = z.string().trim().min(1)
const refs = z.array(id).min(1)
const attribute = z.enum(['physical', 'fire', 'ice', 'electric', 'ether', 'wind'])

/** Stored teammate factors before Refringe, never a precomputed damage value.
 * Skill/anomaly-specific multipliers and critical effects are deliberately not
 * accepted as generic stored ATK/DMG/PEN. The settlement is noncritical. */
export const historicalLuminizeSettlementSchema32 = z
  .object({
    contract: z.literal('soda-declared-luminize-settlement32/v1'),
    sourceIdentityHash: id,
    authority: z.literal('declared_unrefringed_snapshots'),
    eventId: id,
    targetId: id,
    atSeconds: finite.nonnegative(),
    memberAgentIds: z.array(id).min(2).max(3),
    skill: z.enum(['rainbows_end', 'fleeting_grace', 'ultimate', 'flower_feather']),
    effectiveSkillLevel: finite.int().min(1).max(16),
    remielle: z
      .object({
        agentId: z.literal('agent-remielle'),
        coreLevel: finite.int().min(1).max(7),
        mindscape: finite.int().min(0).max(6),
        anomalyProficiency: finite.nonnegative(),
        generalAnomalyDamageBonus: finite.nonnegative(),
        prismaticDefenseIgnoreWindow: z.boolean(),
        sourceRefs: refs,
      })
      .strict(),
    voidflares: z
      .array(
        z
          .object({
            id,
            ownerAgentId: id,
            attribute,
            snapshotAtSeconds: finite.nonnegative(),
            stats: z
              .object({
                attackerLevel: finite.int().min(1).max(60),
                attack: finite.positive(),
                anomalyProficiency: finite.nonnegative(),
                damageBonus: finite.min(-1),
                penetrationRatio: finite.min(0).max(1),
                penetrationFlat: finite.nonnegative(),
              })
              .strict(),
            /** The coefficient stored with this flare, not today's AP. */
            storedRefringeCoefficient: finite.nonnegative(),
            sourceRefs: refs,
          })
          .strict(),
      )
      .min(1)
      .max(3),
    target: z
      .object({
        enemyDefense: finite.nonnegative(),
        resistanceByAttribute: z.partialRecord(attribute, finite),
        resistanceReductionByAttribute: z.partialRecord(attribute, finite),
        defenseReduction: finite.min(0).max(1),
        vulnerability: finite.min(-1),
        stunMultiplier: finite.positive(),
        sourceRefs: refs,
      })
      .strict(),
    sourceRefs: refs,
  })
  .strict()

/** Restore older declarations intact; current evaluation still requires its own source pin. */
export const declaredLuminizeSettlementSchema32 = historicalLuminizeSettlementSchema32.extend({
  sourceIdentityHash: z.literal(reviewedLumifluxMechanicsHash32),
})

export type DeclaredLuminizeSettlement32 = z.infer<typeof declaredLuminizeSettlementSchema32>
