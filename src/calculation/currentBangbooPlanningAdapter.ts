import {
  currentBangbooNumericCatalog,
  projectCurrentBangbooStats,
} from '../gameDataPacks/currentBangbooNumericCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { resolveCurrentBangbooMechanicContract } from './currentBangbooMechanicContracts'
import {
  currentBangbooFixedEventObservation,
  currentNormalizedPlanningBaseline,
} from './currentNormalizedPlanningBaseline'
import { calculateDamageFormula } from './damageFormulaDispatch'
import { isDamageFormula32Version } from './sharpDamageCore'
import type { PlanningBaseline } from './planningDpsContract'

function teamComposition(memberIds: readonly [string, string, string]) {
  const composition: Record<string, number> = {}
  const normalizeKey = (value: string) =>
    value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase()
  for (const agentId of memberIds) {
    const identity = getCurrentAgentEventContract(agentId)?.identity
    composition[`agent:${normalizeKey(agentId.replace(/^agent-/, ''))}`] = 1
    if (!identity) continue
    for (const dimensionKey of [
      `attribute:${normalizeKey(identity.attribute)}`,
      `specialty:${normalizeKey(identity.specialty)}`,
      `faction:${normalizeKey(identity.faction)}`,
    ])
      composition[dimensionKey] = (composition[dimensionKey] ?? 0) + 1
  }
  return composition
}

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
}

/** Resolves one selected level-60 Bangboo settled under the normalized one-active/one-chain baseline against declared enemy conditions. */
export function evaluateCurrentBangbooPlanningParameter(
  input: EvaluateCurrentBangbooPlanningParameterInput,
) {
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
    composition: teamComposition(input.memberIds),
    flags: {},
    accumulators: {},
    additionalAbilityEnabled: input.additionalAbilityEnabled ?? true,
  })
  const blockers = [
    ...(stats.status === 'supported' ? [] : [`邦布 ${input.stableId} 缺少 60 级静态数值。`]),
    ...(mechanic.status === 'unsupported' ? mechanic.blockers : []),
  ]

  const baseline = input.baseline ?? currentNormalizedPlanningBaseline
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
  const excludedOutputs = scheduleMutations.filter((output) => output.mechanic === 'guarantee')
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

      const bonus = damageModifiers
        .filter((modifier) => String(modifier.targetAction).startsWith(action))
        .reduce(
          (sum, modifier) =>
            sum + Number(Array.isArray(modifier.values) ? (modifier.values[0] ?? 0) : 0),
          0,
        )

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
    sourceVersion: currentBangbooNumericCatalog.sourceVersion,
    reviewedForVersion: currentBangbooNumericCatalog.reviewedForVersion,
    sourceReviewCommit: currentBangbooNumericCatalog.continuityReview.releaseSource.commit,
    composition: teamComposition(input.memberIds),
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
      '星级映射为附加能力 1–5 级；主动技/连携技固定采用 60 级对应技能 10 级。固定计划已声明一次主动与一次连携，并结算在相同声明的敌方防御与抗性条件下；失衡、异常积蓄与回复/护盾/回能等非伤害 outputs 归类在直接伤害目标之外，不静默宣称已完整支持；guarantee 作为非数值事件保证显式排除；其他未声明事件变更仍 fail closed。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type CurrentBangbooPlanningParameter = ReturnType<
  typeof evaluateCurrentBangbooPlanningParameter
>
