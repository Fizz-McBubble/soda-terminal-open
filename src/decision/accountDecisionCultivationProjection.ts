import type { AccountRoster } from '../assault/types'
import { baseComparator } from './accountDecisionOrdering'
import type { projectAccountIntrinsicCandidates } from './accountDecisionIntrinsicProjection'
import { lightweightPriorityTier } from './accountCultivationPriority'
import {
  evaluateAccountCultivationRealInvestment,
  type AccountCultivationRealInvestment,
  type AgentRealInvestmentDetail,
} from './accountCultivationRealInvestment'

type ProjectedCandidate = ReturnType<typeof projectAccountIntrinsicCandidates>[number]

/** Evaluate inventory and permanent investment once per exact set of input facts in this run. */
export function projectAccountCultivationCandidates(
  projected: readonly ProjectedCandidate[],
  roster: AccountRoster,
) {
  const ordered = [...projected].sort(baseComparator)
  const investmentByFacts = new Map<string, AccountCultivationRealInvestment>()
  const investmentByAgent = new Map<string, AgentRealInvestmentDetail>()
  return ordered.flatMap((item) => {
    if (item.rating.status !== 'rated') return []
    const missingDiscSlots = item.account.buildCompletionDistance.missingDiscSlots
    const cacheKey = JSON.stringify([
      item.memberIds.toSorted(),
      missingDiscSlots,
      item.account.potentialGaps.map((gap) => [gap.agentId, gap.current, gap.minimum]),
    ])
    let realInvestment = investmentByFacts.get(cacheKey)
    if (!realInvestment) {
      realInvestment = evaluateAccountCultivationRealInvestment({
        memberIds: item.memberIds,
        roster,
        agentInvestmentCache: investmentByAgent,
        ...(missingDiscSlots === null
          ? {}
          : {
              targetFit: {
                status: missingDiscSlots === 0 ? ('ready' as const) : ('partial' as const),
                uniqueDiscCount: Math.max(0, 18 - missingDiscSlots),
                gaps: [],
              },
            }),
        potentialGaps: item.account.potentialGaps,
      })
      investmentByFacts.set(cacheKey, realInvestment)
    }
    const account = {
      ...item.account,
      investmentCost:
        missingDiscSlots === null ? item.account.investmentCost : realInvestment.investmentCost,
    }
    return [
      {
        ...item,
        account,
        realInvestment,
        priorityTier: lightweightPriorityTier(item.rating, account),
      },
    ]
  })
}
