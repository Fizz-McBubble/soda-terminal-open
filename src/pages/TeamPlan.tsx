import { TeamPlanRecoveryStatus } from './TeamPlanRecoveryStatus'
import { setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAgentName, formatDevelopmentEntityText } from '../application/publicRosterNames'
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
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { useTeamRematch } from './useTeamRematch'
import { usePageOperationScope } from '../components/usePageOperationScope'
import { beginUsageOperation } from '../usageStatistics/client'
import { PlanningScenarioControl } from '../components/PlanningScenarioControl'
import {
  planningScenarioSelection32,
  type CurrentPlanningScenarioSelection32,
} from '../application/publicPlanningScenarioContract'
import type { TeamPlanProps } from './teamPlanProps'
import { teamRatingLabelTitle } from './teamRatingPresentation'
import { standardReferenceContinuation32 } from './standardReferenceContinuation32'
import { StandardTeamReferenceControl32 } from './StandardTeamReferenceControl32'

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
      targetFitRequestGeneration.current += 1
    },
    [],
  )
  useEffect(() => {
    if (!canRecoverTargetFit || !analysisRunId || !targetCandidateId) return
    let active = true
    const generation = ++targetFitRequestGeneration.current
    // StrictMode replays effects on first mount. Wait one microtask so its discarded
    // pass never submits a second calculation task.
    queueMicrotask(() => {
      if (!active || generation !== targetFitRequestGeneration.current) return
      setFitStatus('running')
      void calculateTargetTeamWarehouseFit(
        analysisRunId,
        targetCandidateId,
        undefined,
        retainedTargetTeamFit?.scenarioSelection,
        retainedTargetTeamFit?.eventConditionDeclarationsByAgentId,
        undefined,
        standardReferenceContinuation32(retainedTargetTeamFit, targetCandidateId),
      )
        .then((fit) => {
          if (!active || generation !== targetFitRequestGeneration.current) return
          const session = currentTeamAnalysisSession
          if (
            recoveryTeamId &&
            session?.result.analysisRunId === analysisRunId &&
            session.result.warehouse.accountId === recoveryAccountId &&
            session.result.decisionSnapshot.fingerprint.inputHash === recoveryInputHash
          )
            setCurrentTeamAnalysisSession({
              ...session,
              result: {
                ...session.result,
                targetTeamFits: { ...session.result.targetTeamFits, [recoveryTeamId]: fit },
              },
            })
          setTargetFitState({ runId: analysisRunId, fit })
          setFitStatus('idle')
        })
        .catch(() => {
          if (active && generation === targetFitRequestGeneration.current) setFitStatus('error')
        })
    })
    return () => {
      active = false
      targetFitRequestGeneration.current += 1
    }
  }, [
    analysisRunId,
    calculateTargetTeamWarehouseFit,
    canRecoverTargetFit,
    recoveryAccountId,
    recoveryAttempt,
    recoveryInputHash,
    recoveryTeamId,
    targetCandidateId,
    retainedTargetTeamFit,
  ])
  const selectAlternative = useTeamAlternativeSelection({
    accountId: warehouse.accountId,
    decision,
    analysisRunId,
    calculationClient,
    readOnly,
    switchingAlternativeId,
    targetFitRequestGeneration,
    capturePageScope,
    setSwitchingAlternativeId,
    setAlternativeError,
    calculateTargetTeamWarehouseFit: (runId, candidateId, equipmentParameters) =>
      calculateTargetTeamWarehouseFit(runId, candidateId, equipmentParameters, scenarioSelection),
    navigate,
  })
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
  return (
    <PlanEditor
      key={`${warehouse.accountId}:team:${team.id}`}
      warehouse={warehouse}
      kind="team"
      team={resolvedTeam}
      teamRatingLabel={teamRatingLabel}
      profiles={team.agentIds.map(resolveProfile)}
      back="/loadouts/team"
      analysisRunId={analysisRunId}
      decision={decision}
      targetTeamFit={currentTargetTeamFit}
      comparisonScenarioControl={
        <>
          <PlanningScenarioControl
            value={scenarioSelection}
            disabled={
              readOnly || rematching || fitStatus === 'running' || Boolean(switchingAlternativeId)
            }
            onChange={async (selection: CurrentPlanningScenarioSelection32) => {
              if (!analysisRunId || !targetCandidateId || explicitFitPending.current) return
              const isCurrentPage = capturePageScope()
              const generation = ++targetFitRequestGeneration.current
              explicitFitPending.current = true
              setFitStatus('running')
              setEquipmentParametersRequireRefresh(true)
              try {
                const fit = await calculateTargetTeamWarehouseFit(
                  analysisRunId,
                  targetCandidateId,
                  currentTargetTeamFit?.effectiveEquipmentParameters?.source === 'player_confirmed'
                    ? currentTargetTeamFit.effectiveEquipmentParameters
                    : undefined,
                  selection,
                  currentTargetTeamFit?.eventConditionDeclarationsByAgentId,
                  undefined,
                  standardReferenceContinuation32(currentTargetTeamFit, targetCandidateId, {
                    scenarioSelection: selection,
                  }),
                )
                if (!isCurrentPage() || generation !== targetFitRequestGeneration.current) return
                if (fit.scenarioSelection?.id !== selection.id || !fit.scenarioIdentity)
                  throw new Error('比较场景未进入计算结果，请重试。')
                setTargetTeamFit(fit)
                setAlternativeError(null)
                setFitStatus('idle')
              } catch (error) {
                if (!isCurrentPage() || generation !== targetFitRequestGeneration.current) return
                setAlternativeError(
                  error instanceof Error ? error.message : '场景计算失败，请重试。',
                )
                setFitStatus('error')
              } finally {
                explicitFitPending.current = false
                if (isCurrentPage() && generation === targetFitRequestGeneration.current)
                  setEquipmentParametersRequireRefresh(false)
              }
            }}
          />
          <StandardTeamReferenceControl32
            key={`${analysisRunId}:${targetCandidateId}`}
            fit={currentTargetTeamFit}
            disabled={
              readOnly || rematching || fitStatus === 'running' || Boolean(switchingAlternativeId)
            }
            onChange={async (request) => {
              if (
                !analysisRunId ||
                !targetCandidateId ||
                !calculationClient ||
                !currentTargetTeamFit ||
                readOnly
              )
                throw new Error('队伍资料已变化，请重新分析。')
              if (explicitFitPending.current) throw new Error('正在计算，请稍后重试。')
              const isCurrentPage = capturePageScope()
              const generation = ++targetFitRequestGeneration.current
              explicitFitPending.current = true
              setFitStatus('running')
              setEquipmentParametersRequireRefresh(true)
              try {
                const fit = await calculationClient.calculateTargetTeamWarehouseFit({
                  contractVersion: calculationQueryContractVersion,
                  kind: 'target_team_warehouse_fit',
                  runId: analysisRunId,
                  candidateId: targetCandidateId,
                  standardReference32: request,
                  standardReferenceFitFingerprint32: currentTargetTeamFit.fingerprint,
                })
                if (!isCurrentPage() || generation !== targetFitRequestGeneration.current) return
                if (
                  fit.standardReferenceUpdate32?.fitFingerprint !==
                    currentTargetTeamFit.fingerprint ||
                  fit.standardReferenceUpdate32.accountEquipmentPreserved !== true
                )
                  throw new Error('当前计算服务尚未确认独立标准参考，请更新配套服务后重试。')
                if (
                  fit.fingerprint !== currentTargetTeamFit.fingerprint ||
                  fit.candidateId !== targetCandidateId
                )
                  throw new Error('参考计算改变了账户配装身份，请重新分析。')
                if (request.stage === 'select' && fit.standardReference32?.status !== 'selected')
                  throw new Error(
                    formatDevelopmentEntityText(
                      fit.standardReference32?.gaps.join('；') ||
                        '当前动作条件暂不能生成参考，请调整后重试。',
                    ),
                  )
                setTargetTeamFit(fit)
                setAlternativeError(null)
                setFitStatus('idle')
              } catch (error) {
                if (isCurrentPage() && generation === targetFitRequestGeneration.current)
                  setFitStatus('error')
                throw error
              } finally {
                explicitFitPending.current = false
                if (isCurrentPage() && generation === targetFitRequestGeneration.current)
                  setEquipmentParametersRequireRefresh(false)
              }
            }}
          />
        </>
      }
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
      readOnly={readOnly || rematching}
      alternativeTeams={route?.alternativeTeams ?? [team]}
      onSelectAlternative={(candidateId) => void selectAlternative(candidateId)}
      transitionNotice={
        rematching
          ? '正在重新搭配装备…'
          : switchingAlternativeId
            ? '正在搭配替换队伍…'
            : alternativeError
      }
      equipmentParametersRequireRefresh={equipmentParametersRequireRefresh}
      onReanalyze={() => void rematchTeam()}
      onConfirmEquipmentParameters={async (selection) => {
        if (!analysisRunId || !targetCandidateId || readOnly)
          throw new Error('当前队伍资料已变更，请重新分析后再确认配装。')
        if (explicitFitPending.current) return
        explicitFitPending.current = true
        const finishUsage = beginUsageOperation('team_loadout')
        const requestGeneration = ++targetFitRequestGeneration.current
        const isCurrentPage = capturePageScope()
        setEquipmentParametersRequireRefresh(true)
        setFitStatus('running')
        try {
          const fit = await calculateTargetTeamWarehouseFit(
            analysisRunId,
            targetCandidateId,
            selection,
            scenarioSelection,
            currentTargetTeamFit?.eventConditionDeclarationsByAgentId,
            undefined,
            standardReferenceContinuation32(currentTargetTeamFit, targetCandidateId, {
              equipmentParameters: selection,
            }),
          )
          if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) {
            finishUsage('cancelled')
            return
          }
          finishUsage(fit.status === 'ready' ? 'success' : 'incomplete')
          setTargetTeamFit(fit)
          setEquipmentParametersRequireRefresh(false)
          setFitStatus('idle')
        } catch (error) {
          if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) {
            finishUsage('cancelled')
            return
          }
          finishUsage('failure')
          // Inline controls roll back to the previous effective parameters on
          // failure; keep that unchanged result available for a fresh retry.
          setEquipmentParametersRequireRefresh(false)
          setFitStatus('error')
          throw error
        } finally {
          explicitFitPending.current = false
        }
      }}
    />
  )
}
