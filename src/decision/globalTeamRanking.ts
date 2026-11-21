import { stableContentHash } from '../gameDataPacks/types'

export const globalTeamRankingContractId = 'soda-global-team-ranking-diagnostic/v1' as const

export type GlobalTeamRankingPolicy = {
  contract: typeof globalTeamRankingContractId
  gameVersion: string
  objectiveIdentity: string
  objectiveDefinition: string
  authorityKind: 'diagnostic_shadow'
  runtimeEligible: false
  sourceAuthority: 'none'
  accountAuthority: 'filter_only'
  boundary: string
}

export type GlobalTeamRankingCandidate = {
  candidateId: string
  memberIds: readonly [string, string, string]
  diagnosticScore: number | null
  status: 'ranked' | 'unsupported'
  reasons: readonly string[]
}

export type GlobalTeamRankingEntry = GlobalTeamRankingCandidate & {
  denseRank: number | null
  displayOrder: number
}

export type GlobalTeamRanking = {
  policy: GlobalTeamRankingPolicy
  agentIds: readonly string[]
  entries: readonly GlobalTeamRankingEntry[]
  rankedCount: number
  unsupportedCount: number
  fingerprint: string
}

export type GlobalTeamBoxMatch = {
  ownedAgentIds: readonly string[]
  fixedAgentIds?: readonly string[]
}

function memberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

function exactTeam(memberIds: readonly string[]) {
  return (
    memberIds.length === 3 &&
    memberIds.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(memberIds).size === 3
  )
}

function expectedCombinationCount(agentCount: number) {
  return (agentCount * (agentCount - 1) * (agentCount - 2)) / 6
}

/**
 * One objective and one order. Source confidence, editorial tiers, popularity
 * and account state are not accepted by this contract and cannot alter rank.
 */
export function createGlobalTeamRanking(input: {
  policy: {
    gameVersion: string
    objectiveIdentity: string
    objectiveDefinition: string
  }
  agentIds: readonly string[]
  candidates: readonly GlobalTeamRankingCandidate[]
}): GlobalTeamRanking {
  if (!input.policy.gameVersion.trim() || !input.policy.objectiveIdentity.trim())
    throw new Error('Global ranking requires a version and objective identity.')
  const agentIds = [...input.agentIds]
  if (
    agentIds.length < 3 ||
    new Set(agentIds).size !== agentIds.length ||
    agentIds.some((id) => typeof id !== 'string' || !id.trim() || id !== id.trim()) ||
    agentIds.some(
      (id, index) => id !== [...agentIds].sort((left, right) => left.localeCompare(right))[index],
    )
  )
    throw new Error('Global ranking requires a unique sorted current agent dictionary.')
  const expected = expectedCombinationCount(agentIds.length)
  if (input.candidates.length !== expected)
    throw new Error(
      `Global ranking candidate coverage mismatch: ${input.candidates.length}/${expected}.`,
    )
  const agentSet = new Set(agentIds)
  const candidateIds = new Set<string>()
  const memberKeys = new Set<string>()
  for (const candidate of input.candidates) {
    if (
      !candidate.candidateId.trim() ||
      candidateIds.has(candidate.candidateId) ||
      !exactTeam(candidate.memberIds) ||
      candidate.memberIds.some((id) => !agentSet.has(id)) ||
      memberKeys.has(memberKey(candidate.memberIds))
    )
      throw new Error(`Invalid or duplicate global ranking candidate: ${candidate.candidateId}.`)
    candidateIds.add(candidate.candidateId)
    memberKeys.add(memberKey(candidate.memberIds))
    if (candidate.status === 'ranked') {
      if (
        candidate.diagnosticScore === null ||
        !Number.isFinite(candidate.diagnosticScore) ||
        candidate.reasons.length
      )
        throw new Error(
          `Ranked candidate lacks one finite objective value: ${candidate.candidateId}.`,
        )
    } else if (candidate.diagnosticScore !== null || !candidate.reasons.length) {
      throw new Error(
        `Unsupported candidate must be non-numeric and carry a reason: ${candidate.candidateId}.`,
      )
    }
  }
  const ranked = input.candidates
    .filter(
      (candidate): candidate is GlobalTeamRankingCandidate & { diagnosticScore: number } =>
        candidate.status === 'ranked' && candidate.diagnosticScore !== null,
    )
    .sort(
      (left, right) =>
        right.diagnosticScore - left.diagnosticScore ||
        memberKey(left.memberIds).localeCompare(memberKey(right.memberIds)),
    )
  const denseRankById = new Map<string, number>()
  let denseRank = 0
  let previousValue: number | null = null
  for (const candidate of ranked) {
    if (previousValue === null || candidate.diagnosticScore !== previousValue) denseRank += 1
    previousValue = candidate.diagnosticScore
    denseRankById.set(candidate.candidateId, denseRank)
  }
  const displayOrderById = new Map(
    [
      ...ranked,
      ...input.candidates
        .filter((candidate) => candidate.status === 'unsupported')
        .sort((left, right) => memberKey(left.memberIds).localeCompare(memberKey(right.memberIds))),
    ].map((candidate, index) => [candidate.candidateId, index + 1]),
  )
  const policy: GlobalTeamRankingPolicy = {
    contract: globalTeamRankingContractId,
    ...input.policy,
    authorityKind: 'diagnostic_shadow',
    runtimeEligible: false,
    sourceAuthority: 'none',
    accountAuthority: 'filter_only',
    boundary:
      'Diagnostic shadow contract only. One declared analysis objective defines a provisional diagnostic order. It is not runtime or player-facing authority, and BOX filtering is preview-only until an approved production objective and consumer gate exist.',
  }
  const entries = input.candidates
    .map(
      (candidate): GlobalTeamRankingEntry => ({
        candidateId: candidate.candidateId,
        memberIds: [...candidate.memberIds].sort() as [string, string, string],
        diagnosticScore: candidate.diagnosticScore,
        status: candidate.status,
        reasons: [...candidate.reasons],
        denseRank: denseRankById.get(candidate.candidateId) ?? null,
        displayOrder: displayOrderById.get(candidate.candidateId)!,
      }),
    )
    .sort((left, right) => left.displayOrder - right.displayOrder)
  const core = {
    policy,
    agentIds,
    entries,
    rankedCount: ranked.length,
    unsupportedCount: input.candidates.length - ranked.length,
  }
  return {
    ...core,
    fingerprint: stableContentHash(core),
  }
}

/** BOX matching preserves the global order. Rank is never recomputed after filtering. */
export function previewGlobalTeamRankingForBox(
  ranking: GlobalTeamRanking,
  input: GlobalTeamBoxMatch,
): GlobalTeamRankingEntry[] {
  const owned = new Set(input.ownedAgentIds)
  const fixed = [...new Set(input.fixedAgentIds ?? [])]
  if (ranking.policy.runtimeEligible)
    throw new Error('Diagnostic ranking must not be consumed as a runtime ranking.')
  return ranking.entries
    .filter(
      (entry) =>
        entry.status === 'ranked' &&
        entry.memberIds.every((id) => owned.has(id)) &&
        fixed.every((id) => entry.memberIds.includes(id)),
    )
    .sort((left, right) => left.displayOrder - right.displayOrder)
}
