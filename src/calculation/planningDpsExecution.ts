import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { planningDpsResultSchema, type PlanningDpsResult } from './planningDpsContract'

export const planningDpsExecutionVersion = 'planning-dps-execution-v1' as const

const hashSchema = z.string().min(1)

export const planningDpsExecutionSchema = z
  .object({
    schemaVersion: z.literal(planningDpsExecutionVersion),
    contractFingerprint: hashSchema,
    baselineFingerprint: hashSchema,
    comparabilityKey: hashSchema,
    resultHash: hashSchema,
    result: planningDpsResultSchema,
  })
  .strict()
  .superRefine((execution, context) => {
    if (execution.baselineFingerprint !== execution.result.baselineFingerprint)
      context.addIssue({
        code: 'custom',
        path: ['baselineFingerprint'],
        message: 'execution baseline 与 Planning result 不一致。',
      })
    if (execution.resultHash !== stableContentHash(execution.result))
      context.addIssue({
        code: 'custom',
        path: ['resultHash'],
        message: 'Planning resultHash 校验失败。',
      })
    if (execution.comparabilityKey !== planningDpsComparabilityKey(execution.result))
      context.addIssue({
        code: 'custom',
        path: ['comparabilityKey'],
        message: 'Planning comparabilityKey 校验失败。',
      })
  })

export type PlanningDpsExecution = z.infer<typeof planningDpsExecutionSchema>

export function planningDpsComparabilityKey(result: PlanningDpsResult) {
  return stableContentHash({
    baselineFingerprint: result.baselineFingerprint,
    kind: result.kind,
    subjectId: 'subjectId' in result ? result.subjectId : null,
  })
}

export function createPlanningDpsExecution(
  contractFingerprint: string,
  resultInput: unknown,
): PlanningDpsExecution {
  const result = planningDpsResultSchema.parse(resultInput)
  return planningDpsExecutionSchema.parse({
    schemaVersion: planningDpsExecutionVersion,
    contractFingerprint,
    baselineFingerprint: result.baselineFingerprint,
    comparabilityKey: planningDpsComparabilityKey(result),
    resultHash: stableContentHash(result),
    result,
  })
}

export type PlanningDpsComparison =
  | {
      status: 'comparable'
      baselineResultHash: string
      comparedResultHash: string
      totalDamageDelta: number
      planningDpsDelta: number
      planningDpsPercentDelta: number | null
      direction: 'higher' | 'lower' | 'equal'
    }
  | { status: 'incomparable'; reasons: string[] }

export function comparePlanningDpsExecutions(
  baselineInput: unknown,
  comparedInput: unknown,
): PlanningDpsComparison {
  const baseline = planningDpsExecutionSchema.safeParse(baselineInput)
  const compared = planningDpsExecutionSchema.safeParse(comparedInput)
  if (!baseline.success || !compared.success)
    return { status: 'incomparable', reasons: ['Planning execution 或 resultHash 无效。'] }
  if (baseline.data.result.status !== 'supported' || compared.data.result.status !== 'supported')
    return { status: 'incomparable', reasons: ['unsupported Planning 结果没有可比较数值。'] }

  const reasons: string[] = []
  if (baseline.data.baselineFingerprint !== compared.data.baselineFingerprint)
    reasons.push('PlanningBaseline 不一致。')
  if (baseline.data.comparabilityKey !== compared.data.comparabilityKey)
    reasons.push('Planning 结果种类或计算主体不一致。')
  if (reasons.length) return { status: 'incomparable', reasons }

  const totalDamageDelta = compared.data.result.totalDamage - baseline.data.result.totalDamage
  const planningDpsDelta = compared.data.result.planningDps - baseline.data.result.planningDps
  return {
    status: 'comparable',
    baselineResultHash: baseline.data.resultHash,
    comparedResultHash: compared.data.resultHash,
    totalDamageDelta,
    planningDpsDelta,
    planningDpsPercentDelta:
      baseline.data.result.planningDps === 0
        ? null
        : (planningDpsDelta / baseline.data.result.planningDps) * 100,
    direction: planningDpsDelta > 0 ? 'higher' : planningDpsDelta < 0 ? 'lower' : 'equal',
  }
}
