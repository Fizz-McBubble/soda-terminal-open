import { stableContentHash } from '../gameDataPacks/types'
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
  }
  sourceRefs: string[]
}

function compileEffectBlueprints(agentId: string): CurrentAgentPlanningEffectBlueprint[] {
  const contract = getCurrentAgentDecisionMechanicContract(agentId)
  if (!contract) throw new Error(`缺少代理人 Decision Mechanic 合同：${agentId}`)
  return contract.effectContract.effects.map((effect) => {
    const sourceStatus = effect.numericExpression.classification
    if (
      sourceStatus !== 'upstream_expression_available' &&
      sourceStatus !== 'declarative_baseline_input'
    )
      throw new Error(`效果缺少数值表达式来源：${agentId}:${effect.effectId}`)
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
        operators: effect.numericExpression.operators,
        dependencyKinds: effect.numericExpression.dependencyKinds,
        expressionSha256: effect.numericExpression.expressionSha256,
        expressionIr: effect.numericExpression.expressionIr as UpstreamExpressionIR,
        expressionIrReady: true,
        todoBoundary: effect.numericExpression.todoBoundary,
      },
      sourceRefs: [
        `${contract.effectContract.source.repository}@${contract.effectContract.source.commit}`,
        `${contract.effectContract.source.formulaPath}#${contract.effectContract.source.formulaSha256}`,
        effect.locator,
      ],
    }
  })
}

const upstreamAgentPlanningEffectBlueprints = Object.freeze(
  currentAgentDecisionMechanicContracts.flatMap((contract) =>
    compileEffectBlueprints(contract.agentId),
  ),
)

export const currentAgentPlanningEffectBlueprints = Object.freeze([
  ...upstreamAgentPlanningEffectBlueprints,
  ...reviewedPotentialEffectBlueprints,
])

const blueprintByKey = new Map(
  currentAgentPlanningEffectBlueprints.map((blueprint) => [blueprint.effectKey, blueprint]),
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
    return [
      ...compileEffectBlueprints(agentId),
      ...reviewedPotentialEffectBlueprints.filter((effect) => effect.providerAgentId === agentId),
    ]
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
