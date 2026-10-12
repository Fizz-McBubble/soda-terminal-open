import type { AccountPlanningDraft } from './types'

/** Read-only protection projection. A union protects known IDs, never proves a valid six/18-disc plan. */
export function resolvePlanningDiscReferences(
  draft: Pick<
    AccountPlanningDraft,
    'warehouseRefs' | 'candidateWarehouse' | 'teamExecutionSnapshot'
  > &
    Partial<Pick<AccountPlanningDraft, 'teamPortfolioSnapshot' | 'teamPortfolioDiscChoices'>>,
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
    ...(draft.teamPortfolioSnapshot?.executions
      ? [
          {
            source: 'teamPortfolioSnapshot' as const,
            ids: draft.teamPortfolioSnapshot.executions.flatMap((execution) =>
              execution.members.flatMap((member) => member.suggested.discIds),
            ),
          },
        ]
      : []),
    ...(draft.teamPortfolioDiscChoices
      ? [
          {
            source: 'teamPortfolioDiscChoices' as const,
            ids: draft.teamPortfolioDiscChoices.loadouts.flatMap((loadout) =>
              loadout.choices.map((choice) => choice.discId),
            ),
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
