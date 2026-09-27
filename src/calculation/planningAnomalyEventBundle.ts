import { z } from 'zod'
import { stableContentHash } from '../gameDataPacks/types'
import { anomalyDamageCoreHash, calculateAnomalyDamageCore } from './anomalyDamageCore'
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
import {
  unsupportedPlanningPersonalResult,
  validatePlanningBundleContext,
} from './planningRuntimeValidation'

export const planningAnomalyEventBundleVersion = 'planning-anomaly-event-bundle-v1' as const
export const planningAnomalyEventBundleFormulaIdentity = Object.freeze({
  family: 'anomaly_disorder',
  adapterVersion: planningAnomalyEventBundleVersion,
  anomalyDamageCoreHash,
  formula: 'sum(full_precision_single_owner_anomaly_events)',
})
export const planningAnomalyEventBundleFormulaHash = stableContentHash(
  planningAnomalyEventBundleFormulaIdentity,
)
export const planningAnomalyEventBundleSolverIdentity = Object.freeze({
  adapterVersion: planningAnomalyEventBundleVersion,
  strategy: 'deterministic_no_search',
  ownershipBoundary: 'single_owner_share_exactly_1',
  durationSource: 'planning_baseline_declared_duration',
})
export const planningAnomalyEventBundleSolverHash = stableContentHash(
  planningAnomalyEventBundleSolverIdentity,
)

const sourcedNumber = z.object({
  value: z.number(),
  evidenceRefs: z.array(z.string().min(1)).min(1),
})

export const planningAnomalyEventSetSchema = z.object({
  context: calculationContextSchema,
  formulaEvidenceRefs: z.array(z.string().min(1)).min(1),
  ownership: z.object({
    ownerAgentId: z.string().min(1),
    share: sourcedNumber.extend({ value: z.literal(1) }),
  }),
  stats: z.object({
    attack: sourcedNumber,
    anomalyProficiency: sourcedNumber,
    anomalyBaseBonus: sourcedNumber,
    flatAnomalyDamage: sourcedNumber,
    anomalyCritRate: sourcedNumber,
    anomalyCritDamage: sourcedNumber,
    damageBonus: sourcedNumber,
    buffBonus: sourcedNumber,
    directDamageBonus: sourcedNumber,
    defenseReduction: sourcedNumber,
    defenseIgnore: sourcedNumber,
    penetrationRatio: sourcedNumber,
    penetrationFlat: sourcedNumber,
    resistanceReduction: sourcedNumber,
    resistanceIgnore: sourcedNumber,
  }),
  uncertaintyBand: sourcedNumber.extend({ unit: z.literal('damage') }),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        settlement: z.enum(['standard_anomaly', 'disorder']),
        baseMultiplier: sourcedNumber,
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

/** Planning adapter for anomaly events whose buildup and settlement owner is exactly one agent. */
export function calculatePlanningAnomalyEventBundle(
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
    const reason = 'Planning anomaly 输入合同不完整或哈希不一致。'
    return unsupportedPlanningPersonalResult(baselineFingerprint, unavailableCapabilities(reason), [
      reason,
    ])
  }

  const parsedEventSet = planningAnomalyEventSetSchema.safeParse(eventSetInput)
  const contract = createPlanningDpsContract(parsedPlanning.data)
  const capabilities = derivePlanningCapabilityMatrix(contract)
  const blockers = capabilities.flatMap((capability) => capability.blockers)
  if (!parsedEventSet.success) {
    blockers.push('Anomaly 事件集合或单一归属证据不完整。')
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
    blockers.push('Anomaly 首批只支持单代理人计算目标。')
  if (eventSet.ownership.ownerAgentId !== target.agentIds[0])
    blockers.push('Anomaly settlement owner 与计算目标不一致。')
  if (baseline.formulaHash !== planningAnomalyEventBundleFormulaHash)
    blockers.push('Planning formulaHash 不是当前冻结的 anomaly event bundle。')
  if (contract.solverHash !== planningAnomalyEventBundleSolverHash)
    blockers.push('Planning solverHash 不是当前冻结的 single-owner anomaly adapter。')
  if (enemy) {
    if (enemy.defense === null) blockers.push('Anomaly 计算要求具名敌人防御。')
    if (enemy.resistance === null) blockers.push('Anomaly 计算要求具名敌人抗性。')
    if (enemy.stunMultiplier === null) blockers.push('Anomaly 计算要求具名失衡倍率。')
    if (enemy.vulnerability === null) blockers.push('Anomaly 计算要求具名易伤。')
  }
  if (eventSet.uncertaintyBand.value !== 0)
    blockers.push('首批 Anomaly Formal 执行只接受零不确定度的完整输入。')
  if (context.actors[0]?.level === null || context.actors[0]?.level === undefined)
    blockers.push('Anomaly 计算要求具名攻击者等级。')

  const declaredEvidence = new Set(context.evidence.map((item) => item.fieldId))
  const allEvidence = [
    ...eventSet.formulaEvidenceRefs,
    ...eventSet.ownership.share.evidenceRefs,
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
    enemy.defense === null ||
    enemy.resistance === null ||
    enemy.stunMultiplier === null ||
    enemy.vulnerability === null ||
    context.actors[0]?.level === null ||
    context.actors[0]?.level === undefined
  )
    return unsupportedPlanningPersonalResult(baselineFingerprint, capabilities, blockers)

  const enemyDefense = enemy.defense
  const enemyResistance = enemy.resistance
  const enemyStunMultiplier = enemy.stunMultiplier
  const enemyVulnerability = enemy.vulnerability
  const attackerLevel = context.actors[0].level
  const totalDamage = eventSet.events.reduce((sum, event) => {
    const result = calculateAnomalyDamageCore({
      attackerLevel,
      attack: eventSet.stats.attack.value,
      baseMultiplier: event.baseMultiplier.value,
      anomalyBaseBonus: eventSet.stats.anomalyBaseBonus.value,
      flatAnomalyDamage: eventSet.stats.flatAnomalyDamage.value,
      anomalyProficiency: eventSet.stats.anomalyProficiency.value,
      anomalyCritRate: eventSet.stats.anomalyCritRate.value,
      anomalyCritDamage: eventSet.stats.anomalyCritDamage.value,
      damageBonus: eventSet.stats.damageBonus.value,
      buffBonus: eventSet.stats.buffBonus.value,
      directDamageBonus: eventSet.stats.directDamageBonus.value,
      vulnerability: enemyVulnerability,
      defenseReduction: eventSet.stats.defenseReduction.value,
      defenseIgnore: eventSet.stats.defenseIgnore.value,
      penetrationRatio: eventSet.stats.penetrationRatio.value,
      penetrationFlat: eventSet.stats.penetrationFlat.value,
      enemyDefense,
      resistance: enemyResistance,
      resistanceReduction: eventSet.stats.resistanceReduction.value,
      resistanceIgnore: eventSet.stats.resistanceIgnore.value,
      stunMultiplier: enemyStunMultiplier,
    })
    return sum + result.expectedDamage * event.count.value
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
