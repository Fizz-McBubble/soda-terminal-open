import type { AccountPlanningDraft } from './types'

/** Read-only protection projection. A union protects known IDs, never proves a valid six/18-disc plan. */
export function resolvePlanningDiscReferences(
  draft: Pick<
    AccountPlanningDraft,
    'warehouseRefs' | 'candidateWarehouse' | 'teamExecutionSnapshot'
  >,
) {
  const sources = [
    { source: 'warehouseRefs' as const, ids: draft.warehouseRefs ?? [] },
    ...(draft.candidateWarehouse
      ? [
          {
            source: 'candidateWarehouse' as const,
            ids: draft.candidateWarehouse.loadouts.flatMap((loadout) => loadout.discIds),
          },
        ]
      : []),
    ...(draft.teamExecutionSnapshot
      ? [
          {
            source: 'teamExecutionSnapshot' as const,
            ids: draft.teamExecutionSnapshot.members.flatMap((member) => member.suggested.discIds),
          },
        ]
      : []),
  ]
  const referenceIds = [...new Set(sources.flatMap(({ ids }) => ids))]
  const canonical = new Set(sources[0].ids)
  const conflictingSources = sources
    .filter(({ ids }) => ids.length !== canonical.size || ids.some((id) => !canonical.has(id)))
    .map(({ source }) => source)
  const duplicateSources = sources
    .filter(({ ids }) => new Set(ids).size !== ids.length)
    .map(({ source }) => source)
  return {
    referenceIds,
    sources,
    conflictingSources,
    duplicateSources,
    consistent: conflictingSources.length === 0 && duplicateSources.length === 0,
  }
}
