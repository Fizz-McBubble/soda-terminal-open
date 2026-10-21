import {
  planningEventDeclarations32Contract,
  validatePlanningEventDeclarations32,
  type PlanningEventDeclarationsInput32,
  type PlanningEventDeclarationsMetadata32,
  type PlanningEventConditionDefinition32,
  type PlanningEventOccurrence32,
} from '../application/publicPlanningEventDeclarations32'

export type StandardReferenceEventDraft32 = {
  id: string
  eventKey: string
  at: string
  duration: string
  snapshot: string
  constant: boolean
  windswept: string
  conditions: Record<string, string>
  anomalyLifecycleByAgentId?: PlanningEventOccurrence32['anomalyLifecycleByAgentId']
}

export function isRetainedObservationCondition32(
  row: StandardReferenceEventDraft32,
  def: PlanningEventConditionDefinition32,
  retained?: PlanningEventDeclarationsInput32,
) {
  return Boolean(
    (retained?.triggerAftershockWindow32 &&
      def.providerAgentId === 'agent-trigger' &&
      def.referenceKey === 'aftershock_hit') ||
    (row.anomalyLifecycleByAgentId?.[def.providerAgentId] &&
      ['anomTimePassed', 'polarityDisorder.value'].includes(def.referenceKey)),
  )
}
export const conditionDraftKey32 = (
  row: Pick<PlanningEventConditionDefinition32, 'providerAgentId' | 'referenceKey'>,
) => `${row.providerAgentId}:${row.referenceKey}`
export const eventDraftKey32 = (row: { ownerAgentId: string; eventId: string }) =>
  `${row.ownerAgentId}:${row.eventId}`
export const emptyStandardReferenceEventDraft32 = (id: string): StandardReferenceEventDraft32 => ({
  id,
  eventKey: '',
  at: '',
  duration: '',
  snapshot: '',
  constant: false,
  windswept: '',
  conditions: {},
})

export function restoreStandardReferenceEventDraft32(
  metadata: PlanningEventDeclarationsMetadata32,
  declarations?: PlanningEventDeclarationsInput32,
): StandardReferenceEventDraft32[] {
  if (!declarations || declarations.sourceFingerprint !== metadata.sourceFingerprint) return []
  return declarations.occurrences.map((row) => {
    const event = metadata.events.find((event) => eventDraftKey32(event) === eventDraftKey32(row))
    return {
      id: row.occurrenceId,
      eventKey: eventDraftKey32(row),
      at: String(row.atSeconds),
      duration: row.durationSeconds === undefined ? '' : String(row.durationSeconds),
      snapshot: row.snapshotAtSeconds === undefined ? '' : String(row.snapshotAtSeconds),
      constant: row.rateState === 'constant_over_interval',
      windswept: row.windswept,
      ...(row.anomalyLifecycleByAgentId
        ? { anomalyLifecycleByAgentId: structuredClone(row.anomalyLifecycleByAgentId) }
        : {}),
      conditions: Object.fromEntries(
        (event?.conditions ?? []).map((def) => {
          const value = row.conditions.find(
            (value) => conditionDraftKey32(value) === conditionDraftKey32(def),
          )?.value
          const text =
            value === undefined
              ? ''
              : def.valueKind === 'enum'
                ? String(def.options?.findIndex((option) => option.value === value))
                : String(value)
          return [conditionDraftKey32(def), text]
        }),
      ),
    }
  })
}

/** Empty fields stay unknown. Zero/false, event counts and rate durations must be explicit. */
export function compileStandardReferenceEventDraft32(
  metadata: PlanningEventDeclarationsMetadata32,
  rows: StandardReferenceEventDraft32[],
  confirmed: boolean,
  retained?: PlanningEventDeclarationsInput32,
): PlanningEventDeclarationsInput32 {
  if (!confirmed) throw new Error('请确认这些动作和条件用于本次有限比较。')
  if (!rows.length) throw new Error('请至少添加一个比较动作。')
  const number = (value: string, label: string) => {
    if (!value.trim() || !Number.isFinite(Number(value))) throw new Error(`请填写${label}。`)
    return Number(value)
  }
  const declarations: PlanningEventDeclarationsInput32 = {
    contract: planningEventDeclarations32Contract,
    sourceFingerprint: metadata.sourceFingerprint,
    confirmedDeclaredConditions: true,
    ...(retained?.sourceFingerprint === metadata.sourceFingerprint &&
    retained.triggerAftershockWindow32
      ? { triggerAftershockWindow32: structuredClone(retained.triggerAftershockWindow32) }
      : {}),
    occurrences: rows.map((row, index) => {
      const event = metadata.events.find((event) => eventDraftKey32(event) === row.eventKey)
      if (!event) throw new Error(`请选择第${index + 1}个比较动作。`)
      const conditions = event.conditions.flatMap((def) => {
        const text = row.conditions[conditionDraftKey32(def)]
        if (
          (text === undefined || text.trim() === '') &&
          isRetainedObservationCondition32(
            row,
            def,
            retained?.sourceFingerprint === metadata.sourceFingerprint ? retained : undefined,
          )
        )
          return []
        if (text === undefined || text.trim() === '')
          throw new Error(`请填写动作${index + 1}的“${def.label}”。`)
        let value: string | number | boolean
        if (def.valueKind === 'boolean') {
          if (!['true', 'false'].includes(text)) throw new Error(`请重新选择“${def.label}”。`)
          value = text === 'true'
        } else if (def.valueKind === 'number') value = number(text, def.label)
        else {
          const option = def.options?.[Number(text)]
          if (!option || !Number.isInteger(Number(text)))
            throw new Error(`请重新选择“${def.label}”。`)
          value = option.value
        }
        return [{ providerAgentId: def.providerAgentId, referenceKey: def.referenceKey, value }]
      })
      if (event.requiresWindsweptObservation && !['active', 'inactive'].includes(row.windswept))
        throw new Error(`请选择动作${index + 1}的风蚀状态。`)
      if (event.quantityUnit === 'seconds' && !row.constant)
        throw new Error(`请确认动作${index + 1}的区间内条件保持不变。`)
      return {
        occurrenceId: row.id,
        ownerAgentId: event.ownerAgentId,
        eventId: event.eventId,
        atSeconds: number(row.at, `动作${index + 1}的发生时间`),
        ...(event.quantityUnit === 'seconds'
          ? {
              durationSeconds: number(row.duration, '持续秒数'),
              rateState: 'constant_over_interval' as const,
            }
          : {}),
        ...(row.snapshot.trim() ? { snapshotAtSeconds: number(row.snapshot, '快照时间') } : {}),
        windswept: event.requiresWindsweptObservation
          ? (row.windswept as 'active' | 'inactive')
          : 'inactive',
        conditions,
        ...(row.anomalyLifecycleByAgentId
          ? { anomalyLifecycleByAgentId: structuredClone(row.anomalyLifecycleByAgentId) }
          : {}),
        sourceRefs: [
          ...new Set([...event.sourceRefs, ...event.conditions.flatMap((def) => def.sourceRefs)]),
        ],
      }
    }),
  }
  if (validatePlanningEventDeclarations32(declarations, metadata).gaps.length)
    throw new Error(
      `动作时间、持续区间或条件值不符合当前资料；请检查0至${metadata.declaredDurationSeconds}秒内的时间、层数范围及重复区间。`,
    )
  return declarations
}
