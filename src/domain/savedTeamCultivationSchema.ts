import { z } from 'zod'

const skill = z.number().int().min(1).max(16).nullable()
export const savedTeamCultivationSchema = z
  .object({
    projectionVersion: z.literal('solve-input/v1').optional(),
    level: z.number().int().min(1).max(60),
    ascension: z.number().int().min(0).max(5).nullable().optional(),
    mindscape: z.number().int().min(0).max(6),
    potentialImage: z.number().int().min(0).max(6).nullable().optional(),
    skillLevels: z
      .object({
        basic: skill,
        dodge: skill,
        assist: skill,
        special: skill,
        chain: skill,
        core: z.number().int().min(1).max(7).nullable(),
      })
      .strict(),
  })
  .strict()
export type SavedTeamCultivation = z.infer<typeof savedTeamCultivationSchema>
