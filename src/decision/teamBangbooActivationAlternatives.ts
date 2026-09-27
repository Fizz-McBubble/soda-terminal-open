import { targetTeamBangbooOptions } from './targetTeamSourceBangbooOptions'

/** Current reviewed/mechanic shortlist, without assuming account ownership. */
export function teamBangbooActivationAlternatives(memberIds: readonly string[]) {
  return targetTeamBangbooOptions({ memberIds }).map((option) => option.bangbooId)
}
