import type { Dispatch, SetStateAction } from 'react'
import type { AccountPlanningDraft } from '../../accounts/types'
import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
  type CalculationQueryClient,
  type TargetTeamWarehouseFitQueryResult,
} from '../../application/calculationQueryContract'
import {
  acceptSavedTeamReplayPresentation,
  savedTeamReplayPlanHash,
} from '../../application/publicSavedTeamReplay'
import { acceptTeamRoutePresentation } from '../publicTeamRoutePresentation'
import {
  currentTeamAnalysisSession,
  setCurrentTeamAnalysisSession,
  type TeamAnalysisResult,
  type TeamAnalysisState,
} from '../teamAnalysisSession'
import {
  acceptTeamOverviewPresentation,
  type TeamPresentationIdentity,
} from '../teamLoadoutPresentationDto'

export function useTeamPickerQueries({
  calculationClient,
  releaseRun,
  setAnalysis,
  setOverviewFeedback,
}: {
  calculationClient: CalculationQueryClient | null
  releaseRun: (runId: string) => void
  setAnalysis: Dispatch<SetStateAction<TeamAnalysisState>>
  setOverviewFeedback: Dispatch<SetStateAction<string | null>>
}) {
  const identityForRun = (run: AccountDecisionRun): TeamPresentationIdentity => ({
    runId: run.runId,
    accountId: run.input.warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
  })

  const queryTeamOverview = async (
    identity: TeamPresentationIdentity,
    context: { agentId: string | null; planId: string | null; discId: string | null },
    sourceRunId?: string,
    selectedPlanIds?: string[],
    fitCandidateIds?: string[],
  ) => {
    if (!calculationClient) throw new Error('当前分析服务不可用，请重试。')
    const projected = await calculationClient.queryTeamOverviewPresentation({
      contractVersion: calculationQueryContractVersion,
      kind: 'team_overview_presentation',
      runId: identity.runId,
      context,
      sourceRunId,
      reservedPlanIds: selectedPlanIds,
      fitCandidateIds,
    })
    const accepted = acceptTeamOverviewPresentation(projected, {
      ...identity,
      ...context,
    })
    if (!accepted) throw new Error('队伍展示结果缺失或已过期，请重新分析当前队伍。')
    return accepted.overviewModel
  }

  const queryFitOverview = (
    result: TeamAnalysisResult,
    fits: Record<string, TargetTeamWarehouseFitQueryResult>,
  ) =>
    queryTeamOverview(
      {
        runId: result.analysisRunId,
        accountId: result.warehouse.accountId ?? '',
        inputFingerprint: result.decisionSnapshot.fingerprint.inputHash,
      },
      result.presentationContext ?? { agentId: null, planId: null, discId: null },
      result.sourceRunId,
      result.reservations?.map((reservation) => reservation.planId),
      Object.values(fits).map((fit) => fit.candidateId),
    )

  const queryTeamRoute = async (result: TeamAnalysisResult, candidateId: string) => {
    if (!calculationClient) throw new Error('当前分析服务不可用，请重试。')
    const route = await calculationClient.queryTeamRoutePresentation({
      contractVersion: calculationQueryContractVersion,
      kind: 'team_route_presentation',
      runId: result.analysisRunId,
      candidateId,
    })
    const accepted = acceptTeamRoutePresentation(route, {
      runId: result.analysisRunId,
      accountId: result.warehouse.accountId ?? '',
      inputFingerprint: result.decisionSnapshot.fingerprint.inputHash,
      candidateId,
    })
    if (!accepted) throw new Error('队伍详情已变化，请重新分析当前队伍。')
    const session = currentTeamAnalysisSession
    if (
      session?.result.analysisRunId === result.analysisRunId &&
      session.result.inputFingerprint === result.inputFingerprint
    )
      setCurrentTeamAnalysisSession({
        ...session,
        result: {
          ...session.result,
          teamRoutePresentations: {
            ...session.result.teamRoutePresentations,
            [candidateId]: accepted,
          },
        },
      })
    return accepted
  }

  const querySavedReplay = async (result: TeamAnalysisResult, plan: AccountPlanningDraft) => {
    if (!calculationClient) throw new Error('当前分析服务不可用，请重试。')
    const planHash = savedTeamReplayPlanHash(plan)
    const projected = await calculationClient.querySavedTeamPlanReplay({
      contractVersion: calculationQueryContractVersion,
      kind: 'saved_team_plan_replay',
      runId: result.analysisRunId,
      planId: plan.id,
      planHash,
    })
    const accepted = acceptSavedTeamReplayPresentation(projected, {
      runId: result.analysisRunId,
      accountId: result.warehouse.accountId ?? '',
      inputFingerprint: result.decisionSnapshot.fingerprint.inputHash,
      planId: plan.id,
      planHash,
    })
    if (!accepted) throw new Error('已保存方案重放结果缺失或过期。')
    return accepted
  }

  const queueFitOverview = (
    result: TeamAnalysisResult,
    fits: Record<string, TargetTeamWarehouseFitQueryResult>,
  ) => {
    if (result.sourceRunId) return
    void queryFitOverview(result, fits)
      .then((model) => {
        const active = currentTeamAnalysisSession
        if (
          active?.result.analysisRunId !== result.analysisRunId ||
          active.result.inputFingerprint !== result.inputFingerprint ||
          Object.values(active.result.targetTeamFits)
            .map((fit) => fit.candidateId)
            .join('|') !==
            Object.values(fits)
              .map((fit) => fit.candidateId)
              .join('|')
        )
          return
        setCurrentTeamAnalysisSession({
          ...active,
          result: { ...active.result, fitOverviewModel: model },
        })
      })
      .catch(() => undefined)
  }

  const releasePreviousDetached = (nextRunId: string) => {
    const previous = currentTeamAnalysisSession?.result
    if (previous?.sourceRunId && previous.analysisRunId !== nextRunId)
      releaseRun(previous.analysisRunId)
  }

  const restoreFitOverview = async (result: TeamAnalysisResult) => {
    try {
      const model = await queryFitOverview(result, result.targetTeamFits)
      const active = currentTeamAnalysisSession
      if (
        active?.result.analysisRunId !== result.analysisRunId ||
        active.result.inputFingerprint !== result.inputFingerprint
      )
        return
      const updated = { ...active, result: { ...active.result, fitOverviewModel: model } }
      setCurrentTeamAnalysisSession(updated)
      setAnalysis((previous) =>
        previous.kind === 'complete' &&
        previous.result.analysisRunId === result.analysisRunId &&
        previous.result.inputFingerprint === result.inputFingerprint
          ? { ...previous, result: { ...previous.result, fitOverviewModel: model } }
          : previous,
      )
    } catch {
      setOverviewFeedback('队伍配装结果已变化，请重新分析后查看最新建议。')
    }
  }

  return {
    identityForRun,
    queryTeamOverview,
    queryFitOverview,
    queryTeamRoute,
    querySavedReplay,
    queueFitOverview,
    releasePreviousDetached,
    restoreFitOverview,
  }
}
