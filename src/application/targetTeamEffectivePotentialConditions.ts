import type { CoreWarehouse } from '../accounts/coreFlow'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import type { ReviewedTeamAgentState } from '../gameDataPacks/reviewedTeamDiscConditions'
import { getCurrentBuildProfile, getSelectedBuildBranchId } from '../assault/currentBuildProfiles'

/** Per-call planning assumptions; does not normalize or edit account observations. */
export function targetTeamEffectivePotentialConditions(input: {
  memberIds: readonly string[]
  roster: Pick<CoreWarehouse['roster'], 'agents'>
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
        mindscape: input.roster.agents.find((agent) => agent.agentId === agentId)?.mindscape,
        potentialImage:
          overrides[agentId] ??
          input.roster.agents.find((agent) => agent.agentId === agentId)?.potentialImage,
      },
    ]),
  )
}

/** Only an explicitly stored branch may open an experimental team direction.
 * getSelectedBuildBranchId's ordinary profile default is not player consent. */
export function targetTeamSelectedDirectionConditions(input: {
  memberIds: readonly string[]
  roster: Pick<CoreWarehouse['roster'], 'agents'>
}): Record<string, string> {
  return Object.fromEntries(
    input.memberIds.flatMap((agentId) => {
      const agent = input.roster.agents.find((row) => row.agentId === agentId)
      const profile = agent && getCurrentBuildProfile(agentId)
      if (!agent) return []
      const prefix = `buildBranch:${profile?.agentId ?? agent.agentId}:`
      const explicit = agent.lockedFields.find((field) => field.startsWith(prefix))
      if (!explicit) return []
      // Some source-only agents have no legacy BuildProfile. Their explicit
      // roster marker uses the same stable identity convention.
      const selected = getSelectedBuildBranchId(agent) ?? explicit.slice(prefix.length)
      return selected ? [[agentId, selected]] : []
    }),
  )
}

/** The same observed state and explicit selection for live, saved and portfolio compilation. */
export function targetTeamBuildDirectionConditions(
  input: Parameters<typeof targetTeamEffectivePotentialConditions>[0],
) {
  return {
    agentStateById: targetTeamEffectivePotentialConditions(input),
    selectedDirectionIdByAgentId: targetTeamSelectedDirectionConditions(input),
  }
}
