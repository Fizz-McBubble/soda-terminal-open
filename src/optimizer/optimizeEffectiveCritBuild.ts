import type { CandidatePanelInput } from './candidatePanelObjective'
import {
  compareCandidatePanelObjective,
  type CandidatePanelObjective,
} from './candidatePanelObjective'
import type { DiscContribution, OptimizedBuild, OptimizerKnowledge } from './optimizeBuild'
import {
  compareCandidateEffectiveCritObjective,
  projectCandidateEffectiveCritObjective,
  type CandidateEffectiveCritObjective,
  type CandidateEffectiveCritProjection,
} from './candidateEffectiveCritObjective'
import { canStillCompleteSetPattern } from './optimizerSetPatterns'
import { resolveDriveDiscMainStatValue } from '../calculation/outOfCombatPanel'

type State = {
  discs: DiscContribution[]
  setCounts: Record<string, number>
  score: number
  key: string
  projection?: CandidateEffectiveCritProjection
  panelObjective?: CandidatePanelObjective
}

function statCoordinate(discs: readonly DiscContribution[]) {
  const values: Record<string, number> = {}
  for (const { disc } of discs) {
    const main = resolveDriveDiscMainStatValue(disc)
    if (main) values[main.stat] = (values[main.stat] ?? 0) + main.value
    for (const item of disc.subStats) values[item.stat] = (values[item.stat] ?? 0) + item.value
  }
  return Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value.toFixed(6)}`)
    .join('|')
}

/** A bounded source-event beam. No static top-K cut is made before the target is
 * consumed. Equal aggregate stats/set counts are equivalent to the event formula,
 * while top-K physical identities remain available for account disc exclusivity. */
export function optimizeEffectiveCritBuild(input: {
  candidates: Map<number, DiscContribution[]>
  objective: CandidateEffectiveCritObjective
  panelInput?: CandidatePanelInput
  patterns: Record<string, number>[]
  knowledge: OptimizerKnowledge
  topK: number
  panelObjectiveForSelection?: (discs: DiscContribution[]) => CandidatePanelObjective | undefined
  resolveSetPlan: (counts: Record<string, number>) => {
    pattern: '4+2' | '2+2+2'
    score: number
  } | null
}) {
  const anchor = Array.from({ length: 6 }, (_, slot) => input.candidates.get(slot + 1)![0]!)
  const cache = new Map<string, CandidateEffectiveCritProjection>()
  const project = (discs: DiscContribution[]) => {
    const sets: Record<string, number> = {}
    for (const { disc } of discs) sets[disc.setId] = (sets[disc.setId] ?? 0) + 1
    const key =
      statCoordinate(discs) +
      ':' +
      Object.entries(sets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, count]) => `${id}:${count}`)
        .join('|')
    let value = cache.get(key)
    if (!value) {
      value = projectCandidateEffectiveCritObjective(
        input.objective,
        input.panelInput,
        discs.map((item) => item.disc),
      )
      cache.set(key, value)
    }
    return value
  }
  const compare = (a: State, b: State) =>
    compareCandidatePanelObjective(a.panelObjective, b.panelObjective) ||
    compareCandidateEffectiveCritObjective(a.projection, b.projection) ||
    b.score - a.score ||
    a.key.localeCompare(b.key)
  let states: State[] = [{ discs: [], setCounts: {}, score: 0, key: '' }]
  let searchLimited = false
  const beamWidth = Math.max(input.topK * 8, 96)
  for (let slot = 1; slot <= 6; slot++) {
    const buckets = new Map<string, State[]>()
    for (const partial of states)
      for (const candidate of input.candidates.get(slot) ?? []) {
        const setCounts = {
          ...partial.setCounts,
          [candidate.disc.setId]: (partial.setCounts[candidate.disc.setId] ?? 0) + 1,
        }
        if (!canStillCompleteSetPattern(setCounts, 6 - slot, input.patterns)) continue
        const discs = [...partial.discs, candidate]
        const filled = [...discs, ...anchor.slice(slot)]
        const next: State = {
          discs,
          setCounts,
          score: partial.score + candidate.score,
          key: discs
            .map((item) => item.disc.id)
            .sort()
            .join('|'),
          projection: project(filled),
          panelObjective: input.panelObjectiveForSelection?.(filled),
        }
        const key = Object.entries(setCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, count]) => `${id}:${count}`)
          .join('|')
        const bucket = buckets.get(key) ?? []
        bucket.push(next)
        buckets.set(key, bucket)
      }
    states = [...buckets.values()].flatMap((bucket) => {
      bucket.sort(compare)
      const counts = new Map<string, number>()
      const equivalentPruned = bucket.filter((state) => {
        const coordinate = statCoordinate(state.discs)
        const count = counts.get(coordinate) ?? 0
        counts.set(coordinate, count + 1)
        return count < input.topK
      })
      if (equivalentPruned.length <= beamWidth) return equivalentPruned
      searchLimited = true
      // Preserve different CR budgets alongside high current event value. A
      // future slot can make an early high-CR disc redundant; fill heuristics
      // alone would discard that branch before seeing the complete six discs.
      const retained = new Set(equivalentPruned.slice(0, Math.ceil(beamWidth / 2)))
      const byCrit = new Map<string, State[]>()
      for (const state of equivalentPruned) {
        const crit = state.discs.reduce(
          (sum, { disc }) =>
            sum +
            (disc.mainStat === 'crit_rate'
              ? (resolveDriveDiscMainStatValue(disc)?.value ?? 0)
              : 0) +
            disc.subStats
              .filter((item) => item.stat === 'crit_rate')
              .reduce((total, item) => total + item.value, 0),
          0,
        )
        const key = crit.toFixed(4)
        const rows = byCrit.get(key) ?? []
        rows.push(state)
        byCrit.set(key, rows)
      }
      for (let depth = 0; retained.size < beamWidth; depth++) {
        let added = false
        for (const rows of byCrit.values()) {
          const row = rows[depth]
          if (row && !retained.has(row)) {
            retained.add(row)
            added = true
          }
          if (retained.size === beamWidth) break
        }
        if (!added) break
      }
      return [...retained].sort(compare)
    })
  }
  const builds = states
    .flatMap((state): OptimizedBuild[] => {
      const totals: Record<string, number> = {}
      for (const { disc } of state.discs)
        for (const item of disc.subStats) totals[item.stat] = (totals[item.stat] ?? 0) + item.value
      if (
        !Object.entries(input.knowledge.minimumSubstatValues).every(
          ([stat, minimum]) => (totals[stat] ?? 0) >= minimum,
        )
      )
        return []
      const plan = input.resolveSetPlan(state.setCounts)
      if (!plan) return []
      const projection = project(state.discs)
      return [
        {
          rank: 0,
          discs: state.discs,
          totalScore: state.score + plan.score,
          discScore: state.score,
          setScore: plan.score,
          effectiveRolls: state.discs.reduce((sum, item) => sum + item.effectiveRolls, 0),
          setCounts: state.setCounts,
          setPattern: plan.pattern,
          tieBreakKey: state.key,
          effectiveCritObjective: {
            ...projection,
            ...(searchLimited && projection.status !== 'unsupported'
              ? {
                  status: 'limited' as const,
                  reasons: [...projection.reasons, '完整候选经过有界事件搜索；不证明全仓最优。'],
                }
              : {}),
          },
          ...(state.panelObjective
            ? {
                panelObjective: state.panelObjective,
                panelObjectiveStatus: searchLimited ? ('limited' as const) : ('applied' as const),
              }
            : {}),
        },
      ]
    })
    .sort(
      (a, b) =>
        compareCandidatePanelObjective(a.panelObjective, b.panelObjective) ||
        compareCandidateEffectiveCritObjective(
          a.effectiveCritObjective,
          b.effectiveCritObjective,
        ) ||
        b.totalScore - a.totalScore ||
        a.tieBreakKey.localeCompare(b.tieBreakKey),
    )
    .slice(0, input.topK)
    .map((build, index) => ({ ...build, rank: index + 1 }))
  const objectiveStatus =
    !builds.length || builds.every((row) => row.effectiveCritObjective?.status === 'unsupported')
      ? ('unsupported' as const)
      : builds.some((row) => row.effectiveCritObjective?.status !== 'applied')
        ? ('limited' as const)
        : ('applied' as const)
  return { builds, objectiveStatus, searchLimited }
}
