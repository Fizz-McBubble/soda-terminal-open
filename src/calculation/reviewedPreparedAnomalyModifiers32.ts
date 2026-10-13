import { stableContentHash } from '../gameDataPacks/types'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import type {
  PreparedAnomalyModifier32,
  PreparedAnomalyExclusion32,
} from './reviewedPreparedAnomalyEquipment32'

/** Preserve bucket order, deduplication and settlement-domain exclusions. */
export function collectReviewedPreparedAnomalyModifiers32(input: {
  agentId: string
  attribute: string
  bucketRows: readonly SourceBackedPlanningEffectBucket[]
  modifiers: PreparedAnomalyModifier32[]
  exclusions: PreparedAnomalyExclusion32[]
  included: string[]
  refs: string[]
  sums: Record<string, number>
}): string[] | null {
  const { agentId, attribute, bucketRows, modifiers, exclusions, included, refs, sums } = input
  const seenBuckets = new Map<string, SourceBackedPlanningEffectBucket>()
  const applicationStat: Partial<Record<SourceBackedPlanningEffectBucket['application'], string>> =
    {
      attack_percent: 'combat.atk_',
      attack_flat: 'combat.atk',
      damage_bonus: 'combat.common_dmg_',
      buff_bonus: 'combat.buff_',
      penetration_ratio: 'combat.pen_',
      defense_ignore: 'combat.defIgn_',
      resistance_ignore: 'combat.resIgn_',
      defense_reduction: 'enemy.defRed_',
      resistance_reduction: 'enemy.resRed_',
      vulnerability: 'enemy.dmgInc_',
      stun_damage_bonus: 'enemy.stun_',
    }
  for (const row of bucketRows) {
    const previous = seenBuckets.get(row.effectKey)
    if (previous) {
      if (stableContentHash(previous) !== stableContentHash(row))
        return [`conflicting_anomaly_effect_bucket:${row.effectKey}`]
      continue
    }
    seenBuckets.set(row.effectKey, row)
    if (
      !row.recipientAgentIds.includes(agentId) ||
      (row.attribute !== null && row.attribute !== attribute)
    )
      continue
    if (
      row.action !== null ||
      row.applicationScope === 'event_only' ||
      (row.damageType !== null && row.damageType !== 'anomaly' && row.damageType !== 'abloom')
    ) {
      exclusions.push({
        effectKey: row.effectKey,
        reason: 'outside_anomaly_settlement_scope',
        fields: [row.action ?? '', row.damageType ?? ''],
        sourceRefs: row.sourceRefs,
      })
      continue
    }
    const stat =
      row.receiverPath?.replace(/^(ownBuff|teamBuff|notOwnBuff)\./, '') ??
      applicationStat[row.application]
    if (!stat) {
      exclusions.push({
        effectKey: row.effectKey,
        reason: 'outside_anomaly_modifier_domain',
        fields: [row.application],
        sourceRefs: row.sourceRefs,
      })
      continue
    }
    modifiers.push({ effectKey: row.effectKey, stat, value: row.value, sourceRefs: row.sourceRefs })
  }
  for (const row of modifiers) {
    if (!Number.isFinite(row.value) || !row.sourceRefs.length)
      return ['prepared_anomaly_modifier_source_or_value_invalid']
    const channel = /\.(physical|fire|ice|electric|ether|wind)$/.exec(row.stat)
    if (channel && channel[1] !== attribute) continue
    const stat = row.stat.replace(/\.(physical|fire|ice|electric|ether|wind)$/, '')
    if (
      [
        'combat.atk_',
        'combat.atk',
        'combat.anomProf',
        'combat.common_dmg_',
        'combat.dmg_',
        'combat.buff_',
        'combat.pen_',
        'combat.defIgn_',
        'combat.resIgn_',
        'enemy.defRed_',
        'enemy.resRed_',
        'enemy.dmgInc_',
        'enemy.stun_',
        'enemyDebuff.common.defRed_',
        'enemyDebuff.common.resRed_',
        'enemyDebuff.common.dmgInc_',
        'enemyDebuff.common.stun_',
      ].includes(stat)
    ) {
      sums[stat] = (sums[stat] ?? 0) + row.value
      included.push(row.effectKey)
      refs.push(...row.sourceRefs)
    } else
      exclusions.push({
        effectKey: row.effectKey,
        reason:
          stat.includes('anomMas') || stat.includes('anomBuildup')
            ? 'buildup_not_inferred_into_damage_or_AP'
            : 'outside_anomaly_settlement_formula',
        fields: [row.stat],
        sourceRefs: row.sourceRefs,
      })
  }
  return null
}
