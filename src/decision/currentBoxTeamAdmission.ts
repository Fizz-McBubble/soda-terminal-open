import admission from '../gameDataPacks/generated/default-team-admission.3.3.json'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import type { LegalAgentFormation } from '../teamEngine/current31LegalCandidateUniverse'
import { currentGenericTeamRankingStatus } from './teamGenericRanking'

export class FullTeamIndexesRequired extends Error {
  override name = 'FullTeamIndexesRequired'
}

export const currentBoxAdmissionReady =
  currentGenericTeamRankingStatus.status === 'ready' &&
  currentGenericTeamRankingStatus.contentHash === admission.catalog &&
  currentVersionProjection.gameVersion === admission.gameVersion

export const currentBoxAdmissionByTeam = new Map(
  (admission.rows as [string, string, string[]][]).map(([key, route, plays]) => [
    key,
    { route, plays: new Set(plays) },
  ]),
)

const admittedFormations = [...currentBoxAdmissionByTeam.keys()].map(
  (key) => key.split('|') as unknown as LegalAgentFormation,
)

export function ownedAdmittedBoxFormations(ownedAgentIds: ReadonlySet<string>) {
  if (!currentBoxAdmissionReady) return undefined
  return admittedFormations.filter((members) => members.every((id) => ownedAgentIds.has(id)))
}
