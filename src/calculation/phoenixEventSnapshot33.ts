import { anomalySnapshotStatsSchema } from '../domain/anomalySnapshotStatsSchema'
import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import {
  anomalyDamageCoreHash,
  calculateAnomalyDamageCore,
  standardAnomalyBaseMultiplier,
  type AnomalyAttribute,
} from './anomalyDamageCore'
import {
  aggregateOrdinaryAnomalySnapshots,
  ordinaryAggregationIdentity,
} from './dynamic/ordinaryAnomalyAggregation'
import {
  calculatePhoenixAnomalyCrit33,
  phoenixAnomalyCritHash33,
  type PhoenixAnomalyCritInput,
  type PhoenixAbloomInstance,
} from './reviewedPhoenixAnomalyCrit33'

const finite = z.number().finite()
const id = z.string().trim().min(1)
const attribute = z.enum(['physical', 'fire', 'ice', 'electric', 'ether', 'wind'])
const stats = anomalySnapshotStatsSchema

const targetSnapshot = z
  .object({
    enemyDefense: finite.nonnegative(),
    resistance: finite,
    defenseReduction: finite,
    resistanceReduction: finite,
    vulnerability: finite,
    stunMultiplier: finite.positive(),
  })
  .strict()

const contribution = z
  .object({
    id,
    ownerAgentId: id,
    attribute,
    targetId: id,
    buildupStateId: id,
    buildup: finite.positive(),
    snapshotAtSeconds: finite.nonnegative(),
    stats,
  })
  .strict()

export const phoenixEventSnapshot33Schema = z
  .object({
    sourceIdentityHash: z.literal(phoenixAnomalyCritHash33),
    targetId: id,
    eventId: id,
    atSeconds: finite.nonnegative(),
    skill: z.enum(['basic_purifying_flame', 'ultimate_soul_searching_blaze', 'm4_extra']),
    // The historical API is a ratio of the original anomaly. The independently
    // source-bound Sinburn/Fire event instead supplies an ATK base coefficient.
    coefficientBasis: z.enum(['original_anomaly_multiplier', 'sinburn_fire_attack_coefficient']).optional(),
    skillLevel: finite.int().min(1).max(16).optional(),
    chainSkillLevel: finite.int().min(1).max(16).optional(),
    phoenix: z
      .object({
        coreLevel: finite.int().min(1).max(7),
        mindscape: finite.int().min(0).max(6),
        initialAnomalyMastery: finite.nonnegative(),
        additionalAbilityActive: z.boolean(),
      })
      .strict(),
    scorchState: z
      .object({
        active: z.boolean(),
        targetId: id,
        eventId: id,
        appliedAtSeconds: finite.nonnegative().optional(),
        currentAtSeconds: finite.nonnegative().optional(),
        refreshedAtSeconds: finite.nonnegative().optional(),
      })
      .strict(),
    existingAnomalyCritSource: z.string().min(1),
    originalAnomaly: z
      .object({
        eventId: id,
        ownerAgentId: id,
        memberAgentIds: z.array(id).min(1),
        attribute,
        targetId: id,
        atSeconds: finite.nonnegative(),
        activeAtEvent: z.literal(true),
        targetConditionsUnchangedAtEvent: z.literal(true),
        buildupStateId: id,
        totalBuildup: finite.positive(),
        target: targetSnapshot,
        contributions: z.array(contribution).min(1),
      })
      .strict(),
  })
  .strict()

export type PhoenixEventSnapshot33Input = z.input<typeof phoenixEventSnapshot33Schema>

export type PhoenixEventSnapshot33Result =
  | {
      status: 'supported'
      event: {
        eventId: string
        targetId: string
        atSeconds: number
        skill: 'basic_purifying_flame' | 'ultimate_soul_searching_blaze'
        skillLevel: number
        motionValueMultiplier: number
        coefficientBasis: 'original_anomaly_multiplier' | 'sinburn_fire_attack_coefficient'
        originalDamageScale: number
        ownerAgentId: 'agent-phoenix'
      }
      damage: {
        nonCriticalDamage: number
        criticalDamage: number
        expectedDamage: number
        factors: Record<string, number>
      }
      originalAnomaly: {
        eventId: string
        ownerAgentId: string
        targetId: string
        attribute: AnomalyAttribute
        sourceAtSeconds: number
        buildupStateId: string
        totalBuildup: number
        nonCriticalDamage: number
        aggregation: {
          authority: 'source_qualified_ordinary_named_settlement'
          independentlyMeasuredInGame: false
          inputIdentity: string
        }
        contributions: Array<{
          id: string
          ownerAgentId: string
          buildup: number
          buildupShare: number
        }>
      }
      anomalyCrit: Exclude<
        ReturnType<typeof calculatePhoenixAnomalyCrit33>,
        { status: 'unsupported' }
      >
      formulaHash: string
      sourceRefs: string[]
      boundary: 'one_fixed_abloom_event_only_no_rotation_or_formal_dps'
    }
  | { status: 'unsupported'; reason: string; blockers: string[] }

const sourceRefs = Object.freeze([
  'nanoka/3.3/zh/character/1641.json#sha256:237C5B060657DB1FD8ABABE6CD26FB275C325D74A67EDA481BDE6732C7D93DFE',
  'nanoka/3.3/zh/character/1641.json#skill.descriptions:basic-abloom-225+20*(AvatarSkillLevel(0)-1)',
  'nanoka/3.3/zh/character/1641.json#skill.descriptions:ultimate-abloom-300+27*(AvatarSkillLevel(3)-1)',
  `ordinary-anomaly-aggregation:${ordinaryAggregationIdentity.commit}`,
])

const unsupported = (reason: string, ...blockers: string[]): PhoenixEventSnapshot33Result => ({
  status: 'unsupported',
  reason,
  blockers: [...new Set(blockers)],
})

/** Keep the source coefficient and its unit together. The named Sinburn Fire
 * contract is proven by the native source and raw 3.3.4 first Burn/Abloom pair;
 * it does not redefine Ultimate or cross-attribute original-anomaly ratios. */
export function resolvePhoenixAbloomCoefficient33(input: Pick<PhoenixEventSnapshot33Input,
  'skill' | 'skillLevel' | 'chainSkillLevel' | 'coefficientBasis'> & { attribute: AnomalyAttribute }) {
  const basis = input.coefficientBasis ?? 'original_anomaly_multiplier'
  if (basis === 'sinburn_fire_attack_coefficient' &&
      (input.skill !== 'basic_purifying_flame' || input.attribute !== 'fire'))
    throw new Error('sinburn_attack_coefficient_requires_named_basic_fire')
  const level = input.skill === 'basic_purifying_flame' ? input.skillLevel : input.chainSkillLevel
  if (input.skill === 'm4_extra' || !Number.isInteger(level) || level! < 1 || level! > 16)
    throw new Error('phoenix_abloom_coefficient_level_or_instance_invalid')
  const coefficient = input.skill === 'basic_purifying_flame' ? 2.25 + 0.2 * (level! - 1) : 3 + 0.27 * (level! - 1)
  return { coefficient, basis, originalDamageScale: basis === 'sinburn_fire_attack_coefficient'
    ? coefficient / standardAnomalyBaseMultiplier(input.attribute) : coefficient }
}

/** Reuses the ordinary anomaly damage core with original owner snapshots and a named Abloom MV. */
export function calculateReviewedPhoenixAbloomSnapshot33(
  raw: PhoenixEventSnapshot33Input,
): PhoenixEventSnapshot33Result {
  const parsed = phoenixEventSnapshot33Schema.safeParse(raw)
  if (!parsed.success)
    return unsupported(
      'invalid_event_snapshot',
      ...parsed.error.issues.map((issue) => `schema:${issue.path.join('.')}:${issue.code}`),
    )
  const input = parsed.data
  if (input.skill === 'm4_extra')
    return unsupported('unsupported_m4_extra_abloom', 'M4 extra 600% inheritance remains unknown.')
  if (input.skill === 'ultimate_soul_searching_blaze' && input.chainSkillLevel === undefined)
    return unsupported('missing_chain_skill_level', 'Ultimate Abloom uses the chain skill level.')
  if (input.skill === 'ultimate_soul_searching_blaze' && input.skillLevel !== undefined)
    return unsupported(
      'unexpected_basic_skill_level',
      'Ultimate Abloom is bound to chainSkillLevel.',
    )
  if (input.skill === 'basic_purifying_flame' && input.skillLevel === undefined)
    return unsupported('missing_basic_skill_level', 'Basic Abloom uses the basic skill level.')
  if (input.skill === 'basic_purifying_flame' && input.chainSkillLevel !== undefined)
    return unsupported('unexpected_chain_skill_level', 'Basic Abloom is bound to skillLevel.')
  if (input.originalAnomaly.targetId !== input.targetId)
    return unsupported(
      'original_anomaly_target_mismatch',
      'Original anomaly and Abloom target must match.',
    )
  if (input.scorchState.targetId !== input.targetId || input.scorchState.eventId !== input.eventId)
    return unsupported(
      'scorch_binding_mismatch',
      'Scorch observation must bind this exact event and target.',
    )
  if (input.scorchState.currentAtSeconds === undefined)
    return unsupported('missing_scorch_hit_time', 'The event hit time must be explicit.')
  if (input.scorchState.currentAtSeconds !== input.atSeconds)
    return unsupported(
      'scorch_hit_time_mismatch',
      'Scorch hit time must equal the fixed event time.',
    )
  if (input.scorchState.active && input.scorchState.appliedAtSeconds === undefined)
    return unsupported(
      'missing_scorch_application_time',
      'An active Scorch needs its application time.',
    )
  if (input.existingAnomalyCritSource !== 'none')
    return unsupported(
      `unsupported_existing_anomaly_crit_source:${input.existingAnomalyCritSource}`,
      'Only an explicitly absent prior anomaly crit source can be combined with Phoenix event crit.',
    )

  const original = input.originalAnomaly
  if (!original.memberAgentIds.includes(original.ownerAgentId))
    return unsupported('original_anomaly_owner_not_in_members')
  if (!original.memberAgentIds.includes('agent-phoenix'))
    return unsupported('phoenix_not_in_original_anomaly_members')
  if (new Set(original.memberAgentIds).size !== original.memberAgentIds.length)
    return unsupported('duplicate_original_anomaly_members')
  if (new Set(original.contributions.map((row) => row.id)).size !== original.contributions.length)
    return unsupported('duplicate_original_anomaly_contribution')
  const buildup = original.contributions.reduce((sum, row) => sum + row.buildup, 0)
  if (Math.abs(buildup - original.totalBuildup) > Math.max(buildup, original.totalBuildup) * 1e-12)
    return unsupported('incomplete_original_anomaly_buildup_conservation')
  for (const row of original.contributions) {
    if (!original.memberAgentIds.includes(row.ownerAgentId))
      return unsupported('unknown_original_anomaly_contributor', row.ownerAgentId)
    if (row.targetId !== input.targetId || row.buildupStateId !== original.buildupStateId)
      return unsupported('original_anomaly_contribution_binding_mismatch', row.id)
    if (row.attribute !== original.attribute)
      return unsupported('original_anomaly_contribution_attribute_mismatch', row.id)
    if (row.snapshotAtSeconds > original.atSeconds || original.atSeconds > input.atSeconds)
      return unsupported('invalid_original_anomaly_timeline', row.id)
  }
  let coefficient: ReturnType<typeof resolvePhoenixAbloomCoefficient33>
  try {
    coefficient = resolvePhoenixAbloomCoefficient33({ ...input, attribute: original.attribute })
  } catch (error) {
    return unsupported(error instanceof Error ? error.message : 'phoenix_abloom_coefficient_invalid')
  }
  const motionValueMultiplier = coefficient.coefficient
  const phoenixCritInput: PhoenixAnomalyCritInput = {
    sourceIdentityHash: input.sourceIdentityHash,
    targetId: input.targetId,
    eventId: input.eventId,
    phoenix: input.phoenix as PhoenixAnomalyCritInput['phoenix'],
    scorchState: input.scorchState,
    damageKind: 'phoenix_abloom',
    phoenixAbloomInstance: input.skill as PhoenixAbloomInstance,
    existingAnomalyCritSource: 'none',
  }
  const anomalyCrit = calculatePhoenixAnomalyCrit33(phoenixCritInput)
  if (anomalyCrit.status === 'unsupported')
    return unsupported(anomalyCrit.reason, ...anomalyCrit.blockers)
  const anomalyCritRate = anomalyCrit.status === 'supported' ? anomalyCrit.anomalyCritRate : 0
  const anomalyCritDamage = anomalyCrit.status === 'supported' ? anomalyCrit.anomalyCritDamage : 0

  try {
    const aggregate = aggregateOrdinaryAnomalySnapshots({
      rows: original.contributions,
      effectiveAgentBuildup: original.totalBuildup,
    })
    const originalResult = calculateAnomalyDamageCore({
      ...aggregate.virtualSnapshot,
      ...original.target,
      baseMultiplier: standardAnomalyBaseMultiplier(original.attribute as AnomalyAttribute),
    })
    const nonCriticalDamage = originalResult.nonCriticalDamage * coefficient.originalDamageScale
    const damage = {
      ...originalResult,
      nonCriticalDamage,
      criticalDamage: nonCriticalDamage * (1 + anomalyCritDamage),
      expectedDamage: nonCriticalDamage * (1 + anomalyCritRate * anomalyCritDamage),
      factors: {
        ...originalResult.factors,
        anomalyBase: originalResult.factors.anomalyBase * coefficient.originalDamageScale,
        expectedAnomalyCritMultiplier: 1 + anomalyCritRate * anomalyCritDamage,
      },
    }
    return {
      status: 'supported',
      event: {
        eventId: input.eventId,
        targetId: input.targetId,
        atSeconds: input.atSeconds,
        skill: input.skill,
        skillLevel:
          input.skill === 'basic_purifying_flame' ? input.skillLevel! : input.chainSkillLevel!,
        motionValueMultiplier,
        coefficientBasis: coefficient.basis,
        originalDamageScale: coefficient.originalDamageScale,
        ownerAgentId: 'agent-phoenix',
      },
      damage,
      originalAnomaly: {
        eventId: original.eventId,
        ownerAgentId: original.ownerAgentId,
        targetId: original.targetId,
        attribute: original.attribute,
        sourceAtSeconds: original.atSeconds,
        buildupStateId: original.buildupStateId,
        totalBuildup: original.totalBuildup,
        nonCriticalDamage: originalResult.nonCriticalDamage,
        aggregation: {
          authority: aggregate.authority,
          independentlyMeasuredInGame: aggregate.independentlyMeasuredInGame,
          inputIdentity: aggregate.inputIdentity,
        },
        contributions: aggregate.contributionWeights.map((weight) => {
          const row = original.contributions.find((contribution) => contribution.id === weight.id)!
          return {
            id: row.id,
            ownerAgentId: row.ownerAgentId,
            buildup: row.buildup,
            buildupShare: weight.share,
          }
        }),
      },
      anomalyCrit,
      formulaHash: stableContentHash({
        core: anomalyDamageCoreHash,
        aggregation: aggregate.source,
        phoenixAnomalyCrit: phoenixAnomalyCritHash33,
        sourceRefs,
        motionValueMultiplier,
        coefficientBasis: coefficient.basis,
      }),
      sourceRefs: [...sourceRefs],
      boundary: 'one_fixed_abloom_event_only_no_rotation_or_formal_dps',
    }
  } catch (error) {
    return unsupported(
      'ordinary_anomaly_formula_failure',
      error instanceof Error ? error.message : 'unknown',
    )
  }
}
