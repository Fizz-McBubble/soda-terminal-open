import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import { authorityConsumerRecommendations } from '../application/authorityConsumerRecommendations'
import {
  recommendedTargetBangbooDefault,
  sourceBangbooId,
} from '../decision/targetTeamEquipmentParameters'
import { decisionTeamViewModel } from './teamLoadoutDecisionViewModel'

export function resolveTargetTeamFitEntry(
  decision: AccountDecisionSnapshot,
  candidateId: string,
  warehouse: CoreWarehouse,
) {
  const team = decisionTeamViewModel(decision, candidateId)
  const memberKey = team ? [...team.agentIds].sort().join('|') : ''
  const authorityCandidates =
    decision.decisionAuthority.status === 'ready' && team
      ? authorityConsumerRecommendations(decision.decisionAuthority).filter(
          (candidate) => [...candidate.memberIds].sort().join('|') === memberKey,
        )
      : []
  const matchingCandidates = authorityCandidates.filter(
    (candidate) => candidate.bangbooId === team?.bangbooId,
  )
  const authorityCandidate =
    matchingCandidates.find((candidate) => candidate.candidateId === candidateId) ??
    (matchingCandidates.length === 1 ? matchingCandidates[0] : undefined)
  const engineCandidate = decision.teamEngine.recommendations.find(
    (candidate) => candidate.candidateId === team?.id,
  )
  const targetCandidateId = authorityCandidate?.candidateId ?? engineCandidate?.candidateId ?? null
  const playerConfirmableBangbooInput =
    team && !team.bangbooId && (!authorityCandidate?.authorComparisonMembership || authorityCandidate.authorComparisonMembership.independentDefaultAdmission)
      ? {
          memberIds: team.agentIds as [string, string, string],
          primaryBangbooId: engineCandidate ? (sourceBangbooId(engineCandidate) ?? '') : '',
          engineCandidate,
          roster: warehouse.roster,
        }
      : null
  const automaticBangboo = playerConfirmableBangbooInput
    ? recommendedTargetBangbooDefault(playerConfirmableBangbooInput)
    : null
  return {
    team,
    authorityCandidates,
    authorityCandidate,
    engineCandidate,
    targetCandidateId,
    playerConfirmableBangbooInput,
    automaticBangboo,
  }
}
