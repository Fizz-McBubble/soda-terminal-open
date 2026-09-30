import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import { getAccountPlanningDraft } from '../../accounts/planningDrafts'
import {
  CalculationQueryClientContext,
  useAccountDecisionWorld,
  useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import type { AccountDecisionSnapshot } from '../../application/calculationQueryContract'
import { savedPlanDisplayName } from '../../application/savedPlanDisplayName'
import { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { InvalidPlan } from '../InvalidPlan'
import { PlanEditor } from '../PlanEditor'
import { PlanningProfileContext } from '../planningProfile'
import { SavedPortfolioPlan } from '../savedPlanPresentation'
import { SavedPlanDeleteDialog } from './SavedPlanDeleteDialog'
import { useSavedPlanReplay } from './useSavedPlanReplay'

export function SavedPlan({
  warehouse,
  decision,
  readOnly = false,
}: {
  warehouse: CoreWarehouse
  decision?: AccountDecisionSnapshot
  readOnly?: boolean
}) {
  const decisionWorld = useAccountDecisionWorld()
  const calculationClient = useContext(CalculationQueryClientContext)
  const accountSummary = useF5AccountSummary()
  const calculateTargetTeamWarehouseFit = useTargetTeamWarehouseFitCalculation()
  const { planId = '' } = useParams()
  const resolveProfile = useContext(PlanningProfileContext)
  const plan = useLiveQuery(
    () =>
      warehouse.accountId
        ? getAccountPlanningDraft(warehouse.accountId, planId).then((item) => item ?? null)
        : Promise.resolve(null),
    [warehouse.accountId, planId],
  )
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  const {
    componentsIdentity,
    savedComponents,
    replayIdentity,
    savedReplay,
    restoredTeam,
    restoredPlanStale,
    staleNotice,
    restoredTeamRatingLabel,
    savedTargetCandidateId,
    restoredTargetTeamFit,
    restoredTargetFitState,
    setRestoredTargetFitRetry,
  } = useSavedPlanReplay({
    plan,
    warehouse,
    decision,
    decisionWorld,
    calculationClient,
    calculateTargetTeamWarehouseFit,
  })

  if (deleting)
    return (
      <section className="panel result-empty" role="status">
        正在更新队伍方案…
      </section>
    )
  if (plan === undefined)
    return (
      <section className="panel result-empty" aria-live="polite">
        <h1>正在读取已保存方案</h1>
      </section>
    )
  if (!plan) return <InvalidPlan back="/loadouts/team" label="方案" />
  if (
    plan.kind === 'team' &&
    componentsIdentity &&
    calculationClient &&
    savedComponents?.identity !== componentsIdentity
  )
    return (
      <section className="panel result-empty" role="status">
        <h1>正在核对已保存方案</h1>
      </section>
    )
  if (
    plan.kind === 'team' &&
    replayIdentity &&
    calculationClient &&
    savedReplay?.identity !== replayIdentity
  )
    return (
      <section className="panel result-empty" role="status">
        <h1>正在读取已保存配装</h1>
      </section>
    )
  if (plan.kind === 'team' && !plan.teamExecutionSnapshot && restoredTargetFitState === 'loading')
    return (
      <section className="panel result-empty" role="status">
        <h1>正在读取已保存配装</h1>
      </section>
    )
  if (plan.teamPortfolioSnapshot)
    return (
      <SavedPortfolioPlan
        warehouse={warehouse}
        plan={plan}
        readOnly={readOnly || restoredPlanStale}
      />
    )
  const profiles = plan.selection.agentIds.map(resolveProfile)
  return (
    <>
      <PlanEditor
        key={`${warehouse.accountId}:saved:${plan.id}`}
        warehouse={warehouse}
        kind={plan.kind}
        profiles={profiles}
        team={restoredTeam ?? undefined}
        teamRatingLabel={restoredTeamRatingLabel ?? undefined}
        back={`/loadouts/${plan.kind}`}
        restored={{ ...plan, name: savedPlanDisplayName(plan) }}
        deleteAction={
          <button
            ref={deleteButton}
            type="button"
            className="button button--danger"
            onClick={() => setConfirmDelete(true)}
          >
            删除此方案
          </button>
        }
        decision={decision}
        targetTeamFit={restoredTargetTeamFit}
        readOnly={readOnly || restoredPlanStale}
        restoredExecutionIsFresh={Boolean(savedTargetCandidateId)}
        restoredTargetFitState={restoredTargetFitState}
        onRetryRestoredTargetFit={() => setRestoredTargetFitRetry((current) => current + 1)}
        staleNotice={staleNotice}
        onReanalyze={() =>
          navigate(`/loadouts/team?reanalyze=1&rematchPlan=${encodeURIComponent(plan.id)}`)
        }
      />
      {confirmDelete ? (
        <SavedPlanDeleteDialog
          plan={plan}
          warehouse={warehouse}
          accountSummary={accountSummary}
          decisionWorld={decisionWorld}
          onClose={closeDeleteDialog}
          onDeletingChange={setDeleting}
        />
      ) : null}
    </>
  )
}
