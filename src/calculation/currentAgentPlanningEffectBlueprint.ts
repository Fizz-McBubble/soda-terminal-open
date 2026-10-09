import { stableContentHash } from '../gameDataPacks/types'
import { canonicalJson, sha256 } from '../application/contentHash'
import { reconcileProductionSourceExpression } from './dynamic/sourceExpressionReconciliation'
import {
  currentAgentDecisionMechanicContracts,
  getCurrentAgentDecisionMechanicContract,
} from './currentAgentDecisionMechanicContracts'
import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'
import { reviewedPotentialEffectBlueprints } from './reviewedPotentialEffectBlueprints'

export type PlanningEffectTargetKind = 'self' | 'active_agent' | 'team' | 'enemy'

export type CurrentAgentPlanningEffectBlueprint = {
  effectKey: string
  providerAgentId: string
  effectId: string
  applicationScope?: 'generic' | 'event_only'
  targetKinds: PlanningEffectTargetKind[]
  snapshotPolicy: 'recompute_per_event'
  activationBoundary: 'explicit_planning_baseline_disposition_required'
  numericExpression: {
    sourceStatus: 'upstream_expression_available' | 'declarative_baseline_input'
    operators: string[]
    dependencyKinds: string[]
    expressionSha256: string
    expressionIr: UpstreamExpressionIR
    expressionIrReady: true
    todoBoundary: string | null
    requiredExplicitRuntimeReferences?: string[]
    originalSource?: {
      formulaSha256: string
      expressionSha256: string
      expressionIrSha256: string
    }
  }
  sourceRefs: string[]
}

function effectiveExpressionMetadata(expression: UpstreamExpressionIR) {
  const operators = new Set<string>()
  const dependencyKinds = new Set<string>()
  const walk = (node: UpstreamExpressionIR) => {
    if (node.kind === 'call') {
      operators.add(node.operator)
      node.arguments.forEach(walk)
      if (node.receiver) walk(node.receiver)
    } else if (node.kind === 'reference') {
      if (/^(own|target)\.(initial|final)\./.test(node.path)) dependencyKinds.add('mapped_stat')
      else if (node.path.startsWith('char.')) dependencyKinds.add('character_state')
      else if (node.path.startsWith('dm.')) dependencyKinds.add('mapped_parameter')
      else if (node.path.startsWith('team.')) dependencyKinds.add('team_composition')
      else if (!node.path.includes('.combat.')) dependencyKinds.add('conditional_state')
    } else if (node.kind === 'literal') dependencyKinds.add('literal')
    else if (node.kind === 'array') node.items.forEach(walk)
    else if (node.kind === 'object') node.entries.forEach((entry) => walk(entry.value))
    else if (node.kind === 'property') walk(node.receiver)
    else if (node.kind === 'element') {
      walk(node.receiver)
      walk(node.index)
    }
  }
  walk(expression)
  return { operators: [...operators].sort(), dependencyKinds: [...dependencyKinds].sort() }
}

export function compileAgentPlanningEffectBlueprints(
  agentId: string,
): CurrentAgentPlanningEffectBlueprint[] {
  const contract = getCurrentAgentDecisionMechanicContract(agentId)
  if (!contract) throw new Error(`缺少代理人 Decision Mechanic 合同：${agentId}`)
  return contract.effectContract.effects.map((effect) => {
    const sourceStatus = effect.numericExpression.classification
    if (
      sourceStatus !== 'upstream_expression_available' &&
      sourceStatus !== 'declarative_baseline_input'
    )
      throw new Error(`效果缺少数值表达式来源：${agentId}:${effect.effectId}`)

    let expressionIr = effect.numericExpression.expressionIr as UpstreamExpressionIR
    let expressionSha256 = effect.numericExpression.expressionSha256
    let sourceRefs = [
      `${contract.effectContract.source.repository}@${contract.effectContract.source.commit}`,
      `${contract.effectContract.source.formulaPath}#${contract.effectContract.source.formulaSha256}`,
      effect.locator,
    ]
    let todoBoundary = effect.numericExpression.todoBoundary
    let reconciledMetadata: ReturnType<typeof effectiveExpressionMetadata> | null = null
    const originalSource = {
      formulaSha256: contract.effectContract.source.formulaSha256,
      expressionSha256: effect.numericExpression.expressionSha256,
      expressionIrSha256: sha256(canonicalJson(expressionIr)),
    }

    try {
      const reconciled = reconcileProductionSourceExpression({
        agentId,
        effectId: effect.effectId,
        sourceCommit: contract.effectContract.source.commit,
        sourcePath: contract.effectContract.source.formulaPath,
        formulaSha256: originalSource.formulaSha256,
        expressionSha256: originalSource.expressionSha256,
        originalIrSha256: originalSource.expressionIrSha256,
        expression: expressionIr,
      })
      if (reconciled.applied) {
        expressionIr = reconciled.expression as UpstreamExpressionIR
        expressionSha256 = sha256(canonicalJson(expressionIr))
        sourceRefs = [...sourceRefs, ...reconciled.evidence]
        reconciledMetadata = effectiveExpressionMetadata(expressionIr)
      }
    } catch (err: unknown) {
      // 来源漂移拒绝而非悄悄兜底；避免因为全模块初始化抛错让无关角色无法使用
      const msg = err instanceof Error ? err.message : String(err)
      todoBoundary = `reconciliation_drift:${msg}`
    }

    return {
      effectKey: `${agentId}:${effect.effectId}`,
      providerAgentId: agentId,
      effectId: effect.effectId,
      applicationScope: effect.applicationScope as 'generic' | 'event_only',
      targetKinds: [...new Set(effect.recipients)] as PlanningEffectTargetKind[],
      // R1 never assumes that a buff persists or snapshots. Every included effect
      // is recomputed against the named event unless a later version adds a
      // source-backed window operator.
      snapshotPolicy: 'recompute_per_event',
      activationBoundary: 'explicit_planning_baseline_disposition_required' as const,
      numericExpression: {
        sourceStatus,
        operators: reconciledMetadata?.operators ?? effect.numericExpression.operators,
        dependencyKinds:
          reconciledMetadata?.dependencyKinds ?? effect.numericExpression.dependencyKinds,
        expressionSha256,
        expressionIr,
        expressionIrReady: true,
        todoBoundary,
        ...(reconciledMetadata || todoBoundary?.startsWith('reconciliation_drift:')
          ? { originalSource }
          : {}),
        ...(agentId === 'agent-lighter' &&
        ['ability_ice_dmg_', 'ability_fire_dmg_'].includes(effect.effectId)
          ? { requiredExplicitRuntimeReferences: ['elation'] }
          : {}),
      },
      sourceRefs,
    }
  })
}

const upstreamAgentPlanningEffectBlueprints = Object.freeze(
  currentAgentDecisionMechanicContracts.flatMap((contract) =>
    compileAgentPlanningEffectBlueprints(contract.agentId),
  ),
)

export const currentAgentPlanningEffectBlueprints = Object.freeze([
  ...upstreamAgentPlanningEffectBlueprints,
  ...reviewedPotentialEffectBlueprints,
])

const blueprintByKey = new Map(
  currentAgentPlanningEffectBlueprints.map((blueprint) => [blueprint.effectKey, blueprint]),
)

// These are source-only blueprints, validated once when the pinned catalog is
// loaded. Formation queries must still evaluate every event and its observations;
// they do not need to hash and reconcile the same immutable source IR again.
const blueprintsByAgent = new Map(
  currentAgentDecisionMechanicContracts.map((contract) => [
    contract.agentId,
    currentAgentPlanningEffectBlueprints.filter(
      (blueprint) => blueprint.providerAgentId === contract.agentId,
    ),
  ]),
)

if (blueprintByKey.size !== currentAgentPlanningEffectBlueprints.length)
  throw new Error('Planning effect blueprint 存在重复 effectKey。')

export function getCurrentAgentPlanningEffectBlueprint(effectKey: string) {
  return blueprintByKey.get(effectKey) ?? null
}

export function compileFormationPlanningEffectBlueprints(memberIds: readonly string[]) {
  const blockers: string[] = []
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3)
    blockers.push('Planning effect blueprint 要求三名不重复代理人。')
  const entries = memberIds.flatMap((agentId) => {
    const contract = getCurrentAgentDecisionMechanicContract(agentId)
    if (!contract) {
      blockers.push(`缺少代理人 Decision Mechanic 合同：${agentId}`)
      return []
    }
    return blueprintsByAgent.get(agentId) ?? []
  })
  return blockers.length
    ? { status: 'unsupported' as const, blockers: [...new Set(blockers)] }
    : {
        status: 'supported' as const,
        entries,
        blueprintHash: stableContentHash(entries),
      }
}

export const currentAgentPlanningEffectBlueprintCoverage = Object.freeze({
  contract: 'soda-current-agent-planning-effect-blueprint/v1',
  agentCount: currentAgentDecisionMechanicContracts.length,
  effectCount: currentAgentPlanningEffectBlueprints.length,
  upstreamEffectCount: upstreamAgentPlanningEffectBlueprints.length,
  reviewedPotentialEffectCount: reviewedPotentialEffectBlueprints.length,
  ownerReadyCount: currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.providerAgentId.length > 0,
  ).length,
  targetReadyCount: currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.targetKinds.length > 0,
  ).length,
  snapshotPolicyReadyCount: currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.snapshotPolicy === 'recompute_per_event',
  ).length,
  upstreamNumericExpressionAvailableCount: currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.numericExpression.sourceStatus === 'upstream_expression_available',
  ).length,
  upstreamDeclarativeBaselineInputExpressionCount: upstreamAgentPlanningEffectBlueprints.filter(
    (entry) => entry.numericExpression.sourceStatus === 'declarative_baseline_input',
  ).length,
  reviewedDeclarativeBaselineInputExpressionCount: reviewedPotentialEffectBlueprints.filter(
    (entry) => entry.numericExpression.sourceStatus === 'declarative_baseline_input',
  ).length,
  declarativeBaselineInputExpressionCount: currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.numericExpression.sourceStatus === 'declarative_baseline_input',
  ).length,
  todoBoundaryExpressionCount: currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.numericExpression.todoBoundary !== null,
  ).length,
  missingNumericExpressionCount: 0,
  sharedExpressionIrReadyCount: currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.numericExpression.expressionIrReady,
  ).length,
  sharedExpressionIrPendingCount: 0,
  productionExpressionRuntimeReadyCount: 0,
  dedicatedAdapterCount: 0,
  boundary:
    'Upstream and reviewed prose effects remain separately counted from their current catalogs. Upstream-expression-available means reusable formula source exists, not that its runtime inputs, activation window or duration are production-ready. Generic conditionals compile as declarative PlanningBaseline inputs; event-only effects require the event source registration; upstream TODO boundaries remain fail-closed when the affected condition is selected. Recompute-per-event never invents persistent snapshot semantics.',
})
