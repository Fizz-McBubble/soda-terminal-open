import { useEffect, useMemo, useState } from 'react'
import type { CoreWarehouse } from '../../accounts/coreWarehouse'
import type { AccountPlanningDraft } from '../../accounts/types'
import { buildExactTeamVariantKey } from '../../accounts/planningSolutionContext'
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
  savedTeamDiscAssignmentFingerprint,
  savedTeamTargetFitMatchesSavedDiscs,
} from '../savedPlanIdentity'
import { currentSavedTeamRatingLabel } from '../savedTeamRatingPresentation'
import { decisionTeamViewModel } from '../teamLoadoutDecisionViewModel'
import { acceptTeamOverviewPresentation } from '../teamLoadoutPresentationDto'

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

  const portfolioSnapshotFreshness = plan?.teamPortfolioSnapshot
    ? inspectSavedTeamPortfolioPlanSnapshotFreshness(
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
      ? inspectSavedTeamPlanSnapshotFreshness(
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

  const restoredPlanStale = portfolioSnapshotFreshness?.stale ?? snapshotFreshness?.stale ?? true
  const staleNotice = snapshotFreshness ? savedPlanStaleNotice(snapshotFreshness) : undefined
  const currentRun = decisionWorld.status === 'current' ? decisionWorld.run : null

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
    const presentation = acceptTeamOverviewPresentation(currentRun.teamPresentation, {
      runId: currentRun.runId,
      accountId: warehouse.accountId ?? '',
      inputFingerprint: currentRun.snapshot.fingerprint.inputHash,
      agentId: null,
      planId: null,
      discId: null,
    })
    return (
      presentation?.overviewModel.groups
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
    !restoredPlanStale &&
    decisionWorld.status === 'current' &&
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
      ? `${savedTargetRunId}:${savedTargetCandidateId}:${savedTargetParametersFingerprint}:${savedTargetDiscFingerprint}`
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
    void calculateTargetTeamWarehouseFit(
      savedTargetRunId,
      savedTargetCandidateId,
      stableSavedTargetParameters,
    )
      .then((fit) => {
        if (!active || fit.candidateId !== savedTargetCandidateId) return
        setRestoredTargetTeamFitResult(
          plan && savedTeamTargetFitMatchesSavedDiscs(plan, fit)
            ? {
                identity: savedTargetRequestIdentity,
                status: 'ready',
                fit: {
                  ...fit,
                  targetExecution: {
                    ...fit.targetExecution,
                    deploymentOrder: plan.teamExecutionSnapshot?.deploymentOrder,
                  },
                },
              }
            : { identity: savedTargetRequestIdentity, status: 'mismatch' },
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
    plan,
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
    staleNotice,
    restoredTeamRatingLabel,
    savedTargetCandidateId,
    restoredTargetTeamFit,
    restoredTargetFitState,
    setRestoredTargetFitRetry,
  }
}
