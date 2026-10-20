import { z } from 'zod'

const text = z.string().trim().min(1)
/** Accepted hit occurrences in this single-target comparison, not a resource or rotation proof. */
export const publicTriggerAftershockWindowSchema32 = z
  .object({
    sourceIdentityHash: text,
    targetId: text,
    hitOccurrenceIds: z.array(text).min(1),
    /** Explicit comparison starting state; omission leaves pre-hit history unknown. */
    initialState: z.literal('inactive').optional(),
    sourceRefs: z.array(text).min(1),
  })
  .strict()

export type PublicTriggerAftershockWindow32 = z.infer<typeof publicTriggerAftershockWindowSchema32>
