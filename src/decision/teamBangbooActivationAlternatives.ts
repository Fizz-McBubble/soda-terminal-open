import admission from '../gameDataPacks/generated/default-team-admission.3.3.json'
import { preparedBoxBangbooAlternatives } from './preparedBoxFormationRanking'
import { targetTeamBangbooOptions } from './targetTeamSourceBangbooOptions'

/** Current reviewed/mechanic shortlist, without assuming account ownership. */
export function teamBangbooActivationAlternatives(memberIds: readonly string[]) {
  return (
    preparedBoxBangbooAlternatives(memberIds, admission.catalog) ??
    targetTeamBangbooOptions({ memberIds }).map((option) => option.bangbooId)
  )
}
