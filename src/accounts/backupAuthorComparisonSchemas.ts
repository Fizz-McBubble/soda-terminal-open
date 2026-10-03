import { z } from 'zod'

/** Stored membership evidence is revalidated by the private replay producer. */
export const authorComparisonMembershipSchema = z
  .object({
    explicitSelectionOnly: z.literal(true),
    observationRole: z.literal('author_comparison_setup'),
    sourceVersion: z.literal('3.2'),
    conditions: z.array(z.string()),
    equipmentConditions: z.array(
      z.object({ agentId: z.string(), sourceEquipmentName: z.string() }).strict(),
    ),
    fingerprint: z.string().min(1),
  })
  .strict()

export const authorComparisonAccountFactBindingSchema = z
  .object({
    kind: z.literal('account_fact_binding'),
    bangbooId: z.null(),
    sourceFingerprint: z.string().min(1),
    memberIds: z.array(z.string().min(1)).length(3),
    accountEquipmentHash: z.string().min(1),
    fingerprint: z.string().min(1),
  })
  .strict()

export function refineAuthorComparisonBangbooIdentity(
  execution: {
    bangbooId: string | null
    authorComparisonMembership?: unknown
    bangbooStar?: number
  },
  context: z.RefinementCtx,
) {
  if (
    execution.bangbooId === null &&
    (!execution.authorComparisonMembership || execution.bangbooStar !== undefined)
  )
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bangbooId'],
      message: '未纳入邦布的执行须保留作者比较成员证明，且不得有占位星级。',
    })
}
