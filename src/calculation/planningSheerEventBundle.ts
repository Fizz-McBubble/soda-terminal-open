import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { calculationContextSchema } from './calculationContext'
import {
  createPlanningDpsContract,
  derivePlanningCapabilityMatrix,
  planningCapabilityMatrixSchema,
  planningDpsInputSchema,
  planningDpsResultSchema,
  type PlanningCapabilityMatrix,
  type PlanningDpsResult,
} from './planningDpsContract'
import { calculateSheerDamageCore, sheerDamageCoreHash } from './sheerDamageCore'
import {
  unsupportedPlanningPersonalResult,
  validatePlanningBundleContext,
} from './planningRuntimeValidation'

export const planningSheerEventBundleVersion = 'planning-sheer-event-bundle-v1' as const

export const planningSheerEventBundleFormulaIdentity = Object.freeze({
  family: 'rupture_sheer',
  adapterVersion: planningSheerEventBundleVersion,
  sheerDamageCoreHash,
  formula: 'sum(full_precision_sheer_events)',
})

export const planningSheerEventBundleFormulaHash = stableContentHash(
  planningSheerEventBundleFormulaIdentity,
)

export const planningSheerEventBundleSolverIdentity = Object.freeze({
  adapterVersion: planningSheerEventBundleVersion,
  strategy: 'deterministic_no_search',
  durationSource: 'planning_baseline_declared_duration',
})

export const planningSheerEventBundleSolverHash = stableContentHash(
  planningSheerEventBundleSolverIdentity,
)

const sourcedNumber = z.object({
  value: z.number(),
  evidenceRefs: z.array(z.string().min(1)).min(1),
})

export const planningSheerEventSetSchema = z.object({
  context: calculationContextSchema,
  formulaEvidenceRefs: z.array(z.string().min(1)).min(1),
  stats: z.object({
    sheerForce: sourcedNumber,
    critRate: sourcedNumber,
    critDamage: sourcedNumber,
    damageBonus: sourcedNumber,
    directDamageBonus: sourcedNumber,
    resistanceReduction: sourcedNumber,
    sheerDamageBonus: sourcedNumber,
  }),
  uncertaintyBand: sourcedNumber.extend({ unit: z.literal('damage') }),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        actionId: z.string().min(1),
        multiplier: sourcedNumber,
        count: sourcedNumber.extend({ value: z.number().int().positive() }),
        sourceRefs: z.array(z.string().min(1)).min(1),
        version: z.literal('3.1'),
        evidence: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
})

function unavailableCapabilities(reason: string): PlanningCapabilityMatrix {
  return planningCapabilityMatrixSchema.parse([
    { capability: 'planning_damage', state: 'unavailable', supportIds: [], blockers: [reason] },
    { capability: 'planning_dps', state: 'unavailable', supportIds: [], blockers: [reason] },
  ])
}

/** Fail-closed Planning adapter for one or more independently sourced Sheer events. */
export function calculatePlanningSheerEventBundle(
  planningInput: unknown,
  eventSetInput: unknown,
): PlanningDpsResult {
  const parsedPlanning = planningDpsInputSchema.safeParse(planningInput)
  const rawBaseline =
    typeof planningInput === 'object' && planningInput !== null && 'baseline' in planningInput
      ? (planningInput as { baseline: unknown }).baseline
      : { state: 'missing_planning_baseline' }
  const baselineFingerprint = stableContentHash(rawBaseline)
  if (!parsedPlanning.success) {
    const reason = 'Planning Sheer 输入合同不完整或哈希不一致。'
    return unsupportedPlanningPersonalResult(baselineFingerprint, unavailableCapabilities(reason), [
      reason,
    ])
  }

  const parsedEventSet = planningSheerEventSetSchema.safeParse(eventSetInput)
  const contract = createPlanningDpsContract(parsedPlanning.data)
  const capabilities = derivePlanningCapabilityMatrix(contract)
  const blockers = capabilities.flatMap((capability) => capability.blockers)
  if (!parsedEventSet.success) {
    blockers.push('Sheer 事件集合输入不完整。')
    return unsupportedPlanningPersonalResult(baselineFingerprint, capabilities, blockers)
  }

  const eventSet = parsedEventSet.data
  const context = eventSet.context
  const baseline = contract.baseline
  const target = contract.calculationTarget
  const common = validatePlanningBundleContext(contract, context)
  const enemy = common.enemy
  blockers.push(...common.blockers)

  if (target.scope !== 'agent' || target.agentIds.length !== 1)
    blockers.push('Rupture/Sheer 首批只支持单代理人计算目标。')
  if (baseline.formulaHash !== planningSheerEventBundleFormulaHash)
    blockers.push('Planning formulaHash 不是当前冻结的 Rupture/Sheer event bundle。')
  if (contract.solverHash !== planningSheerEventBundleSolverHash)
    blockers.push('Planning solverHash 不是当前冻结的 deterministic Sheer adapter。')
  if (enemy) {
    if (enemy.resistance === null) blockers.push('Sheer 计算要求具名敌人抗性。')
    if (enemy.stunMultiplier === null) blockers.push('Sheer 计算要求具名失衡倍率。')
    if (enemy.vulnerability === null) blockers.push('Sheer 计算要求具名易伤。')
  }
  if (eventSet.uncertaintyBand.value !== 0)
    blockers.push('首批 Rupture/Sheer Formal 执行只接受零不确定度的完整输入。')

  const declaredEvidence = new Set(context.evidence.map((item) => item.fieldId))
  const allEvidence = [
    ...eventSet.formulaEvidenceRefs,
    ...Object.values(eventSet.stats).flatMap((item) => item.evidenceRefs),
    ...eventSet.uncertaintyBand.evidenceRefs,
    ...eventSet.events.flatMap((event) => event.evidence),
  ]
  allEvidence
    .filter((fieldId) => !declaredEvidence.has(fieldId))
    .forEach((fieldId) => blockers.push(`Context evidence ${fieldId} is not declared.`))

  if (
    capabilities.some((capability) => capability.state !== 'ready') ||
    blockers.length ||
    !enemy ||
    enemy.resistance === null ||
    enemy.stunMultiplier === null ||
    enemy.vulnerability === null
  )
    return unsupportedPlanningPersonalResult(baselineFingerprint, capabilities, blockers)

  const enemyResistance = enemy.resistance
  const enemyStunMultiplier = enemy.stunMultiplier
  const enemyVulnerability = enemy.vulnerability
  const totalDamage = eventSet.events.reduce((sum, event) => {
    const result = calculateSheerDamageCore({
      sheerForce: eventSet.stats.sheerForce.value,
      multiplier: event.multiplier.value,
      hitCount: event.count.value,
      critRate: eventSet.stats.critRate.value,
      critDamage: eventSet.stats.critDamage.value,
      damageBonus: eventSet.stats.damageBonus.value,
      directDamageBonus: eventSet.stats.directDamageBonus.value,
      vulnerability: enemyVulnerability,
      resistance: enemyResistance,
      resistanceReduction: eventSet.stats.resistanceReduction.value,
      stunMultiplier: enemyStunMultiplier,
      sheerDamageBonus: eventSet.stats.sheerDamageBonus.value,
    })
    return sum + result.expectedDamage
  }, 0)

  return planningDpsResultSchema.parse({
    status: 'supported',
    kind: 'personal_solo',
    subjectId: target.agentIds[0],
    baselineFingerprint,
    declaredDurationSeconds: baseline.declaredDurationSeconds,
    capabilities,
    totalDamage,
    planningDps: totalDamage / baseline.declaredDurationSeconds,
  })
}
