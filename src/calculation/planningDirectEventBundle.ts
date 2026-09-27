import { directDamageCoreVersion } from './directDamageCore'
import { directDamageEventModelVersion, lockedFormulaCommit } from './directDamageEvents'
import { calculateFormalEventSet, formalEventSetSchema } from './formalEventSet'
import {
  createPlanningDpsContract,
  derivePlanningCapabilityMatrix,
  planningCapabilityMatrixSchema,
  planningDpsInputSchema,
  planningDpsResultSchema,
  type PlanningCapabilityMatrix,
  type PlanningDpsResult,
} from './planningDpsContract'
import { stableContentHash } from '../gameDataPacks/types'
import { validatePlanningBundleContext } from './planningRuntimeValidation'

export const planningDirectEventBundleVersion = 'planning-direct-event-bundle-v1' as const

/**
 * The first executable Planning formula family deliberately composes the
 * existing Formal event-set and locked upstream arithmetic slice. It does not
 * introduce a second direct-damage formula or a hidden rotation/timing model.
 */
export const planningDirectEventBundleFormulaIdentity = Object.freeze({
  family: 'standard_direct_event_bundle',
  adapterVersion: planningDirectEventBundleVersion,
  directDamageCoreVersion,
  directDamageEventModelVersion,
  upstreamRepository: 'frzyc/genshin-optimizer',
  upstreamCommit: lockedFormulaCommit,
  formula: 'formal_event_set_sum',
})

export const planningDirectEventBundleFormulaHash = stableContentHash(
  planningDirectEventBundleFormulaIdentity,
)

export const planningDirectEventBundleSolverIdentity = Object.freeze({
  adapterVersion: planningDirectEventBundleVersion,
  strategy: 'deterministic_no_search',
  durationSource: 'planning_baseline_declared_duration',
})

export const planningDirectEventBundleSolverHash = stableContentHash(
  planningDirectEventBundleSolverIdentity,
)

function unavailableCapabilities(reason: string): PlanningCapabilityMatrix {
  return planningCapabilityMatrixSchema.parse([
    { capability: 'planning_damage', state: 'unavailable', supportIds: [], blockers: [reason] },
    { capability: 'planning_dps', state: 'unavailable', supportIds: [], blockers: [reason] },
  ])
}

function unsupported(
  baselineFingerprint: string,
  capabilities: PlanningCapabilityMatrix,
  blockers: readonly string[],
  kind: 'personal_solo' | 'member_in_team' = 'personal_solo',
): PlanningDpsResult {
  return planningDpsResultSchema.parse({
    status: 'unsupported',
    kind,
    baselineFingerprint,
    capabilities,
    blockers: [...new Set(blockers)],
  })
}

/**
 * Fail-closed adapter for one agent's standard direct-damage event bundle.
 * Formal event damage is divided by the explicitly declared Planning duration;
 * the Formal event set itself remains time-free.
 */
export function calculatePlanningDirectEventBundle(
  planningInput: unknown,
  eventSetInput: unknown,
  resultTarget: { kind: 'personal_solo' } | { kind: 'member_in_team'; subjectAgentId: string } = {
    kind: 'personal_solo',
  },
): PlanningDpsResult {
  const parsedPlanning = planningDpsInputSchema.safeParse(planningInput)
  const rawBaseline =
    typeof planningInput === 'object' && planningInput !== null && 'baseline' in planningInput
      ? (planningInput as { baseline: unknown }).baseline
      : { state: 'missing_planning_baseline' }
  const baselineFingerprint = stableContentHash(rawBaseline)

  if (!parsedPlanning.success) {
    const reason = 'Planning DPS 输入合同不完整或哈希不一致。'
    return unsupported(
      baselineFingerprint,
      unavailableCapabilities(reason),
      [reason],
      resultTarget.kind,
    )
  }

  const contract = createPlanningDpsContract(parsedPlanning.data)
  const capabilities = derivePlanningCapabilityMatrix(contract)
  const blockers = capabilities.flatMap((capability) => capability.blockers)
  const parsedEventSet = formalEventSetSchema.safeParse(eventSetInput)

  if (!parsedEventSet.success) {
    blockers.push('Formal 无时间轴事件集合输入不完整。')
    return unsupported(baselineFingerprint, capabilities, blockers, resultTarget.kind)
  }

  const eventSet = parsedEventSet.data
  const context = eventSet.context
  const baseline = contract.baseline
  const target = contract.calculationTarget
  blockers.push(...validatePlanningBundleContext(contract, context).blockers)

  const subjectAgentId =
    resultTarget.kind === 'member_in_team' ? resultTarget.subjectAgentId : target.agentIds[0]
  if (
    resultTarget.kind === 'personal_solo' &&
    (target.scope !== 'agent' || target.agentIds.length !== 1)
  )
    blockers.push('Personal standard direct event bundle 必须使用单代理人计算目标。')
  if (
    resultTarget.kind === 'member_in_team' &&
    (target.scope !== 'team' || target.agentIds.length !== 3)
  )
    blockers.push('Member In-Team standard direct event bundle 必须使用三人 team 计算目标。')
  if (!subjectAgentId || !target.agentIds.includes(subjectAgentId))
    blockers.push('伤害归属成员不属于 Planning calculationTarget。')
  if (baseline.formulaHash !== planningDirectEventBundleFormulaHash)
    blockers.push('Planning formulaHash 不是当前冻结的 standard direct event bundle。')
  if (contract.solverHash !== planningDirectEventBundleSolverHash)
    blockers.push('Planning solverHash 不是当前冻结的 deterministic adapter。')
  if (capabilities.some((capability) => capability.state !== 'ready') || blockers.length)
    return unsupported(baselineFingerprint, capabilities, blockers, resultTarget.kind)

  const formal = calculateFormalEventSet(eventSet, subjectAgentId)
  if (formal.status !== 'formal')
    return unsupported(baselineFingerprint, capabilities, formal.gaps, resultTarget.kind)

  return planningDpsResultSchema.parse({
    status: 'supported',
    kind: resultTarget.kind,
    subjectId: subjectAgentId,
    baselineFingerprint,
    declaredDurationSeconds: baseline.declaredDurationSeconds,
    capabilities,
    totalDamage: formal.totalDamage,
    planningDps: formal.totalDamage / baseline.declaredDurationSeconds,
  })
}
