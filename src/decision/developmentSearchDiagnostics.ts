import type {
  ValueBenchmarkEffectExclusion,
  ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import { stableContentHash } from '../gameDataPacks/types'
import type { DriveDisc } from '../domain/schemas'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolverCore'

export type DevelopmentSearchDiagnostics = {
  contract: 'soda-personal-search-diagnostics/v1'
  domain: 'fixed_event_direct_damage' | 'prepared_anomaly_settlement' | 'unknown'
  fixedEvent: {
    status: 'comparable' | 'not_comparable' | 'unsupported' | 'not_evaluated'
    comparableAlternatives: number | null
    baselineState: ValueBenchmarkSide['state'] | null
  }
  functionalUnknown: Array<{
    side: 'baseline' | 'candidate'
    key: string
    kind: string
    contextKey: string
    sourceRefs: string[]
    excluded: string[]
    blockers: string[]
    observations: number
  }>
  functionalEvidence: {
    /** Presence only; a present object can still contain unknown capacities. */
    baseline: 'not_evaluated' | 'unavailable' | 'present'
    baselineStatus: string | null
    baselineBlockers: string[]
    candidatesUnavailable: number
  }
  excludedEffects: ValueBenchmarkEffectExclusion[]
  unobservedTriggers: Array<{ reason: string; fields: string[]; sourceRefs: string[] }>
  /** Total distinct evidence records before the bounded transport projection. */
  evidenceCounts: { functionalUnknown: number; excludedEffects: number; unobservedTriggers: number }
  physicalAlternatives: {
    scope: 'supplied_eligible_s_inventory'
    evaluatedAssignments: number
    evaluatedAlternatives: number
    status: 'observed' | 'proven_none' | 'not_observed' | 'not_evaluated'
  }
  budget: {
    nodes: { used: number; limit: number | null }
    evaluations: { used: number; limit: number | null }
    exhausted: boolean | null
  }
  boundary: string
}

type Observation = { physicalKey: string; side: ValueBenchmarkSide; comparable?: boolean }

/** Capture the uncollapsed physical inventory; equal-valued copies remain distinct. */
export function createDevelopmentSearchDiagnosticsRecorder(input: {
  baseline: ValueBenchmarkSide
  initial: DriveDisc[]
  legal: DriveDisc[]
  fixed: DriveDisc | undefined
  candidates: readonly CandidateWarehousePlan[]
  sides: ReadonlyMap<string, ValueBenchmarkSide>
  observedComparisons: ReadonlyMap<string, boolean>
}) {
  const physicalKey = (discs: readonly DriveDisc[]) =>
    JSON.stringify(discs.toSorted((a, b) => a.slot - b.slot).map((disc) => [disc.slot, disc.id]))
  const domain = input.legal.filter(
    (disc) => !input.fixed || disc.slot !== input.fixed.slot || disc.id === input.fixed.id,
  )
  const initialKey = physicalKey(input.initial)
  const provenSinglePhysicalAssignment =
    [1, 2, 3, 4, 5, 6].every((slot) => domain.filter((disc) => disc.slot === slot).length === 1) &&
    input.candidates.some(
      (plan) => physicalKey(plan.loadouts[0]?.discs.map((row) => row.disc) ?? []) === initialKey,
    )
  return (
    trace: {
      status: 'complete' | 'objective_unresolved' | 'budget_exhausted' | 'proven_infeasible'
      nodes: number
      evaluations: number
    },
    nodeLimit: number | null,
    evaluationLimit: number,
  ) =>
    summarizeDevelopmentSearchDiagnostics({
      baselineKey: initialKey,
      baseline: input.baseline,
      observations: [...input.sides].map(([physicalKey, side]) => ({
        physicalKey,
        side,
        comparable: input.observedComparisons.get(physicalKey),
      })),
      status: trace.status,
      nodes: trace.nodes,
      nodeLimit,
      evaluations: trace.evaluations,
      evaluationLimit,
      provenSinglePhysicalAssignment,
    })
}

/** Summarize only already computed sides; never infer missing capacities or run an evaluator. */
export function summarizeDevelopmentSearchDiagnostics(input: {
  baselineKey?: string
  baseline?: ValueBenchmarkSide
  observations: readonly Observation[]
  status: 'not_run' | 'complete' | 'objective_unresolved' | 'budget_exhausted' | 'proven_infeasible'
  nodes: number
  nodeLimit: number | null
  evaluations: number
  evaluationLimit: number | null
  provenSinglePhysicalAssignment?: boolean
}): DevelopmentSearchDiagnostics {
  const baseline = input.baseline
  const alternatives = input.observations.filter((row) => row.physicalKey !== input.baselineKey)
  const comparable = alternatives.filter((row) => row.comparable === true).length
  const comparisonObserved = alternatives.some((row) => typeof row.comparable === 'boolean')
  const unknown = new Map<string, DevelopmentSearchDiagnostics['functionalUnknown'][number]>()
  const excluded = new Map<string, ValueBenchmarkEffectExclusion>()
  const triggers = new Map<string, DevelopmentSearchDiagnostics['unobservedTriggers'][number]>()
  const evidence = [
    ...(baseline ? [{ side: 'baseline' as const, value: baseline }] : []),
    ...alternatives.map(({ side: value }) => ({ side: 'candidate' as const, value })),
  ]
  for (const item of evidence) {
    const capacity = item.value.functionalCapacities32
    for (const reason of capacity?.blockers ?? []) {
      if (/functional_condition_unobserved|energy_recovery_condition_unobserved/.test(reason)) {
        const trigger = { reason, fields: [], sourceRefs: [] }
        triggers.set(stableContentHash(trigger), trigger)
      }
    }
    for (const row of capacity?.capacities ?? []) {
      if (row.value !== null && Number.isFinite(row.value)) continue
      const entry = {
        side: item.side,
        key: row.key,
        kind: row.kind,
        contextKey: row.contextKey,
        sourceRefs: [...row.sourceRefs],
        excluded: [...row.excluded],
        blockers: [...capacity!.blockers],
      }
      const identity = stableContentHash(entry)
      const previous = unknown.get(identity)
      unknown.set(identity, { ...entry, observations: (previous?.observations ?? 0) + 1 })
      for (const reason of capacity?.blockers ?? []) {
        if (/functional_condition_unobserved|energy_recovery_condition_unobserved/.test(reason)) {
          const trigger = { reason, fields: [row.key], sourceRefs: [...row.sourceRefs] }
          triggers.set(stableContentHash(trigger), trigger)
        }
      }
    }
    for (const effect of item.value.coverage?.excludedEffects ?? []) {
      excluded.set(stableContentHash(effect), structuredClone(effect))
      if (
        /unobserved_condition|functional_condition_unobserved|energy_recovery_condition_unobserved|公式 flag|公式累计量|触发|窗口/i.test(
          [effect.reason, ...effect.fields].join(' '),
        )
      ) {
        const row = {
          reason: effect.reason,
          fields: [...effect.fields],
          sourceRefs: [...effect.sourceRefs],
        }
        triggers.set(stableContentHash(row), row)
      }
    }
    for (const reason of item.value.reasons) {
      if (
        /背后命中状态|异常暴击窗口状态|enlightened_event_state_missing_or_inactive|functional_condition_unobserved|energy_recovery_condition_unobserved/i.test(
          reason,
        )
      ) {
        const row = { reason, fields: [], sourceRefs: [] }
        triggers.set(stableContentHash(row), row)
      }
    }
  }
  return {
    contract: 'soda-personal-search-diagnostics/v1',
    domain: baseline?.coverage?.domain ?? 'unknown',
    fixedEvent: {
      status:
        !baseline || !alternatives.length
          ? 'not_evaluated'
          : baseline.state === 'unsupported'
            ? 'unsupported'
            : baseline.state !== 'supported'
              ? 'not_evaluated'
              : comparable
                ? 'comparable'
                : comparisonObserved
                  ? 'not_comparable'
                  : 'not_evaluated',
      comparableAlternatives: comparisonObserved ? comparable : null,
      baselineState: baseline?.state ?? null,
    },
    functionalUnknown: [...unknown.values()].slice(0, 32),
    functionalEvidence: {
      baseline: !baseline
        ? 'not_evaluated'
        : baseline.functionalCapacities32
          ? 'present'
          : 'unavailable',
      baselineStatus: baseline?.functionalCapacities32?.status ?? null,
      baselineBlockers: [...(baseline?.functionalCapacities32?.blockers ?? [])],
      candidatesUnavailable: alternatives.filter(({ side }) => !side.functionalCapacities32).length,
    },
    excludedEffects: [...excluded.values()].slice(0, 32),
    unobservedTriggers: [...triggers.values()].slice(0, 32),
    evidenceCounts: {
      functionalUnknown: unknown.size,
      excludedEffects: excluded.size,
      unobservedTriggers: triggers.size,
    },
    physicalAlternatives: {
      scope: 'supplied_eligible_s_inventory',
      evaluatedAssignments: input.observations.length,
      evaluatedAlternatives: alternatives.length,
      status: !baseline
        ? 'not_evaluated'
        : alternatives.length
          ? 'observed'
          : input.provenSinglePhysicalAssignment
            ? 'proven_none'
            : 'not_observed',
    },
    budget: {
      nodes: { used: input.nodes, limit: input.nodeLimit },
      evaluations: { used: input.evaluations, limit: input.evaluationLimit },
      exhausted: input.status === 'not_run' ? null : input.status === 'budget_exhausted',
    },
    boundary:
      '只记录本次已评估的实体方案和声明事件；未计入效果与未知功能容量不视为守恒，也不证明完整收益或全局最优。',
  }
}
