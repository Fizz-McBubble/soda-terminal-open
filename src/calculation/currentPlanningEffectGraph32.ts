import { evaluateInitialCritConversion32 } from './currentInitialCritConversion32'
import { evaluateReviewedDialynInitialImpact32 } from './reviewedFunctionalInitialImpact32'
import { applyPlanningNaturalEnergyModifiers32 } from './planningNaturalEnergyModifiers32'
import type {
  PlanningEffectRuntimeMember,
  PlanningEffectRuntimeStats,
} from './currentPlanningEffectDomain'
import {
  emptyModifiers,
  addModifier,
  type SourceBackedPlanningEffectBucket,
} from './currentPlanningDamageModifiers'

export type PlanningEffectGraphNode32 = {
  id: string
  reads: readonly string[]
  writes: readonly string[]
  evaluate: (
    stats: Readonly<Record<string, PlanningEffectRuntimeStats>>,
  ) =>
    | { status: 'supported'; buckets: SourceBackedPlanningEffectBucket[] }
    | { status: 'unsupported'; blockers: string[] }
}
const statByApplication: Partial<
  Record<SourceBackedPlanningEffectBucket['application'], keyof PlanningEffectRuntimeStats>
> = {
  attack_percent: 'atk',
  attack_flat: 'atk',
  defense_percent: 'def',
  defense_flat: 'def',
  hp_percent: 'hp',
  hp_flat: 'hp',
  impact_percent: 'impact',
  energy_regen_percent: 'enerRegen',
  energy_regen_flat: 'enerRegen',
  impact_flat: 'impact',
  crit_rate: 'crit_',
  crit_damage: 'crit_dmg_',
  laceration_damage: 'lacerationDamage',
  sharp_damage_bonus: 'sharpDamageBonus',
  sheer_force: 'sheerForce',
  sheer_damage_bonus: 'sheerDamageBonus',
  direct_damage_bonus: 'directDamageBonus',
  buff_bonus: 'buffBonus',
  damage_bonus: 'damageBonus',
  penetration_ratio: 'pen_',
}
export function planningEffectWrittenStats32(
  bucket: Pick<SourceBackedPlanningEffectBucket, 'application' | 'recipientAgentIds'>,
) {
  const stat = statByApplication[bucket.application]
  return stat ? bucket.recipientAgentIds.map((id) => `${id}:${stat}`) : []
}
export const planningFinalStatAlias32: Readonly<Record<string, string>> = {
  laceration_dmg_: 'lacerationDamage',
  sharp_dmg_: 'sharpDamageBonus',
  sheer_dmg_: 'sheerDamageBonus',
  direct_dmg_: 'directDamageBonus',
  buff_: 'buffBonus',
  dmg_: 'damageBonus',
  common_dmg_: 'damageBonus',
}

/** Recompute each stat from the original panel plus each admitted bucket once. */
function resolvedStats(
  members: readonly PlanningEffectRuntimeMember[],
  buckets: readonly SourceBackedPlanningEffectBucket[],
) {
  const stats: Record<string, PlanningEffectRuntimeStats> = {}
  for (const member of members) {
    const conversion = evaluateInitialCritConversion32({
      agentId: member.agentId,
      initialStats: member.initialStats,
    })
    if (conversion.status !== 'supported') return conversion
    const trace = member.finalStats.initialImpactConversion32
    if (trace) {
      const rebound = evaluateReviewedDialynInitialImpact32({
        initialCritRate: member.initialStats.crit_,
        coreLevel: member.coreLevel,
        potential: member.potential,
      })
      if (
        member.agentId !== 'agent-dialyn' ||
        rebound.status !== 'supported' ||
        trace.effectKey !== rebound.effectKey ||
        trace.impactIncrease !== rebound.impactIncrease ||
        trace.bindingHash !== rebound.bindingHash
      )
        return {
          status: 'unsupported' as const,
          blockers: ['琉音已投影冲击转换身份漂移，不能重复或复用旧值。'],
        }
    }
    const mods = emptyModifiers()
    const admitted = buckets.filter((row) => row.recipientAgentIds.includes(member.agentId))
    const projected = trace ? admitted.filter((row) => row.effectKey === trace.effectKey) : []
    if (
      projected.length > 1 ||
      projected.some(
        (row) =>
          row.providerAgentId !== member.agentId ||
          row.application !== 'impact_flat' ||
          row.value !== trace!.impactIncrease,
      )
    )
      return {
        status: 'unsupported' as const,
        blockers: ['琉音冲击转换来源桶重复或与投影不一致。'],
      }
    admitted.forEach((row) => {
      if (trace && row.effectKey === trace.effectKey) {
        return // The matching source conversion is already in the projected final panel.
      }
      addModifier(mods, row)
    })
    const panel = member.finalStats
    const energy = applyPlanningNaturalEnergyModifiers32(
      member.initialStats.enerRegen,
      panel.enerRegen,
      admitted,
    )
    if (energy.status !== 'supported') return energy
    stats[member.agentId] = {
      ...panel,
      atk: panel.atk + member.initialStats.atk * mods.attackPercent + mods.attackFlat,
      def: panel.def + member.initialStats.def * mods.defensePercent + mods.defenseFlat,
      hp: panel.hp + member.initialStats.hp * mods.hpPercent + mods.hpFlat,
      impact: panel.impact + member.initialStats.impact * mods.impactPercent + mods.impactFlat,
      crit_: panel.crit_ + conversion.critRate + mods.critRate,
      crit_dmg_: panel.crit_dmg_ + mods.critDamage,
      pen_: panel.pen_ + mods.penetrationRatio,
      enerRegen: energy.value,
      ...(panel.lacerationDamage === undefined
        ? {}
        : { lacerationDamage: panel.lacerationDamage + mods.lacerationDamage }),
      ...(panel.sheerForce === undefined ? {} : { sheerForce: panel.sheerForce + mods.sheerForce }),
      ...(panel.damageBonus === undefined
        ? {}
        : { damageBonus: panel.damageBonus + mods.damageBonus }),
      ...(panel.directDamageBonus === undefined
        ? {}
        : { directDamageBonus: panel.directDamageBonus + mods.directDamageBonus }),
    }
  }
  return { status: 'supported' as const, stats }
}

/** Final-stat dependencies are a finite DAG; cycles and non-finite inputs fail closed. */
export function resolvePlanningEffectGraph32(input: {
  members: readonly PlanningEffectRuntimeMember[]
  buckets: readonly SourceBackedPlanningEffectBucket[]
  nodes: readonly PlanningEffectGraphNode32[]
}) {
  if (new Set(input.nodes.map((node) => node.id)).size !== input.nodes.length)
    return { status: 'unsupported' as const, blockers: ['事件效果图包含重复来源节点。'] }
  if (input.buckets.some((bucket) => !Number.isFinite(bucket.value)))
    return { status: 'unsupported' as const, blockers: ['事件属性产生来源包含无效数值。'] }
  const pending = [...input.nodes]
  const buckets = [...input.buckets]
  const order: string[] = []
  while (pending.length) {
    const ready = pending.filter(
      (node) =>
        !pending.some((producer) => producer.writes.some((stat) => node.reads.includes(stat))),
    )
    if (!ready.length)
      return {
        status: 'unsupported' as const,
        blockers: [`事件最终属性存在循环依赖：${pending.map((node) => node.id).join(', ')}`],
      }
    const resolved = resolvedStats(input.members, buckets)
    if (resolved.status !== 'supported') return resolved
    for (const node of ready) {
      for (const ref of node.reads) {
        const split = ref.lastIndexOf(':')
        const value =
          resolved.stats[ref.slice(0, split)]?.[
            ref.slice(split + 1) as keyof PlanningEffectRuntimeStats
          ]
        if (typeof value !== 'number' || !Number.isFinite(value))
          return {
            status: 'unsupported' as const,
            blockers: [`事件最终属性依赖缺失或无效：${ref}`],
          }
      }
      const result = node.evaluate(resolved.stats)
      if (result.status !== 'supported') return result
      if (result.buckets.some((bucket) => !Number.isFinite(bucket.value)))
        return { status: 'unsupported' as const, blockers: [`事件效果数值无效：${node.id}`] }
      buckets.push(...result.buckets)
      order.push(node.id)
      pending.splice(pending.indexOf(node), 1)
    }
  }
  const result = resolvedStats(input.members, buckets)
  return result.status !== 'supported'
    ? result
    : { status: 'supported' as const, buckets, finalStats: result.stats, order }
}
