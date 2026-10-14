import { type PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import { isReviewedTemplateMechanicEffect32 } from './reviewedTemplateMechanicEffects32'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { PlanningEffectRuntimeStats } from './currentPlanningEffectDomain'
import { stableContentHash } from '../gameDataPacks/types'
import { compileFormationPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { compileCurrentPlanningBaselineTimelineContracts } from './currentPlanningBaselineObservations'
import {
  isVerifiedFormationTimeline,
  type FormationTimeline,
} from './verifiedPlanningFormationTimeline'
import { compileSourceBackedPlanningInteractionContracts } from './currentPlanningInteractionMechanicIR'
import { currentNormalizedPlanningBaseline } from './currentNormalizedPlanningBaseline'
import type { PlanningEffectDisposition } from './planningCalculationContextCompiler'
import type { PlanningInteractionContract } from './planningInteractionOperators'
import { unique, evaluateFormationEffects } from './currentPlanningFormationEffectEvaluation'
export {
  bindPlanningEffectRuntimePotentialReference,
  createLevel60NeutralEffectRuntimeMember,
} from './currentPlanningEffectDomain'
export type {
  PlanningEffectRuntimeStats,
  PlanningEffectRuntimeMember,
} from './currentPlanningEffectDomain'
export { evaluateInitialCritConversion32 as evaluateCurrentPlanningInitialCritConversion32 } from './currentInitialCritConversion32'
export { compileCurrentPlanningFormationEffectTimeline } from './verifiedPlanningFormationTimeline'

export function evaluateCurrentPlanningFormationEffects(input: {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  finalStatsByAgentId?: Readonly<Record<string, PlanningEffectRuntimeStats>>
}) {
  return evaluateFormationEffects(input, compileFormationPlanningEffectBlueprints(input.memberIds))
}

export function evaluateCurrentPlanningEffectEntries32(
  input: {
    memberIds: readonly string[]
    members: readonly PlanningEffectRuntimeMember[]
    baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    finalStatsByAgentId?: Readonly<Record<string, PlanningEffectRuntimeStats>>
  },
  entries: CurrentAgentPlanningEffectBlueprint[],
) {
  return evaluateFormationEffects(input, {
    status: 'supported',
    entries,
    blueprintHash: stableContentHash(entries),
  })
}

export function compileCurrentPlanningFormationEffectObservations(
  input: {
    memberIds: readonly [string, string, string]
    members: readonly PlanningEffectRuntimeMember[]
    baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  },
  reusedTimeline?: FormationTimeline,
) {
  if (reusedTimeline !== undefined && !isVerifiedFormationTimeline(reusedTimeline, input.memberIds))
    return {
      status: 'unsupported' as const,
      blockers: ['PlanningBaseline timeline 复用需要同一已验证成员绑定与未改写来源合同。'],
    }
  const blueprints = compileFormationPlanningEffectBlueprints(input.memberIds)
  const runtime = evaluateFormationEffects(input, blueprints)
  if (runtime.status === 'unsupported') return runtime
  const timeline =
    reusedTimeline ?? compileCurrentPlanningBaselineTimelineContracts(input.memberIds)
  if (timeline.status === 'unsupported') return timeline
  if (blueprints.status === 'unsupported') return blueprints
  const blueprintByKey = new Map(blueprints.entries.map((entry) => [entry.effectKey, entry]))
  const fieldTime = timeline.contracts.find(
    (contract) => contract.operator === 'field_time_opportunity_cost',
  )
  if (fieldTime?.operator !== 'field_time_opportunity_cost')
    return { status: 'unsupported' as const, blockers: ['PlanningBaseline 缺 field-time 合同。'] }
  const activeAgentId = fieldTime.allocations.toSorted(
    (left, right) => right.activeSeconds - left.activeSeconds,
  )[0]!.agentId
  const baselineRef = `planning-baseline:${currentNormalizedPlanningBaseline.baselineId}:effects`
  const dispositions: PlanningEffectDisposition[] = []
  const contracts: PlanningInteractionContract[] = []
  const blockers: string[] = []
  for (const result of runtime.results) {
    if (result.status === 'unsupported') {
      blockers.push(...result.blockers.map((blocker) => `${result.effectKey}: ${blocker}`))
      continue
    }
    const blueprint = blueprintByKey.get(result.effectKey)!
    if (result.status === 'excluded_unknown') {
      dispositions.push({
        effectKey: result.effectKey,
        disposition: 'excluded_unknown',
        activeSeconds: 0,
        targetAgentId: null,
        reason:
          'The source effect has no explicit condition observation or reviewed source-bound selection; its value remains unknown in this comparison.',
        evidenceRefs: unique([...result.sourceRefs, baselineRef]),
      })
      continue
    }
    if (result.active && result.todoBoundary) {
      blockers.push(
        `${result.effectKey}: 上游 TODO 条件被选中，必须显式补齐 declarative contract。`,
      )
      continue
    }
    const targetAgentId =
      result.recipientAgentIds?.[0] ??
      (blueprint.targetKinds.includes('active_agent') ? activeAgentId : null)
    const reviewedTemplate = isReviewedTemplateMechanicEffect32(blueprint)
    const evidenceRefs = unique([
      ...result.sourceRefs,
      baselineRef,
      ...(reviewedTemplate
        ? [
            `expression-sha256:${blueprint.numericExpression.expressionSha256}`,
            'reviewed-template-comparison-coordinate-not-temporal-proof',
          ]
        : []),
    ])
    dispositions.push({
      effectKey: result.effectKey,
      disposition: result.active ? 'included' : 'excluded',
      activeSeconds: result.active ? currentNormalizedPlanningBaseline.declaredDurationSeconds : 0,
      targetAgentId,
      reason: result.active
        ? reviewedTemplate
          ? 'The source expression is resolved for each counted comparison event; the declared window is a comparison coordinate, not measured uptime or temporal proof.'
          : 'The neutral fixed-event baseline resolves this source expression to a non-zero value for the full declared comparison window.'
        : 'The neutral fixed-event baseline leaves this condition inactive or the account gate evaluates to zero.',
      evidenceRefs,
    })
    if (!result.active) continue
    const recipientAgentIds =
      result.recipientAgentIds ??
      (blueprint.targetKinds.includes('self')
        ? [result.providerAgentId]
        : blueprint.targetKinds.includes('active_agent')
          ? [activeAgentId]
          : [...input.memberIds])
    contracts.push({
      contractId: `${currentNormalizedPlanningBaseline.baselineId}:${result.effectKey}`,
      operator: 'team_effect_resolution',
      authority: 'source_backed',
      sourceRefs: evidenceRefs,
      effectKey: result.effectKey,
      ownerAgentId: result.providerAgentId,
      recipientAgentIds: unique(recipientAgentIds),
      snapshotPolicy: 'recompute_per_event',
      value: result.value as number,
      durationSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
      windows: [
        {
          startSeconds: 0,
          endSeconds: currentNormalizedPlanningBaseline.declaredDurationSeconds,
        },
      ],
    })
  }
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }
  const requiredOperators = contracts.length > 0 ? (['team_effect_resolution'] as const) : []
  const compilation = compileSourceBackedPlanningInteractionContracts({
    memberIds: input.memberIds,
    contracts,
    requiredOperators,
  })
  if (compilation.status === 'unsupported') return compilation
  return {
    status: 'supported' as const,
    dispositions,
    contracts,
    sourceCompilation: compilation,
    effectObservationHash: stableContentHash({ dispositions, contracts }),
  }
}
