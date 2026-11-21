import { createTeamPlanFitActions } from './teamPlanFitActions'
import { TeamPlanRecoveryStatus } from './TeamPlanRecoveryStatus'
import { setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAgentName } from '../application/publicRosterNames'
import { TeamDecisionAuthorityDetail } from './TeamDecisionAuthorityDetail'
import { InvalidPlan } from './InvalidPlan'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'
import { TeamLocalAnalysisEvidence } from './TeamLocalAnalysisEvidence'
import {
  CalculationQueryClientContext,
  useTargetTeamWarehouseFitCalculation,
} from '../application/accountDecisionWorldHooks'
import { PlanningProfileContext } from './planningProfile'
import { currentTeamAnalysisSession } from './teamAnalysisSession'
import { PlanEditor } from './PlanEditor'
import { isTeamDeploymentOrder } from '../application/publicTeamDeploymentOrder'
import { useTeamRoutePresentation } from './useTeamRoutePresentation'
import { useTeamAlternativeSelection } from './useTeamAlternativeSelection'
import { useTeamTargetFitRecovery } from './useTeamTargetFitRecovery'
import { PlanEditorTransitionNotice } from './planEditorSharedPage'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { useTeamRematch } from './useTeamRematch'
import { usePageOperationScope } from '../components/usePageOperationScope'
import { beginUsageOperation } from '../usageStatistics/client'
import { planningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import type { TeamPlanProps } from './teamPlanProps'
import { teamRatingLabelTitle } from './teamRatingPresentation'
import { standardReferenceContinuation32 } from './standardReferenceContinuation32'

export function TeamPlan({
  warehouse,
  decision,
  analysisRunId,
  targetTeamFits,
  readOnly = false,
}: TeamPlanProps) {
  const { teamKey = '' } = useParams()
  const navigate = useNavigate()
  const resolveProfile = useContext(PlanningProfileContext)
  const calculationClient = useContext(CalculationQueryClientContext)
  const explicitFitPending = useRef(false)
  const calculateTargetTeamWarehouseFit = useTargetTeamWarehouseFitCalculation()
  const { retainedSession, route, routeStatus } = useTeamRoutePresentation({
    analysisRunId,
    warehouse,
    decision,
    teamKey,
    calculationClient,
  })
  const team = route?.team ?? null
  const sessionMatchesRun =
    retainedSession?.analysisRunId === analysisRunId &&
    retainedSession?.decisionSnapshot.fingerprint.inputHash === decision?.fingerprint.inputHash
  const retainedTargetTeamFit = team
    ? ((sessionMatchesRun ? retainedSession?.targetTeamFits?.[team.id] : undefined) ??
      targetTeamFits?.[team.id])
    : undefined
  const [targetFitState, setTargetFitState] = useState({
    runId: analysisRunId,
    fit: retainedTargetTeamFit,
  })
  const setTargetTeamFit = (result: TargetTeamWarehouseFitQueryResult, keepDeployment = true) => {
    const previous =
      targetFitState.runId === analysisRunId &&
      targetFitState.fit?.candidateId === result.candidateId
        ? targetFitState.fit
        : retainedTargetTeamFit
    const order = keepDeployment
      ? previous?.targetExecution.deploymentOrder
      : result.targetExecution.deploymentOrder
    const fit = isTeamDeploymentOrder(order, result.memberIds)
      ? {
          ...result,
          targetExecution: {
            ...result.targetExecution,
            deploymentOrder: [...order] as [string, string, string],
          },
        }
      : result
    if (
      team &&
      currentTeamAnalysisSession &&
      currentTeamAnalysisSession?.result.analysisRunId === analysisRunId &&
      currentTeamAnalysisSession.result.decisionSnapshot.fingerprint.inputHash ===
        decision?.fingerprint.inputHash
    ) {
      setCurrentTeamAnalysisSession({
        ...currentTeamAnalysisSession,
        result: {
          ...currentTeamAnalysisSession.result,
          targetTeamFits: { ...currentTeamAnalysisSession.result.targetTeamFits, [team.id]: fit },
        },
      })
    }
    setTargetFitState({ runId: analysisRunId, fit })
  }
  const targetTeamFit = targetFitState.runId === analysisRunId ? targetFitState.fit : undefined
  const [fitStatus, setFitStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [recoveryAttempt, setRecoveryAttempt] = useState(0)
  const [switchingAlternativeId, setSwitchingAlternativeId] = useState<string | null>(null)
  const [alternativeError, setAlternativeError] = useState<string | null>(null)
  const [equipmentParametersRequireRefresh, setEquipmentParametersRequireRefresh] = useState(false)
  const targetFitRequestGeneration = useRef(0)
  const alternativeAbortRef = useRef<AbortController | null>(null)
  const activeTargetFitRouteIdentity = useRef('')
  const ratingAnalysis = route?.ratingAnalysis ?? null
  const recommendationScore = route?.recommendationScore ?? undefined
  const teamRatingLabel = route?.teamRatingLabel ?? ''
  const targetCandidateId = route?.targetCandidateId ?? null
  const targetFitRouteIdentity = `${analysisRunId ?? ''}:${team?.id ?? ''}:${targetCandidateId ?? ''}`
  const capturePageScope = usePageOperationScope(
    JSON.stringify([
      warehouse.accountId,
      teamKey,
      analysisRunId,
      decision?.fingerprint.inputHash,
      readOnly,
    ]),
  )
  const automaticBangboo = route?.automaticBangboo ?? null
  const playerConfirmableBangbooOptions = route?.playerConfirmableBangbooOptions ?? []
  // TeamPlan stays mounted while the route selects a same-core alternative. A fit is
  // an exact Candidate result, never a reusable family-level presentation object.
  // Hide an old fit immediately, before the route effect can schedule the new query.
  const currentTargetTeamFit =
    targetTeamFit?.candidateId === targetCandidateId
      ? targetTeamFit
      : retainedTargetTeamFit?.candidateId === targetCandidateId
        ? retainedTargetTeamFit
        : undefined
  const scenarioSelection =
    currentTargetTeamFit?.scenarioSelection ?? planningScenarioSelection32('normalized-comparison')
  const { rematching, rematchTeam } = useTeamRematch({
    teamKey,
    warehouse,
    decision,
    analysisRunId,
    team,
    currentTargetTeamFit,
    setTargetFitState,
    setAlternativeError,
    readOnly,
  })
  const needsBangbooChoice =
    Boolean(targetCandidateId) && playerConfirmableBangbooOptions.length > 0 && !automaticBangboo
  const bangbooUnavailable =
    !route?.discOnlyCandidate &&
    !team?.bangbooId &&
    !automaticBangboo &&
    playerConfirmableBangbooOptions.length === 0
  const canRecoverTargetFit =
    Boolean(team && analysisRunId && targetCandidateId) &&
    !currentTargetTeamFit &&
    !readOnly &&
    !needsBangbooChoice &&
    !bangbooUnavailable
  const recoveryTeamId = team?.id ?? null
  const recoveryInputHash = decision?.fingerprint.inputHash ?? null
  const recoveryAccountId = warehouse.accountId
  useEffect(() => {
    // TeamPlan remains mounted when a same-core route changes. Invalidate both a
    // failed target and an in-flight old target so neither can block or write the
    // newly selected exact candidate.
    alternativeAbortRef.current?.abort()
    alternativeAbortRef.current = null
    targetFitRequestGeneration.current += 1
    activeTargetFitRouteIdentity.current = targetFitRouteIdentity
    queueMicrotask(() => {
      if (activeTargetFitRouteIdentity.current !== targetFitRouteIdentity) return
      setFitStatus('idle')
      setEquipmentParametersRequireRefresh(false)
      setSwitchingAlternativeId(null)
      setAlternativeError(null)
    })
  }, [targetFitRouteIdentity])
  useEffect(
    () => () => {
      alternativeAbortRef.current?.abort()
      alternativeAbortRef.current = null
      targetFitRequestGeneration.current += 1
    },
    [],
  )
  useTeamTargetFitRecovery({
    analysisRunId,
    calculateTargetTeamWarehouseFit,
    canRecoverTargetFit,
    recoveryAccountId,
    recoveryAttempt,
    recoveryInputHash,
    recoveryTeamId,
    targetCandidateId,
    retainedTargetTeamFit,
    targetFitRequestGenerationRef: targetFitRequestGeneration,
    setTargetFitState,
    setFitStatus,
  })
  const selectAlternative = useTeamAlternativeSelection({
    accountId: warehouse.accountId,
    decision,
    analysisRunId,
    calculationClient,
    readOnly,
    switchingAlternativeId,
    targetFitRequestGeneration,
    alternativeAbortRef,
    capturePageScope,
    setSwitchingAlternativeId,
    setAlternativeError,
    calculateTargetTeamWarehouseFit: (
      runId,
      candidateId,
      equipmentParameters,
      _scenarioSelection,
      _eventConditionDeclarationsByAgentId,
      _declaredEventComparison32,
      _standardReference32,
      _savedPlanReplay,
      signal,
    ) =>
      calculateTargetTeamWarehouseFit(
        runId,
        candidateId,
        equipmentParameters,
        scenarioSelection,
        undefined,
        undefined,
        undefined,
        undefined,
        signal,
      ),
    navigate,
  })
  const cancelAlternativeSwitch = () => {
    alternativeAbortRef.current?.abort()
    alternativeAbortRef.current = null
    targetFitRequestGeneration.current += 1
    setSwitchingAlternativeId(null)
    setAlternativeError(null)
  }
  if (!team)
    return routeStatus === 'loading' ? (
      <section className="panel result-empty" role="status">
        <h1>正在读取队伍详情</h1>
      </section>
    ) : routeStatus === 'error' ? (
      <section className="panel result-empty" role="alert">
        <h1>队伍详情暂不可用</h1>
        <p>请返回当前队伍建议后重试；账户资产没有改变。</p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => navigate('/loadouts/team')}
        >
          返回当前队伍建议
        </button>
      </section>
    ) : (
      <InvalidPlan back="/loadouts/team" label="队伍" />
    )
  const confirmPlayerBangbooAndCalculate = async (selection: {
    bangbooId: string
    bangbooStars: 1 | 2 | 3 | 4 | 5
  }) => {
    if (
      !analysisRunId ||
      !targetCandidateId ||
      !calculationClient ||
      readOnly ||
      explicitFitPending.current
    )
      return
    explicitFitPending.current = true
    const finishUsage = beginUsageOperation('team_loadout')
    const isCurrentPage = capturePageScope()
    const requestGeneration = ++targetFitRequestGeneration.current
    setFitStatus('running')
    try {
      const fit = await calculationClient.calculateTargetTeamWarehouseFit({
        contractVersion: calculationQueryContractVersion,
        kind: 'target_team_warehouse_fit',
        runId: analysisRunId,
        candidateId: targetCandidateId,
        scenarioSelection,
        eventConditionDeclarationsByAgentId:
          currentTargetTeamFit?.eventConditionDeclarationsByAgentId,
        playerBangbooSelection: { teamKey, ...selection },
        standardReference32: standardReferenceContinuation32(
          currentTargetTeamFit,
          targetCandidateId,
          {
            refreshMetadata: true,
          },
        ),
      })
      if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) {
        finishUsage('cancelled')
        return
      }
      finishUsage(fit.status === 'ready' ? 'success' : 'incomplete')
      setTargetTeamFit(fit)
      setFitStatus('idle')
    } catch {
      if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) {
        finishUsage('cancelled')
        return
      }
      finishUsage('failure')
      setFitStatus('error')
    } finally {
      explicitFitPending.current = false
    }
  }
  const resolvedTeam =
    currentTargetTeamFit?.buildIntent.exactTeam.bangbooId === undefined
      ? team
      : { ...team, bangbooId: currentTargetTeamFit.buildIntent.exactTeam.bangbooId }
  if (!currentTargetTeamFit)
    return (
      <section className="optimizer-flow optimizer-plan">
        <header className="optimizer-plan__team-heading">
          <div className="optimizer-plan__team-identity">
            <button
              className="button button--secondary optimizer-plan__back-link"
              type="button"
              onClick={() => navigate('/loadouts/team')}
            >
              ← 返回选择队伍
            </button>
            <h1>{team.title}</h1>
            {currentTeamAnalysisSession?.result.reservations &&
            currentTeamAnalysisSession.result.analysisRunId === analysisRunId ? (
              <span className="f5v-remaining-box-badge">使用其他角色</span>
            ) : null}
            <p>
              {team.agentIds.map(getAgentName).join(' · ')} ·{' '}
              {team.bangbooId
                ? playerFacingBangbooLabel(team.bangbooId)
                : automaticBangboo
                  ? `${automaticBangboo.name}（推荐）`
                  : '邦布待确认'}
            </p>
            <p title={!ratingAnalysis && teamRatingLabel ? teamRatingLabelTitle() : undefined}>
              {ratingAnalysis ? (
                <TeamLocalAnalysisEvidence
                  analysis={ratingAnalysis}
                  recommendationScore={recommendationScore}
                />
              ) : (
                teamRatingLabel
              )}
            </p>
          </div>
        </header>
        <PlanEditorTransitionNotice
          notice={switchingAlternativeId ? '正在搭配替换队伍…' : null}
          onCancel={switchingAlternativeId ? cancelAlternativeSwitch : undefined}
          cancelLabel="取消切换"
        />
        <TeamPlanRecoveryStatus
          readOnly={readOnly}
          fitStatus={fitStatus}
          canRecoverTargetFit={canRecoverTargetFit}
          targetCandidateId={targetCandidateId}
          bangbooUnavailable={bangbooUnavailable}
          needsBangbooChoice={needsBangbooChoice}
          memberIds={team.agentIds}
          options={playerConfirmableBangbooOptions}
          onConfirm={(selection) => void confirmPlayerBangbooAndCalculate(selection)}
          onRetry={() => {
            setFitStatus('idle')
            setRecoveryAttempt((current) => current + 1)
          }}
        />
        {decision ? (
          <TeamDecisionAuthorityDetail decision={decision} memberIds={team.agentIds} />
        ) : null}
      </section>
    )
  const fitActions = createTeamPlanFitActions(() => ({
    analysisRunId,
    targetCandidateId,
    calculationClient,
    currentTargetTeamFit,
    readOnly,
    explicitFitPending,
    targetFitRequestGeneration,
    capturePageScope,
    scenarioSelection,
    calculateTargetTeamWarehouseFit,
    setFitStatus,
    setEquipmentParametersRequireRefresh,
    setTargetTeamFit,
    setAlternativeError,
  }))
  return (
    <PlanEditor
      key={`${warehouse.accountId}:team:${team.id}`}
      warehouse={warehouse}
      kind="team"
      team={resolvedTeam}
      teamRatingLabel={teamRatingLabel}
      ratedTeamPlayId={
        route?.targetCandidateId === currentTargetTeamFit?.candidateId
          ? route?.ratedTeamPlayId
          : undefined
      }
      profiles={team.agentIds.map(resolveProfile)}
      back="/loadouts/team"
      analysisRunId={analysisRunId}
      decision={decision}
      targetTeamFit={currentTargetTeamFit}
      onDeploymentOrderChange={(order) => {
        if (readOnly || equipmentParametersRequireRefresh || !currentTargetTeamFit) return
        setTargetTeamFit(
          {
            ...currentTargetTeamFit,
            targetExecution: { ...currentTargetTeamFit.targetExecution, deploymentOrder: order },
          },
          false,
        )
      }}
      readOnly={readOnly || rematching || Boolean(switchingAlternativeId)}
      alternativeTeams={route?.alternativeTeams ?? [team]}
      onSelectAlternative={(candidateId) => void selectAlternative(candidateId)}
      transitionNotice={
        rematching
          ? '正在重新搭配装备…'
          : switchingAlternativeId
            ? '正在搭配替换队伍…'
            : alternativeError
      }
      onCancelTransition={switchingAlternativeId ? cancelAlternativeSwitch : undefined}
      cancelTransitionLabel="取消切换"
      equipmentParametersRequireRefresh={equipmentParametersRequireRefresh}
      onReanalyze={() => void rematchTeam()}
      onConfirmEquipmentParameters={fitActions.confirmEquipmentParameters}
    />
  )
}
