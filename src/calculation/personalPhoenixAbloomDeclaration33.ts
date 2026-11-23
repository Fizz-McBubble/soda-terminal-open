import { z } from 'zod'

const time = z.number().finite().nonnegative()
export const personalPhoenixAbloomDeclarationSchema33 = z
  .object({
    acceptedSingleOwnerOriginalAnomaly: z.literal(true),
    snapshotBasis: z.literal('current_declared_panels'),
    originalActiveAtTrigger: z.literal(true),
    targetConditionsUnchanged: z.literal(true),
    originalAppliedAtSeconds: time,
    scorchAppliedAtSeconds: time,
    triggerAtSeconds: time,
    sourceRefs: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
export type PersonalPhoenixAbloomDeclaration33 = z.infer<
  typeof personalPhoenixAbloomDeclarationSchema33
>
