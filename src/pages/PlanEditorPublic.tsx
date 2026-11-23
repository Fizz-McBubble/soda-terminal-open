import { claimPlanEditorSaveFromProps } from './planEditorBenchmark32Save'
import { finishPlanEditorSave } from './planEditorSessionRefresh'
import { useF5AccountSummary } from '../components/f5AccountSummaryContext'
import { beginUsageOperation } from '../usageStatistics/client'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlanEditorSaveScope } from './usePlanEditorSaveScope'
import { getActiveAccount } from '../accounts/repository'
import { buildExactTeamVariantKey } from '../accounts/planningSolutionContext'
import {
  CalculationQueryClientContext,
  useAccountDecisionWorld,
  useReleaseAccountDecisionRun,
} from '../application/accountDecisionWorldHooks'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { contentHash } from '../application/contentHash'
import { playerErrorMessage } from '../application/playerErrorMessage'
import {
  acceptSavedTeamSolutionComponents,
  projectedSavedTeamInputHash,
} from '../application/publicSavedTeamSolutionComponents'
import {
  buildSavedTeamPlanSolutionFingerprintFromComponents,
  localPrivateNonPlanningComponents,
} from '../application/publicSavedTeamSolutionFingerprint'
import { targetTeamEquipmentParametersFingerprint } from '../application/publicTargetTeamEquipmentFingerprint'
import { acceptTeamExecutionPresentation } from './teamLoadoutPresentationDto'
import { TeamDecisionAuthorityDetail } from './TeamDecisionAuthorityDetail'
import { PublicAgentPlanDetails } from './PublicAgentPlanDetails'
import { PublicSavedTeamHistory } from './PublicSavedTeamHistory'
import { PublicTeamExecutionPanel } from './PublicTeamExecutionPanel'
import { SavedPlanExecutionRefreshStatus } from './SavedPlanExecutionRefreshStatus'
import { withTeamExecutionSubstituteActions } from './teamExecutionWorkspaceSubstitutes'
import { decisionTeamWarehousePlan } from './planningDraftProjection'
import { savedTeamRatedPlayId } from '../accounts/savedTeamRatingPlayIdentity'
import { useTeamSaveConfirmation } from './useTeamSaveConfirmation'
import {
  projectPlanEditorCandidateWarehouse,
  projectPlanEditorTeamFitForSave,
} from './planEditorSaveProjection'
import { assertCurrentPlanEditorReservation, usePlanEditorDraft } from './planEditorSharedState'
import * as EditorPage from './planEditorSharedPage'
import { persistPlanEditorDraft } from './planEditorDraftPersistence'
import type { PlanEditorProps } from './PlanEditorProps'

/** The public page consumes calculation results but does not instantiate a local solver. */
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
    onDeploymentOrderChange,
    equipmentParametersRequireRefresh = false,
    restoredExecutionIsFresh = false,
    restoredTargetFitState,
  } = props
  const decisionWorld = useAccountDecisionWorld()
  const accountSummary = useF5AccountSummary()
  const { scopeIdentity, captureSaveScope } = usePlanEditorSaveScope(
    props,
    accountSummary?.appSessionId,
  )
  const calculationClient = useContext(CalculationQueryClientContext)
  const releaseRun = useReleaseAccountDecisionRun()
  const navigate = useNavigate()
  const heading = useRef<HTMLHeadingElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const saving = useRef(false)
  const [savePending, setSavePending] = useState(false)
  const latestWorld = useRef({ input: decisionWorld.liveInput, run: decisionWorld.run })
  useEffect(() => {
    latestWorld.current = { input: decisionWorld.liveInput, run: decisionWorld.run }
  }, [decisionWorld.liveInput, decisionWorld.run])
  const { draft, setDraft, saved, setSaved, dirty, setDirty, discard, commit } =
    usePlanEditorDraft(props)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [message, setMessage] = useState('')
  const teamSaveConfirmation = useTeamSaveConfirmation()
  const reanalyze = props.onReanalyze ?? (() => navigate('/loadouts/team?reanalyze=1'))
  const generated = kind !== 'team' || Boolean(restored) || Boolean(analysisRunId)
  const teamMemberKey = team?.agentIds.join(':')
  const duplicateMemberId =
    kind === 'team'
      ? draft.selection.agentIds.find(
          (agentId, index, all) => all.findIndex((item) => item === agentId) !== index,
        )
      : undefined
  const candidatePlan = useMemo(() => {
    if (kind === 'team') return targetTeamFit?.warehousePlan
    if (!decision || !profiles[0]) return undefined
    return decisionTeamWarehousePlan(decision, [profiles[0].agentId])
  }, [decision, kind, profiles, targetTeamFit])
  const historicalExecution = Boolean(
    kind === 'team' &&
    restored?.teamExecutionSnapshot &&
    !targetTeamFit &&
    !restoredExecutionIsFresh,
  )
  const executionReadOnly = readOnly || !team || historicalExecution || Boolean(restored)
  const teamSubstitutes =
    kind === 'team' && team && !historicalExecution
      ? withTeamExecutionSubstituteActions(team, alternativeTeams, onSelectAlternative)
      : undefined
  const savedPlanState = restored
    ? equipmentParametersRequireRefresh
      ? 'refreshing'
      : props.staleNotice
        ? 'stale'
        : 'saved'
    : undefined
  const presentationRunId = analysisRunId ?? decisionWorld.run?.runId
  const presentationInputFingerprint =
    decision?.fingerprint.inputHash ?? decisionWorld.run?.snapshot.fingerprint.inputHash
  const acceptedExecution =
    targetTeamFit?.teamExecutionPresentation && presentationRunId && presentationInputFingerprint
      ? acceptTeamExecutionPresentation(targetTeamFit.teamExecutionPresentation, {
          runId: presentationRunId,
          accountId: warehouse.accountId ?? '',
          inputFingerprint: presentationInputFingerprint,
          candidateId: targetTeamFit.candidateId,
          memberIds: targetTeamFit.memberIds,
        })
      : null

  useEffect(() => {
    document.querySelector<HTMLElement>('[data-f5-scroll-owner]')?.scrollTo?.({ top: 0, left: 0 })
    const timer = window.setTimeout(() => heading.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [kind, teamMemberKey])

  const update = (key: keyof typeof draft.manualOverrides, value: string) => {
    setDraft((previous) => ({
      ...previous,
      manualOverrides: { ...previous.manualOverrides, [key]: value },
    }))
    setSaved(false)
    setDirty(true)
  }

  const save = async () => {
    if (!claimPlanEditorSaveFromProps(props, saving, duplicateMemberId, setMessage)) return false
    setSavePending(true)
    const isCurrentSave = captureSaveScope()
    const originatingPathname = window.location.pathname
    const originatingSearch = window.location.search
    let finishUsage: ReturnType<typeof beginUsageOperation> | undefined
    try {
      const remainingSession = assertCurrentPlanEditorReservation(
        kind,
        decisionWorld.liveInput,
        decisionWorld.liveFingerprint,
        targetTeamFit,
      )
      const candidateWarehouse = projectPlanEditorCandidateWarehouse(candidatePlan)
      const effectiveTeamParameters =
        kind === 'team' && targetTeamFit ? targetTeamFit.effectiveEquipmentParameters : undefined
      if (
        kind === 'team' &&
        (!team ||
          !targetTeamFit ||
          !acceptedExecution ||
          (!effectiveTeamParameters && !targetTeamFit.accountFactBinding))
      )
        throw new Error('当前方案展示或装备参数未就绪，请重新匹配后再保存。')
      const approved =
        kind === 'team'
          ? await teamSaveConfirmation.request(
              warehouse.accountId!,
              team!.agentIds,
              draft.id,
              (import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true'
                ? props.ratedTeamPlayId
                : undefined) ?? savedTeamRatedPlayId(draft),
            )
          : undefined
      if (approved === null) return false
      finishUsage = beginUsageOperation('plan_save')
      const nextPlanId =
        approved?.id ?? (kind === 'agent' ? draft.id : undefined) ?? `plan-${crypto.randomUUID()}`
      const selectedBangbooId =
        kind === 'team' && effectiveTeamParameters
          ? effectiveTeamParameters.bangbooId
          : draft.selection.bangbooId
      const exactVariantKey = team
        ? buildExactTeamVariantKey({
            memberIds: team.agentIds,
            bangbooId: selectedBangbooId,
            scenario: team.scenario ?? '',
          })
        : undefined
      let inputFingerprint = ''
      let capturedInputFingerprint: string | undefined
      if (
        kind === 'team' &&
        targetTeamFit &&
        (effectiveTeamParameters || targetTeamFit.accountFactBinding)
      ) {
        const input = decisionWorld.liveInput
        const run = decisionWorld.run
        if (!calculationClient || !input || !run || decisionWorld.status !== 'current')
          throw new Error('当前账户资料尚未就绪，请重新读取后保存。')
        const localInputHash = contentHash(input)
        const result = await calculationClient.querySavedTeamSolutionComponents({
          contractVersion: calculationQueryContractVersion,
          kind: 'saved_team_solution_components',
          runId: run.runId,
          currentInput: input,
        })
        const accepted = acceptSavedTeamSolutionComponents(result, {
          runId: run.runId,
          accountId: warehouse.accountId!,
          capturedInputFingerprint: run.snapshot.fingerprint.inputHash,
          projectedInputHash: projectedSavedTeamInputHash(input),
        })
        if (!accepted) throw new Error('方案版本校验未通过，请重新分析后保存。')
        if (
          latestWorld.current.run?.runId !== run.runId ||
          !latestWorld.current.input ||
          contentHash(latestWorld.current.input) !== localInputHash
        )
          throw new Error('保存期间账户资料发生变化，请重新分析后保存。')
        capturedInputFingerprint = run.inputFingerprint
        inputFingerprint = buildSavedTeamPlanSolutionFingerprintFromComponents({
          decisionInput: input,
          planId: nextPlanId,
          buildIntentFingerprint: contentHash([
            targetTeamFit.buildIntent.fingerprint,
            exactVariantKey,
            effectiveTeamParameters
              ? targetTeamEquipmentParametersFingerprint(effectiveTeamParameters)
              : targetTeamFit.accountFactBinding!.fingerprint,
          ]),
          nonPlanningComponents: localPrivateNonPlanningComponents(
            accepted.nonPlanningComponents,
            input,
          ),
        })
      }
      const teamExecutionSnapshot =
        kind === 'team' && targetTeamFit
          ? targetTeamFit.targetExecution
          : draft.teamExecutionSnapshot
      const next = await persistPlanEditorDraft({
        accountId: warehouse.accountId!,
        draft,
        nextPlanId,
        approved,
        team,
        selectedBangbooId,
        candidateWarehouse,
        teamExecutionSnapshot,
        teamEquipmentParameters: effectiveTeamParameters ?? undefined,
        targetTeamFit: projectPlanEditorTeamFitForSave({
          fit: targetTeamFit,
          deploymentOrder: teamExecutionSnapshot?.deploymentOrder,
          equipment: effectiveTeamParameters ?? undefined,
          capturedInputFingerprint,
        }),
        inputFingerprint,
        capturedInputFingerprint,
        exactVariantKey,
        ratedTeamPlayId:
          import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true' ? props.ratedTeamPlayId : undefined,
        profiles: profiles,
        remainingSession,
      })
      finishUsage('success')
      const activeAccount = await getActiveAccount().catch(() => null)
      const committed = commit(draft, next)
      if (
        !activeAccount &&
        isCurrentSave() &&
        window.location.pathname === originatingPathname &&
        window.location.search === originatingSearch
      )
        setMessage('方案已保存，当前账户暂时无法确认。')
      if (
        !isCurrentSave() ||
        activeAccount?.id !== warehouse.accountId ||
        window.location.pathname !== originatingPathname ||
        window.location.search !== originatingSearch
      )
        return false
      if (!committed) {
        setMessage('已保存提交时的方案，后续修改仍未保存。')
        return false
      }
      return finishPlanEditorSave({
        kind,
        team,
        decisionWorld,
        releaseRun,
        navigate,
        setMessage,
        savedName: next.name,
        savedPlan: { id: next.id, accountId: next.accountId },
        isCurrentSave,
        appSessionId: accountSummary?.appSessionId,
      })
    } catch (error) {
      finishUsage?.('failure')
      if (isCurrentSave()) setMessage(playerErrorMessage(error, '保存失败，原方案未改变。'))
      return false
    } finally {
      saving.current = false
      setSavePending(false)
    }
  }

  return (
    <section className="optimizer-flow optimizer-plan">
      {teamSaveConfirmation.dialog}
      {kind === 'team' ? (
        team ? (
          <EditorPage.PlanEditorSharedTeamHeader
            props={{ ...props, team }}
            state={{
              backButtonRef: backButton,
              executionPresentation: acceptedExecution?.view ?? null,
              headingRef: heading,
              onBack: () => (dirty ? setConfirmLeave(true) : navigate(back)),
              onReanalyze: reanalyze,
              onSave: save,
              readOnly: readOnly || equipmentParametersRequireRefresh || !acceptedExecution,
              savedPlanState,
            }}
          />
        ) : (
          <EditorPage.PlanEditorSharedSavedTeamHeader
            props={props}
            backButton={backButton}
            heading={heading}
            navigate={navigate}
            name={draft.name}
          />
        )
      ) : (
        <EditorPage.PlanEditorRoleHeader
          backButton={backButton}
          heading={heading}
          onBack={() => (dirty ? setConfirmLeave(true) : navigate(back))}
        />
      )}
      <EditorPage.PlanEditorTransitionNotice
        notice={props.transitionNotice}
        onCancel={props.onCancelTransition}
        cancelLabel={props.cancelTransitionLabel}
      />
      {kind === 'team' &&
      restored &&
      !targetTeamFit &&
      restoredTargetFitState &&
      restoredTargetFitState !== 'ready' ? (
        <SavedPlanExecutionRefreshStatus
          state={restoredTargetFitState}
          onRetry={props.onRetryRestoredTargetFit}
        />
      ) : null}
      {kind === 'team' && acceptedExecution ? (
        <PublicTeamExecutionPanel
          key={restored?.id ?? props.ratedTeamPlayId ?? team?.agentIds.join(':')}
          view={acceptedExecution.view}
          attributePanelsByAgent={acceptedExecution.attributePanelsByAgent}
          alternate={teamSubstitutes}
          warehouse={warehouse}
          targetTeamFit={historicalExecution ? undefined : targetTeamFit}
          onConfirmEquipmentParameters={
            executionReadOnly ? undefined : props.onConfirmEquipmentParameters
          }
          onDeploymentOrderChange={executionReadOnly ? undefined : onDeploymentOrderChange}
          readOnly={executionReadOnly}
          evidence={
            decision && team ? (
              <TeamDecisionAuthorityDetail
                decision={decision}
                memberIds={team.agentIds}
                targetTeamFit={targetTeamFit}
              />
            ) : undefined
          }
        />
      ) : null}
      {kind === 'team' && !acceptedExecution && restored ? (
        <PublicSavedTeamHistory plan={restored} warehouse={warehouse} />
      ) : null}
      {kind === 'team' && !acceptedExecution && !restored ? (
        <section className="panel status-card" role="status">
          <p>本次配装展示尚未就绪，请重新匹配后查看和保存。</p>
          <button className="button button--secondary" type="button" onClick={reanalyze}>
            重新匹配
          </button>
        </section>
      ) : null}
      {kind === 'team' && alternativeTeams.length && onSelectAlternative ? (
        <section className="panel" aria-label="其他队伍方案">
          <h2>其他搭配</h2>
          <div className="button-row">
            {alternativeTeams
              .filter((candidate) => candidate.id !== team?.id)
              .map((candidate) => (
                <button
                  key={candidate.id}
                  className="button button--secondary"
                  type="button"
                  onClick={() => onSelectAlternative(candidate.id)}
                >
                  {candidate.title}
                </button>
              ))}
          </div>
        </section>
      ) : null}
      <EditorPage.PlanEditorSharedNotices props={props} reanalyze={reanalyze} />
      {kind === 'agent' && profiles[0] ? (
        <PublicAgentPlanDetails
          profile={profiles[0]}
          plan={candidatePlan}
          warehouse={warehouse}
          draft={draft}
          onOverrideChange={update}
          onNameChange={(name) => {
            setDraft((previous) => ({ ...previous, name }))
            setDirty(true)
            setSaved(false)
          }}
        />
      ) : null}
      <EditorPage.PlanEditorSharedFooter
        props={props}
        state={{
          generated,
          saved,
          save,
          saving: savePending,
          savingRef: saving,
          scopeIdentity,
          message,
          confirmLeave,
          setConfirmLeave,
          discard,
          backButton,
          navigate,
        }}
      />
    </section>
  )
}
