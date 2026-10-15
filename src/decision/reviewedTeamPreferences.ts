import { z } from 'zod'
import dataset from '../gameDataPacks/data/reviewed-team-preferences.v1.json'
import { currentScopeManifest } from '../gameDataPacks/currentScopeManifest'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { currentVersionAdoption32 } from '../gameDataPacks/currentVersionAdoption32'
import { createTeamPreferenceIndex } from './teamPreferenceEvidence'
import { reviewCurrent31ProductionPairwiseEvidence } from './current31ProductionPairwiseEvidence'

const members = z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)])
const schema = z
  .object({
    schema: z.literal('soda-reviewed-team-preferences/v1'),
    sourceVersion: z.string().min(1),
    records: z.array(
      z
        .object({
          claimId: z.string().min(1),
          preferredMemberIds: members,
          alternativeMemberIds: members,
          sourceVersion: z.string().min(1),
          sourceUrl: z.url(),
          checkedAt: z.string().min(1),
          locator: z.string().min(1),
          reason: z.string().min(1),
          sourceSha256: z.string().regex(/^[a-f\d]{64}$/i),
          withdrawn: z.boolean().optional(),
        })
        .strict(),
    ),
  })
  .strict()

export function createReviewedTeamPreferenceCatalog(input: unknown, currentVersion: string) {
  const parsed = schema.parse(input)
  const known = new Set(
    currentScopeManifest.entries
      .filter((entry) => entry.domain === 'agent' && entry.releaseState === 'released')
      .map((entry) => entry.stableId),
  )
  const claims = new Set<string>()
  for (const fact of parsed.records) {
    if (claims.has(fact.claimId)) throw new Error(`Duplicate preference claim: ${fact.claimId}`)
    claims.add(fact.claimId)
    if (fact.sourceVersion !== parsed.sourceVersion)
      throw new Error(`Preference source version mismatch: ${fact.claimId}`)
    if ([...fact.preferredMemberIds, ...fact.alternativeMemberIds].some((id) => !known.has(id)))
      throw new Error(`Unknown preference member: ${fact.claimId}`)
  }
  const withheldByPerformance = parsed.records.filter(
    (fact) =>
      !fact.withdrawn &&
      fact.sourceVersion === currentVersion &&
      !reviewCurrent31ProductionPairwiseEvidence(fact.preferredMemberIds, fact.alternativeMemberIds)
        .defaultSameBandOrderingEligible,
  )
  const withheld = new Set(withheldByPerformance)
  const index = createTeamPreferenceIndex(
    parsed.records.filter((fact) => !withheld.has(fact)),
    currentVersion,
  )
  const withheldSnapshot = withheldByPerformance.map((fact) => ({
    ...fact,
    preferredMemberIds: [...fact.preferredMemberIds],
    alternativeMemberIds: [...fact.alternativeMemberIds],
  }))
  // Object spread would materialize the index getters into mutable shared arrays.
  // Preserve fresh views through the real registry consumed by account ordering.
  return {
    get acceptedFacts() {
      return index.acceptedFacts
    },
    get conflictingFacts() {
      return index.conflictingFacts
    },
    forTeam: index.forTeam,
    order: index.order,
    get withheldByPerformance() {
      return withheldSnapshot.map((fact) => ({
        ...fact,
        preferredMemberIds: [...fact.preferredMemberIds],
        alternativeMemberIds: [...fact.alternativeMemberIds],
      }))
    },
  }
}

/** The adopted 3.2 read view preserves its explicitly pinned 3.1 review basis.
 * An unknown/future read view cannot borrow that authority. */
export function reviewedTeamPreferenceVersion(currentVersion: string) {
  return currentVersion === currentVersionAdoption32.gameVersion
    ? currentVersionAdoption32.legacyFieldAuthority.gameVersion
    : currentVersion
}

export const reviewedTeamPreferences = createReviewedTeamPreferenceCatalog(
  dataset,
  reviewedTeamPreferenceVersion(currentVersionProjection.gameVersion),
)
