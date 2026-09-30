import type { RefObject } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { PlanEditorFooter } from './PlanEditorFooter'
import { PlanEditorSavedTeamHeader } from './PlanEditorSavedTeamHeader'
import type { PlanEditorProps } from './PlanEditorProps'
import { TeamPlanHeader } from './TeamPlanHeader'
import { usesRemainingBoxReservation } from './planEditorSaveProjection'

type TeamHeaderState = Pick<
  Parameters<typeof TeamPlanHeader>[0],
  | 'executionPresentation'
  | 'headingRef'
  | 'backButtonRef'
  | 'readOnly'
  | 'savedPlanState'
  | 'onBack'
  | 'onReanalyze'
  | 'onSave'
>

export function PlanEditorSharedTeamHeader({
  props,
  state,
}: {
  props: PlanEditorProps & { team: NonNullable<PlanEditorProps['team']> }
  state: TeamHeaderState
}) {
  return (
    <TeamPlanHeader
      {...state}
      team={props.team}
      deleteAction={props.deleteAction}
      teamRatingLabel={props.teamRatingLabel}
      usingRemainingBox={usesRemainingBoxReservation(Boolean(props.restored), props.analysisRunId)}
    />
  )
}

export function PlanEditorSharedSavedTeamHeader({
  props,
  backButton,
  heading,
  navigate,
  name,
}: {
  props: PlanEditorProps
  backButton: RefObject<HTMLButtonElement | null>
  heading: RefObject<HTMLHeadingElement | null>
  navigate: NavigateFunction
  name: string
}) {
  return (
    <PlanEditorSavedTeamHeader
      backButton={backButton}
      heading={heading}
      navigate={navigate}
      back={props.back}
      name={name}
      teamRatingLabel={props.teamRatingLabel}
      deleteAction={props.deleteAction}
    />
  )
}

type FooterState = Pick<
  Parameters<typeof PlanEditorFooter>[0],
  | 'generated'
  | 'saved'
  | 'save'
  | 'message'
  | 'confirmLeave'
  | 'setConfirmLeave'
  | 'backButton'
  | 'navigate'
>

export function PlanEditorSharedFooter({
  props,
  state,
}: {
  props: PlanEditorProps
  state: FooterState
}) {
  return (
    <PlanEditorFooter
      {...state}
      deleteAction={props.kind === 'agent' ? props.deleteAction : undefined}
      kind={props.kind}
      readOnly={props.readOnly ?? false}
      back={props.back}
    />
  )
}
