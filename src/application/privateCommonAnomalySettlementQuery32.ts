import {
  evaluateReviewedCommonAnomalySettlement32,
  getReviewedCommonAnomalySettlementMetadata32,
} from '../calculation/reviewedCommonAnomalySettlement32'
import {
  incremental32RecoveryPolicy,
  incremental32RecoveryReason,
} from '../gameDataPacks/incremental32RecoveryPolicy'
import type { CommonAnomalySettlement32Query } from './calculationQueryContract'
import {
  commonAnomalySettlementQueryContract32,
  commonAnomalySettlementQueryResultFingerprint32,
  type CommonAnomalySettlementQueryResult32,
} from './publicCommonAnomalySettlementQuery32'

export function projectCommonAnomalySettlementQuery32(
  query: CommonAnomalySettlement32Query,
): CommonAnomalySettlementQueryResult32 {
  if (query.input && incremental32RecoveryPolicy.enabled)
    throw new Error(incremental32RecoveryReason)
  const payload = {
    contract: commonAnomalySettlementQueryContract32,
    runId: query.runId,
    metadata: getReviewedCommonAnomalySettlementMetadata32(),
    result: query.input
      ? evaluateReviewedCommonAnomalySettlement32({ runId: query.runId, input: query.input })
      : null,
  }
  return { ...payload, fingerprint: commonAnomalySettlementQueryResultFingerprint32(payload) }
}
