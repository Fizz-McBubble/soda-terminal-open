import type { TeamEngineCandidate } from '../teamEngine/contracts'
import type { BangbooStar } from '../teamEngine/contracts'
import type { projectAccountDecisionAuthority } from './accountDecisionAuthority'
import { authorityConsumerRecommendations } from './accountDecisionAuthorityConsumers'

function exactTeamMemberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

function resolvedEngineBangbooId(candidate: TeamEngineCandidate) {
  if (candidate.bangbooId) return candidate.bangbooId
  const selection = candidate.bangbooSelection
  if (!selection) return null
  if (selection.status === 'selected' || selection.status === 'compatible_fallback') {
    return selection.bangbooId
  }
  return null
}

export type AuthorityExecutionVariantResolver = (input: {
  memberIds: readonly [string, string, string]
  bangbooId: string
  /** An explicit player/query choice is exact; omitted requests source minimum closure. */
  bangbooStar?: BangbooStar
}) => TeamEngineCandidate | undefined

function exactVariantCandidate(
  candidate: TeamEngineCandidate,
  recommendation: ReturnType<typeof authorityConsumerRecommendations>[number],
) {
  return (
    exactTeamMemberKey(candidate.memberIds) === exactTeamMemberKey(recommendation.memberIds) &&
    resolvedEngineBangbooId(candidate) === recommendation.bangbooId
  )
}

export function authorityExecutionCandidates(
  authority: ReturnType<typeof projectAccountDecisionAuthority>,
  engineCandidates: readonly TeamEngineCandidate[],
  resolveExactVariant?: AuthorityExecutionVariantResolver,
) {
  if (authority.status !== 'ready') return []
  return authorityConsumerRecommendations(authority).flatMap((recommendation) => {
    const engine =
      engineCandidates.find((candidate) => exactVariantCandidate(candidate, recommendation)) ??
      (recommendation.bangbooId
        ? resolveExactVariant?.({
            memberIds: [
              recommendation.memberIds[0],
              recommendation.memberIds[1],
              recommendation.memberIds[2],
            ],
            bangbooId: recommendation.bangbooId,
          })
        : undefined)
    if (!engine || !exactVariantCandidate(engine, recommendation)) return []
    return [
      {
        ...engine,
        candidateId: recommendation.candidateId,
        memberIds: [...recommendation.memberIds] as [string, string, string],
        bangbooId: recommendation.bangbooId,
        // Authority establishes the exact Variant identity. Team Engine retains
        // the executable Bangboo evidence boundary (for example, a compatible
        // fallback must not be presented as a direct selected recommendation).
        bangbooSelection: engine.bangbooSelection,
      },
    ]
  })
}
