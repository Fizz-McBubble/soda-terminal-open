import { stableContentHash } from '../gameDataPacks/types'
import type { CalculationContext } from './calculationContext'
import {
  planningDpsResultSchema,
  type PlanningCapabilityMatrix,
  type PlanningDpsContract,
} from './planningDpsContract'

type RuntimeAgent = { level: number; mindscape: number }
type RuntimeWEngine = { id: string; level: number; refinement: number }
type RuntimeDisc = { id: string; slot: number; setId: string; level: number }

export function unsupportedPlanningPersonalResult(
  baselineFingerprint: string,
  capabilities: PlanningCapabilityMatrix,
  blockers: readonly string[],
) {
  return planningDpsResultSchema.parse({
    status: 'unsupported',
    kind: 'personal_solo',
    baselineFingerprint,
    capabilities,
    blockers: [...new Set(blockers)],
  })
}

export function validatePlanningRuntimeBinding(input: {
  agentId: string
  context: CalculationContext
  accountId: string
  agent: RuntimeAgent
  wEngine: RuntimeWEngine
  discs: readonly RuntimeDisc[]
  finalStatsHash: string
  evidenceFieldIds: readonly string[]
}) {
  const blockers: string[] = []
  const actor = input.context.actors.find((item) => item.agentId === input.agentId)
  const contextDiscBySlot = new Map(actor?.discs.map((disc) => [disc.slot, disc]))
  const declaredEvidence = new Set(input.context.evidence.map((item) => item.fieldId))

  if (!actor) blockers.push(`CalculationContext actor is not ${input.agentId}.`)
  if (input.context.accountSnapshot.accountId !== input.accountId)
    blockers.push('Final-stat accountId does not match CalculationContext.')
  if (actor?.level !== input.agent.level || actor?.mindscape !== input.agent.mindscape)
    blockers.push(`${input.agentId} level or mindscape does not match CalculationContext.`)
  if (
    actor?.wEngine?.id !== input.wEngine.id ||
    actor?.wEngine?.level !== input.wEngine.level ||
    actor?.wEngine?.refinement !== input.wEngine.refinement
  )
    blockers.push(`${input.agentId} W-Engine does not match CalculationContext.`)
  if (actor?.finalStatsHash !== input.finalStatsHash)
    blockers.push('CalculationContext finalStatsHash is not the verified runtime projection.')
  input.discs.forEach((disc) => {
    const contextDisc = contextDiscBySlot.get(disc.slot)
    if (
      !contextDisc ||
      contextDisc.id !== disc.id ||
      contextDisc.setId !== disc.setId ||
      contextDisc.level !== disc.level ||
      contextDisc.statsHash !== stableContentHash(disc)
    )
      blockers.push(`CalculationContext disc slot ${disc.slot} does not match the real loadout.`)
  })
  input.evidenceFieldIds
    .filter((fieldId) => !declaredEvidence.has(fieldId))
    .forEach((fieldId) => blockers.push(`Context evidence ${fieldId} is not declared.`))

  return { actor, blockers }
}

export function validatePlanningBundleContext(
  contract: PlanningDpsContract,
  context: CalculationContext,
) {
  const blockers: string[] = []
  const { baseline, accountSnapshot: snapshot, calculationTarget: target } = contract
  const enemy = context.scenario.enemy

  if (
    context.scope.kind !== target.scope ||
    stableContentHash(context.scope.agentIds) !== stableContentHash(target.agentIds)
  )
    blockers.push('CalculationContext 代理人范围与 Planning calculationTarget 不一致。')
  if (
    stableContentHash(context.actors.map((actor) => actor.agentId)) !==
    stableContentHash(target.agentIds)
  )
    blockers.push('CalculationContext actor 身份与 Planning calculationTarget 不一致。')
  if (snapshot.accountId !== context.accountSnapshot.accountId)
    blockers.push('账户快照 accountId 与 CalculationContext 不一致。')
  if (snapshot.rosterHash !== context.accountSnapshot.rosterHash)
    blockers.push('账户快照 rosterHash 与 CalculationContext 不一致。')
  if (snapshot.warehouseHash !== context.accountSnapshot.warehouseHash)
    blockers.push('账户快照 warehouseHash 与 CalculationContext 不一致。')
  if (snapshot.planningHash !== context.accountSnapshot.planningHash)
    blockers.push('账户快照 planningHash 与 CalculationContext 不一致。')
  if (snapshot.stale || context.accountSnapshot.stale) blockers.push('账户资产快照已过期。')
  if (
    baseline.gameVersion !== context.gameVersion ||
    baseline.gameVersion !== context.canonical.gameVersion
  )
    blockers.push('Planning baseline 与 CalculationContext 的游戏版本不一致。')
  if (baseline.sourcePackHash !== context.canonical.contentHash)
    blockers.push('Planning sourcePackHash 与 CalculationContext canonical 内容不一致。')
  if (!enemy) blockers.push('CalculationContext 缺少敌人基线。')
  else {
    if (baseline.enemy.id !== enemy.id) blockers.push('敌人身份与 Planning baseline 不一致。')
    if (baseline.enemy.defense !== enemy.defense)
      blockers.push('敌人防御与 Planning baseline 不一致。')
    if (baseline.enemy.resistance !== enemy.resistance)
      blockers.push('敌人抗性与 Planning baseline 不一致。')
    if (baseline.enemy.stunMultiplier !== enemy.stunMultiplier)
      blockers.push('敌人失衡倍率与 Planning baseline 不一致。')
    if (baseline.enemy.vulnerability !== enemy.vulnerability)
      blockers.push('敌人易伤与 Planning baseline 不一致。')
  }

  return { blockers, enemy }
}
