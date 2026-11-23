import { z } from 'zod'

export const personalMiyabiShimotsukiDeclarationSchema32 = z
  .object({
    fallenFrost: z.literal(6),
    completeContact: z.literal(true),
    sourceRefs: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
export type PersonalMiyabiShimotsukiDeclaration32 = z.infer<
  typeof personalMiyabiShimotsukiDeclarationSchema32
>
