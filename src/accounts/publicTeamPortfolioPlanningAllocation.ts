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
  const missingDiscIds: string[] = []
  const allocation = discChoices.loadouts.map((frozenLoadout) => {
    const storedLoadout = candidateByAgent.get(frozenLoadout.agentId)
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
    return {
      agentId: frozenLoadout.agentId,
      discs: choices,
      totalScore: storedLoadout?.totalScore ?? 0,
      setCounts,
      setPattern: storedLoadout?.setPattern ?? '2+2+2',
      confidence: 'low' as const,
      scenario: '已保存多队求解快照',
      contextRationale: [],
      teamAssumptions: [],
      bangbooIds: [],
      degraded: storedLoadout?.degraded ?? true,
      degradeReasons: storedLoadout ? [] : ['候选仓库快照缺失。'],
    }
  })
  return {
    allocation,
    missingDiscIds: [...new Set(missingDiscIds)],
    status: missingDiscIds.length ? 'incomplete' : 'available',
  }
}
