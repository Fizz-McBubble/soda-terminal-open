import { useEffect, useMemo, useState } from 'react'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import { buildExactTeamVariantKey } from '../../accounts/planningSolutionContext'
import { resolvePlanningDiscReferences } from '../../accounts/planningDiscReferences'
import type {
  useAccountDecisionWorld,
  useTargetTeamWarehouseFitCalculation,
} from '../../application/accountDecisionWorldHooks'
import {
  calculationQueryContractVersion,
  type AccountDecisionSnapshot,
  type CalculationQueryClient,
  type TargetTeamWarehouseFitQueryResult,
} from '../../application/calculationQueryContract'
import { contentHash } from '../../application/contentHash'
import {
  inspectSavedTeamPlanSnapshotFreshness,
  inspectSavedTeamPortfolioPlanSnapshotFreshness,
  canRecalculateSavedTeamPlan,
} from '../../application/publicSavedPlanFreshness'
import { savedPlanStaleNotice } from '../../application/publicSavedPlanStaleNotice'
import {
  acceptSavedTeamReplayPresentation,
  savedTeamReplayPlanHash,
  type SavedTeamReplayPresentation,
} from '../../application/publicSavedTeamReplay'
import {
  acceptSavedTeamSolutionComponents,
  projectedSavedTeamInputHash,
  type SavedTeamSolutionComponents,
} from '../../application/publicSavedTeamSolutionComponents'
import {
  buildSavedTeamPlanSolutionFingerprintFromComponents,
  buildSavedTeamPortfolioPlanSolutionFingerprintFromComponents,
  localPrivateNonPlanningComponents,
} from '../../application/publicSavedTeamSolutionFingerprint'
import { targetTeamEquipmentParametersFingerprint } from '../../application/publicTargetTeamEquipmentFingerprint'
import { acceptTeamRoutePresentation } from '../publicTeamRoutePresentation'
import {
  resolveSavedPlanScenarioSelection,
  savedTeamDiscAssignmentFingerprint,
  currentSavedDiscReplay,
  savedDiscFitState,
} from '../savedPlanIdentity'
import { currentSavedTeamRatingLabel } from '../savedTeamRatingPresentation'
import { decisionTeamViewModel } from '../teamLoadoutDecisionViewModel'
import { acceptTeamOverviewPresentation } from '../teamLoadoutPresentationDto'
import type { TeamAnalysisResult } from '../teamAnalysisSession'

export function useSavedPlanReplay({
  plan,
  warehouse,
  decision,
  decisionWorld,
  calculationClient,
  calculateTargetTeamWarehouseFit,
}: {
  plan: AccountPlanningDraft | null | undefined
  warehouse: CoreWarehouse
  decision?: AccountDecisionSnapshot
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  calculationClient: CalculationQueryClient | null
  calculateTargetTeamWarehouseFit: ReturnType<typeof useTargetTeamWarehouseFitCalculation>
}) {
  const [restoredTargetTeamFitResult, setRestoredTargetTeamFitResult] = useState<
    | {
        identity: string
        status: 'ready' | 'mismatch' | 'error'
        fit?: TargetTeamWarehouseFitQueryResult
      }
    | undefined
  >()
  const [restoredTargetFitRetry, setRestoredTargetFitRetry] = useState(0)

  const runLost = decisionWorld.analysisIssue?.kind === 'run_lost'
  const runForReplay = decisionWorld.run
  const liveInputForFreshness =
    decisionWorld.status === 'current' &&
    decisionWorld.liveInput?.warehouse.accountId === warehouse.accountId
      ? decisionWorld.liveInput
      : null
  const liveInputIdentity = liveInputForFreshness ? contentHash(liveInputForFreshness) : null
  const componentsIdentity =
    runForReplay && liveInputIdentity ? `${runForReplay.runId}:${liveInputIdentity}` : null
  const [savedComponents, setSavedComponents] = useState<
    { identity: string; presentation: SavedTeamSolutionComponents | null } | undefined
  >()

  useEffect(() => {
    if (
      !plan ||
      plan.kind !== 'team' ||
      runLost ||
      !runForReplay ||
      !liveInputForFreshness ||
      !componentsIdentity ||
      !calculationClient ||
      savedComponents?.identity === componentsIdentity ||
      runForReplay.input.warehouse.accountId !== warehouse.accountId
    )
      return
    let active = true
    const projectedInputHash = projectedSavedTeamInputHash(liveInputForFreshness)
    void calculationClient
      .querySavedTeamSolutionComponents({
        contractVersion: calculationQueryContractVersion,
        kind: 'saved_team_solution_components',
        runId: runForReplay.runId,
        currentInput: liveInputForFreshness,
      })
      .then((projected) => {
        if (!active) return
        setSavedComponents({
          identity: componentsIdentity,
          presentation: acceptSavedTeamSolutionComponents(projected, {
            runId: runForReplay.runId,
            accountId: warehouse.accountId ?? '',
            capturedInputFingerprint: runForReplay.snapshot.fingerprint.inputHash,
            projectedInputHash,
          }),
        })
      })
      .catch(() => {
        if (active) setSavedComponents({ identity: componentsIdentity, presentation: null })
      })
    return () => {
      active = false
    }
  }, [
    plan,
    runLost,
    runForReplay,
    liveInputForFreshness,
    componentsIdentity,
    calculationClient,
    savedComponents,
    warehouse.accountId,
  ])

  const currentComponents =
    savedComponents?.identity === componentsIdentity ? savedComponents.presentation : null
  const nonPlanningComponents =
    currentComponents && liveInputForFreshness
      ? localPrivateNonPlanningComponents(
          currentComponents.nonPlanningComponents,
          liveInputForFreshness,
        )
      : null
  const replayIdentity =
    plan && runForReplay && decision
      ? `${runForReplay.runId}:${decision.fingerprint.inputHash}:${plan.id}:${savedTeamReplayPlanHash(plan)}`
      : null
  const [savedReplay, setSavedReplay] = useState<
    { identity: string; presentation: SavedTeamReplayPresentation | null } | undefined
  >()

  useEffect(() => {
    if (
      !plan ||
      runLost ||
      !runForReplay ||
      !decision ||
      !calculationClient ||
      !replayIdentity ||
      savedReplay?.identity === replayIdentity ||
      runForReplay.input.warehouse.accountId !== warehouse.accountId ||
      runForReplay.snapshot.fingerprint.inputHash !== decision.fingerprint.inputHash
    )
      return
    const planHash = savedTeamReplayPlanHash(plan)
    let active = true
    void calculationClient
      .querySavedTeamPlanReplay({
        contractVersion: calculationQueryContractVersion,
        kind: 'saved_team_plan_replay',
        runId: runForReplay.runId,
        planId: plan.id,
        planHash,
      })
      .then((projected) => {
        if (!active) return
        const accepted = acceptSavedTeamReplayPresentation(projected, {
          runId: runForReplay.runId,
          accountId: warehouse.accountId ?? '',
          inputFingerprint: decision.fingerprint.inputHash,
          planId: plan.id,
          planHash,
          luminizeSnapshotFingerprint:
            plan.solutionContext?.declaredLuminizeSettlement32?.snapshotFingerprint,
          standardReferenceIdentity:
            plan.solutionContext?.standardReference32?.selectionIdentity ??
            plan.solutionContext?.standardReference32?.preparedIdentity,
        })
        setSavedReplay({ identity: replayIdentity, presentation: accepted })
      })
      .catch(() => {
        if (active) setSavedReplay({ identity: replayIdentity, presentation: null })
      })
    return () => {
      active = false
    }
  }, [
    plan,
    runLost,
    runForReplay,
    decision,
    calculationClient,
    replayIdentity,
    savedReplay,
    warehouse.accountId,
  ])

  const currentSavedTeam =
    savedReplay?.identity === replayIdentity
      ? (savedReplay.presentation?.match ?? undefined)
      : undefined
  const currentBuildIntent = currentSavedTeam?.buildIntent
  const currentCandidateId = currentBuildIntent?.exactTeam.candidateId ?? null
  const [restoredRoute, setRestoredRoute] = useState<
    | {
        candidateId: string
        runId: string
        team: NonNullable<ReturnType<typeof decisionTeamViewModel>>
      }
    | undefined
  >()

  useEffect(() => {
    if (
      !currentCandidateId ||
      runLost ||
      !calculationClient ||
      decisionWorld.status !== 'current' ||
      !decision ||
      (restoredRoute?.candidateId === currentCandidateId &&
        restoredRoute.runId === decisionWorld.run.runId) ||
      decision.fingerprint.inputHash !== decisionWorld.run.snapshot.fingerprint.inputHash ||
      decisionWorld.run.input.warehouse.accountId !== warehouse.accountId
    )
      return
    const run = decisionWorld.run
    let active = true
    void calculationClient
      .queryTeamRoutePresentation({
        contractVersion: calculationQueryContractVersion,
        kind: 'team_route_presentation',
        runId: run.runId,
        candidateId: currentCandidateId,
      })
      .then((projected) => {
        if (!active) return
        const accepted = acceptTeamRoutePresentation(projected, {
          runId: run.runId,
          accountId: warehouse.accountId ?? '',
          inputFingerprint: decision.fingerprint.inputHash,
          candidateId: currentCandidateId,
        })
        if (accepted?.team)
          setRestoredRoute({
            candidateId: currentCandidateId,
            runId: run.runId,
            team: accepted.team,
          })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [
    currentCandidateId,
    runLost,
    calculationClient,
    decision,
    decisionWorld,
    restoredRoute,
    warehouse.accountId,
  ])

  const restoredTeam =
    currentBuildIntent && decision
      ? decisionTeamViewModel(
          decision,
          currentBuildIntent.exactTeam.candidateId,
          restoredRoute?.candidateId === currentCandidateId &&
            restoredRoute.runId === decisionWorld.run?.runId
            ? restoredRoute.team
            : null,
        )
      : null

  const currentExactVariantKey = plan
    ? buildExactTeamVariantKey({
        memberIds: plan.selection.agentIds,
        bangbooId: plan.selection.bangbooId,
        scenario: plan.selection.scenario,
      })
    : undefined

  const referencedIds = new Set(plan ? resolvePlanningDiscReferences(plan).referenceIds : [])
  const outOfScopeDisc = warehouse.discs.some(
    (disc) => referencedIds.has(disc.id) && disc.rarity !== 'S',
  )
  const portfolioSnapshotFreshness = plan?.teamPortfolioSnapshot
    ? outOfScopeDisc
      ? { stale: true as const, reason: 'disc-rarity-outside-scope' as const }
      : inspectSavedTeamPortfolioPlanSnapshotFreshness(
          plan,
          liveInputForFreshness && nonPlanningComponents && plan.teamPortfolioBuildIntent
            ? buildSavedTeamPortfolioPlanSolutionFingerprintFromComponents({
                decisionInput: liveInputForFreshness,
                planId: plan.id,
                buildIntent: plan.teamPortfolioBuildIntent,
                nonPlanningComponents,
              })
            : undefined,
        )
    : undefined

  const snapshotFreshness =
    plan && !plan.teamPortfolioSnapshot
      ? outOfScopeDisc
        ? { stale: true as const, reason: 'disc-rarity-outside-scope' as const }
        : inspectSavedTeamPlanSnapshotFreshness(
            plan,
            decision?.fingerprint.inputHash,
            currentBuildIntent && decision
              ? contentHash([decision.fingerprint.inputHash, currentBuildIntent.fingerprint])
              : undefined,
            currentBuildIntent && liveInputForFreshness && nonPlanningComponents
              ? buildSavedTeamPlanSolutionFingerprintFromComponents({
                  decisionInput: liveInputForFreshness,
                  planId: plan.id,
                  buildIntentFingerprint: contentHash([
                    currentBuildIntent.fingerprint,
                    currentExactVariantKey!,
                    currentSavedTeam!.effectiveEquipmentParameters
                      ? targetTeamEquipmentParametersFingerprint(
                          currentSavedTeam!.effectiveEquipmentParameters,
                        )
                      : currentSavedTeam!.accountFactBinding!.fingerprint,
                  ]),
                  nonPlanningComponents,
                })
              : undefined,
          )
      : undefined

  const freshness = portfolioSnapshotFreshness ?? snapshotFreshness
  const restoredPlanPending =
    !freshness || (freshness.stale && freshness.reason === 'current-result-unavailable')
  const restoredPlanStale = Boolean(freshness?.stale && !restoredPlanPending)
  const staleNotice =
    snapshotFreshness && !restoredPlanPending
      ? savedPlanStaleNotice(snapshotFreshness)
      : outOfScopeDisc
        ? '方案包含非 S 级或品质未确认的驱动盘，请使用 S 级驱动盘重新匹配。'
        : undefined
  const currentRun = decisionWorld.status === 'current' ? decisionWorld.run : null
  const currentRunOverviewIdentity =
    plan &&
    currentRun &&
    currentRun.input.warehouse.accountId === warehouse.accountId &&
    currentRun.snapshot.fingerprint.inputHash === decision?.fingerprint.inputHash &&
    currentRun.snapshot.fingerprint.inputHash === decisionWorld.liveFingerprint
      ? `${currentRun.runId}:${currentRun.snapshot.fingerprint.inputHash}:${plan.id}`
      : null
  const [currentRunOverview, setCurrentRunOverview] = useState<
    { identity: string; overviewModel: TeamAnalysisResult['overviewModel'] | null } | undefined
  >()
  const directCurrentRunOverview =
    currentRun && currentRunOverviewIdentity
      ? acceptTeamOverviewPresentation(currentRun.teamPresentation, {
          runId: currentRun.runId,
          accountId: currentRun.input.warehouse.accountId ?? '',
          inputFingerprint: currentRun.snapshot.fingerprint.inputHash,
          agentId: null,
          planId: null,
          discId: null,
        })?.overviewModel
      : undefined
  const currentRunOverviewModel =
    directCurrentRunOverview ??
    (currentRunOverview?.identity === currentRunOverviewIdentity
      ? currentRunOverview.overviewModel
      : null)

  useEffect(() => {
    if (
      !currentRun ||
      runLost ||
      !currentRunOverviewIdentity ||
      !calculationClient ||
      typeof calculationClient.queryTeamOverviewPresentation !== 'function' ||
      directCurrentRunOverview ||
      currentRunOverview?.identity === currentRunOverviewIdentity
    )
      return
    let active = true
    void calculationClient
      .queryTeamOverviewPresentation({
        contractVersion: calculationQueryContractVersion,
        kind: 'team_overview_presentation',
        runId: currentRun.runId,
        context: { agentId: null, planId: null, discId: null },
      })
      .then((projected) => {
        if (!active) return
        const overviewModel =
          acceptTeamOverviewPresentation(projected, {
            runId: currentRun.runId,
            accountId: currentRun.input.warehouse.accountId ?? '',
            inputFingerprint: currentRun.snapshot.fingerprint.inputHash,
            agentId: null,
            planId: null,
            discId: null,
          })?.overviewModel ?? null
        setCurrentRunOverview(
          overviewModel
            ? { identity: currentRunOverviewIdentity, overviewModel }
            : {
                identity: currentRunOverviewIdentity,
                overviewModel: null,
              },
        )
      })
      .catch(() => {
        if (active)
          setCurrentRunOverview({ identity: currentRunOverviewIdentity, overviewModel: null })
      })
    return () => {
      active = false
    }
  }, [
    calculationClient,
    currentRun,
    runLost,
    currentRunOverview?.identity,
    currentRunOverviewIdentity,
    directCurrentRunOverview,
  ])

  const savedItemFromCurrentRun = (() => {
    if (
      !plan ||
      !currentRun ||
      currentRun.input.warehouse.accountId !== warehouse.accountId ||
      currentRun.snapshot.fingerprint.inputHash !== decision?.fingerprint.inputHash ||
      currentRun.snapshot.fingerprint.inputHash !== decisionWorld.liveFingerprint ||
      !currentRun.input.drafts.some(
        (captured) => captured.id === plan.id && contentHash(captured) === contentHash(plan),
      )
    )
      return null
    return (
      currentRunOverviewModel?.groups
        .flatMap((group) => group.items)
        .flatMap((family) => family.variants)
        .find((item) => item.id === `saved:${plan.id}`) ?? null
    )
  })()

  const restoredTeamRatingLabel = plan
    ? currentSavedTeamRatingLabel({
        plan,
        decisionAuthority:
          decisionWorld.status === 'current' ? decision?.decisionAuthority : undefined,
        publicItem: savedItemFromCurrentRun,
      })
    : null

  const savedTargetCandidateId =
    plan &&
    !runLost &&
    canRecalculateSavedTeamPlan(snapshotFreshness) &&
    decisionWorld.status === 'current' &&
    decisionWorld.run.input.warehouse.accountId === warehouse.accountId &&
    plan.accountId === warehouse.accountId &&
    decisionWorld.liveFingerprint === decision?.fingerprint.inputHash &&
    currentSavedTeam?.buildIntent.exactTeam.candidateId
      ? currentSavedTeam.buildIntent.exactTeam.candidateId
      : undefined
  const savedTargetParameters = savedTargetCandidateId
    ? currentSavedTeam?.effectiveEquipmentParameters
    : undefined
  const savedAccountBindingFingerprint = currentSavedTeam?.accountFactBinding?.fingerprint ?? ''
  const savedTargetParametersFingerprint = savedTargetParameters
    ? targetTeamEquipmentParametersFingerprint(savedTargetParameters)
    : savedAccountBindingFingerprint
  const savedTargetDiscFingerprint = plan ? savedTeamDiscAssignmentFingerprint(plan) : ''
  const savedTargetScenarioSelection = useMemo(() => {
    if (!plan) return undefined
    return resolveSavedPlanScenarioSelection(plan.solutionContext?.scenarioSelection)
  }, [plan])
  const stableSavedTargetParameters = useMemo(
    () => savedTargetParameters,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedTargetCandidateId, savedTargetParametersFingerprint],
  )
  const savedTargetRunId =
    savedTargetCandidateId && decisionWorld.status === 'current'
      ? decisionWorld.run.runId
      : undefined
  const savedTargetIdentity =
    savedTargetRunId &&
    savedTargetCandidateId &&
    (savedTargetParameters || savedAccountBindingFingerprint)
      ? `${savedTargetRunId}:${savedTargetCandidateId}:${savedTargetParametersFingerprint}:${savedTargetDiscFingerprint}:${savedTeamReplayPlanHash(plan!)}`
      : ''
  const savedTargetRequestIdentity = savedTargetIdentity
    ? `${savedTargetIdentity}:${restoredTargetFitRetry}`
    : ''
  const restoredTargetTeamFit =
    restoredTargetTeamFitResult?.identity === savedTargetRequestIdentity &&
    restoredTargetTeamFitResult.status === 'ready'
      ? restoredTargetTeamFitResult.fit
      : undefined
  const restoredTargetFitState: 'ready' | 'mismatch' | 'error' | 'loading' | undefined =
    savedTargetRequestIdentity
      ? restoredTargetTeamFitResult?.identity === savedTargetRequestIdentity
        ? restoredTargetTeamFitResult.status
        : 'loading'
      : undefined

  useEffect(() => {
    let active = true
    if (
      !savedTargetRunId ||
      !savedTargetCandidateId ||
      (!stableSavedTargetParameters && !savedAccountBindingFingerprint)
    )
      return
    const request = currentSavedDiscReplay(
      plan,
      warehouse.accountId!,
      decision?.fingerprint.inputHash,
    )
    void calculateTargetTeamWarehouseFit(
      savedTargetRunId,
      savedTargetCandidateId,
      stableSavedTargetParameters,
      savedTargetScenarioSelection,
      plan?.solutionContext?.eventConditionDeclarationsByAgentId,
      undefined,
      plan?.solutionContext?.standardReferenceRequest32,
      request,
    )
      .then((fit) => {
        if (!active || fit.candidateId !== savedTargetCandidateId) return
        setRestoredTargetTeamFitResult(
          savedDiscFitState(plan, fit, savedTargetRequestIdentity, request),
        )
      })
      .catch(() => {
        if (active)
          setRestoredTargetTeamFitResult({ identity: savedTargetRequestIdentity, status: 'error' })
      })
    return () => {
      active = false
    }
  }, [
    calculateTargetTeamWarehouseFit,
    savedTargetCandidateId,
    stableSavedTargetParameters,
    savedAccountBindingFingerprint,
    savedTargetParametersFingerprint,
    savedTargetIdentity,
    savedTargetRequestIdentity,
    savedTargetRunId,
    savedTargetScenarioSelection,
    plan,
    decision,
    warehouse.accountId,
  ])

  return {
    componentsIdentity,
    savedComponents,
    replayIdentity,
    savedReplay,
    restoredTeam,
    portfolioSnapshotFreshness,
    snapshotFreshness,
    restoredPlanStale,
    restoredPlanPending,
    staleNotice,
    restoredTeamRatingLabel,
    savedTargetCandidateId,
    restoredTargetTeamFit,
    restoredTargetFitState,
    setRestoredTargetFitRetry,
  }
}
