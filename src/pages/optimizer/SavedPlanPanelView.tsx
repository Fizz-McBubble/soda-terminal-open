import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import { inspectSavedTeamPanelWarehouse } from '../../accounts/savedTeamPanelWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import {
  currentTeamCultivation,
  formedCultivationGaps,
} from '../../application/formedCultivationGaps'
import { savedPlanDisplayName } from '../../application/savedPlanDisplayName'
import { FormedTeamReference } from '../FormedTeamReference'
import { PlanEditorSavedTeamHeader } from '../PlanEditorSavedTeamHeader'
import { PlanEditorSavedStateNotices } from '../PlanEditorSavedStateNotices'
import { currentSavedTeamRatingLabel } from '../savedTeamRatingPresentation'
import { StandardTeamReferenceControl32 } from '../StandardTeamReferenceControl32'
import { TeamExecutionPanel } from '../TeamExecutionPanel'
import { useSavedPlanDeletion } from './useSavedPlanDeletion'

/** Reopen the saved allocation using the same three-member UI without loading solver/editing code. */
export function SavedPlanPanelView({
  plan,
  warehouse,
  onReview,
}: {
  plan: AccountPlanningDraft
  warehouse: CoreWarehouse
  onReview: () => void
}) {
  const navigate = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const { deleteAction, dialog } = useSavedPlanDeletion(warehouse, plan)
  const panelStatus = inspectSavedTeamPanelWarehouse(plan, warehouse)
  const savedFormedTeamReference = plan.solutionContext?.formedTeamReference
  const currentCultivation = savedFormedTeamReference
    ? currentTeamCultivation(plan.selection.agentIds, warehouse.roster)
    : undefined
  const cultivationGaps = savedFormedTeamReference
    ? formedCultivationGaps(savedFormedTeamReference, warehouse.roster)
    : undefined
  useEffect(() => {
    heading.current?.focus()
  }, [plan.scopedId])
  return (
    <section className="optimizer-flow optimizer-plan">
      <PlanEditorSavedTeamHeader
        heading={heading}
        backButton={backButton}
        navigate={navigate}
        back="/loadouts/team"
        name={savedPlanDisplayName(plan)}
        teamRatingLabel={currentSavedTeamRatingLabel({ plan }) ?? undefined}
        deleteAction={deleteAction}
        onReviewSavedRating={onReview}
        standardReferenceControl={
          plan.solutionContext?.standardReference32 && (
            <StandardTeamReferenceControl32
              disabled={false}
              savedReference={plan.solutionContext.standardReference32}
              savedRequest={plan.solutionContext.standardReferenceRequest32}
            />
          )
        }
      />
      <TeamExecutionPanel
        execution={plan.teamExecutionSnapshot!}
        warehouse={warehouse}
        savedPotentialByAgentId={plan.teamEquipmentParameters?.potentialByAgentId}
        readOnly
        savedSnapshot
      />
      <FormedTeamReference
        reference={savedFormedTeamReference}
        current={currentCultivation}
        gaps={cultivationGaps}
        saved
      />
      <PlanEditorSavedStateNotices
        formedTeamReference={undefined}
        objectiveNote={plan.candidateWarehouse?.panelObjectiveNote}
        needsTeamRecovery={panelStatus.needsTeamRecovery}
        staleNotice={panelStatus.staleNotice}
        reanalyze={() =>
          navigate(`/loadouts/team?reanalyze=1&rematchPlan=${encodeURIComponent(plan.id)}`)
        }
      />
      {dialog}
    </section>
  )
}
