import { getAgentName } from '../application/publicRosterNames'
import type {
  TeamExecutionWorkspaceAlternate,
  TeamExecutionWorkspaceSubstitute,
} from './TeamExecutionWorkspaceSurface'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModel'

function directTeamSubstitution(
  current: DecisionTeamViewModel,
  alternative: DecisionTeamViewModel,
) {
  const removedAgentIds = current.agentIds.filter(
    (agentId) => !alternative.agentIds.includes(agentId),
  )
  const addedAgentIds = alternative.agentIds.filter(
    (agentId) => !current.agentIds.includes(agentId),
  )
  if (removedAgentIds.length !== 1 || addedAgentIds.length !== 1) return null

  // A one-member set difference identifies the target and substitute without
  // depending on source ordering. Reordered trios have no set difference and
  // multi-member changes are skipped, so an avatar cannot be attached to an
  // unrelated slot.
  return { targetAgentId: removedAgentIds[0]!, replacementAgentId: addedAgentIds[0]! }
}

export function teamExecutionSubstitutes(
  current: DecisionTeamViewModel,
  alternatives: readonly DecisionTeamViewModel[],
): TeamExecutionWorkspaceSubstitute[] {
  const substitutions: TeamExecutionWorkspaceSubstitute[] = []
  for (const alternative of alternatives) {
    if (alternative.id === current.id) continue
    const substitution = directTeamSubstitution(current, alternative)
    if (!substitution) continue
    substitutions.push({
      targetAgentId: substitution.targetAgentId,
      agentId: substitution.replacementAgentId,
      agentName: getAgentName(substitution.replacementAgentId),
      onSelect: undefined,
    })
  }
  return substitutions.filter(
    (replacement, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.targetAgentId === replacement.targetAgentId &&
          candidate.agentId === replacement.agentId,
      ) === index,
  )
}

export function withTeamExecutionSubstituteActions(
  current: DecisionTeamViewModel,
  alternatives: readonly DecisionTeamViewModel[],
  onSelectAlternative?: (candidateId: string) => void,
): TeamExecutionWorkspaceAlternate | undefined {
  const substitutions = teamExecutionSubstitutes(current, alternatives).map((replacement) => {
    const alternative = alternatives.find((candidate) => {
      const substitution = directTeamSubstitution(current, candidate)
      return (
        candidate.id !== current.id &&
        substitution !== null &&
        substitution.targetAgentId === replacement.targetAgentId &&
        substitution.replacementAgentId === replacement.agentId
      )
    })
    return {
      ...replacement,
      onSelect:
        alternative && onSelectAlternative ? () => onSelectAlternative(alternative.id) : undefined,
    }
  })
  const first = substitutions[0]
  if (!first) return undefined
  return {
    agentId: first.agentId,
    agentName: first.agentName,
    replacedAgentId: first.targetAgentId,
    replacedAgentName: getAgentName(first.targetAgentId),
    onSelect: first.onSelect,
    alternatives: substitutions,
  }
}

export function substitutesForMember(
  member: { agentId: string; agentName: string },
  alternate?: TeamExecutionWorkspaceAlternate,
): TeamExecutionWorkspaceSubstitute[] {
  if (!alternate) return []
  const configured = (alternate.alternatives ?? [])
    .filter(
      (replacement) =>
        replacement.targetAgentId === member.agentId && replacement.agentId !== member.agentId,
    )
    .filter(
      (replacement, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.targetAgentId === replacement.targetAgentId &&
            candidate.agentId === replacement.agentId,
        ) === index,
    )
  if (configured.length) return configured
  if (alternate.replacedAgentId && alternate.replacedAgentId !== member.agentId) return []
  if (alternate.replacedAgentName && !member.agentName.includes(alternate.replacedAgentName))
    return []
  if (alternate.agentId === member.agentId) return []
  return [
    {
      targetAgentId: member.agentId,
      agentId: alternate.agentId,
      agentName: alternate.agentName,
      onSelect: alternate.onSelect,
    },
  ]
}
