import { z } from 'zod'

export const personalOrdinaryAnomalyDeclarationSchema32 = z
  .object({
    acceptedSingleOwnerSettlement: z.literal(true),
    sourceRefs: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
export type PersonalOrdinaryAnomalyDeclaration32 = z.infer<
  typeof personalOrdinaryAnomalyDeclarationSchema32
>
