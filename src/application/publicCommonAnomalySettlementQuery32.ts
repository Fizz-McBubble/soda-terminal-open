import { z } from 'zod'
import { contentHash } from './contentHash'
import {
  acceptPublicCommonAnomalySettlementResult32,
  publicCommonAnomalySettlementMetadataSchema32,
  publicCommonAnomalySettlementResultSchema32,
  type PublicCommonAnomalySettlementInput32,
} from './publicCommonAnomalySettlement32'

export const commonAnomalySettlementQueryContract32 = 'soda-common-anomaly-query32/v1' as const
export const commonAnomalySettlementQueryResultSchema32 = z
  .object({
    contract: z.literal(commonAnomalySettlementQueryContract32),
    runId: z.string().trim().min(1),
    metadata: publicCommonAnomalySettlementMetadataSchema32,
    result: publicCommonAnomalySettlementResultSchema32.nullable(),
    fingerprint: z.string().trim().min(1),
  })
  .strict()
export type CommonAnomalySettlementQueryResult32 = z.infer<
  typeof commonAnomalySettlementQueryResultSchema32
>

export function commonAnomalySettlementQueryResultFingerprint32(
  value: Omit<CommonAnomalySettlementQueryResult32, 'fingerprint'>,
) {
  return contentHash(value)
}

/** Wire validation does not grant an account, event or rotation qualification. */
export function acceptCommonAnomalySettlementQuery32(
  raw: unknown,
  request: { runId: string; input: PublicCommonAnomalySettlementInput32 | null },
): CommonAnomalySettlementQueryResult32 {
  const parsed = commonAnomalySettlementQueryResultSchema32.safeParse(raw)
  if (!parsed.success) throw new Error('风异常结算返回格式无效。')
  const { fingerprint, ...body } = parsed.data
  if (
    body.runId !== request.runId ||
    fingerprint !== commonAnomalySettlementQueryResultFingerprint32(body) ||
    (request.input === null) !== (body.result === null)
  )
    throw new Error('风异常结算返回与当前请求不一致。')
  if (body.result) {
    const accepted = acceptPublicCommonAnomalySettlementResult32({
      runId: request.runId,
      input: request.input,
      result: body.result,
    })
    if (accepted.status !== 'accepted') throw new Error(accepted.reason)
    if (
      body.result.status === 'declared_arithmetic' &&
      body.result.sourceIdentityHash !== body.metadata.sourceIdentityHash
    )
      throw new Error('风异常结算来源已经变化。')
  }
  return parsed.data
}
