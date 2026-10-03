import type { CommonAnomalyEventObservation32 } from './currentCommonAnomalyEffects32'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'
import type { SourceBackedEquipmentModifierBucket } from './currentPlanningDamageModifiers'
import type { PotentialApplicationEvent } from './potentialApplicationBinding'
import { isDamageFormula32Version } from './sharpDamageCore'
import { isSourceRateEvent32, resolveSourceEventQuantity32 } from './sourceEventQuantity32'

/** Private, validated projection of the public per-occurrence declarations.
 * These states describe a benchmark input; they do not prove a legal rotation. */
export type PlanningEventOccurrenceState32 = {
  occurrenceId: string
  ownerAgentId: string
  eventId: string
  atSeconds: number
  /** Explicit rate interval; split it whenever the declared calculation state changes. */
  durationSeconds?: number
  rateState?: 'constant_over_interval'
  snapshotAtSeconds?: number
  referencesByAgentId: Readonly<Record<string, Readonly<Record<string, string | number | boolean>>>>
  commonAnomalyObservations: readonly CommonAnomalyEventObservation32[]
  potentialEvent?: PotentialApplicationEvent
  equipmentModifierBuckets?: readonly SourceBackedEquipmentModifierBucket[]
  sourceRefs: readonly string[]
}

export type PlanningEventSchedule32 = {
  sourceFingerprint: string
  declarationFingerprint: string
  occurrences: readonly PlanningEventOccurrenceState32[]
}

export function planningEventScheduleGaps32(input: {
  schedule: PlanningEventSchedule32
  gameVersion: string
  memberIds: readonly string[]
  eventUsages: readonly PlanningEventUsage[]
  declaredDurationSeconds: number
}): string[] {
  const { schedule, eventUsages, declaredDurationSeconds: duration } = input
  const gaps: string[] = []
  if (!isDamageFormula32Version(input.gameVersion)) gaps.push('逐次条件仅适用于已采用的3.2公式。')
  if (!Number.isFinite(duration) || duration <= 0) gaps.push('固定事件时长必须为有限正数。')
  if (!schedule.sourceFingerprint || !schedule.declarationFingerprint)
    gaps.push('逐次事件缺少来源或声明指纹。')
  if (!schedule.occurrences.length) gaps.push('逐次事件为空。')
  const key = (row: { ownerAgentId: string; eventId: string }) =>
    JSON.stringify([row.ownerAgentId, row.eventId])
  const usages = new Map(eventUsages.map((usage) => [key(usage), usage]))
  if (usages.size !== eventUsages.length) gaps.push('固定事件集存在重复事件。')
  const counts = new Map<string, number>()
  const durations = new Map<string, number>()
  const rateIntervals = new Map<string, Array<{ start: number; end: number }>>()
  const ids = new Set<string>()
  for (const occurrence of schedule.occurrences) {
    const id = occurrence.occurrenceId
    if (!id || ids.has(id)) gaps.push(`逐次事件身份为空或重复：${id}`)
    ids.add(id)
    if (!input.memberIds.includes(occurrence.ownerAgentId) || !usages.has(key(occurrence)))
      gaps.push(`逐次事件不属于固定事件集：${id}`)
    if (
      !Number.isFinite(occurrence.atSeconds) ||
      occurrence.atSeconds < 0 ||
      occurrence.atSeconds >= duration ||
      (occurrence.snapshotAtSeconds !== undefined &&
        (!Number.isFinite(occurrence.snapshotAtSeconds) ||
          occurrence.snapshotAtSeconds < 0 ||
          occurrence.snapshotAtSeconds > occurrence.atSeconds))
    )
      gaps.push(`逐次事件时刻或快照无效：${id}`)
    if (!occurrence.sourceRefs.length || occurrence.sourceRefs.some((ref) => !ref.trim()))
      gaps.push(`逐次事件缺少来源：${id}`)
    const quantity = resolveSourceEventQuantity32({ ...occurrence, occurrenceCount: 1 })
    if (quantity.status === 'unsupported') gaps.push(`${id}：${quantity.reason}`)
    if (isSourceRateEvent32(occurrence.ownerAgentId, occurrence.eventId)) {
      if (
        occurrence.rateState !== 'constant_over_interval' ||
        occurrence.atSeconds + (occurrence.durationSeconds ?? 0) > duration
      )
        gaps.push(`每秒倍率区间越界或未声明区间内计算状态恒定：${id}`)
      durations.set(
        key(occurrence),
        (durations.get(key(occurrence)) ?? 0) + (occurrence.durationSeconds ?? 0),
      )
      const intervals = rateIntervals.get(key(occurrence)) ?? []
      // A source-rate row already includes its own repeated damage. Overlapping
      // intervals must not double-count it; independent storm instances require
      // a separate sourced instance contract before they can be admitted here.
      const interval = {
        start: occurrence.atSeconds,
        end: occurrence.atSeconds + (occurrence.durationSeconds ?? 0),
      }
      if (intervals.some((other) => interval.start < other.end && other.start < interval.end))
        gaps.push(`同一每秒倍率区间重复计量：${id}`)
      rateIntervals.set(key(occurrence), [...intervals, interval])
    } else if (occurrence.rateState !== undefined) gaps.push(`非每秒倍率不能声明持续区间：${id}`)
    for (const [providerId, references] of Object.entries(occurrence.referencesByAgentId)) {
      if (!input.memberIds.includes(providerId)) gaps.push(`条件提供者不属于队伍：${providerId}`)
      for (const [reference, value] of Object.entries(references)) {
        if (
          !reference ||
          !['string', 'number', 'boolean'].includes(typeof value) ||
          (typeof value === 'number' && !Number.isFinite(value)) ||
          // Account/final-stat references are compiled from actual members, never UI conditions.
          /^(own\.(initial|final)|target\.|team\.common\.count|char\.)/.test(reference)
        )
          gaps.push(`逐次条件值或属性覆盖无效：${id}:${providerId}:${reference}`)
      }
    }
    if (
      occurrence.commonAnomalyObservations.some(
        (row) =>
          row.eventId !== occurrence.eventId ||
          typeof row.windswept !== 'boolean' ||
          !row.sourceRefs.length,
      ) ||
      new Set(occurrence.commonAnomalyObservations.map((row) => row.windswept)).size > 1
    )
      gaps.push(`逐次风蚀观测冲突或未绑定事件：${id}`)
    if (
      occurrence.potentialEvent &&
      (occurrence.potentialEvent.eventId !== occurrence.eventId ||
        !occurrence.potentialEvent.sourceRefs.length)
    )
      gaps.push(`逐次潜能观测未绑定事件：${id}`)
    counts.set(key(occurrence), (counts.get(key(occurrence)) ?? 0) + 1)
  }
  for (const usage of eventUsages) {
    const quantity = resolveSourceEventQuantity32(usage)
    if (quantity.status === 'unsupported') gaps.push(`${usage.eventId}：${quantity.reason}`)
    else if (
      quantity.unit === 'seconds' &&
      Math.abs((durations.get(key(usage)) ?? 0) - quantity.value) > 1e-9
    )
      gaps.push(`逐次持续秒数与固定事件集不一致：${usage.ownerAgentId}:${usage.eventId}`)
    if (
      !Number.isInteger(usage.occurrenceCount) ||
      usage.occurrenceCount <= 0 ||
      counts.get(key(usage)) !== usage.occurrenceCount
    )
      gaps.push(`逐次事件数与固定事件集不一致：${usage.ownerAgentId}:${usage.eventId}`)
  }
  return [...new Set(gaps)]
}
