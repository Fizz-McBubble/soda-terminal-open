import { candidateSetPlanIdentity } from '../gameDataPacks/candidateSetPlanPolicy'
import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import type { Decision } from './absoluteDiscRetentionContract'
import type { WarehouseDemandContext } from './warehouseDemandContexts'

export function warehouseInvestmentBranchKey(
  agentId: string,
  branch: string,
  plan: CandidateSetPlan,
) {
  return JSON.stringify([agentId, branch, candidateSetPlanIdentity(plan)])
}

export function investmentTrialContextIds(
  retention: Pick<Decision, 'nextAction' | 'evidence' | 'witnessProfileIds'>,
  branchByProfileId: ReadonlyMap<string, string>,
  eligibleContextIdsByBranch: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> | undefined {
  const { nextAction } = retention
  if (nextAction.kind !== 'try_upgrade' || nextAction.targetLevel === null) return
  const ids = new Set<string>()
  for (const witness of retention.evidence) {
    if (
      witness.useState !== 'valid' ||
      witness.investment.nextLevel !== nextAction.targetLevel ||
      !retention.witnessProfileIds.includes(witness.profileId)
    )
      continue
    const branch = branchByProfileId.get(witness.profileId)
    if (!branch) continue
    for (const id of eligibleContextIdsByBranch.get(branch) ?? []) ids.add(id)
  }
  return ids
}

export function eligibleInvestmentContextsByBranch(contexts: readonly WarehouseDemandContext[]) {
  const result = new Map<string, string[]>()
  for (const context of contexts) {
    if (context.eligibility !== 'eligible') continue
    const ids = result.get(context.investmentBranchKey) ?? []
    ids.push(context.id)
    result.set(context.investmentBranchKey, ids)
  }
  return result
}
