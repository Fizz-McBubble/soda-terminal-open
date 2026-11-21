import { useContext, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { beginUsageOperation } from '../../usageStatistics/client'
import { playerErrorMessage } from '../../application/playerErrorMessage'
import {
  CalculationQueryClientContext,
  type useAccountDecisionWorld,
  type useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import {
  calculationQueryContractVersion,
  type TargetTeamWarehouseFitQueryResult,
} from '../../application/calculationQueryContract'
import type { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { SavedOverviewDeleteDialog } from '../SavedOverviewDeleteDialog'
import { TeamConstraintResetPanel } from '../TeamLoadoutOverviewParts'
import { TeamLoadoutOverview } from '../TeamLoadoutOverview'
import { useBoxOverviewSelection } from './useBoxOverviewSelection'
import type { TeamLoadoutOverviewItem } from '../teamLoadoutOverviewTypes'
import type { useTeamPickerQueries } from './useTeamPickerQueries'
import {
  currentTeamAnalysisSession,
  setCurrentTeamAnalysisSession,
  type LastCompleteAnalysis,
  type TeamAnalysisResult,
  type TeamAnalysisState,
} from '../teamAnalysisSession'
import {
  loadCurrentTeamOverviewFromQuery,
  restoreCurrentTeamAnalysisSession,
  retainTeamAnalysisAfterSavedPlanDeletion,
} from '../teamAnalysisRecovery'

export function TeamAnalysisOverviewView({
  analysis,
  decisionWorld,
  accountSummary,
  hardConstraintPanel,
  remainingBoxSelector,
  requestedSelectedId,
  setRequestedSelectedId,
  overviewFeedback,
  setOverviewFeedback,
  preparingItemId,
  setPreparingItemId,
  preparationError,
  setPreparationError,
  prepareRequest: prepareRequestRef,
  analysisRequest: analysisRequestRef,
  queryTeamRoute,
  calculateTargetTeamWarehouseFit,
  queueFitOverview,
  startAnalysis,
  startRemainingBoxAnalysis,
  setAnalysis,
  setLastCompleteAnalysis,
}: {
  analysis: { kind: 'complete' | 'stale'; result: TeamAnalysisResult }
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  accountSummary: ReturnType<typeof useF5AccountSummary>
  hardConstraintPanel: React.ReactNode
  remainingBoxSelector: React.ReactNode
  requestedSelectedId: string | null
  setRequestedSelectedId: (id: string | null) => void
  overviewFeedback: string | null
  setOverviewFeedback: (feedback: string | null) => void
  preparingItemId: string | null
  setPreparingItemId: (id: string | null) => void
  preparationError: { runId: string; itemId: string; message: string } | null
  setPreparationError: (err: { runId: string; itemId: string; message: string } | null) => void
  prepareRequest: MutableRefObject<number>
  analysisRequest: MutableRefObject<number>
  queryTeamRoute: ReturnType<typeof useTeamPickerQueries>['queryTeamRoute']
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
  queueFitOverview: (
    result: TeamAnalysisResult,
    fits: Record<string, TargetTeamWarehouseFitQueryResult>,
  ) => void
  startAnalysis: (options?: { forceRefresh?: boolean }) => void
  startRemainingBoxAnalysis: () => void
  setAnalysis: React.Dispatch<React.SetStateAction<TeamAnalysisState>>
  setLastCompleteAnalysis: React.Dispatch<React.SetStateAction<LastCompleteAnalysis | null>>
}) {
  const navigate = useNavigate()
  const calculationClient = useContext(CalculationQueryClientContext)
  const [pendingDelete, setPendingDelete] = useState<TeamLoadoutOverviewItem | null>(null)
  const preparingRef = useRef<number | null>(null)
  const { result } = analysis
  const recommendationBlock =
    result.decisionSnapshot.decisionAuthority.status === 'blocked'
      ? { reasons: result.decisionSnapshot.decisionAuthority.blockers }
      : undefined
  const reanalyze = result.reservations
    ? startRemainingBoxAnalysis
    : () => startAnalysis({ forceRefresh: true })
  const runLost = decisionWorld.analysisIssue?.kind === 'run_lost'
  const runLostRef = useRef(runLost)
  const accountRef = useRef(accountSummary)
  const liveAccountIdRef = useRef(decisionWorld.liveInput?.warehouse.accountId)
  useLayoutEffect(() => {
    runLostRef.current = runLost
    if (accountSummary && !accountSummary.hydrating) accountRef.current = accountSummary
    liveAccountIdRef.current = decisionWorld.liveInput?.warehouse.accountId
  }, [runLost, accountSummary, decisionWorld.liveInput])

  const fitsAreCurrent =
    analysis.kind === 'complete' &&
    !runLost &&
    decisionWorld.status === 'current' &&
    decisionWorld.run.input.warehouse.accountId === result.warehouse.accountId &&
    decisionWorld.liveFingerprint === result.inputFingerprint &&
    (result.sourceRunId
      ? decisionWorld.run.runId === result.sourceRunId
      : decisionWorld.run.runId === result.analysisRunId &&
        result.decisionSnapshot.fingerprint.inputHash === result.inputFingerprint)

  const { selectedModel, setOverviewSelection } = useBoxOverviewSelection(
    calculationClient,
    result,
    fitsAreCurrent,
  )
  const visibleOverviewModel = fitsAreCurrent
    ? (selectedModel ?? result.fitOverviewModel ?? result.overviewModel)
    : result.overviewModel
  const visibleGroups = visibleOverviewModel.groups
  const availableIds = new Set(visibleGroups.flatMap((group) => group.items.map((item) => item.id)))
  const selectedId =
    requestedSelectedId && availableIds.has(requestedSelectedId)
      ? requestedSelectedId
      : result.overviewModel.initialSelectedId
  const hasExecutableRecommendation = result.overviewModel.groups.some(
    (group) => group.kind === 'recommended',
  )
  const restrictedByHardConstraints =
    result.decisionSnapshot.hardConstraints.active.length > 0 && !hasExecutableRecommendation
  const resultConstraintPanel = restrictedByHardConstraints ? (
    <TeamConstraintResetPanel
      accountId={accountSummary?.accountId}
      activeCount={result.decisionSnapshot.hardConstraints.active.length}
      teamCount={result.decisionSnapshot.portfolioInput.preference.teamCount}
      blocked
    />
  ) : (
    hardConstraintPanel
  )

  return (
    <>
      {resultConstraintPanel}
      <TeamLoadoutOverview
        scopeActions={
          <div className="f5v-remaining-box-toolbar">
            {remainingBoxSelector}
            {runLost && !recommendationBlock && analysis.kind !== 'stale' ? (
              <button
                className="f5v-box-analysis-entry__secondary-action"
                type="button"
                onClick={reanalyze}
              >
                重新分析
              </button>
            ) : null}
            {result.reservations ? (
              <div className="f5v-remaining-box__status" role="status">
                <span>已排除 {result.reservations.length} 个方案的成员与驱动盘</span>
                <button
                  className="f5v-box-analysis-entry__secondary-action"
                  type="button"
                  onClick={() => startAnalysis()}
                >
                  使用全部角色
                </button>
              </div>
            ) : null}
          </div>
        }
        key={`${result.appSessionId}:${result.warehouse.accountId}:${result.analysisRunId}:${result.capturedAt.getTime()}`}
        initialUiState={result.overviewUiState}
        onUiStateChange={(overviewUiState) => {
          setOverviewSelection(
            overviewUiState.recommendedQuery,
            overviewUiState.includeReferenceDirections ?? false,
          )
          const session = currentTeamAnalysisSession
          if (
            session?.result.appSessionId !== result.appSessionId ||
            session.result.warehouse.accountId !== result.warehouse.accountId ||
            session.result.analysisRunId !== result.analysisRunId ||
            session.result.capturedAt.getTime() !== result.capturedAt.getTime()
          )
            return
          setCurrentTeamAnalysisSession({
            ...session,
            result: { ...session.result, overviewUiState },
          })
        }}
        answer={result.overviewModel.answer}
        recommendationBlock={recommendationBlock}
        coverage={result.overviewModel.coverage}
        groups={visibleGroups}
        favoriteAgentIds={
          decisionWorld.liveInput?.warehouse.accountId === result.warehouse.accountId
            ? decisionWorld.liveInput.developmentPriorityAgentIds
            : undefined
        }
        bangbooStarsById={Object.fromEntries(
          result.warehouse.roster.bangboos.flatMap((bangboo) =>
            bangboo.owned && bangboo.stars && bangboo.stars >= 1 && bangboo.stars <= 5
              ? [[bangboo.bangbooId, bangboo.stars as 1 | 2 | 3 | 4 | 5]]
              : [],
          ),
        )}
        selectedId={selectedId}
        preparingItemId={preparingItemId}
        preparationError={
          preparationError?.runId === result.analysisRunId ? preparationError : null
        }
        contextNote={
          decisionWorld.analysisIssue?.message ??
          overviewFeedback ??
          result.overviewModel.contextNote
        }
        onSelect={(id) => {
          prepareRequestRef.current += 1
          preparingRef.current = null
          setPreparingItemId(null)
          setPreparationError(null)
          setRequestedSelectedId(id)
        }}
        onPreviewSelectionChange={() => {
          prepareRequestRef.current += 1
          preparingRef.current = null
          setPreparingItemId(null)
          setPreparationError(null)
        }}
        onPrimaryAction={(item, bangboo) => {
          if (
            preparingRef.current !== null ||
            accountRef.current?.accountId !== result.warehouse.accountId ||
            accountRef.current?.appSessionId !== result.appSessionId ||
            (liveAccountIdRef.current && liveAccountIdRef.current !== result.warehouse.accountId)
          )
            return
          setPreparationError(null)
          if (!item.detailCandidateId && item.kind !== 'saved') {
            setOverviewFeedback('该记录没有可打开的队伍详情。')
            return
          }
          if (runLost && item.kind !== 'saved') {
            setOverviewFeedback(
              decisionWorld.analysisIssue?.message ?? '当前分析暂不可用，请重新分析。',
            )
            return
          }
          if (item.kind === 'saved' || !fitsAreCurrent) {
            navigate(item.destination)
            return
          }
          const request = ++prepareRequestRef.current
          const isCurrentPreparation = () =>
            request === prepareRequestRef.current &&
            !accountRef.current?.hydrating &&
            accountRef.current?.accountId === result.warehouse.accountId &&
            accountRef.current?.appSessionId === result.appSessionId &&
            (!liveAccountIdRef.current || liveAccountIdRef.current === result.warehouse.accountId)
          preparingRef.current = request
          const finishUsage = beginUsageOperation('team_loadout')
          setPreparingItemId(item.id)
          setPreparationError(null)
          setOverviewFeedback(null)
          void queryTeamRoute(result, item.detailCandidateId!)
            .then(async (entry) => {
              if (!isCurrentPreparation()) {
                finishUsage('cancelled')
                return
              }
              if (runLostRef.current) {
                finishUsage('cancelled')
                setOverviewFeedback('当前分析暂不可用，请重新分析。')
                return
              }
              if (!entry.team || !entry.targetCandidateId) {
                navigate(item.destination)
                return
              }
              const team = entry.team
              if (
                !entry.discOnlyCandidate &&
                !team.bangbooId &&
                !entry.automaticBangboo &&
                !bangboo
              ) {
                navigate(item.destination)
                return
              }
              const cached = result.targetTeamFits[team.id]
              if (
                cached?.candidateId === entry.targetCandidateId &&
                (!bangboo ||
                  (cached.effectiveEquipmentParameters?.bangbooId === bangboo.bangbooId &&
                    cached.effectiveEquipmentParameters?.bangbooStars === bangboo.stars))
              ) {
                navigate(item.destination)
                return
              }
              let fit: TargetTeamWarehouseFitQueryResult
              if (bangboo && !team.bangbooId && !entry.discOnlyCandidate) {
                if (!calculationClient) throw new Error('当前分析服务不可用，请重试。')
                fit = await calculationClient.calculateTargetTeamWarehouseFit({
                  contractVersion: calculationQueryContractVersion,
                  kind: 'target_team_warehouse_fit',
                  runId: result.analysisRunId,
                  candidateId: entry.targetCandidateId,
                  playerBangbooSelection: {
                    teamKey: team.id,
                    bangbooId: bangboo.bangbooId,
                    bangbooStars: bangboo.stars,
                  },
                })
              } else {
                const initialFit =
                  cached?.candidateId === entry.targetCandidateId
                    ? cached
                    : await calculateTargetTeamWarehouseFit(
                        result.analysisRunId,
                        entry.targetCandidateId,
                      )
                if (!isCurrentPreparation()) {
                  finishUsage('cancelled')
                  return
                }
                if (
                  bangboo &&
                  (initialFit.effectiveEquipmentParameters?.bangbooId !== bangboo.bangbooId ||
                    initialFit.effectiveEquipmentParameters?.bangbooStars !== bangboo.stars)
                ) {
                  if (!initialFit.effectiveEquipmentParameters)
                    throw new Error('当前配装缺少可确认的邦布参数，请在配装页选择。')
                  fit = await calculateTargetTeamWarehouseFit(
                    result.analysisRunId,
                    entry.targetCandidateId,
                    {
                      ...initialFit.effectiveEquipmentParameters,
                      bangbooId: bangboo.bangbooId,
                      bangbooStars: bangboo.stars,
                    },
                  )
                } else fit = initialFit
              }
              if (!isCurrentPreparation()) {
                finishUsage('cancelled')
                return
              }
              if (runLostRef.current) {
                finishUsage('cancelled')
                setOverviewFeedback('当前分析暂不可用，请重新分析。')
                return
              }
              const session = currentTeamAnalysisSession
              if (
                session?.kind !== 'complete' ||
                session.result.appSessionId !== result.appSessionId ||
                session.result.warehouse.accountId !== result.warehouse.accountId ||
                session.result.analysisRunId !== result.analysisRunId ||
                session.result.inputFingerprint !== result.inputFingerprint
              ) {
                finishUsage('cancelled')
                setOverviewFeedback('队伍建议已变化，请重新选择这支队伍。')
                return
              }
              finishUsage(fit.status === 'ready' ? 'success' : 'incomplete')
              const nextFits = { ...session.result.targetTeamFits, [team.id]: fit }
              setCurrentTeamAnalysisSession({
                ...session,
                result: {
                  ...session.result,
                  targetTeamFits: nextFits,
                  fitOverviewModel: undefined,
                },
              })
              navigate(item.destination)
              queueFitOverview(session.result, nextFits)
            })
            .catch((error: unknown) => {
              const cancelled = error instanceof Error && error.name === 'AbortError'
              finishUsage(isCurrentPreparation() && !cancelled ? 'failure' : 'cancelled')
              if (isCurrentPreparation())
                setPreparationError({
                  runId: result.analysisRunId,
                  itemId: item.id,
                  message: cancelled
                    ? '本次配装已取消。'
                    : playerErrorMessage(error, '本次配装生成失败，请重试。'),
                })
            })
            .finally(() => {
              if (preparingRef.current === request) preparingRef.current = null
              if (request === prepareRequestRef.current) setPreparingItemId(null)
            })
        }}
        onDeleteSaved={setPendingDelete}
        onEmptyAction={
          result.warehouse.roster.agents.filter((agent) => agent.owned).length < 3
            ? () => navigate('/assets/agents')
            : undefined
        }
        analysisStale={analysis.kind === 'stale'}
        onReanalyze={reanalyze}
        restrictedByHardConstraints={restrictedByHardConstraints}
      />
      {pendingDelete ? (
        <SavedOverviewDeleteDialog
          accountId={accountSummary?.accountId}
          item={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDeleted={async (title) => {
            const refreshRequest = ++analysisRequestRef.current
            setOverviewFeedback(`已删除“${title}”；账户资产未改动。`)
            setPendingDelete(null)
            const previous = currentTeamAnalysisSession ?? analysis
            const retained = retainTeamAnalysisAfterSavedPlanDeletion(previous, pendingDelete.id)
            setCurrentTeamAnalysisSession(retained)
            setAnalysis(retained)
            setLastCompleteAnalysis(retained)
            try {
              const refreshed = await decisionWorld.refresh()
              if (!refreshed || !accountSummary) throw new Error('refresh unavailable')
              if (previous.result.reservations) return
              const overviewModel = await loadCurrentTeamOverviewFromQuery(
                refreshed,
                calculationClient,
              )
              const next = restoreCurrentTeamAnalysisSession(
                accountSummary,
                {
                  status: 'current',
                  run: refreshed,
                  liveFingerprint: refreshed.snapshot.fingerprint.inputHash,
                },
                null,
                overviewModel,
              )
              if (!next || refreshRequest !== analysisRequestRef.current) return
              next.result.overviewUiState =
                currentTeamAnalysisSession?.result.overviewUiState ??
                previous.result.overviewUiState
              setCurrentTeamAnalysisSession(next)
              setAnalysis(next)
              setLastCompleteAnalysis(next)
            } catch {
              setOverviewFeedback(`已删除“${title}”；队伍建议暂未更新。`)
            }
          }}
        />
      ) : null}
    </>
  )
}
