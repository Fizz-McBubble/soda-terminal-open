import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'

type Candidate = Pick<AccountLoadout, 'totalScore' | 'setPattern' | 'degraded'> & {
  discs: readonly { disc: { id: string }; effectiveRolls: number }[]
}
/** Preserve the chosen physical candidate and its recorded score, without re-solving. */
export function savedAgentCandidateWarehouse(
  agentId: string,
  candidatePlan: Pick<CandidateWarehousePlan, 'inventoryTransition' | 'totalScore' | 'boundary'>,
  candidate: Candidate,
): NonNullable<AccountPlanningDraft['candidateWarehouse']> {
  return {
    ...(candidatePlan.inventoryTransition ? { inventoryTransition: true as const } : {}),
    scope: 'agent',
    totalScore: candidatePlan.totalScore,
    loadouts: [
      {
        agentId,
        totalScore: candidate.totalScore,
        discIds: candidate.discs.map((item) => item.disc.id),
        effectiveRolls: candidate.discs.reduce((total, item) => total + item.effectiveRolls, 0),
        setPattern: candidate.setPattern,
        degraded: candidate.degraded,
      },
    ],
    boundary: candidatePlan.boundary,
  }
}
