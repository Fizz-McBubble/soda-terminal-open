import artifact from '../gameDataPacks/generated/graduated-team-scores.v1.json'
import fixedBuildReferences from '../gameDataPacks/data/team-rating-fixed-build-references.3.3.json'
import { stableContentHash } from '../domain/stableContentHash'
import workload from './teamRatingWorkload.json'
import calculationIdentity from './teamRatingCalculationIdentity.json'
import { graduatedTeamRatingBands, type GraduatedTeamRatingBand } from './graduatedTeamRatingBands'

export type GraduatedTeamScore = Readonly<{
  band: GraduatedTeamRatingBand
  score: number
  /** Lower is stronger. Produced offline from the representative continuous result. */
  orderGroup: number
  standardIdentity: string
  ratingBasis?: 'standardized_theory'
  /** The measured build is reproducible but lacks a qualified graduation replacement. */
  unconfirmedBuildAgentIds?: readonly string[]
}>
export type GraduatedScoreKey = {
  catalogHash: string
  gameVersion: string
  playId: string
  memberIds: readonly string[]
}
type StoredRow = {
  playId: string
  members: string
  band: string
  score: number
  group: number
  evidence: string
  ratingBasis?: string
}
const reviewedFixedBuilds = new Map(fixedBuildReferences.entries.map(entry => [entry.playId, entry]))
export type GraduatedScoreIndex = {
  contract: string
  ratingBasis?: string
  engineVersion?: string
  runtimeVersion?: string
  algorithmSourceHash?: string | null
  ratingSourceHash?: string | null
  gameVersion: string
  catalogHash: string
  standardIdentity: string | null
  protocolHash: string | null
  workloadIdentity: string | null
  scoreScale?: { id: string; revision: string; identity: string }
  rows: readonly StoredRow[]
  defaultPlays?: readonly { members: string; playId: string }[]
}

// The producer binds graduate builds and scenario outcomes to the artifact basis.
// Keep those large inputs out of the BOX bundle. Never read an account's old numeric field.
export function createGraduatedTeamScoreLookup(index: GraduatedScoreIndex) {
  const rows = new Map<string, StoredRow>()
  const currentScale = index.contract === 'graduated-team-scores/v2'
  const bands: ReadonlySet<string> = new Set(currentScale ? graduatedTeamRatingBands : ['S', 'A+', 'A', 'B'])
  const unavailable: (key: GraduatedScoreKey) => GraduatedTeamScore | null = () => null
  if (
    !Array.isArray(index?.rows) ||
    !['graduated-team-scores/v1', 'graduated-team-scores/v2'].includes(index.contract) ||
    (currentScale && (!index.scoreScale?.id || !index.scoreScale.revision || !/^[a-f0-9]{64}$/.test(index.scoreScale.identity))) ||
    (index.ratingBasis !== undefined && index.ratingBasis !== 'standardized_theory') ||
    index.engineVersion !== calculationIdentity.engineVersion ||
    index.runtimeVersion !== calculationIdentity.runtimeVersion ||
    !/^[a-f0-9]{64}$/.test(index.algorithmSourceHash ?? '') ||
    !/^[a-f0-9]{64}$/.test(index.ratingSourceHash ?? '') ||
    index.workloadIdentity !== stableContentHash(workload)
  )
    return unavailable
  for (const row of index.rows) {
    if (typeof row?.members !== 'string') return unavailable
    const members: string[] = row.members.split('|')
    if (
      members.length !== 3 ||
      new Set(members).size !== 3 ||
      members.some((id) => !id.startsWith('agent-')) ||
      [...members].sort().join('|') !== row.members ||
      rows.has(row.playId) ||
      !/^sha256:[a-f0-9]{64}$/.test(row.playId) ||
      !bands.has(row.band) ||
      !Number.isSafeInteger(row.score) ||
      row.score < 0 ||
      (currentScale && row.score > 100) ||
      !Number.isSafeInteger(row.group) ||
      row.group < 0 ||
      !/^[a-f0-9]{64}$/.test(row.evidence) ||
      (row.ratingBasis !== undefined && row.ratingBasis !== 'standardized_theory')
    )
      return unavailable
    rows.set(row.playId, row)
  }
  return ({
    catalogHash,
    gameVersion,
    playId,
    memberIds,
  }: GraduatedScoreKey): GraduatedTeamScore | null => {
    if (
      !['graduated-team-scores/v1', 'graduated-team-scores/v2'].includes(index.contract) ||
      !index.standardIdentity ||
      !index.protocolHash ||
      index.catalogHash !== catalogHash ||
      index.gameVersion !== gameVersion ||
      memberIds.length !== 3
    )
      return null
    const row = rows.get(playId)
    if (!row || [...memberIds].sort().join('|') !== row.members) return null
    const review = gameVersion === fixedBuildReferences.gameVersion ? reviewedFixedBuilds.get(playId) : undefined
    const fixedBuild = review?.members === row.members && review.evidence === row.evidence ? review : undefined
    return {
      band: row.band as GraduatedTeamScore['band'],
      score: row.score,
      orderGroup: row.group,
      standardIdentity: index.standardIdentity,
      ...(fixedBuild ? { unconfirmedBuildAgentIds: fixedBuild.unconfirmedAgentIds } : {}),
      ...((row.ratingBasis ?? index.ratingBasis) === 'standardized_theory' ? { ratingBasis: 'standardized_theory' as const } : {}),
    }
  }
}
export const lookupGraduatedTeamScore = createGraduatedTeamScoreLookup(artifact)
const defaultPlays = new Map(((artifact as GraduatedScoreIndex).defaultPlays ?? [])
  .map(row => [row.members, row.playId]))

export function lookupGraduatedTeamDefaultPlay(memberIds: readonly string[], catalogHash: string, gameVersion: string) {
  const playId = defaultPlays.get([...memberIds].sort().join('|'))
  return playId && lookupGraduatedTeamScore({ memberIds, playId, catalogHash, gameVersion }) ? playId : null
}
export const hasGraduatedTeamScores =
  ((artifact as GraduatedScoreIndex).ratingBasis === undefined ||
    (artifact as GraduatedScoreIndex).ratingBasis === 'standardized_theory') &&
  artifact.rows.length > 0 &&
  artifact.engineVersion === calculationIdentity.engineVersion &&
  artifact.runtimeVersion === calculationIdentity.runtimeVersion &&
  /^[a-f0-9]{64}$/.test(artifact.algorithmSourceHash ?? '') &&
  /^[a-f0-9]{64}$/.test(artifact.ratingSourceHash ?? '') &&
  artifact.workloadIdentity === stableContentHash(workload)
