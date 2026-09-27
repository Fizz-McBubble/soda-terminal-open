import type { AccountLoadout } from './optimizeAccountBuilds'

export type ExactTeamWarehouseFitOracleResult = {
  method: 'exact_oracle'
  exactWithinSuppliedCandidateDomain: true
  loadouts: AccountLoadout[]
  totalScore: number
  inspectedAssignmentCount: number
}

export function loadoutKey(loadouts: readonly AccountLoadout[]) {
  return loadouts
    .map(
      (loadout) =>
        `${loadout.agentId}:${loadout.discs
          .map((choice) => choice.disc.id)
          .toSorted((left, right) => left.localeCompare(right))
          .join(',')}`,
    )
    .join('|')
}

/**
 * Exact oracle for small fixtures or bounded candidate domains. It deliberately accepts already
 * generated loadout candidates so production candidate generation and oracle assignment remain
 * separate, reviewable contracts.
 */
export function solveExactTeamWarehouseFitOracle(
  agentIds: readonly string[],
  candidatesByAgent: ReadonlyMap<string, readonly AccountLoadout[]>,
): ExactTeamWarehouseFitOracleResult {
  let inspectedAssignmentCount = 0
  let best: AccountLoadout[] = []
  let bestScore = Number.NEGATIVE_INFINITY
  let bestKey = ''

  const visit = (index: number, selected: AccountLoadout[], usedDiscIds: Set<string>) => {
    if (index === agentIds.length) {
      inspectedAssignmentCount += 1
      const totalScore = selected.reduce((sum, loadout) => sum + loadout.totalScore, 0)
      const key = loadoutKey(selected)
      if (totalScore > bestScore || (totalScore === bestScore && (!bestKey || key < bestKey))) {
        best = [...selected]
        bestScore = totalScore
        bestKey = key
      }
      return
    }
    for (const loadout of candidatesByAgent.get(agentIds[index]!) ?? []) {
      const discIds = loadout.discs.map((choice) => choice.disc.id)
      if (discIds.some((discId) => usedDiscIds.has(discId))) continue
      discIds.forEach((discId) => usedDiscIds.add(discId))
      selected.push(loadout)
      visit(index + 1, selected, usedDiscIds)
      selected.pop()
      discIds.forEach((discId) => usedDiscIds.delete(discId))
    }
  }
  visit(0, [], new Set())

  return {
    method: 'exact_oracle',
    exactWithinSuppliedCandidateDomain: true,
    loadouts: best,
    totalScore: Number.isFinite(bestScore) ? Math.round(bestScore * 100) / 100 : 0,
    inspectedAssignmentCount,
  }
}
