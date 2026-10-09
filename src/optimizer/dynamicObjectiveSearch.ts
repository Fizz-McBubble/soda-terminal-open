import { canonical, finite, integer } from '../calculation/dynamic/numeric'
import {
  compareObjective,
  functionalSatisfied,
  type ObjectiveEvaluation,
  type EffectDeltaBound,
} from '../calculation/dynamic/objectiveEvidence'
export type RawSearchDisc = {
  id: string
  slot: number
  factsKey: string
}
export type RawSearchDomain<D extends RawSearchDisc> = {
  agentId: string
  slots: readonly (readonly D[])[]
  isLegal: (discs: readonly D[]) => boolean
}
export type RawAssignment<D extends RawSearchDisc> = Readonly<Record<string, readonly D[]>>
export type EvaluatedAssignment<D extends RawSearchDisc> = {
  loadouts: RawAssignment<D>
  evaluation: ObjectiveEvaluation
}
export type SearchBudget = {
  nodes: number
  evaluations: number
}
/** Full objective is invoked inside candidate generation. Heuristics order visits, never prune.
 * Raw domains must already enforce game legality and explicit player locks, not guide rank or top-K.
 * Finite budgets do not prove global optimality. Unknown-valued feasible candidates are retained.
 */
export function searchDynamicAssignments<D extends RawSearchDisc>(input: {
  domains: readonly RawSearchDomain<D>[]
  seeds: readonly RawAssignment<D>[]
  evaluate: (assignment: RawAssignment<D>) => ObjectiveEvaluation
  hint?: (disc: D, agentId: string, anchor: EvaluatedAssignment<D> | null) => number
  differenceBounds?: (
    before: ObjectiveEvaluation,
    after: ObjectiveEvaluation,
  ) => readonly EffectDeltaBound[]
  budget: SearchBudget
}) {
  integer(input.budget.nodes, 'nodes', 1, 100000000)
  integer(input.budget.evaluations, 'evaluations', 1, 10000000)
  if (
    !input.domains.length ||
    new Set(input.domains.map((x) => x.agentId)).size !== input.domains.length
  )
    throw new Error('invalid_domains')
  const facts = new Map<string, string>()
  for (const d of input.domains) {
    if (d.slots.length !== 6) throw new Error('need_six_slots')
    d.slots.forEach((pool, s) => {
      const seen = new Set<string>()
      for (const disc of pool) {
        if (!disc.id || !disc.factsKey || disc.slot !== s + 1 || seen.has(disc.id))
          throw new Error('invalid_pool')
        seen.add(disc.id)
        if (facts.has(disc.id) && facts.get(disc.id) !== disc.factsKey)
          throw new Error('conflicting_physical_facts')
        facts.set(disc.id, disc.factsKey)
      }
    })
  }
  const membership = new Map(
    input.domains.map((d) => [
      d.agentId,
      d.slots.map((pool) => new Map(pool.map((disc) => [disc.id, disc.factsKey]))),
    ]),
  )
  let best: EvaluatedAssignment<D> | null = null,
    nodes = 0,
    evaluations = 0,
    exhausted = false,
    legalCount = 0
  const currentBest = (): EvaluatedAssignment<D> | null => best
  const seen = new Set<string>(),
    evaluated: EvaluatedAssignment<D>[] = [],
    unresolved: EvaluatedAssignment<D>[] = []
  const key = (a: RawAssignment<D>) =>
    canonical(
      Object.fromEntries(
        Object.entries(a)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([id, ds]) => [
            id,
            [...ds].sort((x, y) => x.slot - y.slot).map((d) => [d.id, d.factsKey]),
          ]),
      ),
    )
  const legal = (a: RawAssignment<D>) => {
    if (Object.keys(a).length !== input.domains.length) return false
    const used = new Set<string>()
    return input.domains.every((d) => {
      const ds = a[d.agentId]
      if (!ds || ds.length !== 6 || new Set(ds.map((x) => x.slot)).size !== 6) return false
      return (
        ds.every((x) => {
          if (used.has(x.id) || membership.get(d.agentId)?.[x.slot - 1]?.get(x.id) !== x.factsKey)
            return false
          used.add(x.id)
          return true
        }) && d.isLegal(ds)
      )
    })
  }
  const consider = (raw: RawAssignment<D>) => {
    if (!legal(raw)) return
    const k = key(raw)
    if (seen.has(k)) return
    if (evaluations >= input.budget.evaluations) {
      exhausted = true
      return
    }
    seen.add(k)
    legalCount++
    evaluations++
    const loadouts = structuredClone(raw)
    const immutableKey = canonical(loadouts)
    const evaluation = input.evaluate(loadouts),
      row = { loadouts, evaluation }
    if (canonical(loadouts) !== immutableKey) throw new Error('evaluation_mutated_assignment')
    evaluated.push(row)
    const self = compareObjective(evaluation, evaluation)
    if (self.verdict === 'unresolved' || !functionalSatisfied(evaluation)) {
      unresolved.push(row)
      return
    }
    if (!best) {
      best = row
      return
    }
    const compared = compareObjective(
      best.evaluation,
      evaluation,
      input.differenceBounds?.(best.evaluation, evaluation),
    )
    if (compared.verdict === 'candidate_better') best = row
    else if (compared.verdict === 'unresolved') unresolved.push(row)
  }
  for (const seed of input.seeds) {
    consider(seed)
    if (exhausted) break
  }
  // Paired changes include cross-agent physical-disc exchanges; no per-slot top-K truncation.
  const positions = input.domains.flatMap((d) =>
    d.slots.map((pool, slot) => ({ agent: d.agentId, slot, pool })),
  )
  const orderCache = new Map<string, D[]>()
  const ordered = (p: (typeof positions)[number]) => {
    const cacheKey = `${p.agent}:${p.slot}:${best?.evaluation.inputKey ?? ''}`
    const cached = orderCache.get(cacheKey)
    if (cached) return cached
    const sorted = [...p.pool].sort((a, b) => {
      const av = input.hint?.(a, p.agent, best) ?? 0,
        bv = input.hint?.(b, p.agent, best) ?? 0
      return (
        (Number.isFinite(bv) ? bv : 0) - (Number.isFinite(av) ? av : 0) || a.id.localeCompare(b.id)
      )
    })
    orderCache.set(cacheKey, sorted)
    return sorted
  }
  const localLimit = Math.floor(input.budget.evaluations * 0.6),
    localNodeLimit = Math.floor(input.budget.nodes * 0.6)
  const copy = (a: RawAssignment<D>): Record<string, D[]> =>
    Object.fromEntries(
      Object.entries(a).map(([id, ds]) => [id, [...ds].sort((l, r) => l.slot - r.slot)]),
    )
  // Round-robin visits give every slot/member a chance before a large first
  // pool consumes the budget. Accepting a move changes the next full anchor.
  for (let round = 0; round < 3; round++) {
    const anchor = currentBest()
    if (!anchor) break
    const startKey = anchor.evaluation.inputKey
    const pools = positions.map(ordered)
    const singleLimit = evaluations + Math.floor((localLimit - evaluations) * 0.65)
    single: for (let offset = 0; offset < Math.max(...pools.map((pool) => pool.length)); offset++) {
      for (let i = 0; i < positions.length; i++) {
        if (evaluations >= singleLimit || nodes >= localNodeLimit) break single
        const p = positions[i]!,
          disc = pools[i]![offset]
        if (!disc) continue
        nodes++
        const a = copy(currentBest()!.loadouts)
        a[p.agent]![p.slot] = disc
        consider(a)
      }
    }
    // Paired hints are only a budgeted visit order. The remaining raw DFS
    // still contains every legal combination, including arbitrary set jumps.
    pairs: for (let offset = 0; offset < 4; offset++) {
      for (let i = 0; i < positions.length; i++)
        for (let j = i + 1; j < positions.length; j++) {
          if (evaluations >= localLimit || nodes >= localNodeLimit) break pairs
          const p = positions[i]!,
            q = positions[j]!
          const x = ordered(p)[offset],
            y = ordered(q)[offset]
          if (!x || !y) continue
          nodes++
          const a = copy(currentBest()!.loadouts)
          a[p.agent]![p.slot] = x
          a[q.agent]![q.slot] = y
          consider(a)
        }
    }
    if (
      currentBest()!.evaluation.inputKey === startKey ||
      evaluations >= localLimit ||
      nodes >= localNodeLimit
    )
      break
  }
  const selected: Record<string, D[]> = Object.fromEntries(
    input.domains.map((d) => [d.agentId, []]),
  )
  const used = new Set<string>()
  const walk = (depth: number): void => {
    if (exhausted) return
    if (nodes >= input.budget.nodes) {
      exhausted = true
      return
    }
    nodes++
    if (depth === positions.length) {
      consider(selected)
      return
    }
    const p = positions[depth]!
    for (const disc of ordered(p)) {
      if (used.has(disc.id)) continue
      used.add(disc.id)
      selected[p.agent]!.push(disc)
      walk(depth + 1)
      selected[p.agent]!.pop()
      used.delete(disc.id)
      if (exhausted) return
    }
  }
  walk(0)
  for (const r of evaluated)
    if (r.evaluation.modeledValue !== null) finite(r.evaluation.modeledValue, 'objective_value', 0)
  return {
    best: currentBest(),
    evaluated,
    unresolved,
    nodes,
    evaluations,
    legalCount,
    status: exhausted
      ? ('budget_exhausted' as const)
      : !legalCount
        ? ('proven_infeasible' as const)
        : currentBest()
          ? ('complete' as const)
          : ('objective_unresolved' as const),
    exactWithinDeclaredModel:
      !exhausted &&
      unresolved.length === 0 &&
      currentBest() !== null &&
      evaluated.every((r) => r.evaluation.gaps.length === 0 && r.evaluation.error === 0),
    domain: 'supplied_raw_legal_domains' as const,
    productionGameAccuracyCertified: false as const,
  }
}
