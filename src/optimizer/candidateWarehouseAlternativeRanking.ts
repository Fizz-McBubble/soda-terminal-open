import type { CandidateSetPlan } from '../gameDataPacks/candidateSetPlans'
import type { AccountLoadout } from './optimizeAccountBuilds'
import { candidateSetPlanPriority } from '../gameDataPacks/candidateSetPlanPolicy'

/** Only explicit source priority ranks a physical loadout; source order cannot rank it. */
export function candidateLoadoutMatchesSetPlan(
  loadout: AccountLoadout | undefined,
  branch: CandidateSetPlan,
): boolean {
  const counts = new Map<string, number>()
  for (const { disc } of loadout?.discs ?? [])
    counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  return branch.pattern === '4+2'
    ? branch.primarySetIds.some(
        (primary) =>
          (counts.get(primary) ?? 0) >= 4 &&
          branch.secondarySetIds.some(
            (secondary) => secondary !== primary && (counts.get(secondary) ?? 0) >= 2,
          ),
      )
    : branch.primarySetIds.filter((id) => (counts.get(id) ?? 0) >= 2).length >= 3
}

export function candidateLoadoutSourcePlanRank(
  loadout: AccountLoadout | undefined,
  sourcePlans: readonly CandidateSetPlan[],
): number {
  const matches = sourcePlans.filter((branch) => candidateLoadoutMatchesSetPlan(loadout, branch))
  return matches.length
    ? Math.min(...matches.map(candidateSetPlanPriority))
    : Number.MAX_SAFE_INTEGER
}
