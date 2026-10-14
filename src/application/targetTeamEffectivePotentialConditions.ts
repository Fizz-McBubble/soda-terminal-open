import type { CoreWarehouse } from '../accounts/coreFlow'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import type { ReviewedTeamAgentState } from '../gameDataPacks/reviewedTeamDiscConditions'

/** Per-call planning assumptions; does not normalize or edit account observations. */
export function targetTeamEffectivePotentialConditions(input: {
  memberIds: readonly string[]
  roster: CoreWarehouse['roster']
  potentialByAgentId?: Readonly<Record<string, number>>
}): Record<string, ReviewedTeamAgentState> {
  const overrides = input.potentialByAgentId ?? {}
  for (const [agentId, value] of Object.entries(overrides)) {
    if (
      !input.memberIds.includes(agentId) ||
      !supportsPotentialImage(agentId) ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 6
    )
      throw new Error(`${agentId} 的显式潜能参数无效。`)
  }
  return Object.fromEntries(
    input.memberIds.map((agentId) => [
      agentId,
      {
        potentialImage:
          overrides[agentId] ??
          input.roster.agents.find((agent) => agent.agentId === agentId)?.potentialImage,
      },
    ]),
  )
}
