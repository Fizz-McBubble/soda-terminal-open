import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { compileNormalizedAgentEventSchedule } from '../calculation/currentNormalizedPlanningBaseline'
import type { UpstreamExpressionIR } from '../calculation/currentUpstreamExpressionIR'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { effectReceivers, expressionReferences } from './teamStrengthSupportCapabilities'
import { isSourceRateEvent32 } from '../calculation/sourceEventQuantity32'
import { teamStrengthActionFacts } from './teamStrengthActionFacts'
import {
  resolveTeamStrengthReferenceMindscape,
  teamStrengthReferenceStatePolicy,
} from './teamStrengthReferenceState'
import { resolveSkillInvestmentMindscapeBonus } from './skillInvestmentProjection'

const ruleById = new Map(current31TeamEngineD1Pack.agentRules.map((rule) => [rule.agentId, rule]))

export type Member = {
  agentId: string
  specialty: string
  attribute: string
  demand: number
  attack: number
  defense: number
  impact: number
  anomalyMastery: number
  damageMultiplier: number
  dazeMultiplier: number
  anomalyBuildup: number
  sharpMultiplier: number
  lacerationMultiplier: number
  hpToSheer: boolean
  actionReady: boolean
  actionFacts: NonNullable<ReturnType<typeof teamStrengthActionFacts>>
  actionLimitations: string[]
}
const memberCache = new Map<string, Member>()
export function memberFacts(agentId: string): Member | null {
  const cached = memberCache.get(agentId)
  if (cached) return cached
  const contract = getCurrentAgentEventContract(agentId)
  const rule = ruleById.get(agentId)
  if (!contract || !rule) return null
  const schedule = compileNormalizedAgentEventSchedule({ agentId })
  const declaredRateSecondsByEventId = Object.fromEntries(
    schedule.status === 'supported'
      ? schedule.eventUsages.flatMap((usage) =>
          isSourceRateEvent32(agentId, usage.eventId) &&
          usage.durationSeconds !== undefined &&
          usage.occurrenceCount > 0
            ? // Keep the existing declared exposure per source packet. Dividing
              // by its declared uses removes policy repetitions, never time.
              [[usage.eventId, usage.durationSeconds / usage.occurrenceCount]]
            : [],
        )
      : [],
  )
  const skillLevel =
    teamStrengthReferenceStatePolicy.baseSkillLevel +
    (resolveSkillInvestmentMindscapeBonus(resolveTeamStrengthReferenceMindscape(agentId)) ?? 0)
  const actions = teamStrengthActionFacts({ agentId, skillLevel, declaredRateSecondsByEventId })
  if (!actions) return null
  // Separate source packets preserve the metric being described. None of the
  // baseline's 2..6 policy repetitions becomes observed action frequency.
  const result: Member = {
    agentId,
    specialty: contract.identity.specialty,
    attribute: contract.identity.attribute,
    demand: rule.fieldTimeDemand,
    attack: contract.baseStats.atk_base + contract.baseStats.atk_growth * 59,
    defense: contract.baseStats.def_base + contract.baseStats.def_growth * 59,
    impact: contract.baseStats.impact,
    anomalyMastery: contract.baseStats.anomMas,
    damageMultiplier: actions.damage?.damageMultiplier ?? 0,
    dazeMultiplier: actions.stun?.dazeMultiplier ?? 0,
    anomalyBuildup: actions.anomaly?.anomalyBuildup ?? 0,
    sharpMultiplier: actions.sharp?.damageMultiplier ?? 0,
    lacerationMultiplier: actions.laceration?.damageMultiplier ?? 0,
    hpToSheer:
      getCurrentAgentDecisionMechanicContract(agentId)?.effectContract.effects.some(
        (effect) =>
          !/^m[1-6](?:_|$)/i.test(effect.effectId) &&
          effectReceivers(effect.numericExpression.expressionIr as UpstreamExpressionIR).some(
            (receiver) => /ownBuff\..*sheerForce/.test(receiver.path),
          ) &&
          expressionReferences(
            effect.numericExpression.expressionIr as UpstreamExpressionIR,
          ).includes('own.final.hp'),
      ) ?? false,
    actionReady: schedule.status === 'supported' && actions.damage !== null,
    actionFacts: actions,
    actionLimitations: [
      '伤害、失衡与异常积蓄分别采用来源动作包；不是同一轮转，也不表示速度、资源可持续或实战效率。',
      ...(contract.identity.specialty === 'rupture'
        ? ['强命仅描述来源倍率，未以攻击力代替贯穿力或宣称跨通道伤害。']
        : []),
      ...(actions.rateActions.length
        ? ['每秒倍率仅保留声明曝光的独立能力诊断，不与单次动作包合并或比较强度。']
        : []),
      ...actions.excludedActions.flatMap((action) =>
        action.blockers.map((blocker) => `${action.actionId}: ${blocker}`),
      ),
      ...actions.mixedDamageActions.map(
        (id) => `${id}: mixed_formula_or_scaling_not_compared_as_damage`,
      ),
    ],
  }
  memberCache.set(agentId, result)
  return result
}
