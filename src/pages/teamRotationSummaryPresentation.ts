import reviewed from '../gameDataPacks/data/reviewed-team-rotation-summaries.3.3.json'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'

export type TeamRotationSummarySource = {
  contract: string
  gameVersion: string
  rows: readonly {
    playId: string
    memberIds: readonly string[]
    primaryAgentId: string
    opening: string
    loop: string
    burst: string
    evidence: { axisSha256: string; policySha256: string }
  }[]
}

/** A team's summary belongs only to the explicitly selected play. */
export function presentTeamRotationSummary(
  item: Pick<TeamLoadoutOverviewItem, 'agentIds' | 'playDirection'>,
  source: TeamRotationSummarySource = reviewed,
) {
  const play = item.playDirection
  if (!play || source.contract !== 'team-rotation-summaries/v1' ||
      source.gameVersion !== currentVersionProjection.gameVersion) return null
  const members = [...item.agentIds].sort().join('|')
  if (item.agentIds.length !== 3 || new Set(item.agentIds).size !== 3 ||
      [...play.memberIds].sort().join('|') !== members) return null
  const id = canonicalTeamPlayIdentity(play)
  const matches = source.rows.filter(row => row.playId === id &&
    row.memberIds.length === 3 && new Set(row.memberIds).size === 3 &&
    [...row.memberIds].sort().join('|') === members && row.primaryAgentId === play.primaryOutputAgentId &&
    [row.opening, row.loop, row.burst].every(text => typeof text === 'string' && text.trim()))
  return matches.length === 1 ? matches[0]! : null
}
