import { useRef, useState, type MutableRefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { beginUsageOperation } from '../../usageStatistics/client'
import type {
  useAccountDecisionWorld,
  useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import type { TargetTeamWarehouseFitQueryResult } from '../../application/calculationQueryContract'
import type { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { SavedOverviewDeleteDialog } from '../SavedOverviewDeleteDialog'
import { TeamConstraintResetPanel } from '../TeamLoadoutOverviewParts'
import { TeamLoadoutOverview } from '../TeamLoadoutOverview'
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
  startAnalysis: () => void
  startRemainingBoxAnalysis: () => void
  setAnalysis: React.Dispatch<React.SetStateAction<TeamAnalysisState>>
  setLastCompleteAnalysis: React.Dispatch<React.SetStateAction<LastCompleteAnalysis | null>>
}) {
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState<TeamLoadoutOverviewItem | null>(null)
  const preparingRef = useRef<number | null>(null)
  const { result } = analysis

  const fitsAreCurrent =
    analysis.kind === 'complete' &&
    decisionWorld.status === 'current' &&
    decisionWorld.run.input.warehouse.accountId === result.warehouse.accountId &&
    decisionWorld.liveFingerprint === result.inputFingerprint &&
    result.decisionSnapshot.fingerprint.inputHash === result.inputFingerprint

  const visibleOverviewModel = fitsAreCurrent
    ? (result.fitOverviewModel ?? result.overviewModel)
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
            {result.reservations ? (
              <div className="f5v-remaining-box__status" role="status">
                <span>已保留 {result.reservations.length} 队 · 使用未选中的角色</span>
                <button
                  className="f5v-box-analysis-entry__secondary-action"
                  type="button"
                  onClick={startAnalysis}
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
        coverage={result.overviewModel.coverage}
        groups={visibleGroups}
        favoriteAgentIds={
          decisionWorld.liveInput?.warehouse.accountId === result.warehouse.accountId
            ? decisionWorld.liveInput.developmentPriorityAgentIds
            : undefined
        }
        selectedId={selectedId}
        preparingItemId={preparingItemId}
        preparationError={
          preparationError?.runId === result.analysisRunId ? preparationError : null
        }
        contextNote={overviewFeedback ?? result.overviewModel.contextNote}
        onSelect={(id) => {
          prepareRequestRef.current += 1
          preparingRef.current = null
          setPreparingItemId(null)
          setPreparationError(null)
          setRequestedSelectedId(id)
        }}
        onPrimaryAction={(item) => {
          if (preparingRef.current !== null) return
          setPreparationError(null)
          if (!item.detailCandidateId && item.kind !== 'saved') {
            setOverviewFeedback('该记录没有可打开的队伍详情。')
            return
          }
          if (item.kind === 'saved' || !fitsAreCurrent) {
            navigate(item.destination)
            return
          }
          const request = ++prepareRequestRef.current
          preparingRef.current = request
          const finishUsage = beginUsageOperation('team_loadout')
          setPreparingItemId(item.id)
          setPreparationError(null)
          setOverviewFeedback(null)
          void queryTeamRoute(result, item.detailCandidateId!)
            .then(async (entry) => {
              if (request !== prepareRequestRef.current) {
                finishUsage('cancelled')
                return
              }
              if (!entry.team || !entry.targetCandidateId) {
                navigate(item.destination)
                return
              }
              const team = entry.team
              if (!entry.discOnlyCandidate && !team.bangbooId && !entry.automaticBangboo) {
                navigate(item.destination)
                return
              }
              const cached = result.targetTeamFits[team.id]
              if (cached?.candidateId === entry.targetCandidateId) {
                navigate(item.destination)
                return
              }
              const fit = await calculateTargetTeamWarehouseFit(
                result.analysisRunId,
                entry.targetCandidateId,
              )
              if (request !== prepareRequestRef.current) {
                finishUsage('cancelled')
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
                setOverviewFeedback('账户资料已更新，请重新分析后再配装。')
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
            .catch(() => {
              finishUsage(request === prepareRequestRef.current ? 'failure' : 'cancelled')
              if (request === prepareRequestRef.current)
                setPreparationError({
                  runId: result.analysisRunId,
                  itemId: item.id,
                  message: '本次配装生成失败，请重试；账户资产没有改变。',
                })
            })
            .finally(() => {
              if (preparingRef.current === request) preparingRef.current = null
              if (request === prepareRequestRef.current) setPreparingItemId(null)
            })
        }}
        onDeleteSaved={setPendingDelete}
        onEmptyAction={() => navigate('/assets/agents')}
        analysisStale={analysis.kind === 'stale'}
        onReanalyze={result.reservations ? startRemainingBoxAnalysis : startAnalysis}
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
              const next = restoreCurrentTeamAnalysisSession(
                accountSummary,
                {
                  status: 'current',
                  run: refreshed,
                  liveFingerprint: refreshed.snapshot.fingerprint.inputHash,
                },
                null,
              )
              if (!next || refreshRequest !== analysisRequestRef.current) return
              next.result.overviewUiState =
                currentTeamAnalysisSession?.result.overviewUiState ??
                previous.result.overviewUiState
              setCurrentTeamAnalysisSession(next)
              setAnalysis(next)
              setLastCompleteAnalysis(next)
            } catch {
              setOverviewFeedback(`已删除“${title}”；队伍建议暂未更新，可稍后重新分析。`)
            }
          }}
        />
      ) : null}
    </>
  )
}
