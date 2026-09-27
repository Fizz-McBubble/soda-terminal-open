import { stableContentHash } from '../gameDataPacks/types'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import {
  evaluateCurrentPlanningFormationEffects,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectRuntime'
import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from './currentAgentMechanicContracts'
import type { PlanningBaseline } from './planningDpsContract'
import { calculateStandardDirectDamageCore } from './directDamageCore'
import {
  bindReviewedPotentialApplications,
  type PotentialApplicationBinding,
  type PotentialApplicationEvent,
} from './potentialApplicationBinding'

export type SourceBackedPlanningEffectBucket = {
  bucketId: string
  effectKey: string
  providerAgentId: string
  recipientAgentIds: string[]
  receiverPath: string | null
  damageType: string | null
  action: string | null
  attribute: string | null
  value: number
  application:
    | 'attack_percent'
    | 'attack_flat'
    | 'crit_rate'
    | 'crit_damage'
    | 'damage_bonus'
    | 'defense_reduction'
    | 'defense_ignore'
    | 'resistance_reduction'
    | 'resistance_ignore'
    | 'outside_direct_event_formula'
  sourceRefs: string[]
}

export type SourceBackedEquipmentModifierBucket = Omit<
  SourceBackedPlanningEffectBucket,
  'effectKey' | 'receiverPath' | 'damageType'
> & {
  effectKey: string
  receiverPath: null
  damageType: null
}

type DirectDamageModifiers = {
  attackPercent: number
  attackFlat: number
  critRate: number
  critDamage: number
  damageBonus: number
  defenseReduction: number
  defenseIgnore: number
  resistanceReduction: number
  resistanceIgnore: number
  penetrationRatio: number
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function recipientIds(input: {
  targetKinds: readonly string[]
  providerAgentId: string
  memberIds: readonly [string, string, string]
}) {
  if (input.targetKinds.includes('self')) return [input.providerAgentId]
  if (input.targetKinds.includes('active_agent')) return [input.memberIds[0]]
  // Enemy debuffs and team buffs are both applied against each member's own
  // fixed event damage. This records the shared source once per recipient,
  // rather than inventing an owner-damage bucket.
  return [...input.memberIds]
}

function applicationForReceiver(receiverPath: string | null) {
  if (!receiverPath) return 'outside_direct_event_formula' as const
  if (/enemyDebuff\..*\.defRed_?$/.test(receiverPath)) return 'defense_reduction' as const
  if (/ownBuff\..*\.defIgn_?$/.test(receiverPath)) return 'defense_ignore' as const
  if (/enemyDebuff\..*\.resRed_?/.test(receiverPath)) return 'resistance_reduction' as const
  if (/(ownBuff|teamBuff)\..*\.resIgn_?/.test(receiverPath)) return 'resistance_ignore' as const
  if (/(ownBuff|teamBuff)\..*\.crit_dmg_?$/.test(receiverPath)) return 'crit_damage' as const
  if (/(ownBuff|teamBuff)\..*\.crit_?(\.|$)/.test(receiverPath)) return 'crit_rate' as const
  if (/(ownBuff|teamBuff)\..*\.atk_$/.test(receiverPath)) return 'attack_percent' as const
  if (/(ownBuff|teamBuff)\..*\.atk(\.|$)/.test(receiverPath)) return 'attack_flat' as const
  if (/(ownBuff|teamBuff|enemyDebuff)\..*(common_dmg_|dmgInc_|\.dmg_|\.buff_$)/.test(receiverPath))
    return 'damage_bonus' as const
  return 'outside_direct_event_formula' as const
}

function emptyModifiers(): DirectDamageModifiers {
  return {
    attackPercent: 0,
    attackFlat: 0,
    critRate: 0,
    critDamage: 0,
    damageBonus: 0,
    defenseReduction: 0,
    defenseIgnore: 0,
    resistanceReduction: 0,
    resistanceIgnore: 0,
    penetrationRatio: 0,
  }
}

function addModifier(target: DirectDamageModifiers, bucket: SourceBackedPlanningEffectBucket) {
  if (bucket.application === 'outside_direct_event_formula') return
  if (bucket.application === 'attack_percent') target.attackPercent += bucket.value
  if (bucket.application === 'attack_flat') target.attackFlat += bucket.value
  if (bucket.application === 'crit_rate') target.critRate += bucket.value
  if (bucket.application === 'crit_damage') target.critDamage += bucket.value
  if (bucket.application === 'damage_bonus') target.damageBonus += bucket.value
  if (bucket.application === 'defense_reduction') target.defenseReduction += bucket.value
  if (bucket.application === 'defense_ignore') target.defenseIgnore += bucket.value
  if (bucket.application === 'resistance_reduction') target.resistanceReduction += bucket.value
  if (bucket.application === 'resistance_ignore') target.resistanceIgnore += bucket.value
}

function matchesEventScope(
  bucket: SourceBackedPlanningEffectBucket,
  event: { actionId: string; skill: string },
  memberAttribute: string,
) {
  if (bucket.attribute && bucket.attribute !== memberAttribute) return false
  if (!bucket.action) return true
  if (bucket.action === 'basic_attack')
    return event.skill === 'basic' && !event.actionId.startsWith('DashAttack')
  if (bucket.action === 'basic')
    return event.skill === 'basic' && !event.actionId.startsWith('DashAttack')
  if (bucket.action === 'dash') return event.actionId.startsWith('DashAttack')
  if (bucket.action === 'dodge_counter') return event.actionId.startsWith('DodgeCounter')
  if (bucket.action === 'ex_special') return event.actionId.startsWith('EXSpecialAttack')
  if (bucket.action === 'chain') return event.actionId.startsWith('ChainAttack')
  if (bucket.action === 'ultimate') return event.actionId.startsWith('Ultimate')
  return false
}

function directDamage(input: {
  member: PlanningEffectRuntimeMember
  buckets: readonly SourceBackedPlanningEffectBucket[]
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
  potentialApplications?: PotentialApplicationBinding[]
}) {
  const stats = input.member.finalStats
  const identity = getCurrentAgentEventContract(input.member.agentId)?.identity
  if (!identity) return null
  const damage = input.eventUsages.reduce((sum, usage) => {
    const contract = getCurrentAgentEventContract(usage.ownerAgentId)
    const event = contract?.eventContract.events.find((item) => item.eventId === usage.eventId)
    const resolved = resolveCurrentAgentEvent({
      stableId: usage.ownerAgentId,
      eventId: usage.eventId,
      skillLevel: usage.skillLevel,
    })
    if (resolved.status !== 'supported' || !event) return Number.NaN
    let actionDamageBonus = 0
    for (const bonus of stats.actionDamageBonuses ?? []) {
      const matches = bonus.actionTypes.some(
        (action) =>
          (action === 'basic' && event.skill === 'basic') ||
          (action === 'dash' && event.actionId.startsWith('DashAttack')),
      )
      if (matches) actionDamageBonus += bonus.value
      // The event catalog currently has no aftershock classification. A
      // non-matching event must not silently turn this known bonus into zero.
      else if (bonus.actionTypes.some((action) => action !== 'basic' && action !== 'dash'))
        return Number.NaN
    }
    const modifiers = emptyModifiers()
    const observed = input.potentialEvents?.[`${input.member.agentId}:${usage.eventId}`]
    const potential = bindReviewedPotentialApplications({
      member: {
        agentId: input.member.agentId,
        potential: input.member.potential,
        initialStats: input.member.initialStats,
        provenance: 'calculation_context',
      },
      event:
        observed?.eventId === usage.eventId
          ? observed
          : {
              eventId: usage.eventId,
              actionFamilies: [],
              providerStateKeys: [],
              targetStateKeys: [],
              sourceRefs: [`planning-baseline:${input.baseline.baselineId}:event:${usage.eventId}`],
            },
    })
    for (const effect of potential) {
      // Only formula families supported by this direct-event calculator are
      // applied. Timers, anomaly and daze remain explicit exclusions, never
      // reinterpreted as an ordinary damage multiplier.
      let consumed = false
      if (effect.status === 'applied' && effect.targetKind === 'self') {
        if (effect.effectId === 'potential_penetration') {
          modifiers.penetrationRatio += effect.value
          consumed = true
        } else if (effect.bucket === 'self_damage') {
          modifiers.damageBonus += effect.value
          consumed = true
        }
      }
      input.potentialApplications?.push(
        effect.status === 'applied' && !consumed
          ? {
              ...effect,
              status: 'excluded',
              eligibleEventIds: [],
              reason: '当前固定直接伤害公式未消费此效果类型。',
            }
          : effect,
      )
    }
    input.buckets
      .filter(
        (bucket) =>
          bucket.recipientAgentIds.includes(input.member.agentId) &&
          matchesEventScope(bucket, event, identity.attribute),
      )
      .forEach((bucket) => addModifier(modifiers, bucket))
    const resistance = Math.max(
      -1,
      Math.min(
        1,
        (input.baseline.enemy.resistance - modifiers.resistanceReduction) *
          (1 - Math.min(1, Math.max(0, modifiers.resistanceIgnore))),
      ),
    )
    try {
      return (
        sum +
        calculateStandardDirectDamageCore({
          // This adapter's declared comparison baseline is level 60, not a
          // general level-scaling runtime. The shared core resolves its coefficient.
          attackerLevel: 60,
          attack: stats.atk,
          attackPercent: modifiers.attackPercent,
          attackFlat: modifiers.attackFlat,
          multiplier: resolved.damageMultiplier,
          hitCount: usage.occurrenceCount,
          critRate: stats.crit_ + modifiers.critRate,
          critDamage: stats.crit_dmg_ + modifiers.critDamage,
          damageBonus: (stats.damageBonus ?? 0) + actionDamageBonus + modifiers.damageBonus,
          vulnerability: input.baseline.enemy.vulnerability,
          defenseReduction: modifiers.defenseReduction,
          penetrationRatio: stats.pen_ + modifiers.penetrationRatio,
          penetrationFlat: stats.pen ?? 0,
          enemyDefense:
            input.baseline.enemy.defense * (1 - Math.min(1, Math.max(0, modifiers.defenseIgnore))),
          resistance,
          resistanceReduction: 0,
          stunMultiplier: input.baseline.enemy.stunMultiplier,
        }).expectedDamage
      )
    } catch {
      // Invalid observations remain unsupported instead of escaping as a
      // successful zero or breaking the entire account query.
      return Number.NaN
    }
  }, 0)
  return Number.isFinite(damage) ? damage : null
}

function directDamageFailureReason(member: PlanningEffectRuntimeMember) {
  return member.finalStats.actionDamageBonuses?.some((bonus) =>
    bonus.actionTypes.some((action) => action !== 'basic' && action !== 'dash'),
  )
    ? '当前动作资料未标注追击类型，暂不能比较这套驱动盘的动作加成。'
    : '当前属性或动作数值无法用于伤害比较。'
}

/** Single-agent fixed-event slice used by Development Value Benchmark.
 * The caller supplies only source-backed direct-damage equipment buckets;
 * team effects and unobserved triggers remain outside this slice. Static
 * equipment stats already live in finalStats and must not be added again. */
export function evaluateSourceBackedPersonalPlanningDps(input: {
  member: PlanningEffectRuntimeMember
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  equipmentModifierBuckets?: readonly SourceBackedEquipmentModifierBucket[]
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
}) {
  if (
    input.member.potential != null &&
    (!Number.isInteger(input.member.potential) ||
      input.member.potential < 0 ||
      input.member.potential > 6)
  )
    return { status: 'unsupported' as const, blockers: ['潜能影像必须为0至6的整数。'] }
  const potentialApplications: PotentialApplicationBinding[] = []
  const totalDamage = directDamage({
    member: input.member,
    buckets: input.equipmentModifierBuckets ?? [],
    eventUsages: input.eventUsages.filter((usage) => usage.ownerAgentId === input.member.agentId),
    baseline: input.baseline,
    potentialEvents: input.potentialEvents,
    potentialApplications,
  })
  if (totalDamage === null || !Number.isFinite(totalDamage))
    return {
      status: 'unsupported' as const,
      blockers: [`${input.member.agentId}：${directDamageFailureReason(input.member)}`],
    }
  const core = {
    status: 'supported' as const,
    totalDamage,
    planningDps: totalDamage / input.baseline.declaredDurationSeconds,
    declaredDurationSeconds: input.baseline.declaredDurationSeconds,
    potentialApplications,
    equipmentModifierBuckets: [...(input.equipmentModifierBuckets ?? [])],
    directEquipmentEffectBucketCount: (input.equipmentModifierBuckets ?? []).filter(
      (bucket) => bucket.application !== 'outside_direct_event_formula',
    ).length,
    boundary:
      '单代理人固定事件只比较同一已确认音擎下的六盘变化，并消费已来源化且进入直接伤害公式的装备 bucket；静态盘面不重复叠加，队伍效果和未观测条件效果保持排除。',
  }
  return {
    ...core,
    runtimeHash: stableContentHash({
      ...core,
      baseline: input.baseline,
      potentialEvents: input.potentialEvents ?? null,
    }),
  }
}

/**
 * Applies only receiver semantics that are directly represented by the fixed
 * event direct-damage formula. Other source-backed effects remain explicit
 * buckets, rather than being silently folded into a made-up direct multiplier.
 */
export function evaluateSourceBackedPlanningTeamDps(input: {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  equipmentModifierBuckets?: readonly SourceBackedEquipmentModifierBucket[]
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
}) {
  const runtime = evaluateCurrentPlanningFormationEffects({
    memberIds: input.memberIds,
    members: input.members,
    baselineReferencesByAgentId: input.baselineReferencesByAgentId,
  })
  if (runtime.status === 'unsupported') return runtime
  const buckets: SourceBackedPlanningEffectBucket[] = runtime.results.flatMap((effect) => {
    if (effect.status !== 'supported' || !effect.active || typeof effect.value !== 'number')
      return []
    const application = applicationForReceiver(effect.receiverPath)
    return [
      {
        bucketId: `effect:${effect.effectKey}`,
        effectKey: effect.effectKey,
        providerAgentId: effect.providerAgentId,
        recipientAgentIds: recipientIds({
          targetKinds: effect.targetKinds,
          providerAgentId: effect.providerAgentId,
          memberIds: input.memberIds,
        }),
        receiverPath: effect.receiverPath,
        damageType: effect.damageType,
        action: null,
        attribute: null,
        value: effect.value,
        application,
        sourceRefs: effect.sourceRefs,
      },
    ]
  })
  const allBuckets = [...buckets, ...(input.equipmentModifierBuckets ?? [])]

  const damageByAgentId = new Map<string, number>()
  const potentialApplications: PotentialApplicationBinding[] = []
  const blockers: string[] = []
  for (const member of input.members) {
    const totalDamage = directDamage({
      member,
      buckets: allBuckets,
      eventUsages: input.eventUsages.filter((usage) => usage.ownerAgentId === member.agentId),
      baseline: input.baseline,
      potentialEvents: input.potentialEvents,
      potentialApplications,
    })
    if (totalDamage === null || !Number.isFinite(totalDamage)) {
      blockers.push(`${member.agentId}：${directDamageFailureReason(member)}`)
      continue
    }
    damageByAgentId.set(member.agentId, totalDamage)
  }
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }
  const memberDamage = input.memberIds.map((agentId) => ({
    agentId,
    totalDamage: damageByAgentId.get(agentId)!,
  }))
  return {
    status: 'supported' as const,
    memberDamage,
    potentialApplications,
    effectBuckets: buckets,
    equipmentModifierBuckets: [...(input.equipmentModifierBuckets ?? [])],
    directEffectBucketCount: buckets.filter(
      (bucket) => bucket.application !== 'outside_direct_event_formula',
    ).length,
    outsideDirectEventFormulaBucketCount: buckets.filter(
      (bucket) => bucket.application === 'outside_direct_event_formula',
    ).length,
    runtimeHash: stableContentHash({
      memberDamage,
      buckets: allBuckets,
      potentialApplications,
      baseline: input.baseline,
      potentialEvents: input.potentialEvents ?? null,
    }),
    boundary:
      '固定事件直接伤害只消费已由 CalculationContext 表示的攻、暴、伤害、穿透、减防与减抗 bucket；异常积蓄、失衡、资源和其他公式族效果保留为 source-backed bucket，不补零或伪装为直接伤害。',
  }
}
