import { stableContentHash } from '../gameDataPacks/types'
import { standardTeamReferenceEquipmentPolicy } from '../calculation/standardTeamReferenceEquipment'
import { resolveBuildIntentWEngineIds } from '../gameDataPacks/buildIntentWEngineIdentity'
import { targetTeamBuildDirectionConditions } from '../application/targetTeamEffectivePotentialConditions'
import { compileTeamBuildIntent } from './buildIntent'
import {
  createStandardTeamReferenceEvaluator,
  materializeStandardTeamReferenceSelection,
  prepareTargetTeamStandardReferenceEquipment,
  standardTeamReferenceSeedSelection,
  type PreparedTargetTeamStandardReferenceEquipment,
  type selectTargetTeamStandardReferenceEquipment,
} from './standardTeamReferenceEquipment'
import { createTeamStrengthEquippedReferenceMember } from './teamStrengthReferenceBuild'
import type { DeclaredEventGoal32 } from './targetTeamDeclaredEventObjective32'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import { preparePlanningBenchmark32 } from '../application/privatePlanningBenchmarkBinding32'
import { analyzePlanningBenchmark32Candidate } from '../application/privatePlanningBenchmark32'
import type { SourceBackedPlanningEffectBucket } from '../calculation/currentPlanningDamageModifiers'
import type { PlanningEventUsage } from '../calculation/planningCalculationContextCompiler'

export type StandardTeamReferenceSelectionBundle = {
  prepared: PreparedTargetTeamStandardReferenceEquipment
  selection: Extract<
    ReturnType<typeof selectTargetTeamStandardReferenceEquipment>,
    { status: 'supported' }
  >
  declaredEventGoal32?: DeclaredEventGoal32
}
type ReadyBuild = Extract<
  ReturnType<typeof createTeamStrengthEquippedReferenceMember>,
  { status: 'ready' }
>
const cache = new Map<string, ReturnType<typeof bindUncached>>()

function bindUncached(
  bundle: StandardTeamReferenceSelectionBundle,
  memberIds: readonly string[],
  conditions?: TeamStrengthReferenceConditions,
) {
  const unsupported = (reason: string) => ({ status: 'unsupported' as const, reason })
  try {
    const { prepared, selection } = structuredClone(bundle)
    if (
      memberIds.length !== 3 ||
      new Set(memberIds).size !== 3 ||
      stableContentHash([...memberIds].sort()) !==
        stableContentHash([...prepared.referenceInput.candidate.memberIds].sort()) ||
      selection.selections.length !== 3 ||
      new Set(selection.selections.map((row) => row.agentId)).size !== 3 ||
      selection.selections.some((row) => !memberIds.includes(row.agentId)) ||
      !selection.coverageIdentity ||
      !Number.isFinite(selection.value)
    )
      return unsupported('标准配装缺少同一精确三人、完整18盘或覆盖身份。')
    const input = prepared.referenceInput
    const canonical = prepareTargetTeamStandardReferenceEquipment({
      input,
      referenceConditions: prepared.referenceConditions,
      wEngineRuntimeDeclarationsByAgentId: prepared.runtimeDeclarationsByAgentId,
    })
    if (
      canonical.status !== 'supported' ||
      canonical.identity !== prepared.identity ||
      stableContentHash(canonical.members) !== stableContentHash(prepared.members) ||
      stableContentHash(canonical.branchPlans) !== stableContentHash(prepared.branchPlans) ||
      stableContentHash(canonical.referenceInput) !== stableContentHash(input)
    )
      return unsupported('标准基准不是当前独立协议生成的完整来源输入。')
    const conditionInput = targetTeamBuildDirectionConditions({
      memberIds,
      roster: input.warehouse.roster,
      potentialByAgentId: input.parameters.potentialByAgentId,
    })
    const currentIntent = compileTeamBuildIntent({
      candidateId: input.candidate.candidateId,
      memberIds: input.candidate.memberIds,
      bangbooId: input.parameters.bangbooId,
      scenarioTags: input.candidate.scenarioTags,
      ...conditionInput,
    })
    if (currentIntent.fingerprint !== input.buildIntent?.fingerprint)
      return unsupported('标准构筑分支或当前来源身份已变化。')
    if (
      conditions &&
      memberIds.some(
        (id) =>
          conditions.potentialByAgentId[id] !== undefined &&
          conditions.potentialByAgentId[id] !==
            input.warehouse.roster.agents.find((row) => row.agentId === id)?.potentialImage,
      )
    )
      return unsupported('标准配装与消费者的潜能条件冲突。')
    const expectedSelectionIdentity = stableContentHash({
      policy: standardTeamReferenceEquipmentPolicy,
      members: [...prepared.members].sort((a, b) => a.agentId.localeCompare(b.agentId)),
      objectiveIdentity: selection.objectiveIdentity,
      maxEvaluations: selection.diagnostics.maxEvaluations,
      initialReference: standardTeamReferenceSeedSelection(prepared),
      selections: selection.selections,
      coverageIdentity: selection.coverageIdentity,
      value: selection.value,
    })
    if (
      selection.identity !== expectedSelectionIdentity ||
      stableContentHash(selection.policy) !==
        stableContentHash(standardTeamReferenceEquipmentPolicy)
    )
      return unsupported('标准求解结果、预算或实体内容身份不一致。')
    for (const row of selection.selections) {
      const constraint = currentIntent.recommendations.find(
        (item) => item.agentId === row.agentId,
      )?.constraint
      if (!constraint) return unsupported('标准构筑来源缺失。')
      const directions = constraint.wEngineDirections.map(
        (direction) =>
          direction.match(/^(wengine-\d+)(?=$|[（(])/u)?.[1] ??
          direction.match(/^[^（）()：:]*[（(](wengine-\d+)[)）]/u)?.[1] ??
          direction,
      )
      if (!resolveBuildIntentWEngineIds(row.agentId, directions).includes(row.engineId))
        return unsupported('标准音擎不属于该当前来源候选。')
    }
    const evaluator = createStandardTeamReferenceEvaluator({
      prepared,
      declaredEventGoal32: bundle.declaredEventGoal32,
    })
    if (
      evaluator.status !== 'supported' ||
      evaluator.objectiveIdentity !== selection.objectiveIdentity
    )
      return unsupported('标准目标或独立声明身份不一致。')
    // The separately issued reference is evaluated before the selected result,
    // keeping functional guards anchored to the same immutable baseline.
    const reference = standardTeamReferenceSeedSelection(prepared)
    if (!evaluator.evaluate(reference))
      return unsupported('标准完整基准目标未知，不能借候选自身重建基准。')
    const replay = evaluator.evaluate(selection.selections)
    if (
      !replay ||
      replay.coverageIdentity !== selection.coverageIdentity ||
      Math.abs(replay.value - selection.value) > 1e-8 * Math.max(1, Math.abs(selection.value))
    )
      return unsupported('标准候选的目标值或来源覆盖未通过同基准重放。')
    const context = materializeStandardTeamReferenceSelection(prepared, selection.selections)
    if (!context) return unsupported('标准18盘或来源条件不合法。')
    if (bundle.declaredEventGoal32)
      context.declaredEventGoal32 = structuredClone(bundle.declaredEventGoal32)
    const builds: ReadyBuild[] = []
    for (const row of selection.selections) {
      const build = createTeamStrengthEquippedReferenceMember({
        agentId: row.agentId,
        memberIds,
        referenceConditions: prepared.referenceConditions,
        standardEquipmentSelection: {
          engineId: row.engineId,
          refinement: row.refinement,
          discs: row.discs,
          objectiveIdentity: selection.objectiveIdentity,
          identity: selection.identity,
        },
      })
      const state = context.warehouse.roster.agents.find((agent) => agent.agentId === row.agentId)
      if (
        build.status !== 'ready' ||
        !state ||
        state.level !== 60 ||
        state.ascension !== 5 ||
        build.runtimeMember.coreLevel !== state.skillLevels.core ||
        build.runtimeMember.mindscape !== state.mindscape ||
        stableContentHash(build.runtimeMember.skillLevels) !== stableContentHash(state.skillLevels)
      )
        return unsupported('标准培养、有效技能或合法48盘不一致。')
      builds.push(build)
    }
    // Retain every equipment exclusion. A fixed-contact consumer must still
    // apply its existing dependency gate; selection does not prove uptime.
    if (bundle.declaredEventGoal32) {
      const binding = {
        runId: `standard-contact:${prepared.identity}`,
        candidateId: context.candidate.candidateId,
        accountFingerprint: bundle.declaredEventGoal32.referenceAccountFingerprint,
        capturedAt: context.capturedAt,
        warehouse: context.warehouse,
        fit: context.fit,
        selectedEquipment: context.parameters,
        ...(bundle.declaredEventGoal32.equipmentConditionAlternatives32
          ? {
              equipmentConditionAlternatives32:
                bundle.declaredEventGoal32.equipmentConditionAlternatives32,
            }
          : {}),
      }
      const issued = preparePlanningBenchmark32(binding)
      const analysis = analyzePlanningBenchmark32Candidate(
        binding,
        bundle.declaredEventGoal32.declarations,
        issued.sourceBindingFingerprint,
      )
      const occurrences = analysis.runtimeInput32?.eventSchedule32?.occurrences
      if (
        analysis.result.status !== 'declared_event_benchmark' ||
        !occurrences?.length ||
        analysis.result.excludedEffects.some(
          (row) => row.reason !== 'static_condition_not_met' || !row.sourceRefs.length,
        )
      )
        return unsupported('标准逐次装备状态未通过来源消费，不能回到旧固定状态。')
      return {
        status: 'ready' as const,
        identity: stableContentHash({
          selection: selection.identity,
          goal: bundle.declaredEventGoal32,
          conditions: conditions ?? null,
        }),
        builds,
        context,
        equipmentModifierBuckets: [] as SourceBackedPlanningEffectBucket[],
        equipmentEffectExclusions: [] as unknown[],
        eventEquipmentStates: occurrences.map((row) => ({
          ownerAgentId: row.ownerAgentId,
          eventId: row.eventId,
          buckets: row.equipmentModifierBuckets ?? [],
          referencesByAgentId: row.referencesByAgentId,
        })),
      }
    }
    const projection = compileTargetTeamPlanningContext(context)
    if (projection.status !== 'supported')
      return unsupported(`标准装备的固定接触条件未闭合：${projection.blockers.join('；')}`)
    return {
      status: 'ready' as const,
      identity: stableContentHash({
        selection: selection.identity,
        goal: bundle.declaredEventGoal32 ?? null,
        conditions: conditions ?? null,
      }),
      builds,
      context,
      equipmentModifierBuckets: [
        ...projection.modifierProjection.directRuntime.buckets,
        ...projection.discEffects.buckets,
      ],
      equipmentEffectExclusions: [
        ...projection.modifierProjection.directRuntime.exclusions,
        ...projection.discEffects.exclusions,
      ],
      eventEquipmentStates: null,
    }
  } catch (error) {
    return unsupported(error instanceof Error ? error.message : String(error))
  }
}

export function bindStandardTeamContactEquipment(
  bound: Extract<ReturnType<typeof bindStandardTeamReferenceSelection>, { status: 'ready' }>,
  events: readonly PlanningEventUsage[],
) {
  if (!bound.eventEquipmentStates)
    return {
      status: 'ready' as const,
      buckets: bound.equipmentModifierBuckets,
      exclusions: bound.equipmentEffectExclusions,
      referencesByAgentId: undefined,
    }
  const matched = events.map((event) =>
    bound.eventEquipmentStates!.filter(
      (row) => row.ownerAgentId === event.ownerAgentId && row.eventId === event.eventId,
    ),
  )
  if (!events.length || matched.some((rows) => !rows.length))
    return { status: 'unsupported' as const, reason: '该接触事件不属于已声明的标准有限目标。' }
  const states = matched.flat()
  if (
    new Set(
      states.map((buckets) =>
        stableContentHash({ buckets: buckets.buckets, references: buckets.referencesByAgentId }),
      ),
    ).size !== 1
  )
    return {
      status: 'unsupported' as const,
      reason: '同名接触事件有不同装备窗口，当前单次协议不能将其合并。',
    }
  return {
    status: 'ready' as const,
    buckets: states[0]!.buckets,
    exclusions: [] as unknown[],
    referencesByAgentId: states[0]!.referencesByAgentId,
  }
}

/** Per immutable content, not merely object identity or plan ID. No search is
 * repeated for each contact, and callers cannot mutate the cached result. */
export function bindStandardTeamReferenceSelection(
  bundle: StandardTeamReferenceSelectionBundle,
  options: { memberIds: readonly string[]; referenceConditions?: TeamStrengthReferenceConditions },
) {
  const key = stableContentHash({
    bundle,
    memberIds: [...options.memberIds].sort(),
    conditions: options.referenceConditions ?? null,
  })
  if (!cache.has(key)) {
    cache.set(key, bindUncached(bundle, options.memberIds, options.referenceConditions))
    if (cache.size > 64) cache.delete(cache.keys().next().value!)
  }
  return structuredClone(cache.get(key)!)
}
