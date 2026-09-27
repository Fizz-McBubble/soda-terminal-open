import { currentAgentDirectory } from '../assault/catalog'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import {
  candidatePanelPolicyPrerequisites,
  getCandidatePanelPolicy,
} from '../gameDataPacks/candidatePanelPolicy'
import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'

export type TwoPiecePriority = { order: number; label: string; reason: string; effectKey: string }

export type TwoPiecePanelContext = {
  values: Partial<
    Record<
      'atk' | 'critRate' | 'critDamage' | 'impact' | 'energyRegen' | 'anomalyProficiency',
      number
    >
  >
  /** Base values from the panel trace. Percent two-piece effects apply to these. */
  baseValues?: Partial<
    Record<
      'atk' | 'critRate' | 'critDamage' | 'impact' | 'energyRegen' | 'anomalyProficiency',
      number
    >
  >
  /** Game-facing Core level (2-7); required to activate source-bound Core prerequisites. */
  coreLevel?: number
  currentSetIds: readonly string[]
}

const statKeys: Record<string, string> = {
  atk_: 'atk_percent',
  hp_: 'hp_percent',
  def_: 'def_percent',
  crit_: 'crit_rate',
  crit_dmg_: 'crit_dmg',
  anomProf: 'anomaly_proficiency',
  anomMas_: 'anomaly_mastery',
  impact_: 'impact',
  enerRegen_: 'energy_regen',
  pen_: 'pen_ratio',
}
const statNames: Record<string, string> = {
  atk_: '攻击力',
  hp_: '生命值',
  def_: '防御力',
  crit_: '暴击率',
  crit_dmg_: '暴击伤害',
  anomProf: '异常精通',
  anomMas_: '异常掌控',
  impact_: '冲击力',
  enerRegen_: '回能',
  pen_: '穿透率',
}

/** Guidance, not a damage score. Rank only within the already-authorized secondary pool.
 * Numeric effects come from the locked formula catalog. Executable thresholds come
 * from candidatePanelPolicy; softer guide values remain explicitly non-binding.
 * Conditions describe the panel AFTER changing sets, so an ATK set cannot be removed
 * merely because the current panel (which still includes it) reaches the threshold.
 */
export function twoPieceRecommendationPriority(
  setId: string,
  constraint: CandidateWarehouseConstraint,
  primarySetId: string,
  panelContext?: TwoPiecePanelContext,
): TwoPiecePriority {
  const modifiers = getCurrentDriveDiscFormulaData(setId)?.twoPieceModifiers ?? []
  const effectKey = JSON.stringify(
    modifiers.map((m) => [m.stat, m.value, [...(m.actionTypes ?? [])].sort()]).sort(),
  )
  const stat = modifiers[0]?.stat ?? ''
  const id = constraint.agentId.replace('candidate-3.1-', '')
  const result = (order: number, label: string, reason: string): TwoPiecePriority => ({
    order,
    label,
    reason,
    effectKey,
  })
  const panelKeyByModifier: Record<string, keyof TwoPiecePanelContext['values'] | undefined> = {
    atk_: 'atk',
    crit_: 'critRate',
    crit_dmg_: 'critDamage',
    impact_: 'impact',
    enerRegen_: 'energyRegen',
    anomProf: 'anomalyProficiency',
  }
  const panelKey = panelKeyByModifier[stat]
  const percentStats = new Set(['atk_', 'impact_', 'enerRegen_'])
  const modifierValueForStat = (id: string, requestedStat = stat) =>
    (getCurrentDriveDiscFormulaData(id)?.twoPieceModifiers ?? []).reduce(
      (sum, modifier) =>
        modifier.stat === requestedStat
          ? sum +
            (percentStats.has(requestedStat)
              ? (panelContext?.baseValues?.[panelKeyByModifier[requestedStat]!] ?? 0) *
                modifier.value
              : modifier.value * (requestedStat === 'anomProf' ? 1 : 100))
          : sum,
      0,
    )
  const modifierValue = (id: string) => modifierValueForStat(id)
  const projectedPanelValue =
    panelContext &&
    panelKey &&
    panelContext.values[panelKey] !== undefined &&
    (!percentStats.has(stat) || panelContext.baseValues?.[panelKey] !== undefined)
      ? (panelContext.values[panelKey] ?? 0) -
        [...new Set(panelContext.currentSetIds)].reduce((sum, id) => sum + modifierValue(id), 0) +
        modifierValue(setId) +
        modifierValue(primarySetId)
      : undefined
  const projectedAttack =
    panelContext?.values.atk !== undefined && panelContext.baseValues?.atk !== undefined
      ? panelContext.values.atk -
        [...new Set(panelContext.currentSetIds)].reduce(
          (sum, id) => sum + modifierValueForStat(id, 'atk_'),
          0,
        ) +
        modifierValueForStat(setId, 'atk_') +
        modifierValueForStat(primarySetId, 'atk_')
      : undefined
  const softReferences: Record<string, { target: number; after: string; name: string }> = {
    'agent-remielle': { target: 4000, after: 'anomProf', name: '异常精通' },
    'agent-sunna': { target: 3500, after: 'enerRegen_', name: '回能' },
  }
  if (id === 'agent-ju-fufu' && primarySetId === 'set-king-of-the-summit') {
    if (stat === 'impact_')
      return result(
        1,
        '双目标条件后可选',
        '仅在换套后仍满足50%暴击与3400攻击两个条件时，再补冲击力。',
      )
    if (stat === 'atk_')
      return result(0, '先核对双目标', '先保证50%暴击并补至3400攻击；单个攻击值不代表条件完成。')
  }
  const policy = getCandidatePanelPolicy(id)
  const policyAfter =
    policy?.priorityStat === 'energyRegen'
      ? { stat: 'enerRegen_', name: '回能' }
      : policy?.priorityStat === 'anomalyProficiency'
        ? { stat: 'anomProf', name: '异常精通' }
        : null
  if (policy && policyAfter && (stat === 'atk_' || stat === policyAfter.stat)) {
    const prerequisites = candidatePanelPolicyPrerequisites(policy, {
      coreLevel: panelContext?.coreLevel,
      fourPieceSetId: primarySetId,
    })
    if (!prerequisites.executable) {
      const missing = [
        ...(!prerequisites.coreSatisfied ? ['满级核心技'] : []),
        ...(!prerequisites.fourPieceSatisfied ? ['静听嘉音4件套'] : []),
      ].join('、')
      return result(
        1,
        '来源条件参考',
        `${policy.minimumAttack}攻击的切换建议要求${missing}；当前未证明前提，不作为硬门槛排序。`,
      )
    }
    if (projectedAttack !== undefined) {
      if (stat === 'atk_' && projectedAttack >= policy.minimumAttack)
        return result(
          2,
          '攻击已达标，按缺口选',
          `换套后攻击约 ${projectedAttack.toFixed(0)}，已达到 ${policy.minimumAttack} 可执行目标。`,
        )
      if (stat === policyAfter.stat && projectedAttack < policy.minimumAttack)
        return result(
          2,
          '攻击未达标时暂缓',
          `换套后攻击约 ${projectedAttack.toFixed(0)}，低于 ${policy.minimumAttack} 可执行目标。`,
        )
    }
    return stat === 'atk_'
      ? result(
          0,
          '攻击未达标时首选',
          `先补至 ${policy.minimumAttack} 攻击；换套后仍达标，再选${policyAfter.name}。`,
        )
      : result(
          1,
          '攻击达标后优先',
          `换套后仍有 ${policy.minimumAttack} 攻击时，优先补${policyAfter.name}。`,
        )
  }
  const softReference = softReferences[id]
  if (softReference && (stat === 'atk_' || stat === softReference.after)) {
    const projected =
      projectedAttack === undefined ? '' : `换套后攻击约 ${projectedAttack.toFixed(0)}；`
    return stat === 'atk_'
      ? result(
          0,
          '攻略软参考 · 攻击',
          `${projected}${softReference.target}仅为攻略参考值，可优先补攻击，但不作为已验证硬门槛。`,
        )
      : result(
          1,
          `攻略软参考 · ${softReference.name}`,
          `${projected}接近攻略参考值 ${softReference.target} 后可按缺口补${softReference.name}；不据此判定达标。`,
        )
  }
  if (id === 'agent-pyrois' && (stat === 'crit_' || stat === 'crit_dmg_'))
    return stat === 'crit_'
      ? result(0, '暴击不足时首选', '暴击率先补至 57%；参考区间 57%–72%，按被动与1影生效前面板。')
      : result(
          1,
          '暴击达标后优先',
          '换套后、被动与1影生效前仍达57%暴击时补暴伤；超过 72% 时优先此套。',
        )
  if (id === 'agent-ye-shunguang' && stat === 'crit_dmg_' && projectedPanelValue !== undefined) {
    if (projectedPanelValue >= 200)
      return result(
        2,
        '暴伤已达标，按缺口选',
        `换套后暴伤约 ${projectedPanelValue.toFixed(1)}%，已达到常用 180%–200% 目标。`,
      )
    return result(
      0,
      '暴伤不足时首选',
      `换套后暴伤约 ${projectedPanelValue.toFixed(1)}%，优先补至 180%–200%+。`,
    )
  }
  if (id === 'agent-ye-shunguang' && stat === 'crit_dmg_')
    return result(0, '常用首选', '优先补暴伤，参考目标 180%–200%+。')
  if (id === 'agent-trigger' && primarySetId === 'set-king-of-the-summit' && stat === 'impact_')
    return result(
      1,
      '暴击达标后可选',
      '山大王4件套更建议配专属音擎；换套后暴击仍至少90%、有溢出时再选震星。',
    )
  if (id === 'agent-nicole')
    return result(
      0,
      '同级备选',
      stat === 'anomProf'
        ? '异常队可选，补异常精通；与攻击副套没有固定高低。'
        : '补自身攻击伤害；与精通副套没有固定高低。',
    )
  const role = currentAgentDirectory.find((agent) => agent.id === id)?.specialty
  const mains: readonly string[] = Object.values(constraint.mainStats).flat()
  const key = statKeys[stat] ?? stat.replace('_dmg_', '_dmg')
  const weights = constraint.subStatWeights as Record<string, number | undefined>
  const highestWeight = Math.max(
    0,
    ...Object.values(weights).filter((v): v is number => v !== undefined),
  )
  if (stat === 'crit_' || stat === 'crit_dmg_') {
    return result(
      weights[key] === highestWeight ? 0 : 1,
      stat === 'crit_' ? '补暴击优先' : '补暴伤优先',
      stat === 'crit_'
        ? '暴击率未到推荐区间时选；计入战斗增益后避免溢出。'
        : '换套后暴击率仍够用时选；双暴都不足时按面板缺口选择。',
    )
  }
  if (role === 'stun' && stat === 'impact_')
    return result(0, '击破优先', '直接补冲击力，优先保证失衡能力。')
  if (role === 'stun' && stat === 'dazeInc_')
    return result(0, '击破优先', '直接提高失衡值；与冲击副套按角色增益需求选择。')
  if (stat === 'enerRegen_')
    return result(
      role === 'stun' || role === 'support' || mains.includes('energy_regen') ? 0 : 2,
      '循环优先',
      '强化特殊技衔接不顺时选；回能够用后可换伤害或增益属性。',
    )
  if (stat === 'pen_')
    return result(
      id === 'agent-rina' ? 0 : 2,
      id === 'agent-rina' ? '增益首选' : '穿透备选',
      id === 'agent-rina'
        ? '优先补穿透率，服务自身的支援增益。'
        : '适合穿透搭配；按敌人防御和队伍增益选择。',
    )
  if (stat === 'action_dmg_')
    return result(
      2,
      '招式备选',
      `以${modifiers[0]?.actionTypes?.map((action) => ({ basic: '普攻', dash: '冲刺攻击', aftershock: '追加攻击' })[action]).join('、')}为主要伤害时选。`,
    )
  if (stat === 'shield_') return result(2, '护盾备选', '需要更厚护盾时选。')
  if (
    (role === 'support' || role === 'defense') &&
    ['atk_', 'hp_', 'def_'].includes(stat) &&
    mains.includes(key)
  )
    return result(0, '增益优先', `先用${statNames[stat]}补角色的增益或护盾目标；达标后再补循环。`)
  if (stat === 'anomMas_')
    return result(
      mains.includes('anomaly_mastery') ? 0 : 1,
      '积蓄优先',
      '需要更快触发异常时选；单次异常伤害不足则补精通。',
    )
  if (stat === 'anomProf')
    return result(
      role === 'anomaly' ? 0 : 1,
      '异常伤害优先',
      '提高异常伤害；与掌控副套按伤害和积蓄需求选择。',
    )
  const preferred = weights[key] === highestWeight || (key.endsWith('_dmg') && mains.includes(key))
  return result(
    preferred ? 0 : 1,
    preferred ? '常用优先' : '备选',
    statNames[stat]
      ? `补${statNames[stat]}；主需求达标后，按副词条质量选择。`
      : '提高对应属性伤害；与其他伤害副套按面板缺口选择。',
  )
}
