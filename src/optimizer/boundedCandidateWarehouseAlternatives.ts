import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from './candidateWarehouseSolver'
import { compareCandidatePanelObjective } from './optimizeBuild'

/** Explore every replaceable slot of each visited plan within a fixed solve budget.
 * The results are useful alternatives, not a proof of global Top-K completeness.
 */
export function boundedAlternatives(
  discs: DriveDisc[],
  limit: number,
  expectedAgentIds: readonly string[],
  solve: (excluded: string[]) => CandidateWarehousePlan,
  protectedDiscIds: readonly string[] = [],
) {
  if (!Number.isFinite(limit) || limit <= 0) return []
  const count = Math.min(Math.floor(limit), 10)
  const budget = Math.min(1 + expectedAgentIds.length * 6 * count, 25)
  const initial = solve([])
  const complete = (plan: CandidateWarehousePlan) => {
    const loadoutAgentIds = plan.loadouts.map((loadout) => loadout.agentId)
    const discIds = plan.loadouts.flatMap((loadout) =>
      loadout.discs.map((choice) => choice.disc.id),
    )
    return (
      expectedAgentIds.length > 0 &&
      new Set(expectedAgentIds).size === expectedAgentIds.length &&
      plan.loadouts.length === expectedAgentIds.length &&
      new Set(loadoutAgentIds).size === loadoutAgentIds.length &&
      expectedAgentIds.every((agentId) => loadoutAgentIds.includes(agentId)) &&
      plan.loadouts.every((loadout) => loadout.discs.length === 6) &&
      discIds.length === expectedAgentIds.length * 6 &&
      new Set(discIds).size === discIds.length
    )
  }
  if (!complete(initial)) return []
  const key = (plan: CandidateWarehousePlan) =>
    plan.loadouts
      .map(
        (item) =>
          `${item.agentId}:${item.discs
            .map((choice) => choice.disc.id)
            .sort()
            .join('|')}`,
      )
      .sort()
      .join(';')
  const candidates = new Map([[key(initial), initial]])
  const compare = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) =>
    compareCandidatePanelObjective(
      a.loadouts.find((item) => item.panelObjective)?.panelObjective,
      b.loadouts.find((item) => item.panelObjective)?.panelObjective,
    ) ||
    b.totalScore - a.totalScore ||
    key(a).localeCompare(key(b))
  const frontier = [{ plan: initial, excluded: [] as string[] }]
  const visited = new Set([''])
  let calls = 1
  while (frontier.length && calls < budget && candidates.size < count) {
    frontier.sort((a, b) => compare(a.plan, b.plan))
    const next = frontier.shift()!
    for (const choice of next.plan.loadouts.flatMap((item) => item.discs)) {
      // Exploration changes only replaceable choices, never the user's fixed disc.
      if (protectedDiscIds.includes(choice.disc.id)) continue
      // Excluding a globally unique slot cannot produce a complete alternative.
      if (
        !discs.some(
          (disc) =>
            disc.slot === choice.disc.slot &&
            disc.id !== choice.disc.id &&
            !next.excluded.includes(disc.id),
        )
      )
        continue
      const excluded = [...next.excluded, choice.disc.id].sort()
      const exclusionKey = excluded.join('|')
      if (visited.has(exclusionKey)) continue
      if (calls >= budget) break
      visited.add(exclusionKey)
      calls += 1
      const plan = solve(excluded)
      if (!complete(plan)) continue
      // Exclusions used to explore alternatives must not make a weaker-provenance
      // fallback displace an already feasible source recommendation.
      if (!initial.inventoryTransition && plan.inventoryTransition) continue
      const planKey = key(plan)
      if (!candidates.has(planKey)) candidates.set(planKey, plan)
      frontier.push({ plan, excluded })
    }
  }
  return [...candidates.values()].sort(compare).slice(0, count)
}
