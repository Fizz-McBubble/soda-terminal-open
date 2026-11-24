import type { AccountPlanningDraft } from './types'

export const ratedTeamPlayIdPattern = /^sha256:[a-f0-9]{64}$/u

export function savedTeamRatedPlayId(
  plan: Pick<
    AccountPlanningDraft,
    'solutionContext' | 'selection' | 'teamExecutionSnapshot' | 'teamPortfolioSnapshot'
  >,
) {
  const playId = plan.solutionContext?.ratedTeamPlayId
  const members = plan.selection.agentIds
  const captured = plan.teamExecutionSnapshot?.memberIds
  return playId &&
    ratedTeamPlayIdPattern.test(playId) &&
    !plan.teamPortfolioSnapshot &&
    members.length === 3 &&
    new Set(members).size === 3 &&
    captured?.length === 3 &&
    [...members].sort().join('|') === [...captured].sort().join('|')
    ? playId
    : null
}

export function sameSavedTeam(
  plan: Pick<
    AccountPlanningDraft,
    'kind' | 'selection' | 'solutionContext' | 'teamExecutionSnapshot' | 'teamPortfolioSnapshot'
  >,
  memberIds: readonly string[],
  playId?: string | null,
) {
  return (
    plan.kind === 'team' &&
    !plan.teamPortfolioSnapshot &&
    (playId
      ? savedTeamRatedPlayId(plan) === playId
      : plan.solutionContext?.ratedTeamPlayId == null) &&
    plan.selection.agentIds.length === memberIds.length &&
    memberIds.every((id) => plan.selection.agentIds.includes(id))
  )
}
