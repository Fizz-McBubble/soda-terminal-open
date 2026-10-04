import { z } from 'zod'
import { statKeySchema } from '../domain/schemas'

const portfolioBuildSourceSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().min(1),
    sourceVersion: z.string().nullable(),
    checkedAt: z.string().min(1),
    contentHash: z.string().min(1),
    licenseBoundary: z.string().min(1),
    verified: z.boolean(),
  })
  .strict()

const portfolioSetPlanSchema = z
  .object({
    pattern: z.enum(['4+2', '2+2+2']),
    primarySetIds: z.array(z.string().min(1)),
    secondarySetIds: z.array(z.string().min(1)),
    sourceText: z.string().optional(),
    priority: z.number().optional(),
    purpose: z.enum(['recommended', 'conditional', 'transition', 'historical']).optional(),
    condition: z
      .object({
        sourceId: z.string().min(1),
        sourceUrl: z.string().min(1),
        sourceTextVerified: z.boolean(),
        sourceVersion: z.string().optional(),
        contentHash: z.string().optional(),
        rule: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('teammate'), agentId: z.string().min(1) }).strict(),
          z.object({ kind: z.literal('teammate_four_piece'), setId: z.string().min(1) }).strict(),
          z
            .object({ kind: z.literal('teammate_not_four_piece'), setId: z.string().min(1) })
            .strict(),
          z.object({ kind: z.literal('electric_team') }).strict(),
          z
            .object({
              kind: z.literal('teammate_specialty_and_action'),
              specialties: z.array(z.enum(['attack', 'rupture', 'armorer'])),
              action: z.enum(['wearer_ex_special', 'team_quick_assist']),
            })
            .strict(),
        ]),
      })
      .strict()
      .optional(),
  })
  .strict()

export const portfolioConstraintSchema = z
  .object({
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    gameVersion: z.enum(['3.0', '3.1', '3.2']),
    status: z.enum(['candidate', 'missing']),
    setPlanReadiness: z.discriminatedUnion('status', [
      z
        .object({
          status: z.literal('executable'),
          pattern: z.enum(['4+2', '2+2+2']),
          primarySetIds: z.array(z.string().min(1)),
          secondarySetIds: z.array(z.string().min(1)),
        })
        .strict(),
      z
        .object({
          status: z.literal('non_executable'),
          reason: z.enum(['missing_secondary_set', 'unresolved_set_roles']),
          missingEvidence: z.string().min(1),
        })
        .strict(),
    ]),
    sources: z.array(portfolioBuildSourceSchema),
    setIds: z.array(z.string().min(1)),
    setPlans: z.array(portfolioSetPlanSchema).optional(),
    unresolvedSetDirections: z.array(z.string()).optional(),
    mainStats: z
      .object({
        4: z.array(statKeySchema).optional(),
        5: z.array(statKeySchema).optional(),
        6: z.array(statKeySchema).optional(),
      })
      .strict(),
    mainStatAlternatives: z
      .array(
        z
          .object({
            slot: z.enum(['4', '5', '6']),
            stats: z.array(statKeySchema),
            purpose: z.enum([
              'transition',
              'personal_damage',
              'anomaly_support',
              'short_fight',
              'secondary',
            ]),
            condition: z.string(),
            automaticEligibility: z.literal(false),
            source: portfolioBuildSourceSchema,
          })
          .strict(),
      )
      .optional(),
    subStatWeights: z.partialRecord(statKeySchema, z.number()),
    wEngineDirections: z.array(z.string()),
    teamAndBangbooPreconditions: z.array(z.string()),
    progressionDirection: z.array(z.string()),
    targetPanel: z
      .object({
        level: z.literal(60),
        values: z.partialRecord(
          z.enum(['atk', 'hp', 'def', 'critRate', 'critDamage']),
          z.union([
            z.number(),
            z
              .object({
                min: z.number(),
                max: z.number().optional(),
                upperOpen: z.boolean().optional(),
              })
              .strict(),
          ]),
        ),
        conditions: z.array(z.string()),
        sourceIds: z.array(z.string().min(1)),
        label: z.literal('guide_reference_range'),
      })
      .strict()
      .optional(),
    gaps: z.array(z.string()),
    boundary: z.string(),
    contentHash: z.string().min(1),
  })
  .strict()
