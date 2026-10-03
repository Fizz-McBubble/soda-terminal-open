import { stableContentHash } from '../gameDataPacks/types'
import { planningEffectResolutionIdentity32 } from './currentPlanningEffectResolutionIdentity32'
import {
  planningEventScheduleGaps32,
  type PlanningEventSchedule32,
} from './planningEventOccurrenceState32'
import type { PlanningTeamDpsSliceResult32 } from './currentPlanningTeamDpsRuntime'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { PlanningBaseline } from './planningDpsContract'
import type { SourceBackedEquipmentModifierBucket } from './currentPlanningDamageModifiers'
import type { CommonAnomalyEventObservation32 } from './currentCommonAnomalyEffects32'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'

const unique = (values: readonly string[]) => [...new Set(values)]

export type SourceBackedPlanningTeamDpsInput = {
  memberIds: readonly [string, string, string]
  members: readonly PlanningEffectRuntimeMember[]
  eventUsages: readonly PlanningEventUsage[]
  baseline: PlanningBaseline
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  equipmentModifierBuckets?: readonly SourceBackedEquipmentModifierBucket[]
  potentialEvents?: Readonly<Record<string, PotentialApplicationEvent>>
  commonAnomalyEvents?: Readonly<Record<string, readonly CommonAnomalyEventObservation32[]>>
  eventSchedule32?: PlanningEventSchedule32
}

export function evaluatePlanningTeamDpsSchedule32(
  input: SourceBackedPlanningTeamDpsInput,
  evaluatePlanningTeamDpsSlice: (
    input: SourceBackedPlanningTeamDpsInput,
  ) => PlanningTeamDpsSliceResult32,
) {
  const schedule = input.eventSchedule32
  if (!schedule) return evaluatePlanningTeamDpsSlice(input)
  const blockers = planningEventScheduleGaps32({
    schedule,
    gameVersion: input.baseline.gameVersion,
    memberIds: input.memberIds,
    eventUsages: input.eventUsages,
    declaredDurationSeconds: input.baseline.declaredDurationSeconds,
  })
  if (input.baselineReferencesByAgentId || input.commonAnomalyEvents || input.potentialEvents)
    blockers.push('逐次条件不能与全局事件条件或观测混用。')
  if (blockers.length) return { status: 'unsupported' as const, blockers: unique(blockers) }
  const slices: Array<{
    occurrence: PlanningEventSchedule32['occurrences'][number]
    result: Extract<ReturnType<typeof evaluatePlanningTeamDpsSlice>, { status: 'supported' }>
  }> = []
  const usages = new Map(
    input.eventUsages.map((usage) => [JSON.stringify([usage.ownerAgentId, usage.eventId]), usage]),
  )
  for (const occurrence of [...schedule.occurrences].sort(
    (left, right) =>
      left.atSeconds - right.atSeconds || left.occurrenceId.localeCompare(right.occurrenceId),
  )) {
    const usage = usages.get(JSON.stringify([occurrence.ownerAgentId, occurrence.eventId]))!
    const key = `${occurrence.ownerAgentId}:${occurrence.eventId}`
    const result = evaluatePlanningTeamDpsSlice({
      ...input,
      eventSchedule32: undefined,
      eventUsages: [{ ...usage, occurrenceCount: 1, durationSeconds: occurrence.durationSeconds }],
      baselineReferencesByAgentId: occurrence.referencesByAgentId,
      commonAnomalyEvents: { [key]: occurrence.commonAnomalyObservations },
      potentialEvents: occurrence.potentialEvent ? { [key]: occurrence.potentialEvent } : undefined,
      equipmentModifierBuckets:
        occurrence.equipmentModifierBuckets ?? input.equipmentModifierBuckets,
    })
    if (result.status !== 'supported')
      return {
        status: 'unsupported' as const,
        blockers: result.blockers.map((reason) => `${occurrence.occurrenceId}：${reason}`),
      }
    slices.push({ occurrence, result })
  }
  const memberDamage = input.memberIds.map((agentId) => ({
    agentId,
    totalDamage: slices.reduce(
      (sum, { result }) =>
        sum + result.memberDamage.find((member) => member.agentId === agentId)!.totalDamage,
      0,
    ),
  }))
  const totalDamage = memberDamage.reduce((sum, member) => sum + member.totalDamage, 0)
  const eventResults = slices.map(({ occurrence, result }) => ({
    occurrenceId: occurrence.occurrenceId,
    ownerAgentId: occurrence.ownerAgentId,
    eventId: occurrence.eventId,
    atSeconds: occurrence.atSeconds,
    ...(occurrence.durationSeconds === undefined
      ? {}
      : { durationSeconds: occurrence.durationSeconds }),
    snapshotAtSeconds: occurrence.snapshotAtSeconds ?? null,
    totalDamage: result.memberDamage.find((member) => member.agentId === occurrence.ownerAgentId)!
      .totalDamage,
    runtimeHash: result.runtimeHash,
    sourceRefs: [...occurrence.sourceRefs],
  }))
  return {
    ...slices[0]!.result,
    memberDamage,
    totalDamage,
    planningDps: totalDamage / input.baseline.declaredDurationSeconds,
    declaredDurationSeconds: input.baseline.declaredDurationSeconds,
    eventResults,
    formalCyclePromotion: false as const,
    potentialApplications: slices.flatMap(({ result }) => result.potentialApplications),
    effectBuckets: slices.flatMap(({ result }) => result.effectBuckets),
    equipmentModifierBuckets: slices.flatMap(({ result }) => result.equipmentModifierBuckets),
    sourceEffectExclusions: slices.flatMap(({ occurrence, result }) =>
      result.sourceEffectExclusions.map((effect) => ({
        ...effect,
        effectKey: `${occurrence.occurrenceId}:${effect.effectKey}`,
      })),
    ),
    directEffectBucketCount: slices.reduce(
      (sum, { result }) => sum + result.directEffectBucketCount,
      0,
    ),
    outsideDirectEventFormulaBucketCount: slices.reduce(
      (sum, { result }) => sum + result.outsideDirectEventFormulaBucketCount,
      0,
    ),
    runtimeHash: stableContentHash({
      schedule,
      eventResults,
      memberDamage,
      baseline: input.baseline,
      members: input.members,
      effectResolutionIdentity: planningEffectResolutionIdentity32,
    }),
    boundary:
      '逐次声明按同一来源效果解析和公式核心求和；DPS使用声明时长。声明状态不证明资源、占场或完整固定轮转，未闭合范围不升格Formal。',
  }
}
