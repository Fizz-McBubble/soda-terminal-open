import { z } from 'zod'

const time = z.number().finite().nonnegative()
export const preparedYanagiPolaritySchema32 = z
  .object({
    kind: z.literal('yanagi_ex_single_polarity'),
    acceptedSingleOwnerOriginalAnomaly: z.literal(true),
    snapshotBasis: z.literal('current_declared_panels'),
    originalOwnerAgentId: z.string().trim().min(1),
    applicationAtSeconds: time,
    activeUntilSeconds: time,
    endedAtSeconds: time.nullable(),
    triggerAtSeconds: time,
    sourceRefs: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
export type PreparedYanagiPolarity32 = z.infer<typeof preparedYanagiPolaritySchema32>
