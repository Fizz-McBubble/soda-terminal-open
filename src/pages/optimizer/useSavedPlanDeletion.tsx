import { LazySavedPlanDeleteDialog } from './LazySavedPlanDeleteDialog'
import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import { useAccountDecisionWorld } from '../../application/accountDecisionWorldHooks'
import { useF5AccountSummary } from '../../components/f5AccountSummaryContext'

export function useSavedPlanDeletion(warehouse: CoreWarehouse, plan: AccountPlanningDraft) {
  const decisionWorld = useAccountDecisionWorld()
  const accountSummary = useF5AccountSummary()
  const planId = plan.id
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePlan, setDeletePlan] = useState<{
    accountId: string
    planId: string
    plan: AccountPlanningDraft
  } | null>(null)
  const currentIdentity = useRef<{ accountId: CoreWarehouse['accountId']; planId: string } | null>(
    null,
  )
  useLayoutEffect(() => {
    currentIdentity.current = { accountId: warehouse.accountId, planId }
    return () => {
      currentIdentity.current = null
    }
  }, [warehouse.accountId, planId])
  const activeDelete =
    confirmDelete && deletePlan?.accountId === warehouse.accountId && deletePlan.planId === planId
      ? deletePlan
      : null
  const deleteButton = useRef<HTMLButtonElement>(null)
  const restoreDeleteFocus = useRef(false)
  useLayoutEffect(() => {
    if (!confirmDelete && restoreDeleteFocus.current) {
      deleteButton.current?.focus()
      restoreDeleteFocus.current = false
    }
  }, [confirmDelete])
  const closeDeleteDialog = () => {
    restoreDeleteFocus.current = true
    setConfirmDelete(false)
  }

  const deleteAction = (
    <button
      ref={deleteButton}
      type="button"
      className="button button--danger"
      onClick={() => {
        if (!warehouse.accountId) return
        setDeletePlan({ accountId: warehouse.accountId, planId, plan })
        setConfirmDelete(true)
      }}
    >
      删除此方案
    </button>
  )
  const dialog = activeDelete ? (
    <Suspense fallback={null}>
      <LazySavedPlanDeleteDialog
        plan={activeDelete.plan}
        warehouse={warehouse}
        accountSummary={accountSummary}
        decisionWorld={decisionWorld}
        onClose={closeDeleteDialog}
        isCurrent={() =>
          currentIdentity.current?.accountId === activeDelete.accountId &&
          currentIdentity.current?.planId === activeDelete.planId
        }
      />
    </Suspense>
  ) : null
  return { activeDelete, deleteAction, dialog }
}
