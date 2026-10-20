import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
  currentAgentMechanicIdentity,
} from './currentAgentMechanicContracts'
import { resolveCurrentAgentCoreGrowth } from '../gameDataPacks/panel/currentPanelData'
import { isSourceRateEvent32 } from './sourceEventQuantity32'
import {
  resolveSkillInvestmentMaterials,
  skillInvestmentMaterialsIdentity,
} from './skillInvestmentMaterials'
import type { SkillKey } from './skillInvestmentPolicy'

export type SkillInvestmentNextLevelInput = {
  agentId: string
  skill: SkillKey
  /** Effective in-game level, including mindscape bonuses. */
  currentLevel: number | null
  /** Effective target from the caller's recommendation, never a new gain-based ranking. */
  targetLevel: number | null
  /** Explicitly known paid-to-effective offset. Zero is meaningful; unknown is not zero. */
  effectiveLevelBonus?: number | null
  eventIds?: readonly string[]
}

const delta = (before: number, after: number) => ({
  before,
  after,
  delta: after - before,
  relativeGain: before === 0 ? null : (after - before) / before,
})
export const skillInvestmentNextLevelIdentity = Object.freeze({
  revision: 'source-event-next-paid-level-r2',
  eventSource: currentAgentMechanicIdentity,
  materials: skillInvestmentMaterialsIdentity,
  boundary:
    'same named event coefficient; damage, daze and anomaly buildup separate; resource recovery tracked; no frequency, rotation, damage total or resource ROI',
  baseCombatCap: 12,
  coreCap: 7,
})

export function evaluateSkillInvestmentNextLevel(input: SkillInvestmentNextLevelInput) {
  const blocked = <S extends 'unknown' | 'unsupported'>(status: S, reason: string) => ({
    status,
    reason,
    events: [],
    materials: null,
    identity: skillInvestmentNextLevelIdentity,
  })
  if (input.currentLevel === null || input.targetLevel === null)
    return blocked('unknown', '当前等级或来源目标未知。')
  if (
    !Number.isInteger(input.currentLevel) ||
    !Number.isInteger(input.targetLevel) ||
    input.currentLevel < 1 ||
    input.targetLevel < 1
  )
    return blocked('unsupported', '当前等级和目标必须是合法正整数。')
  const contract = getCurrentAgentEventContract(input.agentId)
  if (!contract) return blocked('unsupported', '当前主体无已采用事件合同。')
  const bonus = input.skill === 'core' ? 0 : input.effectiveLevelBonus
  if (bonus === undefined || bonus === null)
    return blocked('unknown', '付费基础等级与影画加级未明确；不能把有效等级静默当基础等级。')
  if (
    ![0, 2, 4].includes(bonus) ||
    (input.skill === 'core' && input.effectiveLevelBonus != null && input.effectiveLevelBonus !== 0)
  )
    return blocked('unsupported', '已锁来源只支持明确的影画技能加级0、2、4；核心不加级。')
  const baseLevel = input.currentLevel - bonus
  const cap = input.skill === 'core' ? 7 : 12
  if (baseLevel < 1 || baseLevel > cap || input.targetLevel > cap + bonus)
    return blocked('unsupported', '基础等级或有效目标超出来源上限。')
  if (baseLevel === cap || input.currentLevel >= input.targetLevel)
    return {
      status: 'no_upgrade' as const,
      reason: baseLevel === cap ? '已达付费基础上限。' : '已达声明目标。',
      events: [],
      materials: null,
      identity: skillInvestmentNextLevelIdentity,
    }
  const nextLevel = input.currentLevel + 1
  const materials = resolveSkillInvestmentMaterials({
    agentId: input.agentId,
    skill: input.skill,
    currentBaseLevel: baseLevel,
  })
  if (input.skill === 'core') {
    const before = resolveCurrentAgentCoreGrowth({
      agentId: input.agentId,
      coreLevel: input.currentLevel,
      basis: 'source_growth',
    })
    const after = resolveCurrentAgentCoreGrowth({
      agentId: input.agentId,
      coreLevel: nextLevel,
      basis: 'source_growth',
    })
    if (before.status !== 'supported' || after.status !== 'supported')
      return blocked('unsupported', '核心静态成长来源不支持该升级。')
    const valuesBefore = before.values as Record<string, number>
    const valuesAfter = after.values as Record<string, number>
    const coreGrowth = Object.fromEntries(
      [...new Set([...Object.keys(valuesBefore), ...Object.keys(valuesAfter)])].map((key) => [
        key,
        delta(valuesBefore[key] ?? 0, valuesAfter[key] ?? 0),
      ]),
    )
    return {
      status: 'partial' as const,
      fromLevel: input.currentLevel,
      toLevel: nextLevel,
      fromBaseLevel: baseLevel,
      toBaseLevel: baseLevel + 1,
      coreGrowth,
      sourceRefs: [...before.sourceRefs, ...after.sourceRefs],
      events: [],
      materials,
      reason: '已结算核心静态属性成长；条件性核心效果及事件伤害/失衡收益未据此推算。',
      identity: skillInvestmentNextLevelIdentity,
    }
  }
  const candidates = contract.eventContract.events.filter(
    (event) =>
      event.skill === input.skill && (!input.eventIds || input.eventIds.includes(event.eventId)),
  )
  if (
    !candidates.length ||
    input.eventIds?.some((id) => !candidates.some((event) => event.eventId === id))
  )
    return blocked('unsupported', '具名事件不属于该技能或无来源事件。')
  const events = candidates.map((event) => {
    const before = resolveCurrentAgentEvent({
      stableId: input.agentId,
      eventId: event.eventId,
      skillLevel: input.currentLevel!,
    })
    const after = resolveCurrentAgentEvent({
      stableId: input.agentId,
      eventId: event.eventId,
      skillLevel: nextLevel,
    })
    if (before.status !== 'supported' || after.status !== 'supported')
      return {
        eventId: event.eventId,
        status: 'unsupported' as const,
        reason: '来源算子不支持当前/下一等级。',
      }
    return {
      eventId: event.eventId,
      status: 'supported' as const,
      actionId: event.actionId,
      attribute: event.attribute,
      damageFamily: event.formulaFamily,
      scalingAttribute: event.scalingAttribute,
      formulaProjection: event.formulaProjection,
      quantityUnit: isSourceRateEvent32(input.agentId, event.eventId)
        ? ('per_second' as const)
        : ('coefficient_use' as const),
      damageCoefficient: delta(before.damageMultiplier, after.damageMultiplier),
      dazeCoefficient: delta(before.dazeMultiplier, after.dazeMultiplier),
      anomalyCoefficient: delta(before.anomalyBuildup, after.anomalyBuildup),
      resourceRecoveryGains:
        before.resourceRecovery?.status === 'supported' &&
        after.resourceRecovery?.status === 'supported'
          ? {
              energy: delta(
                before.resourceRecovery.energy.value,
                after.resourceRecovery.energy.value,
              ),
              decibels: delta(
                before.resourceRecovery.decibels.value,
                after.resourceRecovery.decibels.value,
              ),
            }
          : null,
      sourceRefs: [
        `${contract.source.statsPath}#${contract.source.statsSha256}:${event.eventId}`,
        `${contract.source.formulaPath}#${contract.source.formulaSha256}`,
      ],
    }
  })
  return {
    status: events.every((event) => event.status === 'supported')
      ? ('supported' as const)
      : ('partial' as const),
    fromLevel: input.currentLevel,
    toLevel: nextLevel,
    fromBaseLevel: baseLevel,
    toBaseLevel: baseLevel + 1,
    events,
    materials,
    identity: skillInvestmentNextLevelIdentity,
  }
}
