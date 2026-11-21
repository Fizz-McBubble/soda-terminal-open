import reviewed from '../gameDataPacks/data/default-team-admission-reviewed-plays.3.3.json'
import admission from '../gameDataPacks/generated/default-team-admission.3.3.json'
import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
import type { TeamMechanismDirection } from './teamMechanismDirection'
import { lookupGraduatedTeamDefaultPlay } from './graduatedTeamScoreIndex'

const admittedByTeam = new Map(admission.rows.map(row => [row[0], new Set(row[2] as string[])]))
const reviewedByTeam = new Map<string, (typeof reviewed.entries)[number]>()
for (const entry of reviewed.entries) {
  const key = [...entry.members].sort().join('|')
  if (!reviewedByTeam.has(key)) reviewedByTeam.set(key, entry)
}

export function selectSavedDefaultTeamAdmissionPlay(
  members: readonly string[],
  direction: TeamMechanismDirection,
  catalogHash: string | null | undefined,
) {
  return selectDefaultTeamAdmissionPlay(members, direction,
    admission.catalog === catalogHash ? admittedByTeam.get([...members].sort().join('|')) : undefined)
}

// Match the offline-selected play, retaining explicit reviewed preferences.
// Older artifacts fall back to an admitted intrinsic variant; they must not
// drop a team whose completed result is already available.
export function selectDefaultTeamAdmissionPlay(
  members: readonly string[],
  direction: TeamMechanismDirection | null | undefined,
  admitted: ReadonlySet<string> | undefined,
) {
  if (!direction) return null
  if (!admitted?.size) return direction.playability
  const key = [...members].sort().join('|')
  const entry = reviewedByTeam.get(key)
  if (entry && admitted?.has(entry.playId)) {
    const preferred = direction.variants.find(play =>
      play.primaryOutputAgentId === entry.primary && canonicalTeamPlayIdentity(play) === entry.playId,
    )
    if (preferred) return preferred
  }
  const preparedId = lookupGraduatedTeamDefaultPlay(members, admission.catalog, admission.gameVersion)
  if (preparedId && admitted?.has(preparedId)) {
    const prepared = direction.variants.find(play => canonicalTeamPlayIdentity(play) === preparedId)
    if (prepared) return prepared
  }
  const original = direction.playability
  if (original && admitted.has(canonicalTeamPlayIdentity(original))) return original
  return direction.variants.find(play => admitted.has(canonicalTeamPlayIdentity(play))) ?? original
}
