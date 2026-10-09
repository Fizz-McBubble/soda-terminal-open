import { canonical, finite } from './numeric'
export type ObjectiveContext = {
  gameVersion: string
  subjectKey: string
  scenarioKey: string
  formulaKey: string
  objectiveKey: string
  mode: 'fixed_events' | 'generated_policy'
  policyKey: string
  horizon: number
}
export type MissingEffect = {
  id: string
  expressionKey: string
  /** Empty dependencies are accepted only for a proved constant expression. */
  dependencies: readonly string[]
  dependenciesComplete: boolean
  composition: 'additive' | 'interaction'
  sourceRefs: readonly string[]
}
export type ObjectiveEvaluation = {
  context: ObjectiveContext
  inputKey: string
  eventKey: string
  status: 'evaluated' | 'unavailable'
  modeledValue: number | null
  /** Absolute numerical/sampling error, never an arbitrary coverage percentage. */
  error: number
  gaps: readonly MissingEffect[]
  dependencies: Readonly<Record<string, unknown>>
  legality: 'verified' | 'unresolved' | 'invalid'
  stale: boolean
  functional: Readonly<
    Record<
      string,
      {
        actual: number | null
        minimum: number
        authorityKey: string
      }
    >
  >
}
export type EffectDeltaBound = {
  effectId: string
  beforeKey: string
  afterKey: string
  contextKey: string
  lower: number
  upper: number
  proofKey: string
  sourceRefs: readonly string[]
}
export function objectiveContextKey(ctx: ObjectiveContext): string {
  for (const k of [
    'gameVersion',
    'subjectKey',
    'scenarioKey',
    'formulaKey',
    'objectiveKey',
    'policyKey',
  ] as const)
    if (!ctx[k]?.trim()) throw new Error(`missing_${k}`)
  if (!['fixed_events', 'generated_policy'].includes(ctx.mode)) throw new Error('invalid_mode')
  finite(ctx.horizon, 'horizon', Number.MIN_VALUE)
  return canonical(ctx)
}
export function functionalSatisfied(e: ObjectiveEvaluation): boolean {
  return Object.values(e.functional).every(
    (x) =>
      !!x.authorityKey &&
      x.actual !== null &&
      Number.isFinite(x.actual) &&
      Number.isFinite(x.minimum) &&
      x.actual >= x.minimum,
  )
}
export function compareObjective(
  before: ObjectiveEvaluation,
  after: ObjectiveEvaluation,
  bounds: readonly EffectDeltaBound[] = [],
) {
  const no = (reason: string) => ({
    verdict: 'unresolved' as const,
    lower: null,
    upper: null,
    relativeGain: null,
    fullObjective: false,
    reasons: [reason],
  })
  let key: string
  try {
    key = objectiveContextKey(before.context)
    if (key !== objectiveContextKey(after.context)) return no('context_mismatch')
  } catch {
    return no('invalid_context')
  }
  if (before.context.mode === 'fixed_events' && before.eventKey !== after.eventKey)
    return no('fixed_events_changed')
  if (!before.inputKey || !after.inputKey || !before.eventKey || !after.eventKey)
    return no('missing_fingerprint')
  if (before.stale || after.stale) return no('stale')
  if (
    before.status !== 'evaluated' ||
    after.status !== 'evaluated' ||
    before.legality !== 'verified' ||
    after.legality !== 'verified'
  )
    return no('evaluation_or_legality_unresolved')
  if (
    before.modeledValue === null ||
    after.modeledValue === null ||
    ![before.modeledValue, after.modeledValue, before.error, after.error].every(
      (x) => Number.isFinite(x) && x >= 0,
    )
  )
    return no('invalid_numeric')
  if (
    canonical(
      Object.fromEntries(
        Object.entries(before.functional).map(([k, v]) => [k, [v.minimum, v.authorityKey]]),
      ),
    ) !==
    canonical(
      Object.fromEntries(
        Object.entries(after.functional).map(([k, v]) => [k, [v.minimum, v.authorityKey]]),
      ),
    )
  )
    return no('functional_contract_changed')
  if (!functionalSatisfied(after)) return no('functional_requirement_not_met')
  const b = new Map(before.gaps.map((g) => [g.id, g])),
    a = new Map(after.gaps.map((g) => [g.id, g]))
  if (b.size !== before.gaps.length || a.size !== after.gaps.length) return no('duplicate_gap_id')
  const identicalEvaluation = canonical(before) === canonical(after)
  const delta = after.modeledValue - before.modeledValue,
    error = before.error + after.error
  let lo = delta - error,
    hi = delta + error
  for (const id of new Set([...b.keys(), ...a.keys()])) {
    const x = b.get(id),
      y = a.get(id)
    let constant = identicalEvaluation
    if (
      !constant &&
      x &&
      y &&
      x.dependenciesComplete &&
      y.dependenciesComplete &&
      x.composition === 'additive' &&
      y.composition === 'additive' &&
      !!x.expressionKey &&
      x.expressionKey === y.expressionKey &&
      x.sourceRefs.length &&
      y.sourceRefs.length &&
      canonical([...x.sourceRefs].sort()) === canonical([...y.sourceRefs].sort()) &&
      canonical([...x.dependencies].sort()) === canonical([...y.dependencies].sort())
    ) {
      try {
        constant = x.dependencies.every(
          (d) =>
            Object.hasOwn(before.dependencies, d) &&
            Object.hasOwn(after.dependencies, d) &&
            canonical(before.dependencies[d]) === canonical(after.dependencies[d]),
        )
      } catch {
        return no('invalid_dependency_value')
      }
    }
    if (constant) continue
    const matches = bounds.filter(
      (z) =>
        z.effectId === id &&
        z.beforeKey === before.inputKey &&
        z.afterKey === after.inputKey &&
        z.contextKey === key,
    )
    if (matches.length !== 1) return no(`unbounded_effect:${id}`)
    const z = matches[0]!
    if (
      !z.proofKey ||
      !z.sourceRefs.length ||
      ![z.lower, z.upper].every(Number.isFinite) ||
      z.lower > z.upper
    )
      return no(`invalid_bound:${id}`)
    lo += z.lower
    hi += z.upper
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return no('nonfinite_difference_bound')
  const full = !b.size && !a.size
  return {
    verdict:
      lo > 0
        ? ('candidate_better' as const)
        : hi < 0
          ? ('baseline_better' as const)
          : ('equivalent_or_uncertain' as const),
    lower: lo,
    upper: hi,
    relativeGain:
      full && before.error === 0 && after.error === 0 && before.modeledValue > 0
        ? delta / before.modeledValue
        : null,
    fullObjective: full,
    reasons: full ? [] : ['difference_proof_only_total_percentage_unavailable'],
  }
}
