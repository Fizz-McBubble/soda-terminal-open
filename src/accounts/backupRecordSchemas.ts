import { z } from 'zod'
import { accountIdSchema } from './types'

export const accountScopeShape = {
  scopedId: z.string().min(1),
  accountId: accountIdSchema,
  sourceLegacyId: z.string().min(1).nullable(),
  migratedAt: z.string().datetime().nullable(),
}

export const optimizationResultSchema = z.object({
  scopedId: z.string().min(1),
  accountId: accountIdSchema,
  id: z.string().min(1),
  result: z.unknown(),
  createdAt: z.string().datetime(),
  sourceLegacyId: z.string().min(1).nullable(),
})
