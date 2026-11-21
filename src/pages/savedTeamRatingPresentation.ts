import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountDecisionSnapshot } from '../application/calculationQueryContract'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { referenceSummary } from './teamRatingPresentation'
import { graduatedTeamRatingBands } from '../decision/graduatedTeamRatingBands'

type SavedRatingInput = {
  plan: AccountPlanningDraft
  decisionAuthority?: AccountDecisionSnapshot['decisionAuthority']
  /** Only supply an item from a current, identity-checked private Query response. */
  publicItem?: TeamLoadoutOverviewItem | null
}

const localPresentation =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true'
      ? null
      : await import('./savedTeamRatingPresentationLocal')
const communityPresentation =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true'
      ? await import('./savedTeamRatingPresentationCommunity')
      : null

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
    !graduatedTeamRatingBands.some(band => band === publicItem.teamRatingBand) ||
    publicItem.confidence === 'experimental' ||
    publicItem.mechanicValidity === 'invalid' ||
    (publicItem.recommendationScore != null &&
      (typeof publicItem.recommendationScore !== 'number' ||
        !Number.isFinite(publicItem.recommendationScore)))
  )
    return null
  const label = referenceSummary(publicItem)
  return label.startsWith('评级 ') ? label : null
}

export function currentSavedTeamRatingLabel(input: SavedRatingInput) {
  if (localPresentation) return localPresentation.currentSavedTeamRatingLabel(input)
  if (input.publicItem) return publicSavedTeamRatingLabel(input)
  return communityPresentation?.communitySavedTeamRatingLabel(input.plan) ?? null
}
