import { z } from 'zod'

/** Transport/saved facts only. No source selection or rating logic in the UI. */
export const formedTeamReferenceSchema = z
  .object({
    policy: z.literal('formed-team-reviewed-key-mindscapes/v1'),
    gameVersion: z.string().min(1),
    identity: z.string().regex(/^fnv1a-[0-9a-f]+$/),
    members: z
      .array(
        z
          .object({
            agentId: z.string().min(1),
            level: z.literal(60),
            mindscape: z.number().int().min(0).max(6),
            potential: z.number().int().min(0).max(6).nullable(),
            baseSkillLevel: z.literal(11),
            coreLevel: z.literal(7),
            reason: z.string().min(1),
          })
          .strict(),
      )
      .length(3)
      .refine((rows) => new Set(rows.map((row) => row.agentId)).size === 3),
  })
  .strict()

export type FormedTeamReference = z.infer<typeof formedTeamReferenceSchema>
