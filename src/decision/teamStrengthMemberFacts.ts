import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import { compileNormalizedAgentEventSchedule } from '../calculation/currentNormalizedPlanningBaseline'
import type { UpstreamExpressionIR } from '../calculation/currentUpstreamExpressionIR'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { effectReceivers, expressionReferences } from './teamStrengthSupportCapabilities'

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
}
const memberCache = new Map<string, Member>()
export function memberFacts(agentId: string): Member | null {
  const cached = memberCache.get(agentId)
  if (cached) return cached
  const contract = getCurrentAgentEventContract(agentId)
  const rule = ruleById.get(agentId)
  if (!contract || !rule) return null
  const schedule = compileNormalizedAgentEventSchedule({ agentId })
  const events =
    schedule.status === 'supported'
      ? schedule.eventUsages.map((usage) =>
          resolveCurrentAgentEvent({
            stableId: agentId,
            eventId: usage.eventId,
            skillLevel: usage.skillLevel,
          }),
        )
      : []
  const resolved = events.filter((event) => event.status === 'supported')
  // Use one source action. The baseline's 2..6 repetitions are local policy,
  // not observed speed, and would count field-time assumptions twice here.
  const result: Member = {
    agentId,
    specialty: contract.identity.specialty,
    attribute: contract.identity.attribute,
    demand: rule.fieldTimeDemand,
    attack: contract.baseStats.atk_base + contract.baseStats.atk_growth * 59,
    defense: contract.baseStats.def_base + contract.baseStats.def_growth * 59,
    impact: contract.baseStats.impact,
    anomalyMastery: contract.baseStats.anomMas,
    damageMultiplier: resolved.reduce((sum, event) => sum + event.damageMultiplier, 0),
    dazeMultiplier: resolved.reduce((sum, event) => sum + event.dazeMultiplier, 0),
    anomalyBuildup: resolved.reduce((sum, event) => sum + event.anomalyBuildup, 0),
    sharpMultiplier: resolved
      .filter((event) => event.formulaFamily === 'sharp_damage')
      .reduce((sum, event) => sum + event.damageMultiplier, 0),
    lacerationMultiplier: resolved
      .filter((event) => event.formulaFamily === 'laceration_damage')
      .reduce((sum, event) => sum + event.damageMultiplier, 0),
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
    actionReady:
      events.length > 0 &&
      resolved.length === events.length &&
      resolved.every((event) =>
        [event.damageMultiplier, event.dazeMultiplier, event.anomalyBuildup].every(
          (value) => Number.isFinite(value) && value >= 0,
        ),
      ),
  }
  memberCache.set(agentId, result)
  return result
}
