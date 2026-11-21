import {
  calculationQueryContractVersion,
  type AccountDecisionRun,
  type CalculationQueryClient,
} from '../application/calculationQueryContract'
import type { useAccountDecisionWorld } from '../application/accountDecisionWorldHooks'
import type { useF5AccountSummary } from '../components/f5AccountSummaryContext'
import type { LastCompleteAnalysis } from './teamAnalysisSession'
import { acceptTeamOverviewPresentation } from './teamLoadoutPresentationDto'
import type { TeamLoadoutOverviewModel } from './teamLoadoutOverviewTypes'
import { browserCalculationInputFingerprint } from '../application/browserCalculationInputFingerprint'

export const teamAnalysisStages = [
  '读取角色和驱动盘',
  '查看已保存的方案',
  '寻找适合的队伍',
  '整理队伍建议',
  '准备分析结果',
] as const

export function canRestoreCurrentTeamAnalysisSession(
  accountSummary: ReturnType<typeof useF5AccountSummary>,
  decisionWorld: CurrentDecisionWorld | null,
) {
  return Boolean(
    accountSummary &&
    !accountSummary.hydrating &&
    accountSummary.accountId &&
    decisionWorld &&
    decisionWorld.status === 'current' &&
    decisionWorld.run.input.warehouse.accountId === accountSummary.accountId &&
    decisionWorld.run.snapshot.fingerprint.inputHash === decisionWorld.liveFingerprint,
  )
}

type CurrentDecisionWorld = {
  status: 'current'
  run: AccountDecisionRun
  liveFingerprint: string
}

export function currentDecisionWorldForRecovery(
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>,
): CurrentDecisionWorld | null {
  if (decisionWorld.status !== 'current') return null
  return {
    status: 'current',
    run: decisionWorld.run,
    liveFingerprint: decisionWorld.liveFingerprint,
  }
}

/** Rebind only the same account and exact input; detached remaining-BOX runs keep their source. */
export function reconcileEquivalentTeamAnalysis(
  previous: LastCompleteAnalysis,
  account: { accountId: string; appSessionId: string },
  world: CurrentDecisionWorld,
  overviewModel: TeamLoadoutOverviewModel,
): LastCompleteAnalysis | null {
  const result = previous.result
  const { run, liveFingerprint } = world
  const sourceRunId = result.sourceRunId ?? result.analysisRunId
  if (
    (previous.kind === 'stale' && previous.reason !== 'world_transition') ||
    result.appSessionId !== account.appSessionId ||
    result.warehouse.accountId !== account.accountId ||
    run.input.warehouse.accountId !== account.accountId ||
    result.inputFingerprint !== liveFingerprint ||
    run.inputFingerprint !== liveFingerprint ||
    run.snapshot.fingerprint.inputHash !== liveFingerprint ||
    (run.runId !== sourceRunId &&
      (Boolean(result.sourceRunId) ||
        !result.inputReadFingerprint ||
        result.inputReadFingerprint !== browserCalculationInputFingerprint(run.input)))
  )
    return null
  if (run.runId === sourceRunId)
    return previous.kind === 'complete' ? previous : { kind: 'complete', result }
  return {
    kind: 'complete',
    result: {
      ...result,
      analysisRunId: run.runId,
      warehouse: run.input.warehouse,
      decisionSnapshot: run.snapshot,
      capturedAt: new Date(run.capturedAt),
      overviewModel,
      targetTeamFits: {},
      teamRoutePresentations: undefined,
      fitOverviewModel: undefined,
    },
  }
}

export function currentTeamOverviewFromQuery(run: AccountDecisionRun) {
  return (
    acceptTeamOverviewPresentation(run.teamPresentation, {
      runId: run.runId,
      accountId: run.input.warehouse.accountId ?? '',
      inputFingerprint: run.snapshot.fingerprint.inputHash,
      agentId: null,
      planId: null,
      discId: null,
    })?.overviewModel ?? null
  )
}

export async function loadCurrentTeamOverviewFromQuery(
  run: AccountDecisionRun,
  calculationClient?: CalculationQueryClient | null,
): Promise<TeamLoadoutOverviewModel | null> {
  const direct = currentTeamOverviewFromQuery(run)
  if (direct) return direct
  if (!calculationClient || typeof calculationClient.queryTeamOverviewPresentation !== 'function')
    return null
  const projected = await calculationClient.queryTeamOverviewPresentation({
    contractVersion: calculationQueryContractVersion,
    kind: 'team_overview_presentation',
    runId: run.runId,
    context: { agentId: null, planId: null, discId: null },
  })
  return (
    acceptTeamOverviewPresentation(projected, {
      runId: run.runId,
      accountId: run.input.warehouse.accountId ?? '',
      inputFingerprint: run.snapshot.fingerprint.inputHash,
      agentId: null,
      planId: null,
      discId: null,
    })?.overviewModel ?? null
  )
}

/**
 * This is intentionally an in-memory projection, not a persisted team result.
 * The shared run is already current and input-fingerprint checked by the world;
 * rebuilding this view never invokes a solver or writes account data.
 */
export function restoreCurrentTeamAnalysisSession(
  accountSummary: NonNullable<ReturnType<typeof useF5AccountSummary>>,
  decisionWorld: CurrentDecisionWorld,
  teamKey: string | null,
  suppliedOverviewModel?: TeamLoadoutOverviewModel | null,
): LastCompleteAnalysis | null {
  const { run } = decisionWorld
  if (
    run.input.warehouse.accountId !== accountSummary.accountId ||
    run.snapshot.fingerprint.inputHash !== decisionWorld.liveFingerprint
  )
    return null
  const overviewModel = suppliedOverviewModel ?? currentTeamOverviewFromQuery(run)
  if (!overviewModel) return null
  if (
    teamKey !== null &&
    !overviewModel.groups.some((group) =>
      group.items.some((family) =>
        family.variants.some((variant) => variant.detailCandidateId === teamKey),
      ),
    )
  )
    return null
  return {
    kind: 'complete',
    result: {
      appSessionId: accountSummary.appSessionId,
      analysisRunId: run.runId,
      warehouse: run.input.warehouse,
      overviewModel,
      decisionSnapshot: run.snapshot,
      capturedAt: new Date(run.capturedAt),
      inputFingerprint: run.snapshot.fingerprint.inputHash,
      inputReadFingerprint: browserCalculationInputFingerprint(run.input),
      targetTeamFits: {},
    },
  }
}

export function waitForAnalysisStage() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0))
}

export function retainTeamAnalysisAfterCancellation(
  previous: LastCompleteAnalysis | null,
  account: ReturnType<typeof useF5AccountSummary>,
  world: ReturnType<typeof useAccountDecisionWorld>,
): LastCompleteAnalysis | null {
  if (
    !previous ||
    !account?.accountId ||
    account.accountId !== previous.result.warehouse.accountId ||
    account.appSessionId !== previous.result.appSessionId
  )
    return null
  const { result } = previous
  const liveInput = world.liveInput
  const factualInputChanged =
    liveInput &&
    liveInput.warehouse.accountId === result.warehouse.accountId &&
    result.inputReadFingerprint &&
    browserCalculationInputFingerprint(liveInput) !== result.inputReadFingerprint
  const decisionInputChanged =
    (world.status === 'current' || world.status === 'stale') &&
    world.run.input.warehouse.accountId === result.warehouse.accountId &&
    world.liveFingerprint !== result.inputFingerprint
  if (previous.kind === 'stale' || (!factualInputChanged && !decisionInputChanged)) return previous
  return { kind: 'stale', reason: 'world_transition', result }
}

export function retainTeamAnalysisAfterSavedPlanDeletion(
  previous: LastCompleteAnalysis,
  savedPlanId: string,
  contextNote?: string,
): LastCompleteAnalysis {
  const overviewItemId = savedPlanId.startsWith('saved:') ? savedPlanId : `saved:${savedPlanId}`
  const planId = savedPlanId.replace(/^saved:/, '')
  return {
    kind: 'stale',
    result: {
      ...previous.result,
      reservations: previous.result.reservations?.filter((item) => item.planId !== planId),
      fitOverviewModel: undefined,
      overviewModel: {
        ...previous.result.overviewModel,
        contextNote: contextNote ?? previous.result.overviewModel.contextNote,
        groups: previous.result.overviewModel.groups.map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              item.id !== overviewItemId &&
              !item.variants.some((variant) => variant.id === overviewItemId),
          ),
        })),
      },
    },
  }
}
