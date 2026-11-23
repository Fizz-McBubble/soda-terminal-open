import { PlanEditorSavedStateNotices } from './PlanEditorSavedStateNotices'
import type { RefObject } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { PlanEditorFooter } from './PlanEditorFooter'
import { PlanEditorSavedTeamHeader } from './PlanEditorSavedTeamHeader'
import type { PlanEditorProps } from './PlanEditorProps'
import { StandardTeamReferenceControl32 } from './StandardTeamReferenceControl32'
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
      comparisonScenarioControl={props.comparisonScenarioControl}
      standardReferenceControl={
        props.restored?.solutionContext?.standardReference32 ? (
          <StandardTeamReferenceControl32
            disabled={false}
            savedReference={props.restored.solutionContext.standardReference32}
            savedRequest={props.restored.solutionContext.standardReferenceRequest32}
          />
        ) : undefined
      }
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
      standardReferenceControl={
        props.restored?.solutionContext?.standardReference32 ? (
          <StandardTeamReferenceControl32
            disabled={false}
            savedReference={props.restored.solutionContext.standardReference32}
            savedRequest={props.restored.solutionContext.standardReferenceRequest32}
          />
        ) : undefined
      }
    />
  )
}

type FooterState = Pick<
  Parameters<typeof PlanEditorFooter>[0],
  | 'generated'
  | 'saved'
  | 'save'
  | 'saving'
  | 'savingRef'
  | 'scopeIdentity'
  | 'message'
  | 'confirmLeave'
  | 'setConfirmLeave'
  | 'discard'
  | 'backButton'
  | 'navigate'
>

export function PlanEditorRoleHeader({
  backButton,
  heading,
  onBack,
  inlineMinHeight,
}: {
  backButton: RefObject<HTMLButtonElement | null>
  heading: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  inlineMinHeight?: boolean
}) {
  return (
    <>
      <button
        ref={backButton}
        className="link-button optimizer-plan__back-link"
        type="button"
        style={
          inlineMinHeight
            ? { alignItems: 'center', display: 'inline-flex', minHeight: 24 }
            : undefined
        }
        onClick={onBack}
      >
        返回选择角色
      </button>
      <h1 ref={heading} tabIndex={-1}>
        角色方案
      </h1>
    </>
  )
}

export function PlanEditorTransitionNotice({
  notice,
  onCancel,
  cancelLabel,
}: {
  notice?: string | null
  onCancel?: () => void
  cancelLabel?: string
}) {
  if (!notice) return null
  return (
    <div className="optimizer-plan__transition-notice" role="status">
      <span>{notice}</span>
      {onCancel ? (
        <button className="button button--quiet" type="button" onClick={onCancel}>
          {cancelLabel ?? '取消'}
        </button>
      ) : null}
    </div>
  )
}

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

export function PlanEditorSharedNotices({
  props,
  reanalyze,
}: {
  props: PlanEditorProps
  reanalyze: () => void
}) {
  const {
    targetTeamFit,
    restored,
    luminizeSettlement32,
    kind,
    readOnly = false,
    restoredTargetFitState,
    staleNotice,
  } = props
  return (
    <PlanEditorSavedStateNotices
      formedTeamReference={
        targetTeamFit?.formedTeamReference
          ? undefined
          : restored?.solutionContext?.formedTeamReference
      }
      luminizeSettlement32={luminizeSettlement32}
      objectiveNote={restored?.candidateWarehouse?.panelObjectiveNote}
      needsTeamRecovery={
        kind === 'team' &&
        readOnly &&
        (Boolean(targetTeamFit) || restoredTargetFitState === undefined)
      }
      currentSavedDiscScore={Boolean(restored && targetTeamFit)}
      staleNotice={staleNotice}
      reanalyze={reanalyze}
    />
  )
}
