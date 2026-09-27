import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { formatTeamRating } from './teamRatingText'

type SavedRatingInput = {
  plan: AccountPlanningDraft
  decisionAuthority?: AccountDecisionSnapshot['decisionAuthority']
  /** Only supply an item from a current, identity-checked private Query response. */
  publicItem?: TeamLoadoutOverviewItem | null
}

const localPresentation =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : await import('./savedTeamRatingPresentationLocal')

/** The browser can format an approved rating, but cannot calculate one. */
export function publicSavedTeamRatingLabel(input: Pick<SavedRatingInput, 'plan' | 'publicItem'>) {
  const { plan, publicItem } = input
  if (
    !publicItem ||
    plan.teamPortfolioSnapshot ||
    publicItem.kind !== 'saved' ||
    publicItem.id !== `saved:${plan.id}` ||
    publicItem.agentIds.length !== 3 ||
    plan.selection.agentIds.length !== 3 ||
    new Set(publicItem.agentIds).size !== 3 ||
    publicItem.agentIds.some((id) => !plan.selection.agentIds.includes(id)) ||
    !['S+', 'S', 'A+', 'A', 'B'].includes(publicItem.teamRatingBand ?? '') ||
    publicItem.confidence === 'experimental' ||
    publicItem.mechanicValidity === 'invalid' ||
    (publicItem.recommendationScore != null &&
      (typeof publicItem.recommendationScore !== 'number' ||
        !Number.isFinite(publicItem.recommendationScore)))
  )
    return null
  return formatTeamRating(publicItem.teamRatingBand!, publicItem.recommendationScore)
}

export function currentSavedTeamRatingLabel(input: SavedRatingInput) {
  return localPresentation
    ? localPresentation.currentSavedTeamRatingLabel(input)
    : publicSavedTeamRatingLabel(input)
}
