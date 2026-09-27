import type { AccountDecisionRun } from '../application/calculationQueryContract'
import type { useAccountDecisionWorld } from '../application/accountDecisionWorldHooks'
import type { useF5AccountSummary } from '../components/f5AccountSummaryContext'
import type { LastCompleteAnalysis } from './teamAnalysisSession'
import { acceptTeamOverviewPresentation } from './teamLoadoutPresentationDto'

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

/**
 * This is intentionally an in-memory projection, not a persisted team result.
 * The shared run is already current and input-fingerprint checked by the world;
 * rebuilding this view never invokes a solver or writes account data.
 */
export function restoreCurrentTeamAnalysisSession(
  accountSummary: NonNullable<ReturnType<typeof useF5AccountSummary>>,
  decisionWorld: CurrentDecisionWorld,
  teamKey: string | null,
): LastCompleteAnalysis | null {
  const { run } = decisionWorld
  if (
    run.input.warehouse.accountId !== accountSummary.accountId ||
    run.snapshot.fingerprint.inputHash !== decisionWorld.liveFingerprint
  )
    return null
  const overviewModel = currentTeamOverviewFromQuery(run)
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
      targetTeamFits: {},
    },
  }
}

export function waitForAnalysisStage() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0))
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
