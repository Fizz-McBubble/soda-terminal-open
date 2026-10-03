import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { reviewedClaretIntrinsicActionIdentity32 } from './currentPlanningEffectResolutionIdentity32'

const actions = [
  ['ChainAttackBloodbloomOathResonantBloodPact', 'chain', 'chain'],
  ['UltimateBloodbloomOathTrialAfterTrial', 'chain', 'ult'],
  ['AssistFollowUpBloodbloomOathPureforgedEdge', 'assist', 'assistFollowUp'],
  ['CounterAssistGiveNotAnInchOfSteel', 'assist', 'counterAssist'],
  ['AssistFollowUpBloodbloomOathHammerIntoShape', 'assist', 'assistFollowUp'],
] as const

/** The localized OR applies to these two effects, not to the actor's global
 * Crimson Inscription state. Keep the pinned expression and its M2/core gate. */
export function bindReviewedClaretIntrinsicAction32(input: {
  ownerAgentId: string
  entry: CurrentAgentPlanningEffectBlueprint
  event: { eventId: string; actionId: string; skill: string; damageType?: string }
  attribute: string
}) {
  const identity = reviewedClaretIntrinsicActionIdentity32
  const hash =
    identity.expressionHashes[input.entry.effectKey as keyof typeof identity.expressionHashes]
  if (
    !hash ||
    input.entry.providerAgentId !== 'agent-claret' ||
    input.ownerAgentId !== 'agent-claret'
  )
    return { status: 'supported' as const, active: false, sourceRefs: [] as string[] }
  const action = actions.find(([id]) => id === input.event.actionId)
  if (!action) return { status: 'supported' as const, active: false, sourceRefs: [] as string[] }
  const contract = getCurrentAgentEventContract(input.ownerAgentId)
  const event = contract?.eventContract.events.find((row) => row.eventId === input.event.eventId)
  if (
    !contract ||
    !event ||
    contract.source.commit !== identity.commit ||
    contract.source.formulaPath !== identity.formulaPath ||
    contract.source.formulaSha256 !== identity.formulaSha256 ||
    input.entry.numericExpression.expressionSha256 !== hash ||
    !input.entry.sourceRefs.includes(`${identity.formulaPath}#${identity.formulaSha256}`) ||
    input.event.eventId !== `${action[1]}.${action[0]}.hit-0` ||
    event.actionId !== action[0] ||
    event.skill !== action[1] ||
    event.damageType !== action[2] ||
    input.event.skill !== action[1] ||
    input.event.damageType !== action[2] ||
    event.attribute !== 'electric' ||
    input.attribute !== 'electric' ||
    event.formulaFamily !== 'sharp_damage'
  )
    return {
      status: 'unsupported' as const,
      blockers: ['克拉蕾动作固有效果与锁定事件或表达式来源不一致。'],
    }
  return {
    status: 'supported' as const,
    active: true,
    sourceRefs: [
      `${identity.localizationPath}#sha256=${identity.localizationSha256}`,
      `${identity.localizationPath}#${input.entry.effectKey.endsWith('core_crit_') ? '/core/desc/0/4' : '/mindscapes/2/desc'}`,
      `actor-bound-event:agent-claret:${event.eventId}`,
    ],
  }
}
