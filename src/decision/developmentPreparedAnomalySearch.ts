import type { DriveDisc } from '../domain/schemas'
import { stableContentHash } from '../gameDataPacks/types'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import { refineComparableCandidatePool } from '../optimizer/refineComparableCandidatePool'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'

const key = (discs: readonly DriveDisc[]) =>
  JSON.stringify(discs.toSorted((a, b) => a.slot - b.slot).map((disc) => disc.id))
const records = (plan: CandidateWarehousePlan) => plan.loadouts[0]!.discs.map((row) => row.disc)
const candidateIdentity = (plan: CandidateWarehousePlan) =>
  stableContentHash({
    agentId: plan.agentIds[0] ?? null,
    discs: records(plan)
      .toSorted((left, right) => left.slot - right.slot)
      .map((disc) => [disc.slot, disc.id]),
  })

export const preparedAnomalyCandidateRankingContract =
  'soda-prepared-anomaly-candidate-ranking/v1' as const

export type PreparedAnomalyCandidateRankingEntry = {
  candidateIdentity: string
  calculationIdentity: string
  coverageIdentity: string
  groupId: string
  groupRank: number
  groupSize: number
  comparable: true
  totalDamage: number
  swapCount: number
}

export type PreparedAnomalyCandidateRanking = {
  contract: typeof preparedAnomalyCandidateRankingContract
  source: 'prepared_anomaly_settlement'
  candidateRarityScope: 'S'
  baselineCalculationIdentity: string
  comparisonParametersIdentity: string | null
  entries: PreparedAnomalyCandidateRankingEntry[]
  identity: string
}

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
  comparisonParametersIdentity?: string | null
}) {
  const budget = Number.isFinite(input.evaluationBudget)
    ? Math.max(1, Math.min(384, Math.floor(input.evaluationBudget)))
    : 384
  const baseline = input.side(input.initial)
  const initialPlan = input.compile(input.initial)
  const originals = input.candidates.length ? input.candidates : initialPlan ? [initialPlan] : []
  const baselinePanel = initialPlan?.loadouts[0]?.panelObjective
  // Request-scoped object identity is conservative: different plan or side
  // evidence objects never share an entry. Repeated calls on the same immutable
  // search object reuse the original predicate result.
  const eligibilityCache = new WeakMap<CandidateWarehousePlan, boolean>()
  const coverageCache = new WeakMap<CandidateWarehousePlan, string>()
  const comparabilityCache = new Map<
    CandidateWarehousePlan,
    WeakMap<CandidateWarehousePlan, boolean>
  >()
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
    const cached = eligibilityCache.get(plan)
    if (cached !== undefined) return cached
    let result = false
    if (input.compile(records(plan))) {
      const current = side(records(plan))
      if (current?.coverage?.domain === 'prepared_anomaly_settlement') {
        if (baseline.functionalStats32 && current.functionalStats32) {
          const protectedUtilityPreserved = protectedStats.every((stat) => {
            const before = baseline.functionalStats32![stat]
            const after = current.functionalStats32![stat]
            return Number.isFinite(before) && Number.isFinite(after) && after + 1e-9 >= before
          })
          const panel = plan.loadouts[0]?.panelObjective
          const priority = baselinePanel?.priorityStat ?? 'anomalyProficiency'
          const beforePriority =
            priority === 'source' ? baselinePanel?.hpDeficit : baselinePanel?.[priority]
          const afterPriority = priority === 'source' ? panel?.hpDeficit : panel?.[priority]
          const panelPreserved =
            !baselinePanel ||
            (Boolean(panel) &&
              (panel!.priorityStat ?? 'anomalyProficiency') === priority &&
              panel!.attackDeficit <= baselinePanel.attackDeficit &&
              Number.isFinite(beforePriority) &&
              Number.isFinite(afterPriority) &&
              (priority === 'source'
                ? panel!.priorityStat === 'source' && afterPriority! <= beforePriority!
                : afterPriority! >= beforePriority!))
          result =
            protectedUtilityPreserved &&
            panelPreserved &&
            compareValueBenchmarkSides({
              baseline,
              candidate: current,
              changedDimensions: ['disc_loadout'],
              labels: { baseline: '同条件单次异常', candidate: '同条件单次异常' },
            }).comparable
        }
      }
    }
    eligibilityCache.set(plan, result)
    return result
  }
  const coverage = (plan: CandidateWarehousePlan) => {
    const cached = coverageCache.get(plan)
    if (cached !== undefined) return cached
    const value = side(records(plan))?.coverage
    const stats = side(records(plan))?.functionalStats32
    const result = JSON.stringify([
      plan.inventoryTransition ?? false,
      plan.loadouts[0]?.degraded ?? false,
      plan.loadouts[0]?.panelObjective
        ? { priorityStat: plan.loadouts[0]!.panelObjective!.priorityStat ?? 'anomalyProficiency' }
        : null,
      plan.loadouts[0]?.panelObjectiveStatus ?? null,
      // AP is the settlement operand and is already protected against baseline
      // regression above; it must be allowed to vary within this output group.
      stats
        ? protectedStats.filter((stat) => stat !== 'anomProf').map((stat) => stats[stat])
        : null,
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
    coverageCache.set(plan, result)
    return result
  }
  const comparable = (a: CandidateWarehousePlan, b: CandidateWarehousePlan) => {
    const leftCached = comparabilityCache.get(a)?.get(b)
    if (leftCached !== undefined) return leftCached
    const rightCached = comparabilityCache.get(b)?.get(a)
    if (rightCached !== undefined) return rightCached
    const result = eligible(a) && eligible(b) && coverage(a) === coverage(b)
    const left = comparabilityCache.get(a) ?? new WeakMap<CandidateWarehousePlan, boolean>()
    const right = comparabilityCache.get(b) ?? new WeakMap<CandidateWarehousePlan, boolean>()
    left.set(b, result)
    right.set(a, result)
    comparabilityCache.set(a, left)
    comparabilityCache.set(b, right)
    return result
  }
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
  const baselineCalculationIdentity = baseline.calculationFingerprint
  const candidateIdentityCounts = new Map<string, number>()
  for (const plan of candidates) {
    const identity = candidateIdentity(plan)
    candidateIdentityCounts.set(identity, (candidateIdentityCounts.get(identity) ?? 0) + 1)
  }
  const groups = new Map<
    string,
    Array<{
      plan: CandidateWarehousePlan
      candidateIdentity: string
      calculationIdentity: string | null
      coverageIdentity: string
      totalDamage: number
      swapCount: number
    }>
  >()
  if (baselineCalculationIdentity) {
    for (const plan of candidates) {
      if (!eligible(plan)) continue
      const value = side(records(plan))
      if (!value || !Number.isFinite(value.totalDamage) || value.state !== 'supported') continue
      const coverageText = coverage(plan)
      const coverageIdentity = stableContentHash(JSON.parse(coverageText))
      const groupId = `prepared-anomaly:${coverageIdentity}`
      const rows = groups.get(groupId) ?? []
      rows.push({
        plan,
        candidateIdentity: candidateIdentity(plan),
        calculationIdentity: value.calculationFingerprint,
        coverageIdentity,
        totalDamage: value.totalDamage!,
        swapCount: swaps(plan),
      })
      groups.set(groupId, rows)
    }
  }
  const preparedEntries: PreparedAnomalyCandidateRankingEntry[] = []
  for (const [groupId, rows] of groups) {
    if (
      rows.length < 2 ||
      rows.some((row) => !row.calculationIdentity) ||
      rows.some((row) => candidateIdentityCounts.get(row.candidateIdentity) !== 1) ||
      !rows.every((left, leftIndex) =>
        rows.slice(leftIndex + 1).every((right) => comparable(left.plan, right.plan)),
      )
    )
      continue
    rows.forEach((row, index) => {
      preparedEntries.push({
        candidateIdentity: row.candidateIdentity,
        calculationIdentity: row.calculationIdentity!,
        coverageIdentity: row.coverageIdentity,
        groupId,
        groupRank: index + 1,
        groupSize: rows.length,
        comparable: true,
        totalDamage: row.totalDamage,
        swapCount: row.swapCount,
      })
    })
  }
  const preparedCandidateRanking =
    baselineCalculationIdentity && preparedEntries.length
      ? {
          contract: preparedAnomalyCandidateRankingContract,
          source: 'prepared_anomaly_settlement' as const,
          candidateRarityScope: 'S' as const,
          baselineCalculationIdentity,
          comparisonParametersIdentity: input.comparisonParametersIdentity ?? null,
          entries: preparedEntries,
          identity: stableContentHash({
            contract: preparedAnomalyCandidateRankingContract,
            source: 'prepared_anomaly_settlement',
            candidateRarityScope: 'S',
            baselineCalculationIdentity,
            comparisonParametersIdentity: input.comparisonParametersIdentity ?? null,
            entries: preparedEntries,
          }),
        }
      : undefined
  return {
    candidates,
    search: null,
    rankingApplied: Boolean(preparedCandidateRanking),
    preparedCandidateRanking,
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
