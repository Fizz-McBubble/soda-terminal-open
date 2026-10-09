import { calculateCurrentPlanningEventDamage32 } from './currentPlanningEventDamage32'
import {
  compileReviewedRoxyTapAction32,
  type ReviewedRoxyTapActionInput32,
} from './reviewedRoxyTapAction32'
import {
  type SourceBackedPlanningEffectBucket,
  type SourceBackedEquipmentModifierBucket,
} from './currentPlanningDamageModifiers'
export { getPlanningDamageEventSemantics } from './currentPlanningDamageModifiers'
export type {
  SourceBackedPlanningEffectBucket,
  SourceBackedEquipmentModifierBucket,
} from './currentPlanningDamageModifiers'
import {
  compileCurrentPlanningSelfEffects32,
  planningRuntimeEffectBuckets32,
} from './currentPlanningSelfEffects32'
import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import type { CommonAnomalyEventObservation32 } from './currentCommonAnomalyEffects32'
import { planningEffectResolutionIdentity32 } from './currentPlanningEffectResolutionIdentity32'
import { stableContentHash } from '../gameDataPacks/types'
import {
  incremental32RecoveryPolicy,
  incremental32RecoveryReason,
} from '../gameDataPacks/incremental32RecoveryPolicy'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import {
  evaluatePlanningTeamDpsSchedule32,
  type SourceBackedPlanningTeamDpsInput,
} from './currentPlanningTeamDpsSchedule32'
export type { SourceBackedPlanningTeamDpsInput } from './currentPlanningTeamDpsSchedule32'
import {
  evaluateCurrentPlanningFormationEffects,
  evaluateCurrentPlanningInitialCritConversion32,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectRuntime'
import type { PlanningBaseline } from './planningDpsContract'
import { isDamageFormula32Version } from './sharpDamageCore'
import {
  type PotentialApplicationBinding,
  type PotentialApplicationEvent,
} from './potentialApplicationBinding'

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function directDamageFailureReason(member: PlanningEffectRuntimeMember) {
  return member.finalStats.actionDamageBonuses?.some((bonus) =>
    bonus.actionTypes.some((action) => action !== 'basic' && action !== 'dash'),
  )
    ? '当前动作资料未标注追击类型，暂不能比较这套驱动盘的动作加成。'
    : '当前等级、公式族或类型化盘面（基础攻防、裂伤、贯穿力）不完整，无法用于固定事件比较。'
}

/** Single-agent fixed-event slice used by Development Value Benchmark.
 * The caller supplies only source-backed direct-damage equipment buckets;
 * team effects and unobserved triggers remain outside this slice. Static
 * equipment stats already live in finalStats and must not be added again. */
type PersonalPlanningEvents =
  | { eventUsages: readonly PlanningEventUsage[]; sourceAction32?: never }
  | {
      eventUsages?: never
      sourceAction32: Omit<ReviewedRoxyTapActionInput32, 'skillLevel'> & {
        kind: 'roxy_prepared_tap'
      }
    }

export function evaluateSourceBackedPersonalPlanningDps(
  input: {
    member: PlanningEffectRuntimeMember
    baseline: PlanningBaseline
    equipmentModifierBuckets?: readonly SourceBackedEquipmentModifierBucket[]
    potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
    baselineReferences?: Readonly<Record<string, unknown>>
    commonAnomalyEvents?: Readonly<Record<string, readonly CommonAnomalyEventObservation32[]>>
  } & PersonalPlanningEvents,
) {
  if (
    incremental32RecoveryPolicy.enabled &&
    usesIncremental32Capabilities({
      members: [input.member],
      equipmentEffects: input.equipmentModifierBuckets,
      usesWindState: Object.values(input.commonAnomalyEvents ?? {}).some((rows) =>
        rows.some((row) => row.windswept),
      ),
    })
  )
    return { status: 'unsupported' as const, blockers: [incremental32RecoveryReason] }
  if (
    input.member.potential != null &&
    (!Number.isInteger(input.member.potential) ||
      input.member.potential < 0 ||
      input.member.potential > 6)
  )
    return { status: 'unsupported' as const, blockers: ['潜能影像必须为0至6的整数。'] }
  const source32 = isDamageFormula32Version(input.baseline.gameVersion)
  const action = input.sourceAction32
  if (
    action &&
    (!source32 ||
      action.kind !== 'roxy_prepared_tap' ||
      input.eventUsages !== undefined ||
      input.member.agentId !== 'agent-roxy' ||
      input.member.mindscape !== 0 ||
      (input.member.potential != null && input.member.potential !== 0) ||
      !Number.isFinite(input.baseline.declaredDurationSeconds) ||
      input.baseline.declaredDurationSeconds < 1)
  )
    return { status: 'unsupported' as const, blockers: ['prepared_action_context_mismatch'] }
  const sourceAction = action
    ? compileReviewedRoxyTapAction32({
        ...action,
        skillLevel: input.member.skillLevels?.special ?? Number.NaN,
      })
    : null
  if (sourceAction?.status === 'unsupported')
    return { status: 'unsupported' as const, blockers: sourceAction.reasons }
  const eventUsages = sourceAction?.eventUsages ?? input.eventUsages
  if (!eventUsages) return { status: 'unsupported' as const, blockers: ['missing_planning_events'] }
  const self = source32
    ? compileCurrentPlanningSelfEffects32({
        member: input.member,
        references: input.baselineReferences,
      })
    : null
  if (self?.status === 'unsupported') return self
  const effectBuckets: SourceBackedPlanningEffectBucket[] = []
  const effectExclusions = self?.status === 'supported' ? [...self.exclusions] : []
  const potentialApplications: PotentialApplicationBinding[] = []
  const diagnosticBlockers: string[] = []
  const totalDamage = calculateCurrentPlanningEventDamage32({
    member: input.member,
    buckets: [
      ...(input.equipmentModifierBuckets ?? []),
      ...(self?.status === 'supported' ? self.buckets : []),
    ],
    eventUsages: eventUsages.filter((usage) => usage.ownerAgentId === input.member.agentId),
    baseline: input.baseline,
    potentialEvents: input.potentialEvents,
    potentialApplications,
    diagnosticBlockers,
    eventEffectContext: source32
      ? {
          memberIds: [input.member.agentId],
          members: [input.member],
          entries: self?.status === 'supported' ? self.entries : [],
          baselineReferencesByAgentId: { [input.member.agentId]: input.baselineReferences ?? {} },
          commonAnomalyEvents: input.commonAnomalyEvents,
          consumedBuckets: effectBuckets,
          exclusions: effectExclusions,
        }
      : undefined,
  })
  if (totalDamage === null || !Number.isFinite(totalDamage))
    return {
      status: 'unsupported' as const,
      blockers: diagnosticBlockers.length
        ? unique(diagnosticBlockers)
        : [`${input.member.agentId}：${directDamageFailureReason(input.member)}`],
    }
  const core = {
    status: 'supported' as const,
    totalDamage,
    planningDps: totalDamage / input.baseline.declaredDurationSeconds,
    declaredDurationSeconds: input.baseline.declaredDurationSeconds,
    ...(sourceAction?.status === 'supported'
      ? {
          sourceAction32: {
            identity: sourceAction.sourceIdentity,
            resourceLegality: sourceAction.resourceLegality,
            boundaries: sourceAction.boundaries,
            formalCyclePromotion: false as const,
          },
        }
      : {}),
    levelAuthority:
      input.member.level === undefined
        ? ('legacy_declared_level60' as const)
        : ('explicit_actor_level' as const),
    potentialApplications,
    initialCritConversion: isDamageFormula32Version(input.baseline.gameVersion)
      ? evaluateCurrentPlanningInitialCritConversion32(input.member)
      : null,
    effectBuckets,
    sourceEffectExclusions: effectExclusions,
    sourceResolvedInactiveEffectKeys:
      self?.status === 'supported' ? self.resolvedInactiveEffectKeys : [],
    equipmentModifierBuckets: [...(input.equipmentModifierBuckets ?? [])],
    directEquipmentEffectBucketCount: (input.equipmentModifierBuckets ?? []).filter(
      (bucket) =>
        ![
          'outside_direct_event_formula',
          'shield_percent',
          'daze_increase',
          'daze_reduction',
          'energy_regen_percent',
          'energy_regen_flat',
        ].includes(bucket.application),
    ).length,
    boundary:
      '单代理人固定事件只比较同一已确认音擎下的六盘变化，并消费已来源化且进入直接伤害公式的装备 bucket；静态盘面不重复叠加，队伍效果和未观测条件效果保持排除。',
  }
  return {
    ...core,
    runtimeHash: stableContentHash({
      ...core,
      member: input.member,
      baseline: input.baseline,
      effectResolutionIdentity: source32 ? planningEffectResolutionIdentity32 : null,
      potentialEvents: input.potentialEvents ?? null,
      baselineReferences: input.baselineReferences ?? null,
      commonAnomalyEvents: input.commonAnomalyEvents ?? null,
    }),
  }
}

/**
 * Applies only receiver semantics that are directly represented by the fixed
 * event direct-damage formula. Other source-backed effects remain explicit
 * buckets, rather than being silently folded into a made-up direct multiplier.
 */
function evaluatePlanningTeamDpsSlice(input: SourceBackedPlanningTeamDpsInput) {
  if (
    incremental32RecoveryPolicy.enabled &&
    usesIncremental32Capabilities({
      members: input.members,
      equipmentEffects: input.equipmentModifierBuckets,
      usesWindState: Object.values(input.commonAnomalyEvents ?? {}).some((rows) =>
        rows.some((row) => row.windswept),
      ),
    })
  )
    return { status: 'unsupported' as const, blockers: [incremental32RecoveryReason] }
  const runtime = evaluateCurrentPlanningFormationEffects({
    memberIds: input.memberIds,
    members: input.members,
    baselineReferencesByAgentId: input.baselineReferencesByAgentId,
  })
  if (runtime.status === 'unsupported') return runtime
  const buckets = planningRuntimeEffectBuckets32(runtime.results, input.memberIds)
  const allBuckets = [...buckets, ...(input.equipmentModifierBuckets ?? [])]

  const damageByAgentId = new Map<string, number>()
  const consumedBuckets: SourceBackedPlanningEffectBucket[] = []
  const effectExclusions: Array<{
    effectKey: string
    reason: string
    fields: string[]
    sourceRefs: string[]
  }> = []
  const potentialApplications: PotentialApplicationBinding[] = []
  const blockers: string[] = []
  for (const member of input.members) {
    const diagnosticBlockers: string[] = []
    const totalDamage = calculateCurrentPlanningEventDamage32({
      member,
      buckets: allBuckets,
      eventUsages: input.eventUsages.filter((usage) => usage.ownerAgentId === member.agentId),
      baseline: input.baseline,
      potentialEvents: input.potentialEvents,
      potentialApplications,
      diagnosticBlockers,
      eventEffectContext: isDamageFormula32Version(input.baseline.gameVersion)
        ? {
            memberIds: input.memberIds,
            members: input.members,
            entries: currentAgentPlanningEffectBlueprints.filter(
              (entry) =>
                input.memberIds.includes(entry.providerAgentId) &&
                entry.numericExpression.sourceStatus === 'upstream_expression_available',
            ),
            baselineReferencesByAgentId: input.baselineReferencesByAgentId,
            commonAnomalyEvents: input.commonAnomalyEvents,
            consumedBuckets,
            exclusions: effectExclusions,
          }
        : undefined,
    })
    if (totalDamage === null || !Number.isFinite(totalDamage)) {
      blockers.push(
        ...(diagnosticBlockers.length
          ? diagnosticBlockers
          : [`${member.agentId}：${directDamageFailureReason(member)}`]),
      )
      continue
    }
    damageByAgentId.set(member.agentId, totalDamage)
  }
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }
  const memberDamage = input.memberIds.map((agentId) => ({
    agentId,
    totalDamage: damageByAgentId.get(agentId)!,
  }))
  return {
    status: 'supported' as const,
    memberDamage,
    potentialApplications,
    effectBuckets: isDamageFormula32Version(input.baseline.gameVersion) ? consumedBuckets : buckets,
    sourceEffectExclusions: effectExclusions,
    equipmentModifierBuckets: [...(input.equipmentModifierBuckets ?? [])],
    directEffectBucketCount: buckets.filter(
      (bucket) => bucket.application !== 'outside_direct_event_formula',
    ).length,
    outsideDirectEventFormulaBucketCount: buckets.filter(
      (bucket) => bucket.application === 'outside_direct_event_formula',
    ).length,
    runtimeHash: stableContentHash({
      memberDamage,
      members: input.members,
      buckets: allBuckets,
      baselineReferencesByAgentId: input.baselineReferencesByAgentId ?? null,
      consumedBuckets,
      effectExclusions,
      commonAnomalyEvents: input.commonAnomalyEvents ?? null,
      potentialApplications,
      baseline: input.baseline,
      effectResolutionIdentity: isDamageFormula32Version(input.baseline.gameVersion)
        ? planningEffectResolutionIdentity32
        : null,
      potentialEvents: input.potentialEvents ?? null,
    }),
    boundary:
      '固定事件直接伤害只消费已由 CalculationContext 表示的攻、暴、伤害、穿透、减防与减抗 bucket；异常积蓄、失衡、资源和其他公式族效果保留为 source-backed bucket，不补零或伪装为直接伤害。',
  }
}

/** Keep the existing event/formula chain, evaluating each declared state once.
 * A declared schedule alone never upgrades a benchmark to a verified rotation. */
export function evaluateSourceBackedPlanningTeamDps(input: SourceBackedPlanningTeamDpsInput) {
  return evaluatePlanningTeamDpsSchedule32(input, evaluatePlanningTeamDpsSlice)
}

export type PlanningTeamDpsSliceResult32 = ReturnType<typeof evaluatePlanningTeamDpsSlice>
import { usesIncremental32Capabilities } from '../gameDataPacks/incremental32AffectedCapabilities'
