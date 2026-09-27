import type { AccountPlanningDraft } from '../accounts/types'
import { savedPlanDisplayName } from './savedPlanDisplayName'

/** Player-facing saved plans only. Agent development/recovery references remain
 * in warehouse safety analysis but are not presented as independent plans. */
export function warehousePlanReferences(
  drafts: readonly AccountPlanningDraft[],
  activeIds: readonly string[],
) {
  return drafts.flatMap((draft) =>
    draft.kind === 'team'
      ? [
          {
            id: draft.id,
            name: savedPlanDisplayName(draft),
            state: draft.state,
            active: activeIds.includes(draft.id),
          },
        ]
      : [],
  )
}
