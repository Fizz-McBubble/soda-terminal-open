import { z } from 'zod'
import { contentHash } from './contentHash'
import {
  planningEventDeclarationsMetadataGaps32,
  type PlanningEventDeclarationsMetadata32,
} from './publicPlanningEventDeclarations32'

export const planningBenchmark32Contract = 'soda-planning-benchmark32/v1' as const
export type PlanningBenchmarkResult32 = {
  contract: typeof planningBenchmark32Contract
  runId: string
  candidateId: string
  fitFingerprint: string
  accountFingerprint: string
  sourceBindingFingerprint: string
  metadata: PlanningEventDeclarationsMetadata32 | null
  inputFingerprint: string | null
  sideEffect: 'read_only'
  status: 'metadata' | 'declared_event_benchmark' | 'unsupported'
  formalCycleReady: false
  totalDamage: number | null
  benchmarkDps: number | null
  declaredDurationSeconds: number | null
  eventResults: Array<{
    occurrenceId: string
    ownerAgentId: string
    eventId: string
    atSeconds: number
    snapshotAtSeconds: number | null
    totalDamage: number
    runtimeHash: string
    sourceRefs: string[]
  }>
  includedEffectKeys: string[]
  excludedEffects: Array<{
    effectKey: string
    reason: string
    fields: string[]
    sourceRefs: string[]
  }>
  gaps: string[]
  missingContext: string[]
  resultFingerprint: string
}
export type PlanningBenchmarkExpected32 = {
  runId: string
  candidateId: string
  fitFingerprint: string
  accountFingerprint: string
  inputFingerprint: string | null
  sourceBindingFingerprint?: string
}

const text = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)
const finiteNonnegative = z.number().finite().nonnegative()
const textList = z.array(text)
const resultSchema = z
  .object({
    contract: z.literal(planningBenchmark32Contract),
    runId: text,
    candidateId: text,
    fitFingerprint: text,
    accountFingerprint: text,
    sourceBindingFingerprint: text,
    metadata: z.unknown(),
    inputFingerprint: text.nullable(),
    sideEffect: z.literal('read_only'),
    status: z.enum(['metadata', 'declared_event_benchmark', 'unsupported']),
    formalCycleReady: z.literal(false),
    totalDamage: finiteNonnegative.nullable(),
    benchmarkDps: finiteNonnegative.nullable(),
    declaredDurationSeconds: z.number().finite().positive().nullable(),
    eventResults: z.array(
      z
        .object({
          occurrenceId: text,
          ownerAgentId: text,
          eventId: text,
          atSeconds: finiteNonnegative,
          snapshotAtSeconds: finiteNonnegative.nullable(),
          totalDamage: finiteNonnegative,
          runtimeHash: text,
          sourceRefs: textList.min(1),
        })
        .strict(),
    ),
    includedEffectKeys: textList,
    excludedEffects: z.array(
      z
        .object({
          effectKey: text,
          reason: text,
          fields: textList,
          sourceRefs: textList.min(1),
        })
        .strict(),
    ),
    gaps: textList,
    missingContext: textList,
    resultFingerprint: text,
  })
  .strict()

/** Keep every event's independent state and order in the response binding. */
export function planningBenchmarkResultFingerprint32(
  payload: Omit<PlanningBenchmarkResult32, 'resultFingerprint'>,
): string {
  const publicPayload = { ...payload }
  Reflect.deleteProperty(publicPayload, 'resultFingerprint')
  return contentHash(publicPayload)
}
const duplicate = (values: string[]) => new Set(values).size !== values.length
const equalNumber = (left: number, right: number) =>
  Number.isFinite(left) &&
  Number.isFinite(right) &&
  Math.abs(left - right) <= Number.EPSILON * 32 * Math.max(1, Math.abs(left), Math.abs(right))

/** Expected source bindings originate at the private producer, never at client metadata. */
export function planningBenchmarkResultGaps32(
  raw: unknown,
  expected: PlanningBenchmarkExpected32,
): string[] {
  const parsed = resultSchema.safeParse(raw)
  if (!parsed.success)
    return parsed.error.issues.map(
      (issue) => `invalid_benchmark_result:${issue.path.join('.')}:${issue.code}`,
    )
  const result = parsed.data
  const gaps: string[] = []
  for (const key of [
    'runId',
    'candidateId',
    'fitFingerprint',
    'accountFingerprint',
    'inputFingerprint',
  ] as const)
    if (result[key] !== expected[key]) gaps.push(`benchmark_binding_mismatch:${key}`)
  if (
    expected.sourceBindingFingerprint !== undefined &&
    result.sourceBindingFingerprint !== expected.sourceBindingFingerprint
  )
    gaps.push('benchmark_binding_mismatch:sourceBindingFingerprint')
  const { resultFingerprint, ...payload } = result
  if (resultFingerprint !== contentHash(payload)) gaps.push('benchmark_result_fingerprint_mismatch')
  let metadata: PlanningEventDeclarationsMetadata32 | null = null
  if (result.metadata !== null) {
    const metadataGaps = planningEventDeclarationsMetadataGaps32(result.metadata)
    if (metadataGaps.length) gaps.push(...metadataGaps.map((gap) => `benchmark_${gap}`))
    else metadata = result.metadata as PlanningEventDeclarationsMetadata32
  }
  if (
    duplicate(result.includedEffectKeys) ||
    duplicate(result.excludedEffects.map((effect) => effect.effectKey))
  )
    gaps.push('duplicate_benchmark_effect_key')
  if (result.excludedEffects.some((effect) => result.includedEffectKeys.includes(effect.effectKey)))
    gaps.push('conflicting_benchmark_effect_key')
  if (
    result.excludedEffects.some(
      (effect) => duplicate(effect.fields) || duplicate(effect.sourceRefs),
    )
  )
    gaps.push('duplicate_excluded_effect_reference')
  if (result.status !== 'declared_event_benchmark') {
    if (
      result.totalDamage !== null ||
      result.benchmarkDps !== null ||
      result.declaredDurationSeconds !== null ||
      result.eventResults.length
    )
      gaps.push('unexpected_benchmark_damage')
    if (result.status === 'metadata' && !metadata) gaps.push('missing_benchmark_metadata')
    return gaps
  }
  if (!metadata) gaps.push('missing_benchmark_metadata')
  if (result.inputFingerprint === null) gaps.push('missing_benchmark_input_fingerprint')
  if (result.gaps.length) gaps.push('benchmark_contains_unresolved_gaps')
  // missingContext describes effects and cycle context outside the declared event slice.
  if (
    result.totalDamage === null ||
    result.benchmarkDps === null ||
    result.declaredDurationSeconds === null
  )
    gaps.push('missing_benchmark_damage')
  if (!result.eventResults.length) gaps.push('missing_benchmark_event_results')
  if (duplicate(result.eventResults.map((event) => event.occurrenceId)))
    gaps.push('duplicate_benchmark_occurrence_id')
  if (metadata && result.declaredDurationSeconds !== metadata.declaredDurationSeconds)
    gaps.push('benchmark_duration_mismatch')
  for (const event of result.eventResults) {
    const definition = metadata?.events.find(
      (candidate) =>
        candidate.ownerAgentId === event.ownerAgentId && candidate.eventId === event.eventId,
    )
    if (!definition || !metadata?.memberIds.includes(event.ownerAgentId))
      gaps.push(`unknown_benchmark_event:${event.occurrenceId}`)
    if (
      result.declaredDurationSeconds !== null &&
      event.atSeconds >= result.declaredDurationSeconds
    )
      gaps.push(`invalid_benchmark_event_time:${event.occurrenceId}`)
    if (event.snapshotAtSeconds !== null && event.snapshotAtSeconds > event.atSeconds)
      gaps.push(`invalid_benchmark_snapshot_time:${event.occurrenceId}`)
    if (duplicate(event.sourceRefs))
      gaps.push(`duplicate_benchmark_event_source:${event.occurrenceId}`)
    if (definition) {
      const accepted = new Set([
        ...definition.sourceRefs,
        ...definition.conditions.flatMap((condition) => condition.sourceRefs),
      ])
      if (
        event.sourceRefs.some((ref) => !accepted.has(ref)) ||
        [...accepted].some((ref) => !event.sourceRefs.includes(ref))
      )
        gaps.push(`wrong_benchmark_event_source:${event.occurrenceId}`)
    }
  }
  if (
    result.totalDamage !== null &&
    !equalNumber(
      result.totalDamage,
      result.eventResults.reduce((sum, event) => sum + event.totalDamage, 0),
    )
  )
    gaps.push('benchmark_total_damage_mismatch')
  if (
    result.totalDamage !== null &&
    result.benchmarkDps !== null &&
    result.declaredDurationSeconds !== null &&
    !equalNumber(result.benchmarkDps, result.totalDamage / result.declaredDurationSeconds)
  )
    gaps.push('benchmark_dps_mismatch')
  return gaps
}

export function acceptPlanningBenchmarkResult32(
  raw: unknown,
  expected: PlanningBenchmarkExpected32,
): PlanningBenchmarkResult32 {
  const gaps = planningBenchmarkResultGaps32(raw, expected)
  if (gaps.length) throw new Error(`事件声明基准响应无效：${gaps.join('、')}`)
  return raw as PlanningBenchmarkResult32
}
