import {
  commonAnomalySettlementSchema32,
  type CommonAnomalySettlement32,
} from './currentCommonAnomalySettlement32'
import { calculateAnomalyDamageCore, standardAnomalyBaseMultiplier } from './anomalyDamageCore'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { commonAnomalySettlementIdentity32 } from './currentCommonAnomalySettlementIdentity32'
import {
  aggregateOrdinaryAnomalySnapshots,
  ordinaryAggregationIdentity,
} from './dynamic/ordinaryAnomalyAggregation'
import { stableContentHash } from '../gameDataPacks/types'

export const sourceQualifiedOrdinaryAnomalyHash32 = stableContentHash({
  aggregation: ordinaryAggregationIdentity,
  arithmeticCoreHash: commonAnomalySettlementIdentity32.arithmeticCoreHash,
  scope: 'ordinary_same_attribute_same_level_named_settlement',
})
export type SourceQualifiedOrdinaryAnomalyInput32 = Omit<
  CommonAnomalySettlement32,
  'sourceIdentityHash'
> & {
  sourceIdentityHash: string
}

/** Explicit new consumer. The historical homogeneous/Formal path is not widened.
 * One named ordinary settlement is supported here, not trigger eligibility,
 * mixed levels, anomaly crit, Abloom, Polarity Disorder, Vortex or a full cycle.
 */
export function calculateSourceQualifiedOrdinaryAnomalySettlement32(
  raw: SourceQualifiedOrdinaryAnomalyInput32,
) {
  const { sourceIdentityHash, ...observations } = raw
  if (sourceIdentityHash !== sourceQualifiedOrdinaryAnomalyHash32)
    throw new Error('ordinary_aggregation_source_identity_mismatch')
  const input = commonAnomalySettlementSchema32
    .omit({ sourceIdentityHash: true })
    .parse(observations)
  const memberIds = new Set(input.memberAgentIds)
  if (memberIds.size !== input.memberAgentIds.length || !memberIds.has(input.triggerAgentId))
    throw new Error('invalid_anomaly_members_or_trigger')
  for (const id of memberIds) {
    const actor = getCurrentAgentEventContract(id)
    if (!actor || actor.source.commit !== commonAnomalySettlementIdentity32.commit)
      throw new Error('anomaly_member_source_identity_missing')
  }
  if (input.attribute === 'wind') throw new Error('wind_settlement_requires_dedicated_adapter')
  const first = input.contributions[0]!
  if (first.instance.kind !== 'anomaly') throw new Error('not_an_ordinary_anomaly_settlement')
  for (const row of input.contributions) {
    const actor = getCurrentAgentEventContract(row.ownerAgentId)
    if (
      !memberIds.has(row.ownerAgentId) ||
      !actor ||
      actor.source.commit !== commonAnomalySettlementIdentity32.commit
    )
      throw new Error('missing_anomaly_contributor_authority')
    if (
      actor.identity.attribute !== row.attribute ||
      row.attribute !== input.attribute ||
      row.targetId !== input.targetId ||
      row.buildupStateId !== input.buildupStateId
    )
      throw new Error('anomaly_snapshot_context_mismatch')
    if (row.snapshotAtSeconds > input.atSeconds) throw new Error('future_anomaly_snapshot')
    if (
      row.instance.kind !== 'anomaly' ||
      row.instance.motionValueMultiplier !== first.instance.motionValueMultiplier
    )
      throw new Error('different_instance_coefficients_require_adapter')
  }
  const aggregate = aggregateOrdinaryAnomalySnapshots({
    rows: input.contributions,
    effectiveAgentBuildup: input.totalBuildup,
  })
  const { sourceRefs: targetSourceRefs, ...target } = input.target
  const result = calculateAnomalyDamageCore({
    ...aggregate.virtualSnapshot,
    ...target,
    baseMultiplier:
      standardAnomalyBaseMultiplier(input.attribute) * (first.instance.motionValueMultiplier || 1),
  })
  if (!Number.isFinite(result.expectedDamage) || result.expectedDamage < 0)
    throw new Error('invalid_source_qualified_anomaly_damage')
  return {
    ...result,
    aggregate,
    rawInputHash: stableContentHash(raw),
    sourceIdentityHash: sourceQualifiedOrdinaryAnomalyHash32,
    targetSourceRefs,
    boundary:
      'Declared accepted agent buildup only. No Bangboo eligibility inference or trigger/cycle qualification. Contribution shares are not causal damage benefits.',
    formalCycleReady: false as const,
    modelQualification32: null,
  }
}
