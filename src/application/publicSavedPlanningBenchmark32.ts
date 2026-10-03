import { z } from 'zod'
import { contentHash } from './contentHash'
import {
  acceptPlanningBenchmarkResult32,
  type PlanningBenchmarkExpected32,
  type PlanningBenchmarkResult32,
} from './publicPlanningBenchmark32'
import {
  planningEventDeclarationsInputShapeGaps32,
  planningEventDeclarationsInputFingerprint32,
  validatePlanningEventDeclarations32,
  type PlanningEventDeclarationsInput32,
} from './publicPlanningEventDeclarations32'

export type SavedPlanningBenchmark32 = Omit<
  PlanningBenchmarkResult32,
  'contract' | 'metadata' | 'status'
> & {
  contract: 'soda-saved-planning-benchmark32/v1'
  declarations: PlanningEventDeclarationsInput32
  snapshotFingerprint: string
}
const text = z.string().min(1)
const nonnegative = z.number().finite().nonnegative()
export const savedPlanningBenchmark32Schema = z
  .object({
    contract: z.literal('soda-saved-planning-benchmark32/v1'),
    runId: text,
    candidateId: text,
    fitFingerprint: text,
    accountFingerprint: text,
    sourceBindingFingerprint: text,
    inputFingerprint: text,
    sideEffect: z.literal('read_only'),
    formalCycleReady: z.literal(false),
    totalDamage: nonnegative,
    benchmarkDps: nonnegative,
    declaredDurationSeconds: z.number().finite().positive(),
    declarations: z.custom<PlanningEventDeclarationsInput32>(
      (raw) => planningEventDeclarationsInputShapeGaps32(raw).length === 0,
    ),
    eventResults: z
      .array(
        z
          .object({
            occurrenceId: text,
            ownerAgentId: text,
            eventId: text,
            atSeconds: nonnegative,
            snapshotAtSeconds: nonnegative.nullable(),
            totalDamage: nonnegative,
            runtimeHash: text,
            sourceRefs: z.array(text).min(1),
          })
          .strict(),
      )
      .min(1),
    includedEffectKeys: z.array(text),
    excludedEffects: z.array(
      z
        .object({
          effectKey: text,
          reason: text,
          fields: z.array(text),
          sourceRefs: z.array(text).min(1),
        })
        .strict(),
    ),
    gaps: z.array(text).max(0),
    missingContext: z.array(text),
    resultFingerprint: text,
    snapshotFingerprint: text,
  })
  .strict()
  .superRefine((value, context) => {
    const { snapshotFingerprint, ...payload } = value
    const input = value.declarations
    const occurrences = input.occurrences
    if (
      snapshotFingerprint !== contentHash(payload) ||
      value.inputFingerprint !== planningEventDeclarationsInputFingerprint32(input) ||
      !input.confirmedDeclaredConditions ||
      new Set(occurrences.map((event) => event.occurrenceId)).size !== occurrences.length ||
      occurrences.length !== value.eventResults.length ||
      value.eventResults.some(
        (event) =>
          !occurrences.some(
            (item) =>
              item.occurrenceId === event.occurrenceId &&
              item.ownerAgentId === event.ownerAgentId &&
              item.eventId === event.eventId &&
              item.atSeconds === event.atSeconds &&
              (item.snapshotAtSeconds ?? null) === event.snapshotAtSeconds &&
              contentHash([...item.sourceRefs].sort()) ===
                contentHash([...event.sourceRefs].sort()),
          ),
      ) ||
      Math.abs(
        value.totalDamage - value.eventResults.reduce((sum, event) => sum + event.totalDamage, 0),
      ) > 1e-7 ||
      Math.abs(value.benchmarkDps - value.totalDamage / value.declaredDurationSeconds) > 1e-7
    )
      context.addIssue({ code: 'custom', message: '保存的事件声明快照校验失败' })
  })

export function createSavedPlanningBenchmark32(
  result: PlanningBenchmarkResult32,
  declarations: PlanningEventDeclarationsInput32,
  expected: PlanningBenchmarkExpected32,
): SavedPlanningBenchmark32 {
  acceptPlanningBenchmarkResult32(result, expected)
  if (
    result.status !== 'declared_event_benchmark' ||
    !result.metadata ||
    validatePlanningEventDeclarations32(declarations, result.metadata).gaps.length ||
    result.inputFingerprint !== planningEventDeclarationsInputFingerprint32(declarations)
  )
    throw new Error('当前事件声明结果不可保存。')
  const compact = { ...result }
  Reflect.deleteProperty(compact, 'metadata')
  Reflect.deleteProperty(compact, 'contract')
  Reflect.deleteProperty(compact, 'status')
  const payload = {
    ...compact,
    contract: 'soda-saved-planning-benchmark32/v1' as const,
    declarations,
  }
  return savedPlanningBenchmark32Schema.parse({
    ...payload,
    snapshotFingerprint: contentHash(payload),
  })
}

export function isSavedPlanningBenchmark32Current(
  snapshot: SavedPlanningBenchmark32,
  expected: PlanningBenchmarkExpected32,
) {
  return (
    savedPlanningBenchmark32Schema.safeParse(snapshot).success &&
    (
      [
        'runId',
        'candidateId',
        'fitFingerprint',
        'accountFingerprint',
        'inputFingerprint',
        'sourceBindingFingerprint',
      ] as const
    ).every((key) => expected[key] !== undefined && snapshot[key] === expected[key])
  )
}
