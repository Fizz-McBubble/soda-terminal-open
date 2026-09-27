import type { DiscContribution } from './optimizeBuild'

/** Input is score-sorted and already filtered for legal set, slot, main stat and fixed disc.
 * Preserve the global score front plus topK representatives of every surviving set.
 * This is a bounded candidate search, not a proof of the global optimum.
 */
export function retainSetRepresentatives(
  candidates: DiscContribution[],
  limit: number,
  topK: number,
): DiscContribution[] {
  const retainedIds = new Set(
    candidates.slice(0, Math.max(0, Math.floor(limit))).map((item) => item.disc.id),
  )
  const perSet = new Map<string, number>()
  const representatives = Math.max(1, Math.floor(topK))
  for (const candidate of candidates) {
    const count = perSet.get(candidate.disc.setId) ?? 0
    if (count >= representatives) continue
    retainedIds.add(candidate.disc.id)
    perSet.set(candidate.disc.setId, count + 1)
  }
  return candidates.filter((item) => retainedIds.has(item.disc.id))
}
