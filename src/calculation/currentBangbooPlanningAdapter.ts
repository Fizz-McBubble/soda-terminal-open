import {
  currentBangbooNumericCatalog,
  projectCurrentBangbooStats,
} from '../gameDataPacks/currentBangbooNumericCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { projectCurrentBangbooComposition32 } from './currentBangbooCompositionIdentity'
import { resolveCurrentBangbooMechanicContract } from './currentBangbooMechanicContracts'
import {
  currentBangbooFixedEventObservation,
  currentNormalizedPlanningBaseline,
} from './currentNormalizedPlanningBaseline'
import { calculateDamageFormula } from './damageFormulaDispatch'
import { isDamageFormula32Version } from './sharpDamageCore'
import type { PlanningBaseline } from './planningDpsContract'

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

export interface CurrentBangbooPlanningEnemyConditions {
  readonly id?: string
  readonly defense: number
  readonly resistance: number
  readonly stunMultiplier?: number
  readonly vulnerability?: number
}

export interface EvaluateCurrentBangbooPlanningParameterInput {
  readonly stableId: string
  readonly stars: number
  readonly memberIds: readonly [string, string, string]
  readonly additionalAbilityEnabled?: boolean
  readonly baseline?: PlanningBaseline
  readonly enemy?: CurrentBangbooPlanningEnemyConditions
  /** One declared fixed slice, not inferred from formation activation. */
  readonly eventFlags?: Readonly<Record<string, boolean>>
  readonly accumulators?: Readonly<Record<string, number>>
  readonly enemyCount?: number
}

/** Resolves one selected level-60 Bangboo settled under the normalized one-active/one-chain baseline against declared enemy conditions. */
export function evaluateCurrentBangbooPlanningParameter(
  input: EvaluateCurrentBangbooPlanningParameterInput,
) {
  const composition = projectCurrentBangbooComposition32(input.memberIds)
  const stats = projectCurrentBangbooStats({
    stableId: input.stableId,
    level: 60,
    ascensionLevelCap: 60,
  })
  const mechanic = resolveCurrentBangbooMechanicContract({
    stableId: input.stableId,
    bangbooLevel: 60,
    skillLevel: 10,
    additionalAbilityLevel: input.stars,
    composition,
    flags: input.eventFlags ?? {},
    accumulators: input.accumulators ?? {},
    unresolvedEventPolicy: 'exclude',
    additionalAbilityEnabled: input.additionalAbilityEnabled ?? true,
  })
  const blockers = [
    ...(stats.status === 'supported' ? [] : [`邦布 ${input.stableId} 缺少 60 级静态数值。`]),
    ...(mechanic.status === 'unsupported' ? mechanic.blockers : []),
  ]

  const baseline = input.baseline ?? currentNormalizedPlanningBaseline
  const enemyCount = input.enemyCount ?? 1
  if (!Number.isInteger(enemyCount) || enemyCount < 1) blockers.push('固定事件敌人数必须为正整数。')
  const declaredEnemy = input.enemy ?? baseline.enemy
  if (!declaredEnemy || typeof declaredEnemy !== 'object') {
    blockers.push('缺少敌方目标条件声明。')
  } else {
    if (
      typeof declaredEnemy.defense !== 'number' ||
      !Number.isFinite(declaredEnemy.defense) ||
      declaredEnemy.defense < 0
    ) {
      blockers.push('敌方防御值缺失或不合法。')
    }
    if (
      typeof declaredEnemy.resistance !== 'number' ||
      !Number.isFinite(declaredEnemy.resistance) ||
      declaredEnemy.resistance < -1 ||
      declaredEnemy.resistance > 1
    ) {
      blockers.push('敌方抗性缺失或不合法。')
    }
    if (
      declaredEnemy.stunMultiplier !== undefined &&
      (typeof declaredEnemy.stunMultiplier !== 'number' ||
        !Number.isFinite(declaredEnemy.stunMultiplier) ||
        declaredEnemy.stunMultiplier <= 0)
    ) {
      blockers.push('敌方失衡易伤倍率不合法。')
    }
    if (
      declaredEnemy.vulnerability !== undefined &&
      (typeof declaredEnemy.vulnerability !== 'number' ||
        !Number.isFinite(declaredEnemy.vulnerability))
    ) {
      blockers.push('敌方易伤不合法。')
    }
  }

  if (stats.status === 'supported') {
    if (
      typeof stats.critRate !== 'number' ||
      !Number.isFinite(stats.critRate) ||
      stats.critRate < 0
    ) {
      blockers.push(`邦布 ${input.stableId} 的暴击率数值无效。`)
    }
    if (
      typeof stats.critDamage !== 'number' ||
      !Number.isFinite(stats.critDamage) ||
      stats.critDamage < 0
    ) {
      blockers.push(`邦布 ${input.stableId} 的暴击伤害数值无效。`)
    }
    if (
      typeof stats.penetrationRatio !== 'number' ||
      !Number.isFinite(stats.penetrationRatio) ||
      stats.penetrationRatio < 0
    ) {
      blockers.push(`邦布 ${input.stableId} 的穿透率数值无效。`)
    }
  }

  const outputs = (mechanic.status === 'supported' ? mechanic.outputs : []) as Array<
    Record<string, unknown>
  >
  const scheduleMutations = outputs.filter((output) => output.operator === 'event_schedule_mutate')
  const excludedOutputs: Array<Record<string, unknown>> = [
    ...scheduleMutations.filter((output) => output.mechanic === 'guarantee'),
    ...(mechanic.status === 'supported' && 'unresolvedOutputs' in mechanic
      ? (mechanic.unresolvedOutputs ?? []).map((output) => ({
          ...output,
          operator: 'unresolved_conditional_output',
        }))
      : []),
  ]
  const unsupportedScheduleMutations = scheduleMutations.filter(
    (output) => output.mechanic !== 'guarantee',
  )
  if (unsupportedScheduleMutations.length)
    blockers.push(
      ...unsupportedScheduleMutations.map(
        (output) =>
          `邦布 ${input.stableId} 的 ${String(output.mechanic)} 会改变固定事件计划，当前 baseline 尚未声明其事件结果。`,
      ),
    )
  const damageEvents = outputs.filter((output) => output.operator === 'damage_event_emit')
  const damageModifiers = outputs.filter(
    (output) =>
      output.operator === 'scoped_modifier_apply' && output.mechanic === 'damage_multiplier',
  )
  const nonDamageOutputs = outputs.filter(
    (output) =>
      output.operator !== 'damage_event_emit' &&
      !(output.operator === 'scoped_modifier_apply' && output.mechanic === 'damage_multiplier'),
  )

  let directDamage: number | null = null
  if (stats.status === 'supported' && blockers.length === 0) {
    const baselineVersion = baseline.gameVersion
    const formulaVersion = isDamageFormula32Version(baselineVersion)
      ? ('3.2' as const)
      : ('legacy' as const)
    let totalDamage = 0
    let calculationFailed = false

    for (const event of damageEvents) {
      const action = String(event.action)
      const uses =
        action === 'active'
          ? currentBangbooFixedEventObservation.activeUseCount
          : action === 'chain'
            ? currentBangbooFixedEventObservation.chainUseCount
            : 0
      if (uses <= 0) continue

      const bonus = damageModifiers.reduce((sum, modifier) => {
        const target = String(modifier.targetAction)
        if (
          target !== 'all' &&
          target !== 'active_and_chain' &&
          target !== action &&
          !target.startsWith(`${action}:`)
        )
          return sum
        const values = Array.isArray(modifier.values) ? modifier.values.map(Number) : []
        let value: number
        if (target === 'chain:enemy_count_tiers')
          value = values[Math.min(enemyCount, values.length) - 1] ?? Number.NaN
        else if (values.length === 1) value = values[0]!
        else {
          const excluded = {
            ...modifier,
            reason: '多参数额外加成尚未绑定本次累计量算式，不计入固定伤害。',
          }
          if (
            !excludedOutputs.some(
              (row) => row.targetAction === target && row.reason === excluded.reason,
            )
          )
            excludedOutputs.push(excluded)
          return sum
        }
        const chance = modifier.chance === undefined ? 1 : Number(modifier.chance)
        if (!Number.isFinite(value) || !Number.isFinite(chance) || chance < 0 || chance > 1) {
          blockers.push(`邦布 ${input.stableId} 的额外伤害倍率或概率无效。`)
          return sum
        }
        return sum + value * chance
      }, 0)

      try {
        const result = calculateDamageFormula({
          family: 'direct',
          scalingAttribute: 'attack',
          formulaVersion,
          attackerLevel: 60,
          attack: stats.attack,
          multiplier: Number(event.multiplier),
          hitCount: 1,
          critRate: stats.critRate,
          critDamage: stats.critDamage,
          damageBonus: bonus,
          directDamageBonus: 0,
          buffBonus: 0,
          vulnerability: declaredEnemy.vulnerability ?? 0,
          defenseReduction: 0,
          defenseIgnore: 0,
          penetrationRatio: stats.penetrationRatio,
          penetrationFlat: 0,
          enemyDefense: declaredEnemy.defense,
          resistance: declaredEnemy.resistance,
          resistanceReduction: 0,
          resistanceIgnore: 0,
          stunMultiplier: declaredEnemy.stunMultiplier ?? 1,
        })
        if (!Number.isFinite(result.expectedDamage)) {
          calculationFailed = true
          blockers.push(`邦布 ${input.stableId} 的 ${action} 动作结算结果非有限数值。`)
          break
        }
        totalDamage += result.expectedDamage * uses
      } catch (error) {
        calculationFailed = true
        blockers.push(
          `邦布 ${input.stableId} 的 ${action} 动作公式计算失败：${error instanceof Error ? error.message : String(error)}`,
        )
        break
      }
    }

    if (!calculationFailed && blockers.length === 0) {
      directDamage = totalDamage
    }
  }

  const core = {
    contract: 'soda-current-bangboo-planning-parameter/v2' as const,
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    stableId: input.stableId,
    level: 60 as const,
    stars: input.stars,
    skillLevel: 10 as const,
    additionalAbilityLevel: input.stars,
    additionalAbilityEnabled: input.additionalAbilityEnabled ?? true,
    eventFlags: input.eventFlags ?? {},
    accumulators: input.accumulators ?? {},
    enemyCount,
    sourceVersion: currentBangbooNumericCatalog.sourceVersion,
    reviewedForVersion: currentBangbooNumericCatalog.reviewedForVersion,
    sourceReviewCommit: currentBangbooNumericCatalog.continuityReview.releaseSource.commit,
    composition,
    stats: stats.status === 'supported' ? stats : null,
    outputs,
    excludedOutputs,
    nonDamageOutputs,
    settledEnemyConditions: declaredEnemy
      ? {
          defense: declaredEnemy.defense,
          resistance: declaredEnemy.resistance,
          stunMultiplier: declaredEnemy.stunMultiplier ?? 1,
          vulnerability: declaredEnemy.vulnerability ?? 0,
          ...(declaredEnemy.id ? { id: declaredEnemy.id } : {}),
        }
      : null,
    directDamage,
    declaredObservation: currentBangbooFixedEventObservation,
    blockers: unique(blockers),
    boundary:
      '星级映射为附加能力 1–5 级；主动技/连携技固定采用60级技能10级、一次主动与一次连携，默认单敌人。概率增益按期望结算；未知事件状态只排除对应额外输出并保留来源基础伤害，组成激活不等于状态常驻。失衡、异常积蓄与回复/护盾/回能等非伤害 outputs 归类在直接伤害目标之外，未计入队伍综合收益；guarantee显式排除，已声明但仍无法表达的事件计划变更继续拒绝。此为固定伤害片段，不是邦布推荐收益排序或完整实战DPS。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type CurrentBangbooPlanningParameter = ReturnType<
  typeof evaluateCurrentBangbooPlanningParameter
>
