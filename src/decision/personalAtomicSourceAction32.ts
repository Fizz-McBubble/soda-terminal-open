import {
  getCurrentAgentEventContract,
  resolveCurrentAgentEvent,
} from '../calculation/currentAgentMechanicContracts'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'

/** A source coefficient row is a single declared mathematical event, never
 * the field-time multiplier or an assumed complete action cycle. */
export function personalAtomicSourceAction32(input: {
  agentId: string
  skillLevels: Readonly<Record<string, number | null>>
}) {
  if (input.agentId !== 'agent-lycaon') return null
  const contract = getCurrentAgentEventContract(input.agentId)
  const eventId = 'basic.BasicAttackMoonHunter.hit-9'
  const expectedHash = '693E61F9CF5C463C1BDAE3F655052691275C8CB60AD50D5F7EB43EF09E4300D9'
  const level = input.skillLevels.basic
  const event = contract?.eventContract.events.find((row) => row.eventId === eventId)
  if (
    contract?.source.formulaSha256 !== expectedHash ||
    !event ||
    event.formulaProjection !== 'source_registered' ||
    event.attribute !== 'ice' ||
    !event.eventModifierRefs.includes('core_basic_dazeInc_') ||
    !Number.isInteger(level) ||
    Number(level) < 1 ||
    Number(level) > 16 ||
    resolveCurrentAgentEvent({ stableId: input.agentId, eventId, skillLevel: Number(level) })
      .status !== 'supported'
  )
    return {
      status: 'unsupported' as const,
      blockers: ['莱卡恩蓄力冰属性单段来源身份或技能等级不匹配。'],
    }
  const eventUsages: PlanningEventUsage[] = [
    {
      ownerAgentId: input.agentId,
      eventId,
      skillLevel: Number(level),
      occurrenceCount: 1,
      evidenceRefs: [
        `${contract.source.formulaPath}#${expectedHash}`,
        'personal-atomic:lycaon-charged-ice-hit-9-once:preparation-cost-not-modeled',
      ],
    },
  ]
  return { status: 'supported' as const, eventUsages }
}
