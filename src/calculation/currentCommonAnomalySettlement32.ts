import { z } from 'zod'
import { publicAnomalySnapshotStatsSchema32 } from '../application/publicAnomalySnapshotStats32'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  calculateAnomalyDamageCore,
  disorderBaseMultiplier,
  standardAnomalyBaseMultiplier,
} from './anomalyDamageCore'
import {
  commonAnomalySettlementHash32,
  commonAnomalySettlementIdentity32,
} from './currentCommonAnomalySettlementIdentity32'

const finite = z.number().finite()
const id = z.string().trim().min(1)
const refs = z.array(id).min(1)
const attribute = z.enum(['physical', 'fire', 'ice', 'electric', 'ether', 'wind'])

const instance = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anomaly'), motionValueMultiplier: finite.nonnegative() }).strict(),
  // util.ts hides Abloom if anom_mv_mult_ == 0; zero must not become an ordinary proc.
  z.object({ kind: z.literal('abloom'), motionValueMultiplier: finite.positive() }).strict(),
  z
    .object({
      kind: z.literal('polarity_disorder'),
      elapsedSeconds: finite.nonnegative(),
      additionalDisorderMultiplier: finite,
    })
    .strict(),
])

export const commonAnomalySettlementSchema32 = z
  .object({
    sourceIdentityHash: z.literal(commonAnomalySettlementHash32),
    eventId: id,
    triggerAgentId: id,
    memberAgentIds: z.array(id).min(1),
    attribute,
    targetId: id,
    atSeconds: finite.nonnegative(),
    buildupStateId: id,
    totalBuildup: finite.positive(),
    sourceRefs: refs,
    // Enemy state is evaluated at settlement, not copied from an attacker buildup snapshot.
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
            attribute,
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
  .strict()

export type CommonAnomalySettlement32 = z.infer<typeof commonAnomalySettlementSchema32>

/**
 * A declared single settlement, never an inferred trigger or Formal cycle.
 * Identical complete factors make sum(w_i * product(f_i)) and
 * product(sum(w_i * f_i)) equal. Different factors remain unresolved by sources.
 */
export function calculateCommonAnomalySettlement32(raw: CommonAnomalySettlement32) {
  const parsed = commonAnomalySettlementSchema32.safeParse(raw)
  if (!parsed.success)
    throw new Error(
      `invalid_anomaly_settlement32:${parsed.error.issues.map((issue) => issue.path.join('.')).join(',')}`,
    )
  const input = parsed.data
  const members = new Set(input.memberAgentIds)
  if (members.size !== input.memberAgentIds.length || !members.has(input.triggerAgentId))
    throw new Error('invalid_anomaly_members_or_trigger')
  const actorContracts = new Map(
    input.memberAgentIds.map((agentId) => [agentId, getCurrentAgentEventContract(agentId)]),
  )
  if (
    [...actorContracts.values()].some(
      (contract) =>
        !contract || contract.source.commit !== commonAnomalySettlementIdentity32.commit,
    )
  )
    throw new Error('anomaly_actor_source_identity_missing')
  if (new Set(input.contributions.map((row) => row.id)).size !== input.contributions.length)
    throw new Error('duplicate_anomaly_contribution')
  const total = input.contributions.reduce((sum, row) => sum + row.buildup, 0)
  if (
    !Number.isFinite(total) ||
    Math.abs(total - input.totalBuildup) > Math.max(total, input.totalBuildup) * 1e-12
  )
    throw new Error('incomplete_anomaly_buildup_conservation')
  for (const row of input.contributions) {
    if (!members.has(row.ownerAgentId)) throw new Error('unknown_anomaly_contributor')
    if (actorContracts.get(row.ownerAgentId)!.identity.attribute !== row.attribute)
      throw new Error('anomaly_contributor_source_attribute_mismatch')
    if (row.targetId !== input.targetId || row.buildupStateId !== input.buildupStateId)
      throw new Error('anomaly_target_or_state_mismatch')
    if (row.attribute !== input.attribute) throw new Error('anomaly_attribute_mismatch')
    if (row.snapshotAtSeconds > input.atSeconds) throw new Error('future_anomaly_snapshot')
    if (row.instance.kind === 'polarity_disorder' && row.attribute !== 'wind')
      throw new Error('only_wind_polarity_disorder_reviewed32')
  }
  const first = input.contributions[0]!
  const parameterHash = stableContentHash({ stats: first.stats, instance: first.instance })
  if (
    input.contributions.some(
      (row) => stableContentHash({ stats: row.stats, instance: row.instance }) !== parameterHash,
    )
  )
    throw new Error(
      'heterogeneous_anomaly_aggregation_source_unresolved:weighted_strength_vs_weighted_factors',
    )

  const baseMultiplier =
    first.instance.kind === 'polarity_disorder'
      ? disorderBaseMultiplier({
          attribute: 'wind',
          elapsedSeconds: first.instance.elapsedSeconds,
          additionalDisorderMultiplier: first.instance.additionalDisorderMultiplier,
        })
      : standardAnomalyBaseMultiplier(input.attribute) *
        (first.instance.motionValueMultiplier === 0 ? 1 : first.instance.motionValueMultiplier)
  const { sourceRefs: targetRefs, ...target } = input.target
  const result = calculateAnomalyDamageCore({ ...first.stats, ...target, baseMultiplier })
  if (
    [result.expectedDamage, result.nonCriticalDamage, result.criticalDamage].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  )
    throw new Error('invalid_anomaly_settlement_damage')
  const sourceRefs = [
    ...new Set([
      ...commonAnomalySettlementIdentity32.sources.map(
        (source) => `${source.path}#${source.sha256}`,
      ),
      ...input.sourceRefs,
      ...targetRefs,
      ...input.contributions.flatMap((row) => row.sourceRefs),
      ...[...actorContracts.values()].map(
        (contract) => `${contract!.source.statsPath}#${contract!.source.statsSha256}`,
      ),
    ]),
  ].sort()
  return {
    ...result,
    attribution: {
      eventId: input.eventId,
      triggerAgentId: input.triggerAgentId,
      targetId: input.targetId,
      buildupStateId: input.buildupStateId,
      totalBuildup: input.totalBuildup,
      contributions: input.contributions.map((row) => ({
        id: row.id,
        ownerAgentId: row.ownerAgentId,
        attribute: row.attribute,
        targetId: row.targetId,
        snapshotAtSeconds: row.snapshotAtSeconds,
        buildup: row.buildup,
        share: row.buildup / input.totalBuildup,
        expectedDamage: result.expectedDamage * (row.buildup / input.totalBuildup),
        sourceRefs: [...row.sourceRefs],
      })),
      parameterHash,
      actorSourceHash: stableContentHash(
        [...actorContracts].map(([agentId, contract]) => ({
          agentId,
          identity: contract!.identity,
          source: contract!.source,
        })),
      ),
      formulaHash: commonAnomalySettlementHash32,
      inputHash: stableContentHash(input),
      sourceRefs,
      evidenceStatus: 'declared_inputs' as const,
      scope: 'homogeneous_named_settlement_arithmetic' as const,
      formalCycleReady: false as const,
    },
  }
}
