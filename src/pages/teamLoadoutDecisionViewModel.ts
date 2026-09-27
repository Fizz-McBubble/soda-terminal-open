import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import type { DecisionTeamViewModel } from './teamLoadoutDecisionViewModelLocal'

type TeamRecommendation = AccountDecisionSnapshot['teamEngine']['recommendations'][number]

const localDecisionModel =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : await import('./teamLoadoutDecisionViewModelLocal')

export type { DecisionTeamViewModel }

/** The selection identity is already a calculation fact, so it needs no catalog lookup. */
export function defaultSchemeBangbooId(recommendation: TeamRecommendation) {
  if (recommendation.bangbooId) return recommendation.bangbooId
  const selection = recommendation.bangbooSelection
  if (!selection) return null
  if (selection.status === 'selected' || selection.status === 'compatible_fallback')
    return selection.bangbooId
  return null
}

export function teamRecommendationFamilyId(recommendation: TeamRecommendation) {
  if (!localDecisionModel) throw new Error('队伍系列须由私有计算结果提供。')
  return localDecisionModel.teamRecommendationFamilyId(recommendation)
}

export function teamRecommendationFamilyKey(recommendation: TeamRecommendation) {
  if (!localDecisionModel) throw new Error('队伍系列须由私有计算结果提供。')
  return localDecisionModel.teamRecommendationFamilyKey(recommendation)
}

/** A public route may display only its accepted private Query projection. */
export function decisionTeamViewModel(
  decision: AccountDecisionSnapshot,
  candidateId: string,
  publicTeam?: DecisionTeamViewModel | null,
): DecisionTeamViewModel | null {
  if (localDecisionModel) return localDecisionModel.decisionTeamViewModel(decision, candidateId)
  if (
    !publicTeam ||
    publicTeam.id !== candidateId ||
    publicTeam.agentIds.length !== 3 ||
    new Set(publicTeam.agentIds).size !== 3
  )
    return null
  return publicTeam
}

export function decisionTeamAlternativeVariants(
  decision: AccountDecisionSnapshot,
  candidateId: string,
  publicAlternatives: readonly DecisionTeamViewModel[] = [],
): DecisionTeamViewModel[] {
  if (localDecisionModel)
    return localDecisionModel.decisionTeamAlternativeVariants(decision, candidateId)
  return publicAlternatives.some((team) => team.id === candidateId)
    ? publicAlternatives.filter((team) => team.agentIds.length === 3)
    : []
}

export function decisionTeamAlternatives(
  decision: AccountDecisionSnapshot,
  candidateId: string,
  publicAlternatives: readonly DecisionTeamViewModel[] = [],
): DecisionTeamViewModel[] {
  return decisionTeamAlternativeVariants(decision, candidateId, publicAlternatives).filter(
    (candidate) => candidate.availability === 'direct',
  )
}

export function teamRatingSummary(ratingBand: string | null | undefined) {
  return !ratingBand || ratingBand === 'Experimental'
    ? '暂时无法判断这队的强弱'
    : `评级 ${ratingBand}`
}
