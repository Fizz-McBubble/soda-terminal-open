import type { AccountDecisionRun } from './calculationQueryContract'
import {
  savedTeamReplayContract,
  savedTeamReplayPlanHash,
  type SavedTeamReplayPresentation,
} from './publicSavedTeamReplay'
import { currentSavedTeamBuildIntent } from '../pages/optimizer/savedPlanFreshness'

export function projectPrivateSavedTeamReplay(
  run: AccountDecisionRun,
  planId: string,
  planHash: string,
): SavedTeamReplayPresentation {
  const plan = run.input.drafts.find((draft) => draft.id === planId)
  if (!plan || plan.kind !== 'team' || savedTeamReplayPlanHash(plan) !== planHash)
    throw new Error('已保存方案不属于当前分析，或其内容已变化。')
  const match = currentSavedTeamBuildIntent(plan, run.snapshot, run.input.warehouse) ?? null
  return {
    contract: savedTeamReplayContract,
    runId: run.runId,
    accountId: run.input.warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    planId,
    planHash,
    status: match ? 'ready' : 'unavailable',
    match,
  }
}
