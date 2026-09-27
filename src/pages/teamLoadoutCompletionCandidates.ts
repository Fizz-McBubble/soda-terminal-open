import type { TeamEngineCandidate, TeamEnginePack } from '../teamEngine/contracts'

export type TeamLoadoutCompletionCandidate = {
  id: string
  kernelId: string
  memberIds: string[]
  /** Every member already owned in the real account, including reserved members. */
  ownedAgentIds: string[]
  /** Compatibility projection for the existing member-gap presentation. */
  ownedCoreAgentIds: string[]
  /** Owned members excluded from this analysis scope, never presented as unowned. */
  unavailableOwnedAgentIds: string[]
  missingAgentIds: string[]
  missingRole: 'core' | 'eligible_third'
  failureCode: 'missing_core_agent' | 'no_eligible_third'
  sourceIds: string[]
  label: string
}

const supportedFailureCodes = new Set<TeamLoadoutCompletionCandidate['failureCode']>([
  'missing_core_agent',
  'no_eligible_third',
])

function isSupportedFailureCode(
  code: string,
): code is TeamLoadoutCompletionCandidate['failureCode'] {
  return supportedFailureCodes.has(code as TeamLoadoutCompletionCandidate['failureCode'])
}

/**
 * Converts only the Team Engine's structured, source-backed rejections into
 * read-only member-completion facts. It never parses presentation text, creates
 * a candidate, or changes recommendation ranking.
 */
export function projectTeamLoadoutCompletionCandidates(input: {
  rejected: readonly TeamEngineCandidate[]
  /** Real account ownership before any remaining-BOX reservation is applied. */
  ownedAgentIds: readonly string[]
  /** Members allowed in this run; defaults to the complete owned roster. */
  availableAgentIds?: readonly string[]
  pack: Pick<TeamEnginePack, 'kernels'>
}): TeamLoadoutCompletionCandidate[] {
  const owned = new Set(input.ownedAgentIds)
  const available = new Set(input.availableAgentIds ?? input.ownedAgentIds)
  const kernelById = new Map(input.pack.kernels.map((kernel) => [kernel.kernelId, kernel]))
  const projected = new Map<string, TeamLoadoutCompletionCandidate>()

  for (const candidate of input.rejected) {
    if (!candidate.kernelId) continue
    const failure = candidate.failures.find((item) => isSupportedFailureCode(item.code))
    if (!failure || !isSupportedFailureCode(failure.code)) continue
    const kernel = kernelById.get(candidate.kernelId)
    if (!kernel) continue

    if (
      candidate.strengthTier !== 'current_strong_candidate' ||
      (candidate.metaBand !== 'apex' && candidate.metaBand !== 'meta') ||
      candidate.failures.some((item) => !isSupportedFailureCode(item.code)) ||
      candidate.sourceIds.length === 0
    )
      continue

    for (const thirdAgentId of kernel.eligibleThirdAgentIds) {
      const memberIds = [...kernel.coreAgentIds, thirdAgentId]
      const ownedAgentIds = memberIds.filter((agentId) => owned.has(agentId))
      const missingAgentIds = memberIds.filter((agentId) => !owned.has(agentId))
      const unavailableOwnedAgentIds = ownedAgentIds.filter((agentId) => !available.has(agentId))
      // A member-gap card is an actionable one-member completion, not a long
      // acquisition list or a workaround for members reserved by another team.
      if (missingAgentIds.length !== 1 || unavailableOwnedAgentIds.length) continue
      const ownedCoreAgentIds = kernel.coreAgentIds.filter((agentId) => owned.has(agentId))
      if (!ownedCoreAgentIds.length) continue

      const missingRole = kernel.coreAgentIds.includes(missingAgentIds[0]!)
        ? ('core' as const)
        : ('eligible_third' as const)
      const id = `${candidate.kernelId}:${thirdAgentId}:${missingAgentIds[0]}`
      if (projected.has(id)) continue
      projected.set(id, {
        id,
        kernelId: candidate.kernelId,
        memberIds,
        ownedAgentIds,
        ownedCoreAgentIds,
        unavailableOwnedAgentIds,
        missingAgentIds,
        missingRole,
        failureCode: failure.code,
        sourceIds: [...new Set(candidate.sourceIds)],
        label: candidate.label,
      })
    }
  }

  const metaRank = { apex: 2, meta: 1, viable: 0 } as const
  const metaByKernelId = new Map(input.rejected.map((item) => [item.kernelId, item.metaBand]))
  return [...projected.values()].sort((left, right) => {
    const leftRank = metaRank[metaByKernelId.get(left.kernelId) ?? 'viable']
    const rightRank = metaRank[metaByKernelId.get(right.kernelId) ?? 'viable']
    return rightRank - leftRank || left.id.localeCompare(right.id)
  })
}
