import type { PlanEditorProps } from './PlanEditorProps'
import { claimPlanEditorSave } from './planEditorSharedState'

/** Both editor compositions share the same save claim and player-facing guards. */
export function claimPlanEditorSaveFromProps(
  props: PlanEditorProps,
  saving: Parameters<typeof claimPlanEditorSave>[0],
  duplicateMemberId: string | undefined,
  setMessage: Parameters<typeof claimPlanEditorSave>[2],
) {
  return claimPlanEditorSave(
    saving,
    {
      equipmentParametersRequireRefresh: props.equipmentParametersRequireRefresh ?? false,
      readOnly: props.readOnly ?? false,
      staleNotice: props.staleNotice,
      accountId: props.warehouse.accountId!,
      duplicateMemberId,
    },
    setMessage,
  )
}
