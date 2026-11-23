import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import type { CoreWarehouse } from './coreFlow'
import type { AccountPlanningDraft } from './types'

export type TeamPortfolioPlanningAllocation = {
  /** Existing account discs joined with frozen solve evidence; no score is recalculated here. */
  allocation: AccountLoadout[]
  /** Saved ids which are no longer in the warehouse and were therefore not fabricated. */
  missingDiscIds: string[]
  /** Older drafts do not have frozen per-disc evidence and remain readable as history. */
  status: 'available' | 'not_recorded' | 'incomplete'
}

/** Rejoins frozen choices to the current account discs without invoking a solver. */
export function readTeamPortfolioPlanningAllocation(
  draft: Pick<AccountPlanningDraft, 'candidateWarehouse' | 'teamPortfolioDiscChoices'>,
  warehouse: Pick<CoreWarehouse, 'discs'>,
): TeamPortfolioPlanningAllocation {
  const discChoices = draft.teamPortfolioDiscChoices
  const candidateWarehouse = draft.candidateWarehouse
  if (!discChoices || !candidateWarehouse || candidateWarehouse.scope !== 'portfolio')
    return { allocation: [], missingDiscIds: [], status: 'not_recorded' }

  const discsById = new Map(warehouse.discs.map((disc) => [disc.id, disc]))
  const candidateByAgent = new Map(
    candidateWarehouse.loadouts.map((loadout) => [loadout.agentId, loadout]),
  )
  const candidateCounts = new Map<string, number>()
  const choiceCounts = new Map<string, number>()
  for (const loadout of candidateWarehouse.loadouts)
    candidateCounts.set(loadout.agentId, (candidateCounts.get(loadout.agentId) ?? 0) + 1)
  for (const loadout of discChoices.loadouts)
    choiceCounts.set(loadout.agentId, (choiceCounts.get(loadout.agentId) ?? 0) + 1)
  const missingDiscIds: string[] = []
  let missingEvidence = false
  const allocation = discChoices.loadouts.flatMap((frozenLoadout) => {
    const storedLoadout = candidateByAgent.get(frozenLoadout.agentId)
    const frozenIds = frozenLoadout.choices.map((choice) => choice.discId)
    if (
      !storedLoadout ||
      candidateCounts.get(frozenLoadout.agentId) !== 1 ||
      choiceCounts.get(frozenLoadout.agentId) !== 1 ||
      new Set(frozenIds).size !== frozenIds.length ||
      new Set(storedLoadout.discIds).size !== storedLoadout.discIds.length ||
      storedLoadout.discIds.length !== frozenIds.length ||
      frozenIds.some((id) => !storedLoadout.discIds.includes(id))
    ) {
      missingEvidence = true
      return []
    }
    const choices = frozenLoadout.choices.flatMap((frozenChoice) => {
      const disc = discsById.get(frozenChoice.discId)
      if (!disc) {
        missingDiscIds.push(frozenChoice.discId)
        return []
      }
      return [{ ...frozenChoice, disc }]
    })
    const setCounts = choices.reduce<Record<string, number>>((counts, choice) => {
      counts[choice.disc.setId] = (counts[choice.disc.setId] ?? 0) + 1
      return counts
    }, {})
    return [
      {
        agentId: frozenLoadout.agentId,
        discs: choices,
        totalScore: storedLoadout.totalScore,
        setCounts,
        setPattern: storedLoadout.setPattern,
        confidence: 'low' as const,
        scenario: '已保存多队求解快照',
        contextRationale: [],
        teamAssumptions: [],
        bangbooIds: [],
        degraded: storedLoadout.degraded,
        degradeReasons: [],
      },
    ]
  })
  return {
    allocation,
    missingDiscIds: [...new Set(missingDiscIds)],
    status: missingDiscIds.length || missingEvidence ? 'incomplete' : 'available',
  }
}
