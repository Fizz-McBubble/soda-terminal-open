import {
  damageCalculationContextSchema,
  evaluateDamageCalculationGate,
  type DamageCalculationContext,
  type DamageGateResult,
} from './damageGate'
import {
  calculateDirectDamageExpectation,
  directDamageInputSchema,
  type DirectDamageInput,
} from './directDamage'
import {
  calculateDirectDamageRotation,
  type DirectDamageRotationResult,
} from './directDamageEvents'

export type FormalDamageWhiteboxResult =
  | {
      status: 'formal'
      totalDamage: number
      dps: number
      effectiveAttack: number
      expectedCritMultiplier: number
      factors: Array<{ label: string; value: number }>
      boundary: string
    }
  | { status: 'unsupported'; gate: DamageGateResult; reason: string }

function unsupported(gate: DamageGateResult, reason: string): FormalDamageWhiteboxResult {
  return { status: 'unsupported', gate, reason }
}

/**
 * The only bridge from a versioned formal context to a player-facing damage
 * result. Candidate inputs may still power warehouse scoring, but cannot pass
 * this gate or produce a whitebox damage value.
 */
export function resolveFormalDamageWhitebox(
  contextInput: unknown,
  directDamageInput: unknown,
): FormalDamageWhiteboxResult {
  const gate = evaluateDamageCalculationGate(contextInput)
  if (gate.status !== 'calculable')
    return unsupported(gate, gate.missing.map((item) => item.reason).join('；'))

  const context = damageCalculationContextSchema.parse(contextInput) as DamageCalculationContext
  const input = directDamageInputSchema.safeParse(directDamageInput)
  if (!input.success) return unsupported(gate, '缺少可复算的正式单动作输入，不能生成精确伤害。')

  const mismatch = formalContextMismatch(context, input.data)
  if (mismatch) return unsupported(gate, mismatch)

  const calculation = calculateDirectDamageExpectation(input.data)
  if (calculation.status !== 'supported')
    return unsupported(gate, `直接伤害模型缺口：${calculation.missing.join('、')}。`)

  return {
    status: 'formal',
    totalDamage: calculation.expectedDirectDamage,
    dps: calculation.dps,
    effectiveAttack: calculation.effectiveAttack,
    expectedCritMultiplier: calculation.expectedCritMultiplier,
    factors: calculation.factors.map(({ label, value }) => ({ label, value })),
    boundary: calculation.boundary,
  }
}

/**
 * R1C bridge for the unified CalculationContext. The event model owns the
 * formal/candidate/unsupported boundary; this function adds no fallback data.
 */
export function resolveDirectDamageRotationWhitebox(
  contextInput: unknown,
  rotationInput: unknown,
): DirectDamageRotationResult {
  return calculateDirectDamageRotation(contextInput, rotationInput)
}

function formalContextMismatch(
  context: DamageCalculationContext,
  input: DirectDamageInput,
): string | null {
  if (!context.combatSnapshot || !context.enemySnapshot || !context.cycleSnapshot)
    return '正式计算上下文缺少角色、敌人或循环快照。'
  if (input.gameVersion !== context.gameVersion) return '动作输入与正式数据版本不一致。'
  if (input.agentId !== context.combatSnapshot.agentId) return '动作输入与当前角色不一致。'
  if (input.scenarioId !== context.rotation.scenarioId) return '动作输入与当前场景不一致。'
  if (input.cycleSeconds.value !== context.cycleSnapshot.seconds)
    return '动作时长与正式循环快照不一致。'
  return null
}
