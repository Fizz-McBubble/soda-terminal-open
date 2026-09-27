import { z } from 'zod'

export const discSlotSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
])

export const statKeySchema = z.enum([
  'hp_flat',
  'hp_percent',
  'atk_flat',
  'atk_percent',
  'def_flat',
  'def_percent',
  'crit_rate',
  'crit_dmg',
  'anomaly_proficiency',
  'pen',
  'pen_ratio',
  'impact',
  'anomaly_mastery',
  'energy_regen',
  'physical_dmg',
  'fire_dmg',
  'ice_dmg',
  'electric_dmg',
  'wind_dmg',
  'ether_dmg',
])

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  faction: z.string().min(1),
  specialty: z.enum(['attack', 'anomaly', 'stun', 'support', 'defense', 'rupture']),
  attribute: z.enum(['physical', 'fire', 'ice', 'electric', 'wind', 'ether', 'auric-ink']),
  rarity: z.enum(['A', 'S']),
  version: z.string().min(1),
})

export const driveDiscSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  englishName: z.string().min(1).optional(),
  aliases: z.array(z.string().min(1)).default([]),
  twoPieceEffect: z.string().min(1),
  fourPieceEffect: z.string().min(1),
  version: z.string().min(1),
  evidenceOnly: z.boolean().default(false),
})

const statRuleSchema = z.object({
  stat: statKeySchema,
  unit: z.enum(['flat', 'percent']),
  baseValue: z.number().positive(),
})

export const driveDiscDataManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  gameVersion: z.string().min(1),
  dataVersion: z.string().min(1),
  updatedAt: z.string().datetime(),
  contentHash: z.string().min(1),
  sources: z.array(
    z.object({
      id: z.string().min(1),
      url: z.string().url(),
      note: z.string().min(1),
    }),
  ),
  driveDiscSets: z.array(driveDiscSetSchema),
  rules: z.object({
    maxLevelByRarity: z.record(z.enum(['B', 'A', 'S']), z.number().int().positive()),
    mainStatsBySlot: z.record(z.string(), z.array(statKeySchema).min(1)),
    mainStatBaseByRarity: z.record(z.enum(['B', 'A', 'S']), z.array(statRuleSchema)),
    subStatStepsByRarity: z.record(z.enum(['B', 'A', 'S']), z.array(statRuleSchema)),
  }),
})

export const driveDiscImportSourceSchema = z.object({
  adapter: z.string().min(1),
  sourceId: z.string().min(1).optional(),
  sourceFile: z.string().min(1).optional(),
  capturedAt: z.string().datetime().optional(),
  detailPanel: z
    .object({
      resolution: z.string().min(1).optional(),
      region: z.string().min(1).optional(),
    })
    .optional(),
})

export const driveDiscSchema = z.object({
  id: z.string().min(1),
  setId: z.string().min(1),
  slot: discSlotSchema,
  level: z.number().int().min(0).max(15),
  rarity: z.enum(['A', 'S']).optional(),
  mainStat: statKeySchema,
  subStats: z
    .array(
      z.object({
        stat: statKeySchema,
        value: z.number().nonnegative(),
        upgrades: z.number().int().min(0).max(5),
      }),
    )
    .max(4),
  locked: z.boolean().default(false),
  favorite: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(12)).max(8).default([]),
  discVersion: z.string().min(1).optional(),
  importBatchId: z.string().min(1).optional(),
  importFingerprint: z.string().min(1).optional(),
  importSource: driveDiscImportSourceSchema.optional(),
  evaluationSnapshot: z.unknown().optional(),
  previousEvaluationSnapshot: z.unknown().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  dataVersion: z.string().min(1),
})

export const discEvaluationStatusSchema = z.enum([
  'valid',
  'stale',
  'pending',
  'failed',
  'needs_review',
])

export const discEvaluationSchema = z.object({
  id: z.string().min(1),
  discId: z.string().min(1),
  discVersion: z.string().min(1),
  templateId: z.string().min(1),
  templateVersion: z.string().min(1),
  templateContentHash: z.string().min(1),
  ruleVersion: z.string().min(1),
  ruleContentHash: z.string().min(1),
  gameDataVersion: z.string().min(1),
  evaluatedAt: z.string().datetime(),
  status: discEvaluationStatusSchema,
  source: z.enum(['manual', 'migration', 'automatic']),
  snapshot: z.unknown().optional(),
  failureMessage: z.string().min(1).optional(),
})

export const buildProfileSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  name: z.string().trim().min(1),
  role: z.enum(['damage', 'anomaly', 'stun', 'support', 'defense']),
  statWeights: z.record(z.string(), z.number().min(0).max(1)),
  version: z.string().min(1),
  isDefault: z.boolean(),
  sourceTemplateId: z.string().min(1).nullable().default(null),
  archived: z.boolean().default(false),
  mainStatFit: z.record(z.string(), z.record(z.string(), z.number().min(0).max(1))),
  setFit: z.record(z.string(), z.number().min(0).max(1)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const gameDataManifestSchema = z.object({
  gameVersion: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  agents: z.array(agentSchema),
  driveDiscSets: z.array(driveDiscSetSchema),
})

export type Agent = z.infer<typeof agentSchema>
export type StatKey = z.infer<typeof statKeySchema>
export type DriveDisc = z.infer<typeof driveDiscSchema>
export type DriveDiscImportSource = z.infer<typeof driveDiscImportSourceSchema>
export type DiscEvaluation = z.infer<typeof discEvaluationSchema>
export type DiscEvaluationStatus = z.infer<typeof discEvaluationStatusSchema>
export type DriveDiscSet = z.infer<typeof driveDiscSetSchema>
export type DriveDiscDataManifest = z.infer<typeof driveDiscDataManifestSchema>
export type BuildProfile = z.infer<typeof buildProfileSchema>
export type GameDataManifest = z.infer<typeof gameDataManifestSchema>
