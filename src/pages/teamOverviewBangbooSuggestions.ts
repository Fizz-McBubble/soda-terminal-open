import prepared from '../gameDataPacks/generated/team-bangboo-overview.3.3.json'
import admission from '../gameDataPacks/generated/default-team-admission.3.3.json'
import { resolveTargetTeamBangbooOption } from '../decision/targetTeamSourceBangbooOptions'
import { admittedTeamBangbooOptions } from '../decision/admittedTeamBangbooOptions'
import type { BangbooUtilityPurpose } from '../calculation/currentBangbooUtilityProjectionTypes'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'

type Suggestion = NonNullable<TeamLoadoutOverviewItem['bangbooSuggestions']>[number]
type Stars = 1 | 2 | 3 | 4 | 5
const rows: Record<string, number[]> = prepared.rows
const options = prepared.options as [
  string,
  Stars,
  BangbooUtilityPurpose,
  string,
  'active' | 'inactive',
][]
const ready =
  prepared.catalog === admission.catalog && prepared.gameVersion === admission.gameVersion

function summary({
  bangbooId,
  defaultStars,
  primaryPurpose,
  recommendationReason,
  activationStatus,
}: Suggestion): Suggestion {
  return { bangbooId, defaultStars, primaryPurpose, recommendationReason, activationStatus }
}

export function teamOverviewBangbooSuggestions(
  memberIds: readonly string[],
  selectedId?: string | null,
  stars?: Stars,
) {
  const indices = ready ? rows[[...memberIds].sort().join('|')] : undefined
  const baseline = indices?.map((index) => {
    const [bangbooId, defaultStars, primaryPurpose, recommendationReason, activationStatus] =
      options[index]!
    return { bangbooId, defaultStars, primaryPurpose, recommendationReason, activationStatus }
  })
  const previous = baseline?.find((option) => option.bangbooId === selectedId)
  const input = {
    memberIds,
    bangbooStarsById: selectedId && stars ? { [selectedId]: stars } : undefined,
  }
  const list =
    baseline && (!stars || previous?.defaultStars === stars)
      ? baseline
      : admittedTeamBangbooOptions(input).map(summary)
  if (!selectedId) return list
  const ranked = list.find((option) => option.bangbooId === selectedId)
  const retained = ranked ? undefined : resolveTargetTeamBangbooOption(input, selectedId)
  const selected =
    ranked ??
    (retained?.recipientFit === 'direct' || retained?.recipientFit === 'general'
      ? retained
      : undefined)
  if (selected?.activationStatus !== 'active') return list
  return [summary(selected), ...list.filter((option) => option.bangbooId !== selectedId)].slice(
    0,
    3,
  )
}
