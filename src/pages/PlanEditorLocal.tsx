import { claimPlanEditorSaveFromProps } from './planEditorBenchmark32Save'
import { PlanEditorSavedStateNotices } from './PlanEditorSavedStateNotices'
import { finishPlanEditorSave } from './planEditorSessionRefresh'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildSavedTeamPlanSolutionFingerprint } from '../accounts/planningSnapshotFreshness'
import { buildExactTeamVariantKey } from '../accounts/planningSolutionContext'
import {
  useAccountDecisionWorld,
  useReleaseAccountDecisionRun,
} from '../application/accountDecisionWorld'
import { contentHash } from '../application/contentHash'
import { TeamExecutionPanel } from './TeamExecutionPanel'
import { TeamDecisionAuthorityDetail } from './TeamDecisionAuthorityDetail'
import { presentTeamExecution } from './teamExecutionPresentation'
import { targetTeamEquipmentParametersFingerprint } from '../application/publicTargetTeamEquipmentFingerprint'
import { SavedTeamHistory } from './SavedTeamHistory'
import { PlanningProfileContext } from './planningProfile'
import { decisionTeamWarehousePlan } from './planningDraftProjection'
import { AgentPlanDetails } from './AgentPlanDetails'
import type { PlanEditorProps } from './PlanEditorProps'
import { useTeamSaveConfirmation } from './useTeamSaveConfirmation'
import { projectPlanEditorCandidateWarehouse } from './planEditorSaveProjection'
import { assertCurrentPlanEditorReservation, usePlanEditorDraft } from './planEditorSharedState'
import {
  PlanEditorSharedFooter,
  PlanEditorSharedSavedTeamHeader,
  PlanEditorSharedTeamHeader,
} from './planEditorSharedPage'
import { persistPlanEditorDraft } from './planEditorDraftPersistence'
import { recommendTeamDeployment } from '../decision/teamDeployment'
import { SavedPlanExecutionRefreshStatus } from './teamExecutionWorkspaceParts'
import { withTeamExecutionSubstituteActions } from './teamExecutionWorkspaceSubstitutes'

export function PlanEditor(props: PlanEditorProps) {
  const {
    warehouse,
    kind,
    profiles,
    team,
    back,
    restored,
    analysisRunId,
    decision,
    targetTeamFit,
    readOnly = false,
    alternativeTeams = [],
    onSelectAlternative,
    transitionNotice,
    onReanalyze,
    onDeploymentOrderChange,
    onConfirmEquipmentParameters,
    staleNotice,
    equipmentParametersRequireRefresh = false,
    restoredExecutionIsFresh = false,
    restoredTargetFitState,
    onRetryRestoredTargetFit,
  } = props
  const decisionWorld = useAccountDecisionWorld()
  const releaseRun = useReleaseAccountDecisionRun()
  const navigate = useNavigate()
  const resolveProfile = useContext(PlanningProfileContext)
  const heading = useRef<HTMLHeadingElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const [draft, setDraft] = usePlanEditorDraft(props)
  const [saved, setSaved] = useState(restored?.state === 'saved')
  const [dirty, setDirty] = useState(false)
  const generated = kind !== 'team' || Boolean(restored) || Boolean(analysisRunId)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [message, setMessage] = useState('')
  const teamSaveConfirmation = useTeamSaveConfirmation()
  const saving = useRef(false)
  const reanalyze = onReanalyze ?? (() => navigate('/loadouts/team?reanalyze=1'))
  const activeProfiles = kind === 'team' ? draft.selection.agentIds.map(resolveProfile) : profiles
  const duplicateMemberId =
    kind === 'team'
      ? draft.selection.agentIds.find(
          (agentId, index, all) => all.findIndex((item) => item === agentId) !== index,
        )
      : undefined
  const profileIds = activeProfiles.map((profile) => profile.agentId).join(':')
  const candidatePlans = useMemo(() => {
    const agentIds = kind === 'team' ? draft.selection.agentIds : [profiles[0]!.agentId]
    if (kind === 'team') return targetTeamFit ? [targetTeamFit.warehousePlan] : []
    if (!decision) return []
    const projected = decisionTeamWarehousePlan(decision, agentIds)
    return [{ ...projected, scope: kind }]
  }, [decision, draft.selection.agentIds, kind, profiles, targetTeamFit])
  const [candidatePlanIndex, setCandidatePlanIndex] = useState(0)
  const activeCandidatePlanIndex = candidatePlans.length
    ? Math.min(candidatePlanIndex, candidatePlans.length - 1)
    : 0
  const selectedCandidatePlan = candidatePlans[activeCandidatePlanIndex]
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-f5-scroll-owner]')?.scrollTo?.({ top: 0, left: 0 })
    const timer = window.setTimeout(() => heading.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [kind, profileIds])
  const candidate = draft.comparisonCapability === 'direction'
  const teamExecution =
    kind === 'team'
      ? (targetTeamFit?.targetExecution ?? restored?.teamExecutionSnapshot ?? team?.execution)
      : undefined
  const historicalExecution = Boolean(
    kind === 'team' &&
    restored?.teamExecutionSnapshot &&
    !targetTeamFit &&
    !restoredExecutionIsFresh,
  )
  const executionReadOnly = readOnly || !team || historicalExecution || Boolean(restored)
  const savedPlanState = restored
    ? equipmentParametersRequireRefresh
      ? 'refreshing'
      : staleNotice
        ? 'stale'
        : 'saved'
    : undefined
  const executionPresentation = teamExecution
    ? presentTeamExecution(
        teamExecution,
        warehouse,
        targetTeamFit ? decision?.allocation.global : [],
      )
    : null
  const update = (key: keyof typeof draft.manualOverrides, value: string) => {
    setDraft((previous) => ({
      ...previous,
      manualOverrides: { ...previous.manualOverrides, [key]: value },
    }))
    setSaved(false)
    setDirty(true)
  }
  const teamSubstitutes =
    kind === 'team' && team
      ? withTeamExecutionSubstituteActions(team, alternativeTeams, onSelectAlternative)
      : undefined
  const save = async () => {
    if (!claimPlanEditorSaveFromProps(props, saving, duplicateMemberId, setMessage)) return false
    try {
      const remainingSession = assertCurrentPlanEditorReservation(
        kind,
        decisionWorld.liveInput,
        decisionWorld.liveFingerprint,
        targetTeamFit,
      )
      const candidateWarehouse = projectPlanEditorCandidateWarehouse(selectedCandidatePlan)
      const effectiveTeamParameters =
        kind === 'team' && targetTeamFit ? targetTeamFit.effectiveEquipmentParameters : undefined
      if (kind === 'team' && !effectiveTeamParameters && !targetTeamFit?.accountFactBinding)
        throw new Error('当前方案缺少已验证的装备参数，请重新匹配后再保存。')
      const approved =
        kind === 'team'
          ? await teamSaveConfirmation.request(warehouse.accountId!, team!.agentIds, draft.id)
          : undefined
      if (approved === null) return false
      const nextPlanId =
        approved?.id ?? (kind === 'agent' ? draft.id : undefined) ?? `plan-${crypto.randomUUID()}`
      const selectedBangbooId =
        kind === 'team' && team && effectiveTeamParameters
          ? effectiveTeamParameters.bangbooId
          : draft.selection.bangbooId
      const exactVariantKey = team
        ? buildExactTeamVariantKey({
            memberIds: team.agentIds,
            bangbooId: selectedBangbooId,
            scenario: team.scenario ?? '',
          })
        : undefined
      if (kind === 'team' && targetTeamFit && !decisionWorld.liveInput)
        throw new Error('当前账户资料尚未就绪，请重新读取后保存。')
      const inputFingerprint =
        kind === 'team' && team && targetTeamFit
          ? buildSavedTeamPlanSolutionFingerprint({
              decisionInput: decisionWorld.liveInput!,
              planId: nextPlanId,
              buildIntentFingerprint: contentHash([
                targetTeamFit.buildIntent.fingerprint,
                exactVariantKey,
                effectiveTeamParameters
                  ? targetTeamEquipmentParametersFingerprint(effectiveTeamParameters)
                  : targetTeamFit.accountFactBinding!.fingerprint,
              ]),
            })
          : ''
      const teamExecutionSnapshot =
        kind === 'team' && targetTeamFit
          ? {
              ...targetTeamFit.targetExecution,
              deploymentOrder: recommendTeamDeployment({
                memberIds: targetTeamFit.memberIds,
                customOrder: targetTeamFit.targetExecution.deploymentOrder,
              }).orderedMemberIds,
            }
          : draft.teamExecutionSnapshot
      const next = await persistPlanEditorDraft(
        {
          accountId: warehouse.accountId!,
          draft,
          nextPlanId,
          approved,
          team,
          selectedBangbooId,
          candidateWarehouse,
          teamExecutionSnapshot,
          teamEquipmentParameters: effectiveTeamParameters ?? undefined,
          targetTeamFit,
          inputFingerprint,
          exactVariantKey,
          profiles: activeProfiles,
          remainingSession,
        },
      )
      setDraft(next)
      setSaved(true)
      setDirty(false)
      return finishPlanEditorSave({
        kind,
        team,
        decisionWorld,
        releaseRun,
        navigate,
        setMessage,
        savedName: next.name,
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，原方案未改变。')
      return false
    } finally {
      saving.current = false
    }
  }
  return (
    <section className="optimizer-flow optimizer-plan">
      {teamSaveConfirmation.dialog}
      {kind === 'team' ? (
        team ? (
          <PlanEditorSharedTeamHeader
            props={{ ...props, team }}
            state={{
              backButtonRef: backButton,
              executionPresentation,
              headingRef: heading,
              onBack: () => (dirty ? setConfirmLeave(true) : navigate(back)),
              onReanalyze: reanalyze,
              onSave: save,
              readOnly: readOnly || equipmentParametersRequireRefresh,
              savedPlanState,
            }}
          />
        ) : (
          <PlanEditorSharedSavedTeamHeader
            props={props}
            backButton={backButton}
            heading={heading}
            navigate={navigate}
            name={draft.name}
          />
        )
      ) : (
        <>
          <button
            ref={backButton}
            className="link-button optimizer-plan__back-link"
            type="button"
            style={{ alignItems: 'center', display: 'inline-flex', minHeight: 24 }}
            onClick={() => (dirty ? setConfirmLeave(true) : navigate(back))}
          >
            返回选择角色
          </button>
          <h1 ref={heading} tabIndex={-1}>
            角色方案
          </h1>
        </>
      )}
      {transitionNotice ? (
        <p className="optimizer-plan__transition-notice" role="status">
          {transitionNotice}
        </p>
      ) : null}
      {kind === 'team' && teamExecution ? (
        <>
          {restored &&
          restoredExecutionIsFresh &&
          !targetTeamFit &&
          restoredTargetFitState &&
          restoredTargetFitState !== 'ready' ? (
            <SavedPlanExecutionRefreshStatus
              state={restoredTargetFitState}
              onRetry={onRetryRestoredTargetFit}
            />
          ) : null}
          <TeamExecutionPanel
            execution={teamExecution}
            warehouse={warehouse}
            allocation={targetTeamFit ? decision?.allocation.global : []}
            targetTeamFit={historicalExecution ? undefined : targetTeamFit}
            onConfirmEquipmentParameters={
              executionReadOnly ? undefined : onConfirmEquipmentParameters
            }
            onDeploymentOrderChange={
              executionReadOnly || !onDeploymentOrderChange
                ? undefined
                : (order) => {
                    onDeploymentOrderChange(order)
                    setSaved(false)
                    setDirty(true)
                  }
            }
            readOnly={executionReadOnly}
            evidence={
              decision && team && !historicalExecution ? (
                <TeamDecisionAuthorityDetail
                  decision={decision}
                  memberIds={team.agentIds}
                  targetTeamFit={targetTeamFit}
                />
              ) : undefined
            }
            alternate={!historicalExecution && teamSubstitutes ? teamSubstitutes : undefined}
          />
        </>
      ) : null}
      {kind === 'team' && !teamExecution && restored ? (
        <SavedTeamHistory plan={restored} warehouse={warehouse} />
      ) : null}
      <PlanEditorSavedStateNotices
        objectiveNote={restored?.candidateWarehouse?.panelObjectiveNote}
        needsTeamRecovery={kind === 'team' && !team && readOnly}
        staleNotice={staleNotice}
        reanalyze={reanalyze}
      />
      <AgentPlanDetails
        generated={generated}
        kind={kind}
        activeProfiles={activeProfiles}
        candidatePlans={candidatePlans}
        activeCandidatePlanIndex={activeCandidatePlanIndex}
        setCandidatePlanIndex={setCandidatePlanIndex}
        warehouse={warehouse}
        candidate={candidate}
        draft={draft}
        update={update}
        onNameChange={(name) => {
          setDraft((previous) => ({ ...previous, name }))
          setDirty(true)
          setSaved(false)
        }}
      />
      <PlanEditorSharedFooter
        props={props}
        state={{
          generated,
          saved,
          save,
          message,
          confirmLeave,
          setConfirmLeave,
          backButton,
          navigate,
        }}
      />
    </section>
  )
}
