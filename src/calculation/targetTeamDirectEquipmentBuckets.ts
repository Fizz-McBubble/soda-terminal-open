import type { SourceBackedEquipmentModifierBucket } from './currentPlanningTeamDpsRuntime'
import type { CurrentWEngineFormulaRuntime } from './currentWEnginePersonalPlanningEffects'
import { stableContentHash } from '../gameDataPacks/types'
import { CAGE_OF_CONFINED_SIN_STABLE_ID, FIRST_PLUMAGE_STABLE_ID } from './reviewedWEngine33'
import { planningWEngineActions as directActionBySource } from './currentPlanningWEngineDependencies32'
import { currentCombatPlanningModifierTargets } from './currentCombatPlanningModifierTargets'
import {
  functionalEffectMetadata32,
  hasReviewedShieldConsumer32,
  sourceEquipmentEffectMetadata32,
} from './reviewedFunctionalEquipmentDependencies32'

const directApplicationByStat: Readonly<
  Record<string, SourceBackedEquipmentModifierBucket['application']>
> = {
  attack_percent: 'attack_percent',
  hp_percent: 'hp_percent',
  hp_flat: 'hp_flat',
  crit_rate: 'crit_rate',
  crit_damage: 'crit_damage',
  damage_bonus: 'damage_bonus',
  ...currentCombatPlanningModifierTargets,
}
const explicitlyExcludedDirectStats = new Set([
  'combat.anomBuildup_',
  'combat.anomProf',
  'combat.anomMas',
  'combat.dmg_red_',
  'combat.dazeInc_',
])

export function compileTargetTeamDirectEquipmentBuckets(input: {
  memberIds: readonly [string, string, string]
  wEngines: Array<{
    agentId: string
    engineId: string
    passiveStatus: 'supported' | 'unsupported'
    effects: unknown[]
    blockers: string[]
    exclusions: Array<Record<string, unknown>>
    sourceRefs: string[]
    runtime?: CurrentWEngineFormulaRuntime
  }>
}) {
  const blockers = input.wEngines.flatMap((item) => item.blockers)
  const exclusions: Array<Record<string, unknown>> = input.wEngines.flatMap((item) =>
    item.exclusions.map((exclusion) => ({
      ...(item.engineId === FIRST_PLUMAGE_STABLE_ID
        ? functionalEffectMetadata32('own.combat.dmg_.fire', item.agentId, input.memberIds)
        : item.engineId === CAGE_OF_CONFINED_SIN_STABLE_ID
          ? functionalEffectMetadata32('own.combat.atk_', item.agentId, input.memberIds)
          : sourceEquipmentEffectMetadata32(
              'wengine',
              item.engineId,
              exclusion.effectIndex,
              item.agentId,
              input.memberIds,
              typeof exclusion.recipientAgentId === 'string'
                ? exclusion.recipientAgentId
                : undefined,
            )),
      engineId: item.engineId,
      agentId: item.agentId,
      reason: 'unobserved_conditional_effect',
      ...exclusion,
    })),
  )
  const buckets: SourceBackedEquipmentModifierBucket[] = []
  for (const item of input.wEngines) {
    if (item.passiveStatus === 'unsupported') continue
    item.effects.forEach((rawEffect, index) => {
      if (!rawEffect || typeof rawEffect !== 'object') {
        blockers.push(`${item.engineId} 返回了不可识别的被动效果。`)
        return
      }
      const effect = rawEffect as Record<string, unknown>
      if (effect.kind === 'damage_event' && effect.owner === 'own') {
        exclusions.push({
          ...functionalEffectMetadata32('own.damage_event', item.agentId, input.memberIds),
          engineId: item.engineId,
          agentId: item.agentId,
          effectIndex: index,
          reason: 'separate_equipment_damage_event_requires_occurrence',
          sourceRefs: item.sourceRefs,
        })
        return
      }
      if (effect.kind !== 'modifier') {
        blockers.push(
          `${item.engineId} 的 ${String(effect.kind)} 尚未进入固定事件直接伤害 runtime。`,
        )
        return
      }
      const stat = String(effect.stat)
      const channel =
        /^combat\.(dmg_|common_dmg_|crit_dmg_|laceration_dmg_|sharp_dmg_|sheer_dmg_|direct_dmg_|buff_|defIgn_|resIgn_)\.(physical|fire|ice|electric|ether|wind)$/.exec(
          stat,
        )
      const application = channel
        ? directApplicationByStat[`combat.${channel[1]}` as keyof typeof directApplicationByStat]
        : directApplicationByStat[stat as keyof typeof directApplicationByStat]
      const metadata = functionalEffectMetadata32(
        typeof effect.target === 'string' ? `${effect.target}.${stat}` : null,
        item.agentId,
        input.memberIds,
      )
      if (!application) {
        if (
          explicitlyExcludedDirectStats.has(stat) ||
          /^combat\.anomBuildup_\.(physical|fire|ice|electric|ether|wind)$/.test(stat)
        ) {
          exclusions.push({
            ...metadata,
            engineId: item.engineId,
            agentId: item.agentId,
            effectIndex: index,
            reason: 'outside_fixed_event_direct_damage_domain',
            stat: effect.stat,
            action: effect.action ?? null,
          })
          return
        }
        blockers.push(
          `${item.engineId} 的 modifier ${String(effect.stat)} 不属于当前直接伤害公式域。`,
        )
        return
      }
      const enemyDefenseReduction = effect.target === 'enemy' && application === 'defense_reduction'
      if (effect.target !== 'own' && effect.target !== 'team' && !enemyDefenseReduction) {
        blockers.push(`${item.engineId} 的 modifier target ${String(effect.target)} 尚未适配。`)
        return
      }
      if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
        blockers.push(`${item.engineId} 的 modifier 数值无效。`)
        return
      }
      const action = effect.action == null ? null : directActionBySource[String(effect.action)]
      if (effect.action != null && !action) {
        exclusions.push({
          ...metadata,
          engineId: item.engineId,
          agentId: item.agentId,
          effectIndex: index,
          reason: 'outside_fixed_event_action_set',
          action: effect.action,
        })
        return
      }
      // The per-recipient formula pass retains an enemy-wide effect once on
      // the provider's row. Its benefit still applies to every attacker.
      const recipientAgentIds = enemyDefenseReduction
        ? [...input.memberIds]
        : Array.isArray(effect.recipientAgentIds)
          ? effect.recipientAgentIds.filter(
              (id): id is string => typeof id === 'string' && input.memberIds.includes(id),
            )
          : effect.target === 'team'
            ? [...input.memberIds]
            : [item.agentId]
      if (application === 'shield_percent') {
        for (const recipient of recipientAgentIds.filter((id) => !hasReviewedShieldConsumer32(id)))
          exclusions.push({
            ...metadata,
            recipientAgentIds: [recipient],
            engineId: item.engineId,
            agentId: item.agentId,
            effectIndex: index,
            reason: 'shield_consumer_unmodeled',
            stat,
          })
      }
      const modeledRecipients =
        application === 'shield_percent'
          ? recipientAgentIds.filter(hasReviewedShieldConsumer32)
          : recipientAgentIds
      if (!modeledRecipients.length) return
      buckets.push({
        bucketId: `wengine:${item.agentId}:${item.engineId}:${index}`,
        effectKey: ['wengine', item.engineId, 'P', index].join(':'),
        providerAgentId: item.agentId,
        recipientAgentIds: modeledRecipients,
        receiverPath: /^(combat|initial|final|common)\./.test(stat)
          ? `${effect.target}.${stat}`
          : null,
        damageType: null,
        action: action ?? null,
        attribute: channel?.[2] ?? (typeof effect.attribute === 'string' ? effect.attribute : null),
        value: effect.value,
        application,
        sourceRefs: item.sourceRefs,
        ...(item.engineId === 'wengine-13011' && application === 'energy_regen_percent'
          ? {
              sourceReceiverObservation: {
                engineId: item.engineId,
                memberIds: [...input.memberIds],
                recipientAgentId: item.runtime?.recipients?.['SpringEmbrace:recipientAgentId'],
                activeProviderAgentId:
                  item.runtime?.recipients?.['SpringEmbrace:activeProviderAgentId'],
              },
            }
          : {}),
      })
    })
  }
  // A single-target packet can carry one Weeping Cradle passive per recipient.
  // Different reported strengths need an observed active effect owner.
  const cradleByRecipient = new Map<string, number>()
  const effectiveBuckets = buckets.filter((bucket) => {
    if (!bucket.effectKey.startsWith('wengine:wengine-14121:')) return true
    const recipients = [...(bucket.recipientAgentIds ?? input.memberIds)].sort().join('|')
    const prior = cradleByRecipient.get(recipients)
    if (prior === undefined) {
      cradleByRecipient.set(recipients, bucket.value)
      return true
    }
    if (prior !== bucket.value) blockers.push('啜泣摇篮同名效果需要确定当前目标的生效来源。')
    return false
  })
  const core = {
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    buckets: effectiveBuckets,
    exclusions,
    blockers: [...new Set(blockers)],
    boundary:
      '静态音擎事实照常进入角色面板；仅可映射的直接伤害 modifier 进入固定事件 runtime。未观测条件效果及异常/失衡等非直接伤害域效果显式排除并留痕，不补零、不伪造触发。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
