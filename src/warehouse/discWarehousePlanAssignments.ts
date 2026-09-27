import type { AccountPlanningDraft } from '../accounts/types'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'

/** Full team membership is impact context, never a physical disc assignment. */
export function savedDiscAgentIds(draft: AccountPlanningDraft, discId: string): string[] {
  const members = [...new Set(draft.selection.agentIds)]
  if (draft.kind === 'agent')
    return members.length === 1 ? members.map(resolveCurrentReleasedIdentity) : []
  const execution = draft.teamExecutionSnapshot
  const matchingExecution =
    execution &&
    [...new Set(execution.memberIds)].sort().join('|') === [...members].sort().join('|')
      ? execution
      : null
  const sources = [
    ...(draft.candidateWarehouse ? [draft.candidateWarehouse.loadouts] : []),
    ...(matchingExecution
      ? [
          matchingExecution.members.map((member) => ({
            agentId: member.agentId,
            discIds: member.suggested.discIds,
          })),
        ]
      : []),
  ]
  const assignments = sources.map((loadouts) => [
    ...new Set(
      loadouts
        .filter((loadout) => loadout.discIds.includes(discId) && members.includes(loadout.agentId))
        .map((loadout) => resolveCurrentReleasedIdentity(loadout.agentId)),
    ),
  ])
  if (assignments.some((ids) => ids.length > 1)) return []
  const assigned = [...new Set(assignments.flat())]
  return assigned.length === 1 ? assigned : []
}
