/** Physical identity is a final tie breaker, not a numerical search feature. */
export type CandidateSearchDisc = {
  id: string
  setId: string
  slot: number
  level: number
  rarity?: string
  mainStat: string
  subStats: readonly { stat: string; value: number; upgrades: number }[]
}

export function candidateDiscFactKey(disc: CandidateSearchDisc): string {
  return JSON.stringify([
    disc.setId,
    disc.slot,
    disc.rarity ?? null,
    disc.level,
    disc.mainStat,
    disc.subStats
      .map(({ stat, value, upgrades }) => [stat, value, upgrades])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ])
}

export function compareCandidateDiscFacts(left: CandidateSearchDisc, right: CandidateSearchDisc) {
  const order =
    left.setId.localeCompare(right.setId) ||
    left.slot - right.slot ||
    (left.rarity ?? '').localeCompare(right.rarity ?? '') ||
    left.level - right.level ||
    left.mainStat.localeCompare(right.mainStat)
  if (order) return order
  const stats = (disc: CandidateSearchDisc) =>
    [...disc.subStats].sort(
      (a, b) => a.stat.localeCompare(b.stat) || a.value - b.value || a.upgrades - b.upgrades,
    )
  const a = stats(left),
    b = stats(right)
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const statOrder =
      a[index]!.stat.localeCompare(b[index]!.stat) ||
      a[index]!.value - b[index]!.value ||
      a[index]!.upgrades - b[index]!.upgrades
    if (statOrder) return statOrder
  }
  return a.length - b.length || left.id.localeCompare(right.id)
}

export type SearchPanelObjective = {
  attackDeficit: number
  anomalyProficiency: number
  energyRegen?: number
  priorityStat?: 'anomalyProficiency' | 'energyRegen'
}

/** Existing comparator semantics; parity is verified against the application. */
export function compareCandidatePanelPriority(
  left?: SearchPanelObjective,
  right?: SearchPanelObjective,
) {
  if (!left || !right) return 0
  const stat = left.priorityStat ?? 'anomalyProficiency'
  if (stat !== (right.priorityStat ?? 'anomalyProficiency')) return 0
  return left.attackDeficit - right.attackDeficit || (right[stat] ?? 0) - (left[stat] ?? 0)
}
