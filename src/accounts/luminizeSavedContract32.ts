import { z } from 'zod'
import { contentHash } from '../application/contentHash'
import { historicalLuminizeSettlementSchema32 } from '../calculation/luminizeSettlementContract32'

export const savedDeclaredLuminizeSettlement32Contract =
  'soda-saved-declared-luminize-settlement32/v1' as const

/** Historical declarations remain readable; current replay verifies its source separately. */
export const savedDeclaredLuminizeSettlement32Schema = z
  .object({
    contract: z.literal(savedDeclaredLuminizeSettlement32Contract),
    declaration: historicalLuminizeSettlementSchema32,
    snapshotFingerprint: z.string().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const { snapshotFingerprint, ...body } = value
    if (snapshotFingerprint !== contentHash(body))
      context.addIssue({ code: 'custom', message: 'Luminize 结算快照指纹无效' })
  })

export type SavedDeclaredLuminizeSettlement32 = z.infer<
  typeof savedDeclaredLuminizeSettlement32Schema
>
