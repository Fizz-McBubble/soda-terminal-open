import type { AccountPlanningDraft } from '../accounts/types'
import { savedTeamRatedPlayId } from '../accounts/savedTeamRatingPlayIdentity'
import { publicVersionIdentity } from '../application/publicVersionIdentity'
import {
  lookupGraduatedTeamDefaultPlay,
  lookupGraduatedTeamScore,
} from '../decision/graduatedTeamScoreIndex'
import scores from '../gameDataPacks/generated/graduated-team-scores.v1.json'
import { formatGraduatedTeamScore } from './teamRatingText'

const playCounts = new Map<string, number>()
for (const row of scores.rows) playCounts.set(row.members, (playCounts.get(row.members) ?? 0) + 1)

/** Read back a verified display score after the saved plan outlives its calculation session. */
export function communitySavedTeamRatingLabel(plan: AccountPlanningDraft) {
  const members = plan.selection.agentIds
  const key = [...members].sort().join('|')
  const snapshotMembers = plan.teamExecutionSnapshot?.memberIds
  const version = publicVersionIdentity.gameVersion
  if (
    plan.kind !== 'team' ||
    plan.state !== 'saved' ||
    plan.teamPortfolioSnapshot ||
    plan.teamExecutionSnapshot?.authorComparisonMembership ||
    plan.solutionContext?.scope !== 'team_joint' ||
    plan.solutionContext.gameVersion !== version ||
    members.length !== 3 ||
    new Set(members).size !== 3 ||
    snapshotMembers?.length !== 3 ||
    [...snapshotMembers].sort().join('|') !== key
  )
    return null

  const catalogHash = scores.catalogHash
  const playId =
    plan.solutionContext.ratedTeamPlayId !== undefined
      ? savedTeamRatedPlayId(plan)
      : playCounts.get(key) === 1
        ? lookupGraduatedTeamDefaultPlay(members, catalogHash, version)
        : null
  const score =
    playId &&
    lookupGraduatedTeamScore({ catalogHash, gameVersion: version, memberIds: members, playId })
  return score ? formatGraduatedTeamScore(score) : null
}
