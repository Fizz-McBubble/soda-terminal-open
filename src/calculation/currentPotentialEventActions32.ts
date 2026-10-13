import {
  evaluateCurrentAgentTeamActivation,
  getCurrentAgentEventContract,
} from './currentAgentMechanicContracts'

/** Recover damageType2 omitted by the catalog projection, only against pinned raw sheets. */
export function sourcePlanningAftershock32(input: {
  agentId: string
  eventId: string
  memberIds: readonly string[]
  potential?: number | null
}): boolean | null {
  const contract = getCurrentAgentEventContract(input.agentId)
  const event = contract?.eventContract.events.find((row) => row.eventId === input.eventId)
  if (!contract || !event) return null
  const pins: Record<string, string> = {
    'agent-soldier-0-anby': '15E220B7933E2A50257119248DCC3F0A7F8564A708AEFB1AD826763A04979D6E',
    'agent-pulchra': '136C36B91C1E06975759E9C89F7A2D8B4B994588FF2AD607514F56A4F6B8027A',
    'agent-trigger': 'C24093AAEF041B0CA582F19729665387060E64C6CDDC9DAF7B338DA37075B0A6',
  }
  if (contract.source.formulaSha256 !== pins[input.agentId]) return null
  if (input.agentId === 'agent-soldier-0-anby') {
    if (
      !['ChainAttackLeapingThunderstrike', 'UltimateVoidstrike'].includes(event.actionId) ||
      event.hitIndex !== 0
    )
      return false
    const activation = evaluateCurrentAgentTeamActivation({
      stableId: input.agentId,
      memberIds: input.memberIds,
      agentState: { potentialImage: input.potential },
    })
    return activation.status === 'supported' ? activation.active : null
  }
  if (input.agentId === 'agent-pulchra')
    return (
      event.actionId === 'SpecialAttackRendingClawNightmareShadow' &&
      [0, 1].includes(event.hitIndex)
    )
  return (
    (event.actionId === 'BasicAttackHarmonizingShot' && event.hitIndex === 0) ||
    (event.actionId === 'BasicAttackHarmonizingShotTartarus' && [0, 1].includes(event.hitIndex))
  )
}

/** Families for a resolved source damage event. State, stack counts and timing
 * remain separate declarations, never inferred from the action name. */
export function actualPlanningPotentialActionFamilies32(event: {
  actionId: string
  skill: string
  attribute: string
}): readonly string[] {
  const families = new Set<string>([`${event.attribute}_damage`])
  if (['basic', 'chain', 'special'].includes(event.skill)) families.add(event.skill)
  if (event.actionId.startsWith('Ultimate')) families.add('ultimate')
  if (event.actionId.startsWith('EXSpecialAttack')) families.add('ex_special')
  if (event.actionId.startsWith('DashAttack')) families.add('dash')
  if (event.actionId.startsWith('DodgeCounter')) families.add('dodge_counter')
  if (event.actionId === 'BasicAttackFlashFreezeTrimming') families.add('flash_freeze_charge_basic')
  if (event.actionId === 'ChasingThunder') families.add('chasing_thunder')
  if (event.actionId === 'DashAttackHitenNoTsuruSlash') families.add('flying_spirit_slash')
  return [...families]
}
