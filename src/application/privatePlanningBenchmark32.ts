import {
  createCalculationContext,
  type CalculationContext,
} from '../calculation/calculationContext'
import { evaluateCalculationGate } from '../calculation/damageGate'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import { compileReviewedDriveDiscEventEffects32 } from '../calculation/reviewedDriveDiscEventEffects32'
import { reviewedDriveDiscSemanticsIdentity32 } from '../calculation/reviewedDriveDiscSemanticsIdentity32'
import type { DriveDiscEventRuntimeBinding32 } from '../calculation/reviewedDriveDiscConditionDomains32'
import { resolveCurrentPlanningConditionDeclarations32 } from '../calculation/currentPlanningConditionCatalog32'
import { evaluateSourceBackedPlanningTeamDps } from '../calculation/currentPlanningTeamDpsRuntime'
import type { PlanningEventSchedule32 } from '../calculation/planningEventOccurrenceState32'
import { projectTargetTeamWEngineModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import type { CurrentWEngineFormulaRuntime } from '../calculation/currentWEnginePersonalPlanningEffects'
import { stableContentHash } from '../gameDataPacks/types'
import { qualifyReviewedPlanningEventSet32 } from '../gameDataPacks/reviewedPlanningEventSet32'
import { reviewedPlanningEventSetIdentity32 } from '../gameDataPacks/reviewedPlanningEventSetIdentity32'
import {
  planningEventDeclarationsInputFingerprint32,
  validatePlanningEventDeclarations32,
  type PlanningEventDeclarationsInput32,
} from './publicPlanningEventDeclarations32'
import {
  planningBenchmark32Contract,
  planningBenchmarkResultFingerprint32,
  type PlanningBenchmarkResult32,
} from './publicPlanningBenchmark32'
import {
  planningBenchmarkBaseline32 as baseline,
  planningBenchmarkContextPolicy32,
  preparePlanningBenchmark32,
  type PlanningBenchmarkBinding32,
} from './privatePlanningBenchmarkBinding32'
export type { PlanningBenchmarkBinding32 } from './privatePlanningBenchmarkBinding32'

const eventKey = (row: { ownerAgentId: string; eventId: string }) =>
  JSON.stringify([row.ownerAgentId, row.eventId])

/** Trusted private producer. Only the public vocabulary is transported; all
 * source IR, account facts and equipment operands are rebuilt from the run. */
export function analyzePlanningBenchmark32Candidate(
  input: PlanningBenchmarkBinding32,
  declarations?: PlanningEventDeclarationsInput32,
  expectedSourceBindingFingerprint?: string,
): { result: PlanningBenchmarkResult32; context: CalculationContext | null } {
  let context: CalculationContext | null = null
  const prepared = preparePlanningBenchmark32(input)
  const payload: Omit<PlanningBenchmarkResult32, 'resultFingerprint'> = {
    contract: planningBenchmark32Contract,
    runId: input.runId,
    candidateId: input.candidateId,
    fitFingerprint: input.fit.fingerprint,
    accountFingerprint: input.accountFingerprint,
    sourceBindingFingerprint: prepared.sourceBindingFingerprint,
    metadata: prepared.metadata,
    inputFingerprint: declarations
      ? planningEventDeclarationsInputFingerprint32(declarations)
      : null,
    sideEffect: 'read_only',
    status: prepared.gaps.length ? 'unsupported' : 'metadata',
    formalCycleReady: false,
    totalDamage: null,
    benchmarkDps: null,
    declaredDurationSeconds: null,
    eventResults: [],
    includedEffectKeys: [],
    excludedEffects: [],
    gaps: [...prepared.gaps],
    missingContext: [
      '音擎使用当前方案身份与精炼；未指定等级的替换沿用账户记录等级与突破。',
      '事件声明不证明完整轮转的占场、资源收支和触发窗口。',
      '本次切片不纳入异常结算、失衡进度、邦布及没有声明的动作。',
    ],
  }
  const finish = () => {
    const excluded = new Map<string, PlanningBenchmarkResult32['excludedEffects'][number]>()
    for (const row of payload.excludedEffects) {
      const previous = excluded.get(row.effectKey)
      excluded.set(row.effectKey, {
        ...row,
        fields: [...new Set([...(previous?.fields ?? []), ...row.fields])],
        sourceRefs: [...new Set([...(previous?.sourceRefs ?? []), ...row.sourceRefs])],
      })
    }
    payload.excludedEffects = [...excluded.values()]
    payload.gaps = [...new Set(payload.gaps)]
    return {
      result: { ...payload, resultFingerprint: planningBenchmarkResultFingerprint32(payload) },
      context,
    }
  }
  if (!prepared.metadata || !declarations) return finish()
  if (expectedSourceBindingFingerprint !== prepared.sourceBindingFingerprint) {
    payload.status = 'unsupported'
    payload.gaps.push('来源、账户或配装绑定已变化，请重新读取条件定义。')
    return finish()
  }
  const validated = validatePlanningEventDeclarations32(declarations, prepared.metadata)
  if (validated.gaps.length) {
    payload.status = 'unsupported'
    payload.gaps.push(...validated.gaps)
    return finish()
  }
  const discEffects = compileCurrentDriveDiscPlanningEffects({
    members: prepared.members,
    loadouts: prepared.loadouts.map((loadout) => ({
      ...loadout,
      discs: loadout.discs.filter(
        (disc) => !(disc.setId in reviewedDriveDiscSemanticsIdentity32.sources),
      ),
    })),
  })
  if (discEffects.status !== 'supported') {
    payload.status = 'unsupported'
    payload.gaps.push(...discEffects.blockers)
    return finish()
  }
  const schedule: PlanningEventSchedule32 = {
    sourceFingerprint: prepared.sourceBindingFingerprint,
    declarationFingerprint: payload.inputFingerprint!,
    occurrences: [],
  }
  for (const occurrence of validated.occurrences) {
    const projection = prepared.projections.get(occurrence.ownerAgentId)!
    const resolved = resolveCurrentPlanningConditionDeclarations32({
      projection,
      declarations: occurrence.conditions,
    })
    if (resolved.status !== 'supported') {
      payload.gaps.push(...resolved.blockers)
      continue
    }
    const referencesByAgentId: Record<string, Record<string, string | number | boolean>> = {}
    const runtimeByAgentId: Record<string, CurrentWEngineFormulaRuntime> = {}
    const discBindings = new Map<string, DriveDiscEventRuntimeBinding32>()
    for (const row of resolved.values) {
      if (row.disposition === 'unknown' || row.value === undefined) continue
      const evidence = projection.evidence.find(
        (item) =>
          item.providerAgentId === row.providerAgentId && item.referenceKey === row.referenceKey,
      )!
      if (evidence.discSetId) {
        const key = JSON.stringify([row.providerAgentId, evidence.discSetId])
        const binding = discBindings.get(key) ?? {
          providerAgentId: row.providerAgentId,
          setId: evidence.discSetId,
          runtime: {},
        }
        if (typeof row.value === 'boolean')
          binding.runtime.flags = {
            ...binding.runtime.flags,
            [evidence.runtimeReference]: row.value,
          }
        else if (typeof row.value === 'number')
          binding.runtime.accumulators = {
            ...binding.runtime.accumulators,
            [evidence.runtimeReference]: row.value,
          }
        else payload.gaps.push(`四件套条件类型尚未闭合：${row.referenceKey}`)
        discBindings.set(key, binding)
      } else if (evidence.engineId) {
        const state = runtimeByAgentId[row.providerAgentId] ?? { flags: {}, numbers: {} }
        if (typeof row.value === 'boolean')
          state.flags = { ...state.flags, [evidence.runtimeReference]: row.value }
        else if (typeof row.value === 'number')
          state.numbers = { ...state.numbers, [evidence.runtimeReference]: row.value }
        else {
          payload.gaps.push(`音擎枚举尚未映射到实际公式：${row.referenceKey}`)
          continue
        }
        runtimeByAgentId[row.providerAgentId] = state
      } else {
        if (
          typeof row.value !== 'number' &&
          typeof row.value !== 'boolean' &&
          typeof row.value !== 'string'
        )
          continue
        referencesByAgentId[row.providerAgentId] = {
          ...referencesByAgentId[row.providerAgentId],
          [evidence.runtimeReference]: row.value,
        }
      }
    }
    const reviewedDiscs = compileReviewedDriveDiscEventEffects32({
      members: prepared.members,
      loadouts: prepared.loadouts,
      ownerAgentId: occurrence.ownerAgentId,
      runtimeBindings: [...discBindings.values()],
    })
    if (reviewedDiscs.status !== 'supported') {
      payload.gaps.push(...reviewedDiscs.blockers)
      continue
    }
    const engines = projectTargetTeamWEngineModifiers({
      memberIds: input.fit.memberIds,
      members: prepared.members,
      parameters: { wEngines: prepared.parameters },
      wEngineLevelsByAgentId: Object.fromEntries(
        prepared.parameters.map((row) => [row.agentId, row.level]),
      ),
      runtimeByAgentId,
    })
    if (engines.status !== 'supported') {
      payload.gaps.push(...engines.blockers)
      continue
    }
    payload.excludedEffects.push(
      ...engines.directRuntime.exclusions.map((row) => {
        const engineId = 'engineId' in row ? row.engineId : undefined
        const index = 'effectIndex' in row ? row.effectIndex : undefined
        return {
          effectKey: `${occurrence.occurrenceId}:wengine:${String(engineId ?? ('effectKey' in row ? row.effectKey : 'unknown'))}:${String(index ?? row.reason ?? 'excluded')}`,
          reason: String(row.reason ?? '来源效果尚未纳入。'),
          fields:
            'fields' in row && Array.isArray(row.fields)
              ? row.fields.filter((field): field is string => typeof field === 'string')
              : [],
          sourceRefs:
            'sourceRefs' in row && Array.isArray(row.sourceRefs)
              ? row.sourceRefs.filter((ref): ref is string => typeof ref === 'string')
              : (engines.wEngines.find((engine) => engine.engineId === engineId)?.sourceRefs ?? []),
        }
      }),
    )
    schedule.occurrences = [
      ...schedule.occurrences,
      {
        occurrenceId: occurrence.occurrenceId,
        ownerAgentId: occurrence.ownerAgentId,
        eventId: occurrence.eventId,
        atSeconds: occurrence.atSeconds,
        ...(occurrence.snapshotAtSeconds === undefined
          ? {}
          : { snapshotAtSeconds: occurrence.snapshotAtSeconds }),
        referencesByAgentId,
        commonAnomalyObservations:
          occurrence.windswept === 'unobserved'
            ? []
            : [
                {
                  eventId: occurrence.eventId,
                  windswept: occurrence.windswept === 'active',
                  sourceRefs: occurrence.sourceRefs,
                },
              ],
        equipmentModifierBuckets: [
          ...engines.directRuntime.buckets,
          ...discEffects.buckets,
          ...reviewedDiscs.buckets,
        ],
        sourceRefs: occurrence.sourceRefs,
      },
    ]
  }
  if (payload.gaps.length) {
    payload.status = 'unsupported'
    return finish()
  }
  const usageMap = new Map<
    string,
    {
      ownerAgentId: string
      eventId: string
      skillLevel: number
      occurrenceCount: number
      evidenceRefs: string[]
    }
  >()
  for (const occurrence of validated.occurrences) {
    const metadata = prepared.metadata.events.find((row) => eventKey(row) === eventKey(occurrence))!
    const usage = usageMap.get(eventKey(occurrence)) ?? {
      ownerAgentId: occurrence.ownerAgentId,
      eventId: occurrence.eventId,
      skillLevel: metadata.skillLevel,
      occurrenceCount: 0,
      evidenceRefs: occurrence.sourceRefs,
    }
    usage.occurrenceCount++
    usageMap.set(eventKey(occurrence), usage)
  }
  // Named event/loadout readiness is independently derived. It does not grant
  // complete-cycle readiness or require the unimplemented resource simulation.
  const qualification = qualifyReviewedPlanningEventSet32(input, prepared, declarations)
  const qualifiedCapabilities = [
    'formal_event_damage_ready',
    'formal_event_set_ready',
    'formal_loadout_ready',
  ] as const
  const calculationContext = createCalculationContext({
    schemaVersion: 'calculation-context-v2',
    contextId: `declared32:${prepared.sourceBindingFingerprint}:${payload.inputFingerprint}`,
    gameVersion: '3.2',
    canonical: {
      packageId: 'declared-planning-events32',
      packageVersion: prepared.sourceBindingFingerprint,
      gameVersion: '3.2',
      contentHash: prepared.sourceBindingFingerprint,
      status: qualification.allowed ? 'formal' : 'candidate',
      rollbackPackageId: null,
    },
    accountSnapshot: {
      accountId: input.warehouse.accountId ?? 'legacy-local',
      rosterHash: input.accountFingerprint,
      warehouseHash: input.fit.fingerprint,
      planningHash: payload.inputFingerprint!,
      capturedAt: input.capturedAt,
      stale: false,
    },
    scope: { kind: 'team', agentIds: [...input.fit.memberIds] },
    actors: prepared.actorBindings,
    bangboo: null,
    scenario: {
      playModeId: 'declared-event-benchmark32',
      scenarioId: baseline.baselineId,
      scenarioHash: stableContentHash(baseline),
      enemy: { ...baseline.enemy, level: planningBenchmarkContextPolicy32.enemyLevel },
    },
    cycle: {
      id: 'declared-event-benchmark32',
      durationSeconds: baseline.declaredDurationSeconds,
      actionSequenceHash: stableContentHash(schedule),
      hitCount: schedule.occurrences.length,
      buffWindowHash: payload.inputFingerprint!,
      complete: false,
    },
    objective: 'candidate_warehouse_score',
    constraintsHash: input.fit.fingerprint,
    evidence: [
      {
        fieldId: 'declared32-source-and-asset-binding',
        status: 'candidate',
        applicability: 'verified_current',
        sourceRefs: [prepared.sourceBindingFingerprint, payload.inputFingerprint!],
        sourceVersion: '3.2',
        requiredFor: ['candidate_warehouse'],
        reason: '来源事件与逐次声明绑定实际账户/十八盘；未升级完整固定轮转。',
      },
      ...qualifiedCapabilities.map((capability) => ({
        fieldId: `reviewed32:${capability}`,
        status: qualification.allowed ? ('formal' as const) : ('candidate' as const),
        applicability: 'verified_current' as const,
        sourceRefs: [
          ...qualification.evidenceRefs,
          prepared.sourceBindingFingerprint,
          payload.inputFingerprint!,
        ],
        sourceVersion: '3.2',
        requiredFor: [capability],
        reason: qualification.allowed
          ? `${reviewedPlanningEventSetIdentity32.qualificationId}核验当前事件、条件及实际配装；完整轮转不在该资格范围。`
          : qualification.gaps.join('；'),
      })),
    ],
  })
  context = calculationContext
  const result = evaluateSourceBackedPlanningTeamDps({
    memberIds: input.fit.memberIds,
    members: prepared.members,
    eventUsages: [...usageMap.values()],
    baseline,
    eventSchedule32: schedule,
  })
  if (result.status !== 'supported' || !('eventResults' in result)) {
    payload.status = 'unsupported'
    payload.gaps.push(
      ...(result.status === 'unsupported' ? result.blockers : ['逐次事件结果缺失。']),
    )
    return finish()
  }
  payload.status = 'declared_event_benchmark'
  payload.totalDamage = result.totalDamage
  payload.benchmarkDps = result.planningDps
  payload.declaredDurationSeconds = result.declaredDurationSeconds
  payload.eventResults = result.eventResults.map((event) => ({
    ...event,
    runtimeHash: stableContentHash({
      eventRuntimeHash: event.runtimeHash,
      calculationContextFingerprint: calculationContext.fingerprint,
    }),
  }))
  payload.includedEffectKeys = [
    ...new Set(
      [...result.effectBuckets, ...result.equipmentModifierBuckets].map((row) => row.effectKey),
    ),
  ]
  payload.excludedEffects.push(
    ...result.sourceEffectExclusions,
    ...discEffects.exclusions.map((row) => ({
      effectKey: `disc:${row.agentId}:${row.setId}`,
      reason: row.reason,
      fields: row.fields,
      sourceRefs: row.sourceRefs,
    })),
    ...[...prepared.projections.values()].flatMap((row) =>
      row.blockedReferences.map((ref) => ({
        effectKey: `${ref.providerAgentId}:${ref.referenceKey}`,
        reason: ref.reason,
        fields: [ref.referenceKey],
        sourceRefs: ref.sourceRefs,
      })),
    ),
  )
  return finish()
}

/** Public numbers require the same Formal gates as every production damage
 * consumer. A source-bound, evaluable Candidate remains private analysis. */
export function projectPlanningBenchmark32(
  input: PlanningBenchmarkBinding32,
  declarations?: PlanningEventDeclarationsInput32,
  expectedSourceBindingFingerprint?: string,
): PlanningBenchmarkResult32 {
  const analyzed = analyzePlanningBenchmark32Candidate(
    input,
    declarations,
    expectedSourceBindingFingerprint,
  )
  const result = analyzed.result
  if (result.status !== 'declared_event_benchmark') return result
  const gate = evaluateCalculationGate(analyzed.context)
  if (gate.capabilities.formalEventSet.allowed && gate.capabilities.formalLoadout.allowed)
    return result
  const payload = {
    ...result,
    status: 'unsupported' as const,
    totalDamage: null,
    benchmarkDps: null,
    declaredDurationSeconds: null,
    eventResults: [],
    gaps: [
      ...new Set([
        '具名事件集与实际配装尚未完成Formal资格核验；当前只开放条件声明。',
        ...(analyzed.context?.evidence
          .filter((row) => row.fieldId.startsWith('reviewed32:') && row.status !== 'formal')
          .map((row) => row.reason) ?? []),
        ...gate.capabilities.formalEventSet.blockers.map((row) => row.reason),
        ...gate.capabilities.formalLoadout.blockers.map((row) => row.reason),
      ]),
    ],
  }
  return { ...payload, resultFingerprint: planningBenchmarkResultFingerprint32(payload) }
}
