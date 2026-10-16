import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { refineComparableCandidatePool } from '../optimizer/refineComparableCandidatePool'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'

const key = (discs: readonly DriveDisc[]) =>
  JSON.stringify(discs.toSorted((a, b) => a.slot - b.slot).map((disc) => disc.id))
const records = (plan: CandidateWarehousePlan) => plan.loadouts[0]!.discs.map((row) => row.disc)

/** Cover each legal main-stat/set branch before spending the budget on its variants. */
function interleaveBranches(pool: readonly DriveDisc[]) {
  const groups = new Map<string, DriveDisc[]>()
  for (const disc of pool) {
    const branch = `${disc.mainStat}:${disc.setId}`
    const rows = groups.get(branch) ?? []
    rows.push(disc)
    groups.set(branch, rows)
  }
  const columns = [...groups.values()]
  return Array.from({ length: Math.max(0, ...columns.map((rows) => rows.length)) }, (_, index) =>
    columns.flatMap((rows) => (rows[index] ? [rows[index]!] : [])),
  ).flat()
}

/** A bounded neighbourhood of the declared settlement, never a full-cycle objective.
 * Coverage exclusions remain on the original benchmark; none are assumed to cancel.
 * Unresolved/source-distinct candidate positions remain untouched. */
export function searchPreparedAnomalyCandidates(input: {
  candidates: readonly CandidateWarehousePlan[]
  initial: DriveDisc[]
  pools: readonly DriveDisc[][]
  compile: (discs: DriveDisc[]) => CandidateWarehousePlan | null
  side: (discs: DriveDisc[]) => ValueBenchmarkSide
  fixedDiscId?: string
  equippedIds: readonly string[]
  evaluationBudget: number
}) {
  const budget = Number.isFinite(input.evaluationBudget)
    ? Math.max(1, Math.min(384, Math.floor(input.evaluationBudget)))
    : 384
  const baseline = input.side(input.initial)
  const initialPlan = input.compile(input.initial)
  const originals = input.candidates.length ? input.candidates : initialPlan ? [initialPlan] : []
  const baselinePanel = initialPlan?.loadouts[0]?.panelObjective
  const sides = new Map<string, ValueBenchmarkSide>()
  let exhausted = false
  let nodes = 0
  const side = (discs: DriveDisc[]) => {
    const id = key(discs)
    if (!sides.has(id)) {
      if (sides.size >= budget) {
        exhausted = true
        return null
      }
      sides.set(id, input.side(discs))
    }
    return sides.get(id)!
  }
  const protectedStats = ['impact', 'enerRegen', 'anomMas', 'anomProf'] as const
  const eligible = (plan: CandidateWarehousePlan) => {
    if (!input.compile(records(plan))) return false
    const current = side(records(plan))
    if (!current || current.coverage?.domain !== 'prepared_anomaly_settlement') return false
    if (!baseline.functionalStats32 || !current.functionalStats32) return false
    if (
      protectedStats.some((stat) => {
        const before = baseline.functionalStats32![stat]
        const after = current.functionalStats32![stat]
        return !Number.isFinite(before) || !Number.isFinite(after) || after + 1e-9 < before
      })
    )
      return false
    const panel = plan.loadouts[0]?.panelObjective
    const priority = baselinePanel?.priorityStat ?? 'anomalyProficiency'
    const beforePriority =
      priority === 'source' ? baselinePanel?.hpDeficit : baselinePanel?.[priority]
    const afterPriority = priority === 'source' ? panel?.hpDeficit : panel?.[priority]
    if (
      baselinePanel &&
      (!panel ||
        panel.attackDeficit > baselinePanel.attackDeficit ||
        !Number.isFinite(beforePriority) ||
        !Number.isFinite(afterPriority) ||
        (priority === 'source'
          ? panel.priorityStat !== 'source' || afterPriority! > beforePriority!
          : afterPriority! < beforePriority!))
    )
      return false
    return compareValueBenchmarkSides({
      baseline,
      candidate: current,
      changedDimensions: ['disc_loadout'],
      labels: { baseline: '同条件单次异常', candidate: '同条件单次异常' },
    }).comparable
  }
  const coverage = (plan: CandidateWarehousePlan) => {
    const value = side(records(plan))?.coverage
    return JSON.stringify([
      plan.inventoryTransition ?? false,
      plan.loadouts[0]?.degraded ?? false,
      [...(value?.includedEffectKeys ?? [])].sort(),
      (value?.excludedEffects ?? [])
        .map((effect) => [
          effect.effectKey,
          effect.reason,
          [...effect.fields].sort(),
          [...effect.sourceRefs].sort(),
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ])
  }
  const comparable = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) =>
    eligible(a) && eligible(b) && coverage(a) === coverage(b)
  const swaps = (plan: CandidateWarehousePlan) =>
    input.equippedIds.length === 6
      ? records(plan).filter((disc) => !input.equippedIds.includes(disc.id)).length
      : 0
  const proposals: CandidateWarehousePlan[] = []
  // Reserve the original candidate observations before exploring replacements.
  originals.forEach(eligible)
  const seen = new Set(originals.map((plan) => key(records(plan))))
  const anchors = [input.initial, ...originals.map(records)]
  const pools = input.pools.map(interleaveBranches)
  // Slot five is visited first without restricting element or guide main-stat fit.
  // A second pass can combine a useful replacement with another physical disc.
  for (let pass = 0; pass < 2 && !exhausted; pass++) {
    const currentAnchors = pass
      ? proposals
          .toSorted((a, b) => side(records(b))!.totalDamage! - side(records(a))!.totalDamage!)
          .slice(0, 10)
          .map(records)
      : anchors
    outer: for (const slot of [5, 4, 6, 1, 2, 3]) {
      for (const discs of currentAnchors) {
        const current = discs.find((disc) => disc.slot === slot)
        if (!current || current.id === input.fixedDiscId) continue
        for (const replacement of pools[slot - 1] ?? []) {
          const selection = discs.map((disc) => (disc.slot === slot ? replacement : disc))
          const id = key(selection)
          if (seen.has(id)) continue
          seen.add(id)
          nodes++
          const plan = input.compile(selection)
          if (plan && eligible(plan)) proposals.push(plan)
          if (exhausted) break outer
        }
      }
    }
  }
  const candidates = refineComparableCandidatePool(originals, proposals, {
    key: (plan) => key(records(plan)),
    group: coverage,
    comparable,
    compare: (a, b) => {
      const before = side(records(a))!.totalDamage!
      const after = side(records(b))!.totalDamage!
      const epsilon = Number.EPSILON * 32 * Math.max(1, before, after)
      return Math.abs(after - before) > epsilon ? after - before : swaps(a) - swaps(b)
    },
  })
  const rankingApplied = originals.some((plan) => eligible(plan))
  return {
    candidates,
    search: null,
    rankingApplied,
    preparedAnomalySearch: {
      status: exhausted
        ? ('budget_exhausted' as const)
        : rankingApplied
          ? ('complete' as const)
          : ('objective_unresolved' as const),
      nodes,
      evaluations: sides.size,
      exactWithinDeclaredModel: false,
    },
  }
}
