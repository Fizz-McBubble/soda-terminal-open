import { setCurrentTeamAnalysisSession } from './teamAnalysisSession'
import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAgentName } from '../application/publicRosterNames'
import {
  PlayerConfirmableBangbooSelector,
  type PlayerConfirmableBangbooOption,
} from './PlayerConfirmableBangbooSelector'
import { TeamDecisionAuthorityDetail } from './TeamDecisionAuthorityDetail'
import { InvalidPlan } from './InvalidPlan'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type {
  AccountDecisionSnapshot,
  TargetTeamWarehouseFitQueryResult,
} from '../application/calculationQueryContract'
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

export function TeamPlan({
  warehouse,
  decision,
  analysisRunId,
  targetTeamFits,
  readOnly = false,
}: {
  warehouse: CoreWarehouse
  decision?: AccountDecisionSnapshot
  analysisRunId?: string
  targetTeamFits?: Record<string, TargetTeamWarehouseFitQueryResult>
  readOnly?: boolean
}) {
  const { teamKey = '' } = useParams()
  const navigate = useNavigate()
  const resolveProfile = useContext(PlanningProfileContext)
  const calculationClient = useContext(CalculationQueryClientContext)
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
  const playerConfirmableBangbooOptions: readonly PlayerConfirmableBangbooOption[] =
    route?.playerConfirmableBangbooOptions ?? []
  // TeamPlan stays mounted while the route selects a same-core alternative. A fit is
  // an exact Candidate result, never a reusable family-level presentation object.
  // Hide an old fit immediately, before the route effect can schedule the new query.
  const currentTargetTeamFit =
    targetTeamFit?.candidateId === targetCandidateId
      ? targetTeamFit
      : retainedTargetTeamFit?.candidateId === targetCandidateId
        ? retainedTargetTeamFit
        : undefined
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
      void calculateTargetTeamWarehouseFit(analysisRunId, targetCandidateId)
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
    calculateTargetTeamWarehouseFit,
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
    if (!analysisRunId || !targetCandidateId || !calculationClient || readOnly) return
    const requestGeneration = ++targetFitRequestGeneration.current
    setFitStatus('running')
    try {
      const fit = await calculationClient.calculateTargetTeamWarehouseFit({
        contractVersion: calculationQueryContractVersion,
        kind: 'target_team_warehouse_fit',
        runId: analysisRunId,
        candidateId: targetCandidateId,
        playerBangbooSelection: { teamKey, ...selection },
      })
      if (requestGeneration !== targetFitRequestGeneration.current) return
      setTargetTeamFit(fit)
      setFitStatus('idle')
    } catch {
      if (requestGeneration !== targetFitRequestGeneration.current) return
      setFitStatus('error')
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
            <p title={!ratingAnalysis && recommendationScore != null ? '队伍强度参考' : undefined}>
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
        <section className="panel status-card" aria-label="队伍建议详情">
          <h2>
            {readOnly
              ? '账户资料已更新'
              : fitStatus === 'error'
                ? '配装生成失败'
                : canRecoverTargetFit
                  ? '正在生成队伍配装'
                  : !targetCandidateId
                    ? '暂不能为这队配装'
                    : bangbooUnavailable
                      ? '暂未找到可用邦布'
                      : needsBangbooChoice
                        ? '确认邦布后生成配装'
                        : '暂不能打开这份配装'}
          </h2>
          <p role={fitStatus === 'error' && !readOnly ? 'alert' : undefined}>
            {readOnly
              ? '返回队伍建议重新分析后，再为这支队伍配装。'
              : fitStatus === 'error'
                ? '配装生成失败；账户资料没有被修改。'
                : canRecoverTargetFit
                  ? '正在恢复这支队伍的配装，请稍候。'
                  : !targetCandidateId
                    ? '当前没有足够的配装依据，请返回选择其他队伍。'
                    : bangbooUnavailable
                      ? '当前没有可确认的邦布搭配，请返回选择其他队伍。'
                      : needsBangbooChoice
                        ? '选择要搭配的邦布，再匹配驱动盘；不会修改账户资产。'
                        : '请返回队伍建议，重新选择这支队伍。'}
          </p>
          {needsBangbooChoice && !readOnly ? (
            <PlayerConfirmableBangbooSelector
              memberIds={team.agentIds}
              options={playerConfirmableBangbooOptions}
              pending={fitStatus === 'running' || readOnly}
              onConfirm={(selection) => void confirmPlayerBangbooAndCalculate(selection)}
            />
          ) : null}
          {canRecoverTargetFit && fitStatus === 'error' ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setFitStatus('idle')
                setRecoveryAttempt((current) => current + 1)
              }}
            >
              重试生成
            </button>
          ) : null}
        </section>
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
        const requestGeneration = ++targetFitRequestGeneration.current
        const isCurrentPage = capturePageScope()
        setEquipmentParametersRequireRefresh(true)
        setFitStatus('running')
        try {
          const fit = await calculateTargetTeamWarehouseFit(
            analysisRunId,
            targetCandidateId,
            selection,
          )
          if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) return
          setTargetTeamFit(fit)
          setEquipmentParametersRequireRefresh(false)
          setFitStatus('idle')
        } catch (error) {
          if (!isCurrentPage() || requestGeneration !== targetFitRequestGeneration.current) return
          // Inline controls roll back to the previous effective parameters on
          // failure; keep that unchanged result available for a fresh retry.
          setEquipmentParametersRequireRefresh(false)
          setFitStatus('error')
          throw error
        }
      }}
    />
  )
}
