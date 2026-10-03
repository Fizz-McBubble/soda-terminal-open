import {
  publicCommonAnomalySettlementBoundary32,
  publicCommonAnomalySettlementContract32,
  publicCommonAnomalySettlementInputSchema32,
  publicCommonAnomalySettlementMetadataSchema32,
  publicCommonAnomalySettlementResultSchema32,
  publicCommonAnomalySettlementScope32,
  publicCommonAnomalySettlementInputFingerprint32,
  publicCommonAnomalySettlementResultFingerprint32,
  type PublicCommonAnomalySettlementMetadata32,
  type PublicCommonAnomalySettlementResult32,
} from '../application/publicCommonAnomalySettlement32'
import { stableContentHash } from '../gameDataPacks/types'
import { calculateDamageFormula } from './damageFormulaDispatch'
import {
  commonAnomalySettlementHash32,
  commonAnomalySettlementIdentity32,
} from './currentCommonAnomalySettlementIdentity32'

const boundary = {
  contract: publicCommonAnomalySettlementContract32,
  gameVersion: '3.2' as const,
  scope: publicCommonAnomalySettlementScope32,
  evidenceStatus: 'declared_inputs' as const,
  accountBound: false as const,
  formalCycleReady: false as const,
  formalPromotion: false as const,
  importReady: false as const,
  boundary: publicCommonAnomalySettlementBoundary32,
}

/** Hash the actual strict public wire shape after schema normalization. */
function fingerprintResult(raw: unknown): PublicCommonAnomalySettlementResult32 {
  const result = publicCommonAnomalySettlementResultSchema32.parse({
    ...record(raw),
    resultFingerprint: 'pending-public-normalization',
  })
  return { ...result, resultFingerprint: publicCommonAnomalySettlementResultFingerprint32(result) }
}

export function getReviewedCommonAnomalySettlementMetadata32(): PublicCommonAnomalySettlementMetadata32 {
  return publicCommonAnomalySettlementMetadataSchema32.parse({
    ...boundary,
    sourceIdentityHash: commonAnomalySettlementHash32,
    sourceRefs: commonAnomalySettlementIdentity32.sources.map((row) => `${row.path}#${row.sha256}`),
    supportedKinds: ['anomaly', 'abloom', 'polarity_disorder'],
  })
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Scope diagnostics do not repair, strip or coerce invalid public fields. */
function unsupportedScopeGaps(raw: unknown) {
  const settlement = record(record(raw)?.settlement)
  const contributions = settlement?.contributions
  if (!Array.isArray(contributions)) return []
  const gaps: string[] = []
  for (const rawRow of contributions) {
    const row = record(rawRow)
    if (row?.ownerKind === 'bangboo') gaps.push('bangboo_contribution_normalization_unresolved32')
    const kind = record(row?.instance)?.kind
    if (kind === 'vortex') gaps.push('vortex_cross_attribute_ownership_unresolved32')
    else if (kind === 'contamination')
      gaps.push('contamination_cross_attribute_ownership_unresolved32')
    else if (typeof kind === 'string' && !['anomaly', 'abloom', 'polarity_disorder'].includes(kind))
      gaps.push(`unsupported_anomaly_instance_scope32:${kind}`)
  }
  return gaps
}

/** Declared arithmetic only. The existing core owns conservation, actor source
 * identity and homogeneous snapshot guards; no new damage formula is introduced. */
export function evaluateReviewedCommonAnomalySettlement32(request: {
  runId: string
  input: unknown
}): PublicCommonAnomalySettlementResult32 {
  const { runId, input: raw } = request
  if (typeof runId !== 'string' || runId.trim().length === 0)
    throw new Error('invalid_anomaly_run_id32')
  const inputFingerprint = publicCommonAnomalySettlementInputFingerprint32(raw)
  const unsupported = (gaps: string[]) => {
    const result = {
      ...boundary,
      runId,
      status: 'unsupported' as const,
      inputFingerprint,
      gaps: [...new Set(gaps)],
    }
    return fingerprintResult(result)
  }
  const parsed = publicCommonAnomalySettlementInputSchema32.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) =>
        `schema:${issue.path.join('.')}:${issue.code}${'keys' in issue ? `:${issue.keys.join(',')}` : ''}`,
    )
    return unsupported([...unsupportedScopeGaps(raw), ...issues])
  }
  const value = parsed.data
  if (value.settlement.sourceIdentityHash !== commonAnomalySettlementHash32)
    return unsupported(['anomaly_source_identity_mismatch32'])
  try {
    const result = calculateDamageFormula({
      family: 'anomaly',
      scalingAttribute: 'attack',
      formulaVersion: '3.2',
      anomalySettlement32: value.settlement,
    })
    if (!('attribution' in result))
      return unsupported(['anomaly_settlement_dispatch_shape_mismatch32'])
    const attribution = result.attribution
    const body = {
      ...boundary,
      runId,
      status: 'declared_arithmetic' as const,
      inputFingerprint,
      sourceIdentityHash: commonAnomalySettlementHash32,
      sourceRefs: attribution.sourceRefs,
      nonCriticalDamage: result.nonCriticalDamage,
      criticalDamage: result.criticalDamage,
      expectedDamage: result.expectedDamage,
      attribution: {
        eventId: attribution.eventId,
        triggerAgentId: attribution.triggerAgentId,
        memberAgentIds: [...value.settlement.memberAgentIds],
        instanceKind: value.settlement.contributions[0]!.instance.kind,
        attribute: 'wind' as const,
        targetId: attribution.targetId,
        atSeconds: value.settlement.atSeconds,
        buildupStateId: attribution.buildupStateId,
        totalBuildup: attribution.totalBuildup,
        parameterHash: attribution.parameterHash,
        actorSourceHash: attribution.actorSourceHash,
        targetSnapshotHash: stableContentHash(value.settlement.target),
        contributions: attribution.contributions.map((row, index) => ({
          ...row,
          snapshotStatsHash: stableContentHash(value.settlement.contributions[index]!.stats),
          instanceHash: stableContentHash(value.settlement.contributions[index]!.instance),
        })),
      },
    }
    return fingerprintResult(body)
  } catch (error) {
    return unsupported([error instanceof Error ? error.message : 'anomaly_settlement_failure32'])
  }
}
