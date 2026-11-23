import { useContext, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import {
  CalculationQueryClientContext,
  useAccountDecisionWorld,
  useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import type { AccountDecisionSnapshot } from '../../application/calculationQueryContract'
import { savedPlanDisplayName } from '../../application/savedPlanDisplayName'
import { PlanEditor } from '../PlanEditor'
import { PlanningProfileContext } from '../planningProfile'
import { SavedPortfolioPlan } from '../savedPlanPresentation'
import { useSavedPlanDeletion } from './useSavedPlanDeletion'
import { useSavedPlanReplay } from './useSavedPlanReplay'
import { SavedPlanAccountAnalysisStatus } from './SavedPlanAccountAnalysisStatus'

export function SavedPlan({
  warehouse,
  plan,
  pending,
  decision,
  readOnly = false,
}: {
  warehouse: CoreWarehouse
  plan: AccountPlanningDraft
  pending: ReactNode
  decision?: AccountDecisionSnapshot
  readOnly?: boolean
}) {
  const decisionWorld = useAccountDecisionWorld()
  const calculationClient = useContext(CalculationQueryClientContext)
  const calculateTargetTeamWarehouseFit = useTargetTeamWarehouseFitCalculation()
  const resolveProfile = useContext(PlanningProfileContext)
  const navigate = useNavigate()
  const { activeDelete, deleteAction, dialog } = useSavedPlanDeletion(warehouse, plan)

  const {
    componentsIdentity,
    savedComponents,
    replayIdentity,
    savedReplay,
    restoredTeam,
    restoredPlanStale,
    restoredPlanPending,
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

  const content = (() => {
    if (
      !activeDelete &&
      plan.kind === 'team' &&
      decisionWorld.analysisIssue?.kind !== 'run_lost' &&
      componentsIdentity &&
      calculationClient &&
      savedComponents?.identity !== componentsIdentity
    )
      return pending
    if (
      !activeDelete &&
      plan.kind === 'team' &&
      decisionWorld.analysisIssue?.kind !== 'run_lost' &&
      replayIdentity &&
      calculationClient &&
      savedReplay?.identity !== replayIdentity
    )
      return pending
    if (
      !activeDelete &&
      plan.kind === 'team' &&
      !plan.teamExecutionSnapshot &&
      restoredTargetFitState === 'loading'
    )
      return pending
    if (plan.teamPortfolioSnapshot)
      return (
        <>
          <SavedPlanAccountAnalysisStatus world={decisionWorld} />
          <SavedPortfolioPlan
            warehouse={warehouse}
            plan={plan}
            readOnly={
              readOnly ||
              restoredPlanStale ||
              restoredPlanPending ||
              decisionWorld.analysisIssue?.kind === 'run_lost'
            }
          />
        </>
      )
    const profiles = plan.selection.agentIds.map(resolveProfile)
    return (
      <>
        {plan.kind === 'team' ? <SavedPlanAccountAnalysisStatus world={decisionWorld} /> : null}
        <PlanEditor
          key={`${warehouse.accountId}:saved:${plan.id}`}
          warehouse={warehouse}
          kind={plan.kind}
          profiles={profiles}
          team={restoredTeam ?? undefined}
          teamRatingLabel={restoredTeamRatingLabel ?? undefined}
          back={`/loadouts/${plan.kind}`}
          restored={{ ...plan, name: savedPlanDisplayName(plan) }}
          deleteAction={deleteAction}
          decision={decision}
          targetTeamFit={restoredTargetTeamFit}
          readOnly={
            readOnly ||
            restoredPlanStale ||
            restoredPlanPending ||
            (plan.kind === 'team' && decisionWorld.analysisIssue?.kind === 'run_lost')
          }
          restoredExecutionIsFresh={
            Boolean(savedTargetCandidateId) && !restoredPlanStale && !restoredPlanPending
          }
          restoredTargetFitState={restoredTargetFitState}
          onRetryRestoredTargetFit={() => setRestoredTargetFitRetry((current) => current + 1)}
          staleNotice={staleNotice}
          luminizeSettlement32={
            savedReplay?.identity === replayIdentity
              ? savedReplay?.presentation?.luminizeSettlement32
              : undefined
          }
          onReanalyze={() =>
            navigate(`/loadouts/team?reanalyze=1&rematchPlan=${encodeURIComponent(plan.id)}`)
          }
        />
      </>
    )
  })()
  return (
    <>
      {content}
      {dialog}
    </>
  )
}
