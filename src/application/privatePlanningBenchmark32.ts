import { analyzePreparedPlanningBenchmark32Candidate } from './privatePreparedPlanningBenchmark32'

import { evaluateCalculationGate } from '../calculation/damageGate'

import {
  validatePlanningEventDeclarations32,
  type PlanningEventDeclarationsInput32,
  type PlanningEventDeclarationsMetadata32,
} from './publicPlanningEventDeclarations32'
import {
  planningBenchmarkResultFingerprint32,
  type PlanningBenchmarkResult32,
} from './publicPlanningBenchmark32'
import {
  preparePlanningBenchmark32,
  type PlanningBenchmarkBinding32,
} from './privatePlanningBenchmarkBinding32'
export type { PlanningBenchmarkBinding32 } from './privatePlanningBenchmarkBinding32'

/** The public/private result projection always retains its full response hash. */
export function analyzePlanningBenchmark32Candidate(
  input: PlanningBenchmarkBinding32,
  declarations?: PlanningEventDeclarationsInput32,
  expectedSourceBindingFingerprint?: string,
) {
  const analyzed = analyzePreparedPlanningBenchmark32Candidate(
    input,
    preparePlanningBenchmark32(input),
    declarations,
    expectedSourceBindingFingerprint,
  )
  return {
    ...analyzed,
    result: {
      ...analyzed.result,
      resultFingerprint: planningBenchmarkResultFingerprint32(analyzed.result),
    },
  }
}

/** A private optimizer captures validated declarations once. Every candidate
 * still rebuilds actual stats, sources, equipment, effects and functional operands.
 * Unsigned numerical analysis is never returned by the public Query producer. */
export function createPlanningBenchmark32ObjectiveAnalyzer(
  declarations: PlanningEventDeclarationsInput32,
  metadata: PlanningEventDeclarationsMetadata32,
) {
  const captured = structuredClone(declarations)
  const validation = validatePlanningEventDeclarations32(captured, metadata)
  const vocabularyFingerprint = metadata.sourceFingerprint
  return (input: PlanningBenchmarkBinding32) => {
    const prepared = preparePlanningBenchmark32(input)
    const currentValidation =
      prepared.metadata?.sourceFingerprint === vocabularyFingerprint
        ? structuredClone(validation)
        : { occurrences: [], gaps: ['比较条件定义已变化，不能复用已确认的动作声明。'] }
    return {
      ...analyzePreparedPlanningBenchmark32Candidate(
        input,
        prepared,
        captured,
        prepared.sourceBindingFingerprint,
        currentValidation,
      ),
      prepared,
    }
  }
}

/** Public numbers require the same Formal gates as every production damage
 * consumer. A source-bound, evaluable Candidate remains private analysis. */
export function projectPlanningBenchmark32(
  input: PlanningBenchmarkBinding32,
  declarations?: PlanningEventDeclarationsInput32,
  expectedSourceBindingFingerprint?: string,
): PlanningBenchmarkResult32 {
  const analyzed = analyzePlanningBenchmark32Candidate(
    input,
    declarations,
    expectedSourceBindingFingerprint,
  )
  const result = analyzed.result
  if (result.status !== 'declared_event_benchmark') return result
  const gate = evaluateCalculationGate(analyzed.context)
  if (gate.capabilities.formalEventSet.allowed && gate.capabilities.formalLoadout.allowed)
    return result
  const payload = {
    ...result,
    status: 'unsupported' as const,
    totalDamage: null,
    benchmarkDps: null,
    declaredDurationSeconds: null,
    eventResults: [],
    gaps: [
      ...new Set([
        '具名事件集与实际配装尚未完成Formal资格核验；当前只开放条件声明。',
        ...(analyzed.context?.evidence
          .filter((row) => row.fieldId.startsWith('reviewed32:') && row.status !== 'formal')
          .map((row) => row.reason) ?? []),
        ...gate.capabilities.formalEventSet.blockers.map((row) => row.reason),
        ...gate.capabilities.formalLoadout.blockers.map((row) => row.reason),
      ]),
    ],
  }
  return { ...payload, resultFingerprint: planningBenchmarkResultFingerprint32(payload) }
}
