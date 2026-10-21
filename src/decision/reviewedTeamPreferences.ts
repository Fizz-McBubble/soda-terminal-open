import { z } from 'zod'
import dataset from '../gameDataPacks/data/reviewed-team-preferences.v1.json'
import { currentScopeManifest } from '../gameDataPacks/currentScopeManifest'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { currentVersionAdoption32 } from '../gameDataPacks/currentVersionAdoption32'
import { currentVersionAdoption33 } from '../gameDataPacks/currentVersionAdoption33'
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
  const performanceCautions = parsed.records.filter(
    (fact) =>
      !fact.withdrawn &&
      fact.sourceVersion === currentVersion &&
      !reviewCurrent31ProductionPairwiseEvidence(fact.preferredMemberIds, fact.alternativeMemberIds)
        .defaultSameBandOrderingEligible,
  )
  // Uncontrolled population aggregates describe a mode/cycle, not the formed
  // generic baseline. Keep their reversals visible as cautions; a reversal alone
  // cannot erase an explicitly reviewed fixed-core substitution preference.
  const index = createTeamPreferenceIndex(parsed.records, currentVersion)
  const cautionSnapshot = performanceCautions.map((fact) => ({
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
    get performanceCautions() {
      return cautionSnapshot.map((fact) => ({
        ...fact,
        preferredMemberIds: [...fact.preferredMemberIds],
        alternativeMemberIds: [...fact.alternativeMemberIds],
      }))
    },
  }
}

/** The adopted 3.2 and 3.3 read views retain the existing fixed-core guide
 * substitutions and their original 3.1 sources. This is reference continuity,
 * not a new guide review, strength band, or combat-performance claim.
 * An unknown/future read view cannot borrow that authority. */
export function reviewedTeamPreferenceVersion(currentVersion: string) {
  const adoption = [currentVersionAdoption32, currentVersionAdoption33].find(
    (entry) => entry.gameVersion === currentVersion,
  )
  return adoption?.legacyFieldAuthority.gameVersion ?? currentVersion
}

export const reviewedTeamPreferences = createReviewedTeamPreferenceCatalog(
  dataset,
  reviewedTeamPreferenceVersion(currentVersionProjection.gameVersion),
)
