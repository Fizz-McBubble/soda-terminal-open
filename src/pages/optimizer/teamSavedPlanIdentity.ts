import type { AccountPlanningDraft } from '../../accounts/types'
import { contentHash } from '../../application/contentHash'

/**
 * Returns saved plans whose current content exactly matches a captured draft
 * from the current decision run. Hash each distinct object once per caller
 * memoization boundary instead of once per rendered saved-team item.
 */
export function matchingCapturedSavedPlanIds(
  savedPlans: readonly AccountPlanningDraft[],
  capturedDrafts: readonly AccountPlanningDraft[],
) {
  const capturesById = new Map<string, AccountPlanningDraft[]>()
  for (const draft of capturedDrafts) {
    const rows = capturesById.get(draft.id)
    if (rows) rows.push(draft)
    else capturesById.set(draft.id, [draft])
  }

  const matched = new Set<string>()
  for (const plan of savedPlans) {
    const captures = capturesById.get(plan.id)
    if (!captures?.length) continue
    const expected = contentHash(plan)
    if (captures.some((captured) => contentHash(captured) === expected)) matched.add(plan.id)
  }
  return matched
}
