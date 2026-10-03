import { z } from 'zod'
import { contentHash } from './contentHash'
import { publicAnomalySnapshotStatsSchema32 } from './publicAnomalySnapshotStats32'

export const publicCommonAnomalySettlementContract32 =
  'soda-public-common-anomaly-settlement32/v1' as const
export const publicCommonAnomalySettlementScope32 =
  'homogeneous_named_wind_settlement_arithmetic' as const
export const publicCommonAnomalySettlementBoundary32 =
  'Explicit declared final snapshots and one homogeneous Wind settlement; no account verification, trigger inference, rotation, Formal promotion or Import.'

const finite = z.number().finite()
const id = z.string().trim().min(1)
const refs = z.array(id).min(1)

export { publicAnomalySnapshotStatsSchema32 } from './publicAnomalySnapshotStats32'

const instance = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anomaly'), motionValueMultiplier: finite.nonnegative() }).strict(),
  z.object({ kind: z.literal('abloom'), motionValueMultiplier: finite.positive() }).strict(),
  z
    .object({
      kind: z.literal('polarity_disorder'),
      elapsedSeconds: finite.nonnegative(),
      additionalDisorderMultiplier: finite,
    })
    .strict(),
])

export const publicCommonAnomalySettlementInputSchema32 = z
  .object({
    contract: z.literal(publicCommonAnomalySettlementContract32),
    confirmedDeclaredStates: z.literal(true),
    confirmedFinalSnapshotStats: z.literal(true),
    settlement: z
      .object({
        sourceIdentityHash: id,
        eventId: id,
        triggerAgentId: id,
        memberAgentIds: z.array(id).min(1),
        attribute: z.literal('wind'),
        targetId: id,
        atSeconds: finite.nonnegative(),
        buildupStateId: id,
        totalBuildup: finite.positive(),
        sourceRefs: refs,
        target: z
          .object({
            enemyDefense: finite.nonnegative(),
            resistance: finite,
            defenseReduction: finite,
            resistanceReduction: finite,
            vulnerability: finite,
            stunMultiplier: finite.positive(),
            sourceRefs: refs,
          })
          .strict(),
        contributions: z
          .array(
            z
              .object({
                id,
                ownerAgentId: id,
                ownerKind: z.literal('agent'),
                attribute: z.literal('wind'),
                targetId: id,
                buildupStateId: id,
                buildup: finite.positive(),
                snapshotAtSeconds: finite.nonnegative(),
                stats: publicAnomalySnapshotStatsSchema32,
                instance,
                sourceRefs: refs,
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict()

export type PublicCommonAnomalySettlementInput32 = z.infer<
  typeof publicCommonAnomalySettlementInputSchema32
>

const boundary = {
  runId: z.string().min(1),
  contract: z.literal(publicCommonAnomalySettlementContract32),
  gameVersion: z.literal('3.2'),
  scope: z.literal(publicCommonAnomalySettlementScope32),
  evidenceStatus: z.literal('declared_inputs'),
  accountBound: z.literal(false),
  formalCycleReady: z.literal(false),
  formalPromotion: z.literal(false),
  importReady: z.literal(false),
  boundary: z.literal(publicCommonAnomalySettlementBoundary32),
}

export const publicCommonAnomalySettlementResultSchema32 = z.discriminatedUnion('status', [
  z
    .object({
      ...boundary,
      status: z.literal('declared_arithmetic'),
      inputFingerprint: id,
      resultFingerprint: id,
      sourceIdentityHash: id,
      sourceRefs: refs,
      nonCriticalDamage: finite.nonnegative(),
      criticalDamage: finite.nonnegative(),
      expectedDamage: finite.nonnegative(),
      attribution: z
        .object({
          eventId: id,
          triggerAgentId: id,
          memberAgentIds: z.array(id).min(1),
          instanceKind: z.enum(['anomaly', 'abloom', 'polarity_disorder']),
          attribute: z.literal('wind'),
          targetId: id,
          atSeconds: finite.nonnegative(),
          buildupStateId: id,
          totalBuildup: finite.positive(),
          parameterHash: id,
          actorSourceHash: id,
          targetSnapshotHash: id,
          contributions: z
            .array(
              z
                .object({
                  id,
                  ownerAgentId: id,
                  attribute: z.literal('wind'),
                  targetId: id,
                  snapshotAtSeconds: finite.nonnegative(),
                  buildup: finite.positive(),
                  share: finite.positive().max(1),
                  expectedDamage: finite.nonnegative(),
                  snapshotStatsHash: id,
                  instanceHash: id,
                  sourceRefs: refs,
                })
                .strict(),
            )
            .min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...boundary,
      status: z.literal('unsupported'),
      inputFingerprint: id.nullable(),
      resultFingerprint: id,
      gaps: refs,
    })
    .strict(),
])

export type PublicCommonAnomalySettlementResult32 = z.infer<
  typeof publicCommonAnomalySettlementResultSchema32
>

/** Original JSON content identity: sort object keys only, never parse/trim/default
 * request values. Producer and public consumer use exactly this function. */
export const publicCommonAnomalySettlementInputFingerprint32 = (input: unknown) =>
  contentHash(input)

export function publicCommonAnomalySettlementResultFingerprint32(
  result: PublicCommonAnomalySettlementResult32,
) {
  const { resultFingerprint: previous, ...body } = result
  void previous
  return contentHash(body)
}

export function acceptPublicCommonAnomalySettlementResult32(input: {
  runId: string
  input: unknown
  result: unknown
}) {
  const parsed = publicCommonAnomalySettlementResultSchema32.safeParse(input.result)
  if (!parsed.success)
    return { status: 'rejected' as const, reason: 'invalid_public_anomaly_result32' }
  const result = parsed.data
  if (result.runId !== input.runId)
    return { status: 'rejected' as const, reason: 'anomaly_run_id_mismatch32' }
  try {
    if (result.inputFingerprint !== publicCommonAnomalySettlementInputFingerprint32(input.input))
      return { status: 'rejected' as const, reason: 'anomaly_request_fingerprint_mismatch32' }
    if (result.resultFingerprint !== publicCommonAnomalySettlementResultFingerprint32(result))
      return { status: 'rejected' as const, reason: 'anomaly_result_fingerprint_mismatch32' }
  } catch {
    return { status: 'rejected' as const, reason: 'invalid_anomaly_request_json32' }
  }
  return { status: 'accepted' as const, result }
}

export const publicCommonAnomalySettlementMetadataSchema32 = z
  .object(boundary)
  .omit({ runId: true })
  .extend({
    sourceIdentityHash: id,
    sourceRefs: refs,
    supportedKinds: z.tuple([
      z.literal('anomaly'),
      z.literal('abloom'),
      z.literal('polarity_disorder'),
    ]),
  })
  .strict()

export type PublicCommonAnomalySettlementMetadata32 = z.infer<
  typeof publicCommonAnomalySettlementMetadataSchema32
>
