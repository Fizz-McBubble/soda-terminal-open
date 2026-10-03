import type { CurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import type { RetentionActionFact } from './absoluteDiscRetentionActionFacts'
import review from './reviewedRetentionActionKits.json'
import actionContinuity from './reviewed-action-source-continuity.v1.json'

const reviewHash = stableContentHash(review)

/** Derived facts only. Full kits and guide snapshots stay in private evidence.
 * Damage names and a primary damage tag do not exclude a second Aftershock tag.
 * The sole negative has an explicit community statement, cross-checked against
 * every skill/core/Mindscape in the parent snapshot's pinned 3.1 kit.
 */
export function reviewedKitAftershockFact(
  actorAgentId: string,
  contract: CurrentAgentEventContract,
): RetentionActionFact | null {
  const row = review.actors.find((actor) => actor.actorAgentId === actorAgentId)
  const currentSourceContinues =
    contract.source.commit === actionContinuity.currentCommit &&
    actionContinuity.genericActionReview.legacyActionProjectionEqual &&
    actionContinuity.rows.some(
      (entry) =>
        entry.unchanged &&
        entry.externalId === contract.externalId &&
        entry.upstreamKey === contract.upstreamKey &&
        entry.formulaPath === contract.source.formulaPath &&
        entry.statsPath === contract.source.statsPath &&
        entry.formulaSha256 === contract.source.formulaSha256 &&
        entry.statsSha256 === contract.source.statsSha256,
    )
  if (
    !row ||
    contract.stableId !== row.actorAgentId ||
    contract.externalId !== row.externalId ||
    contract.upstreamKey !== row.upstreamKey ||
    contract.source.repository !== review.parentRepository ||
    (contract.source.commit !== review.parentCommit && !currentSourceContinues) ||
    contract.source.formulaPath !== `libs/zzz/formula/src/data/char/sheets/${row.upstreamKey}.ts` ||
    contract.source.statsPath !== `libs/zzz/stats/Data/Characters/${row.upstreamKey}.json` ||
    contract.source.formulaSha256 !== row.formulaSha256 ||
    contract.source.statsSha256 !== row.statsSha256
  )
    return null
  return {
    actorAgentId,
    actionTag: 'aftershock',
    presence: row.aftershockPresence === 'absent' ? 'absent' : 'unresolved',
    condition: null,
    currentBuildBenefit: 'unresolved',
    sourceIds: [
      `${review.kitRepository}:${review.kitCommit}:character/${row.externalId}.json:${row.kitSha256}`,
      `${review.reviewVersion}:${reviewHash}:reviewed-full-kit-action-boundary`,
      ...(currentSourceContinues
        ? [
            `${review.parentCommit}->${actionContinuity.currentCommit}:${actionContinuity.genericActionReview.currentLegacyProjectionSha256}:unchanged-static-kit-applicability`,
          ]
        : []),
      ...(row.aftershockPresence === 'absent'
        ? review.crossChecks.map(
            (source) => `${source.url}:${source.snapshotSha256}:${source.locator}`,
          )
        : []),
    ],
    sourceEvents: [],
    detail: row.detail,
  }
}
