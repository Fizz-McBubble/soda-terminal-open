import { z } from 'zod'

export const referenceRatingBands = ['S+', 'S', 'A+', 'A', 'B'] as const
const named = z.string().trim().min(1)
export const teamReferenceIntervalSchema = z
  .object({
    claimId: named,
    lower: z.enum(referenceRatingBands),
    upper: z.enum(referenceRatingBands),
    scope: z.literal('formed_generic_reference'),
    confidence: z.literal('low'),
    sourceRefs: z.array(named).min(1),
    conditions: z.array(named).min(1),
    limitations: z.array(named).min(1),
    rationale: named,
    referenceIdentity: named,
  })
  .strict()
  .refine(
    (value) =>
      referenceRatingBands.indexOf(value.lower) >= referenceRatingBands.indexOf(value.upper),
    'Reference interval endpoints reversed',
  )

export type GenericReferenceInterval = z.infer<typeof teamReferenceIntervalSchema>
