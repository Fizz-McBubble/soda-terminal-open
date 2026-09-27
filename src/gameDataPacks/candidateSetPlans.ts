import type { AgentDiscProfile } from '../assault/engine'
import { currentDriveDiscRecommendationCatalog } from './currentDriveDiscRecommendationCatalog'

export type CandidateSetPlan = {
  pattern: '4+2' | '2+2+2'
  primarySetIds: string[]
  secondarySetIds: string[]
  /** Keep the branch's prerequisites; compiling a candidate does not prove them satisfied. */
  sourceText?: string
  /** An explicitly adopted preference; missing means equal priority, never array position. */
  priority?: number
  purpose?: 'recommended' | 'conditional' | 'transition' | 'historical'
  condition?: {
    sourceId: string
    sourceUrl: string
    sourceTextVerified: boolean
    rule:
      | { kind: 'teammate'; agentId: string }
      | { kind: 'teammate_four_piece'; setId: string }
      | { kind: 'teammate_not_four_piece'; setId: string }
      | { kind: 'electric_team' }
  }
}

const catalog = currentDriveDiscRecommendationCatalog
const knownIds = new Set(catalog.map((set) => set.id))
const setNames = [
  ...new Set(catalog.flatMap((set) => [set.id, set.name, set.englishName, ...set.aliases])),
]
  .filter((name): name is string => Boolean(name))
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const namedSet = `(?:${setNames.join('|')})`
const primaryPoolSuffix = new RegExp(`(${namedSet}(?:\\s*[/／、]\\s*${namedSet})*)\\s*$`, 'i')

/** Preserve source order. Catalogue order has no recommendation meaning. */
export function candidateSetIdsInSourceOrder(text: string): string[] {
  const hits = catalog.flatMap((set) => {
    const positions = [set.id, set.name, set.englishName, ...set.aliases]
      .filter((name): name is string => Boolean(name))
      .map((name) => text.indexOf(name))
      .filter((index) => index >= 0)
    return positions.length ? [{ id: set.id, position: Math.min(...positions) }] : []
  })
  return hits.sort((a, b) => a.position - b.position).map((hit) => hit.id)
}

function validPlan(plan: CandidateSetPlan) {
  const primary = [...new Set(plan.primarySetIds)].filter((id) => knownIds.has(id))
  const secondary = [...new Set(plan.secondarySetIds)].filter((id) => knownIds.has(id))
  if (plan.pattern === '2+2+2')
    return primary.length >= 3 ? { ...plan, primarySetIds: primary, secondarySetIds: [] } : null
  return primary.some((id) => secondary.some((other) => other !== id))
    ? { ...plan, primarySetIds: primary, secondarySetIds: secondary }
    : null
}

function explicitTwoTwoTwoPlan(sourceText: string): CandidateSetPlan | null {
  // A bare "2+2+2" is not evidence by itself. Accept only three named two-piece
  // clauses linked in one branch, so nearby alternatives cannot become a third set.
  const linked =
    /([^+＋；。！？\n]{1,80}?)\s*2\s*(?:件|pc)\s*[+＋]\s*([^+＋；。！？\n]{1,80}?)\s*2\s*(?:件|pc)\s*[+＋]\s*([^+＋；。！？\n]{1,80}?)\s*2\s*(?:件|pc)/gi
  for (const match of sourceText.matchAll(linked)) {
    const ids = match.slice(1, 4).map((part) => candidateSetIdsInSourceOrder(part))
    if (!ids.every((part) => part.length === 1)) continue
    const valid = validPlan({
      pattern: '2+2+2',
      primarySetIds: ids.map((part) => part[0]!),
      secondarySetIds: [],
      sourceText,
    })
    if (valid) return valid
  }

  // Some sources name the three sets once around an explicit 2+2+2 label rather
  // than repeating "2件". Keep the sentence local and reject a later conditional
  // clause, which may mention an unrelated replacement set.
  for (const sentence of sourceText.split(/[；。！？\n]/)) {
    const marker = /2\s*[+＋]\s*2\s*[+＋]\s*2/.exec(sentence)
    if (!marker) continue
    if (/(?:若|如果|当|条件|改用|替换|换成)/.test(sentence.slice(marker.index + marker[0].length)))
      continue
    const ids = candidateSetIdsInSourceOrder(sentence)
    if (ids.length !== 3) continue
    const valid = validPlan({
      pattern: '2+2+2',
      primarySetIds: ids,
      secondarySetIds: [],
      sourceText,
    })
    if (valid) return valid
  }
  return null
}

/**
 * Compile explicit 4/2 roles per source branch, not the cross-product of a flat list.
 * An ID-only field is a lossy legacy projection; recover its original typed plans
 * only when their complete ID set matches that field. Never invent a two-piece.
 */
export function compileCandidateSetPlans(
  directions: readonly string[],
  originalPlans?: AgentDiscProfile['setPlans'],
): CandidateSetPlan[] {
  const idOnly = directions.length > 0 && directions.every((text) => knownIds.has(text))
  const plans: CandidateSetPlan[] = []
  if (idOnly) {
    const sourceIds = new Set(directions)
    const originalIds = new Set(
      originalPlans?.flatMap((plan) => [...plan.primarySets, ...plan.secondarySets]) ?? [],
    )
    if (sourceIds.size !== originalIds.size || [...sourceIds].some((id) => !originalIds.has(id)))
      return []
    for (const plan of originalPlans ?? []) {
      const valid = validPlan({
        pattern: plan.pattern,
        primarySetIds: plan.primarySets,
        secondarySetIds: plan.secondarySets,
        ...(plan.pattern === '2+2+2' ? { purpose: 'transition' as const, priority: 100 } : {}),
      })
      if (valid) plans.push(valid)
    }
  } else {
    for (const sourceText of directions) {
      const twoTwoTwo = explicitTwoTwoTwoPlan(sourceText)
      if (twoTwoTwo) plans.push(twoTwoTwo)
      const four = /4\s*(?:件|pc)/i.exec(sourceText)
      if (!four) continue
      const remainder = sourceText.slice(four.index + four[0].length)
      // Only an explicitly connected '+ ... 2件' clause belongs to this four-piece.
      const two = /^\s*[+＋]\s*(.*?)2\s*(?:件|pc)/i.exec(remainder)
      if (!two) continue
      // A set mentioned in a prerequisite belongs to the team, not this agent's
      // four-piece pool. Read only the named pool immediately before the count.
      const primaryText = primaryPoolSuffix.exec(sourceText.slice(0, four.index))?.[1] ?? ''
      const primary = candidateSetIdsInSourceOrder(primaryText)
      const secondary = candidateSetIdsInSourceOrder(two[1]!)
      const valid = validPlan({
        pattern: '4+2',
        primarySetIds: primary,
        secondarySetIds: secondary,
        sourceText,
      })
      if (valid) plans.push(valid)
    }
  }
  return plans.filter(
    (plan, index) =>
      plans.findIndex(
        (other) =>
          other.pattern === plan.pattern &&
          other.primarySetIds.join('|') === plan.primarySetIds.join('|') &&
          other.secondarySetIds.join('|') === plan.secondarySetIds.join('|') &&
          other.sourceText === plan.sourceText,
      ) === index,
  )
}
