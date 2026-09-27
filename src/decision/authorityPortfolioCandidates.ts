import { getAgentName, currentBangbooDirectory } from '../assault/catalog'
import type { AccountRoster } from '../assault/types'
import type { SourceBackedTeamCandidate } from '../optimizer/multiTeamCoordinator'
import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { projectAccountDecisionAuthority } from './accountDecisionAuthority'
import { authorityConsumerRecommendations } from './accountDecisionAuthorityConsumers'
import { authorityTargetBuildDirection } from './authorityTargetBuildDirection'
import type { TeamBuildExecutionIdentity } from './teamBuildExecutionIdentity'
import { sourceSupportedTargetBangbooSelection } from './targetTeamEquipmentParameters'
import { defaultEquipmentRankForRarity } from './teamEquipmentRecommendations'
import { current31AdoptedExactTeamCoverageSources } from './reviewedTeamCoverageAudit'

const trioKey = (ids: readonly string[]) => [...ids].sort().join('|')
// Membership only: neither audit metrics nor independent labels become a ranking input.
const adoptedTrios = new Set(
  current31AdoptedExactTeamCoverageSources().map((row) => trioKey(row.memberIds)),
)

export function isAdoptedPortfolioTeam(memberIds: readonly string[]) {
  return adoptedTrios.has(trioKey(memberIds))
}

/** Reuse adopted exact-team strength for physical allocation, without inventing Engine kernels. */
export function authorityPortfolioCandidates(input: {
  authority: ReturnType<typeof projectAccountDecisionAuthority>
  roster: AccountRoster
  engineMatches: readonly SourceBackedTeamCandidate[]
  engineCandidates: readonly TeamEngineCandidate[]
  requestedCandidateIds?: readonly string[]
  confirmedDirections?: readonly TeamBuildExecutionIdentity[]
}) {
  const matches: SourceBackedTeamCandidate[] = input.engineMatches.map((match) => ({
    ...match,
    strength: { ...match.strength, band: null },
  }))
  const executionCandidates: TeamBuildExecutionIdentity[] = [...input.engineCandidates]
  const owned = new Set(
    input.roster.agents.filter((agent) => agent.owned).map((agent) => agent.agentId),
  )
  const needsBangbooChoice: string[] = []
  for (const item of authorityConsumerRecommendations(input.authority)) {
    if (!adoptedTrios.has(trioKey(item.memberIds))) continue
    if (item.teamRating.status !== 'rated' || item.teamRating.ratingBand === 'Experimental')
      continue
    if (!item.memberIds.every((id) => owned.has(id))) continue
    const confirmed = input.confirmedDirections?.find(
      (candidate) => candidate.candidateId === item.candidateId,
    )
    const direction = confirmed?.bangbooId
      ? { ...confirmed, bangbooId: confirmed.bangbooId }
      : authorityTargetBuildDirection(item)
    if (!direction) {
      needsBangbooChoice.push(item.candidateId)
      continue
    }
    const equivalent = input.engineCandidates.find(
      (candidate) =>
        trioKey(candidate.memberIds) === trioKey(item.memberIds) &&
        candidate.bangbooId === item.bangbooId,
    )
    const band =
      item.teamRating.ratingBand === 'S+' || item.teamRating.ratingBand === 'S'
        ? 'apex'
        : item.teamRating.ratingBand === 'A+' || item.teamRating.ratingBand === 'A'
          ? 'meta'
          : 'viable'
    const existingIndex = equivalent
      ? matches.findIndex((match) => match.templateId === equivalent.candidateId)
      : -1
    if (existingIndex >= 0)
      matches[existingIndex] = {
        ...matches[existingIndex],
        strength: { ...matches[existingIndex].strength, band },
        source: {
          ...matches[existingIndex].source,
          sourceIds: [
            ...new Set([
              ...matches[existingIndex].source.sourceIds,
              ...item.metaCalibration.evidenceRefs,
            ]),
          ],
        },
      }
    if (existingIndex >= 0 && !input.requestedCandidateIds?.includes(item.candidateId)) continue
    const selection =
      confirmed?.bangbooId && confirmed.bangbooStar
        ? {
            status: 'selected' as const,
            bangbooId: confirmed.bangbooId,
            bangbooStar: confirmed.bangbooStar,
          }
        : sourceSupportedTargetBangbooSelection({
            memberIds: direction.memberIds,
            primaryBangbooId: direction.bangbooId,
            engineCandidate: equivalent,
            roster: input.roster,
          })
    if (selection.status !== 'selected' && selection.status !== 'compatible_fallback') continue
    if (selection.bangbooId !== direction.bangbooId) continue
    const bangbooStar =
      selection.bangbooStar ??
      defaultEquipmentRankForRarity(
        currentBangbooDirectory.find((bangboo) => bangboo.id === direction.bangbooId)?.rarity,
      )
    if (existingIndex >= 0) matches.splice(existingIndex, 1)
    const duplicateIndex = matches.findIndex((match) => match.templateId === item.candidateId)
    if (duplicateIndex >= 0) matches.splice(duplicateIndex, 1)
    matches.push({
      templateId: item.candidateId,
      label: item.memberIds.map(getAgentName).join(' · '),
      coreAgentId: item.memberIds[0],
      members: item.memberIds.map((agentId) => ({
        agentId,
        requiredAgentId: agentId,
        role: 'member',
        substitution: 'none',
        currentPlan: { status: 'unavailable', planId: null },
      })),
      bangbooId: direction.bangbooId,
      scenario: equivalent?.scenarioTags.join('|') || null,
      formulaFamily: equivalent?.kernelId ?? null,
      source: {
        sourceIds: item.metaCalibration.evidenceRefs,
        evidenceLocator: `authority-exact:${item.candidateId}`,
        sourceRevision: '3.1',
      },
      strength: { status: 'candidate', band, boundary: '来源评级用于选队；配装不代表精确伤害。' },
    })
    executionCandidates.push({ ...direction, bangbooStar })
  }
  return { candidates: matches, executionCandidates, needsBangbooChoice }
}
