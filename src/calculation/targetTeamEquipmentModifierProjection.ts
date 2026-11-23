import { currentAgentDirectory } from '../assault/catalog'
import type { PlanningBaseline } from './planningDpsContract'
import {
  currentWEngineSourceRefs,
  getCurrentWEngineStaticData,
} from '../gameDataPacks/currentWEngineStaticCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { applyReviewedWEngineReceiverSemantics32 } from './reviewedWEngineReceiverSemantics32'
import { applyReviewedSpringEmbraceReceivers32 } from './reviewedSpringEmbraceReceivers32'
import type { TargetTeamEquipmentParameterSelection } from '../decision/targetTeamAccountBoundBenchmark'
import { evaluateCurrentBangbooPlanningParameter } from './currentBangbooPlanningAdapter'
import { resolveCurrentWEnginePassive } from './currentWEnginePassiveAdapters'
import { resolveCurrentFormulaWEngineContract } from './currentFormulaMechanicContracts'
import {
  CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS,
  CAGE_OF_CONFINED_SIN_STABLE_ID,
  TRICK_OF_CANDLEGLOW_RUNTIME_INPUT_KEYS,
  TRICK_OF_CANDLEGLOW_STABLE_ID,
  resolveCageOfConfinedSinPassive,
  resolveTrickOfCandleglowPassive,
  FIRST_PLUMAGE_STABLE_ID,
  resolveFirstPlumagePassive,
} from './reviewedWEngine33'
import {
  bindCurrentWEngineFormulaRuntime,
  FIRST_PLUMAGE_WINDOW_FLAG,
  type CurrentWEngineFormulaRuntime,
} from './currentWEnginePersonalPlanningEffects'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { retainPlanningWEngineDependencies32 } from './currentPlanningWEngineDependencies32'
import { compileTargetTeamDirectEquipmentBuckets } from './targetTeamDirectEquipmentBuckets'

const agentSpecialtyById = new Map(
  currentAgentDirectory.map((agent) => [agent.id, agent.specialty] as const),
)

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

/**
 * Resolves only source-backed equipment operands selected for one target-team run.
 * It never reads account W-Engine/Bangboo inventory and never invents missing combat state.
 */
export function projectTargetTeamWEngineModifiers(input: {
  memberIds: readonly [string, string, string]
  parameters: Pick<TargetTeamEquipmentParameterSelection, 'wEngines'>
  members?: readonly PlanningEffectRuntimeMember[]
  runtimeByAgentId?: Readonly<Record<string, CurrentWEngineFormulaRuntime>>
  wEngineLevelsByAgentId?: Readonly<Record<string, number>>
  /** A finite operand comparison may vary one provider while recipients stay fixed. */
  selectionScope?: 'complete_team' | 'declared_subset'
}) {
  const wEngines = input.parameters.wEngines.map((selection) => {
    const staticData = getCurrentWEngineStaticData(selection.engineId)
    const agentSpecialty = agentSpecialtyById.get(selection.agentId) ?? null
    const specialtyMatches = Boolean(
      staticData && agentSpecialty && staticData.specialty === agentSpecialty,
    )
    const hasRuntime = Boolean(input.members || input.runtimeByAgentId)
    const usesReviewedCandleglowRuntime =
      hasRuntime && selection.engineId === TRICK_OF_CANDLEGLOW_STABLE_ID
    const usesReviewedFirstPlumage = selection.engineId === FIRST_PLUMAGE_STABLE_ID
    const usesReviewedCageOfConfinedSin = selection.engineId === CAGE_OF_CONFINED_SIN_STABLE_ID
    const localBoundRuntime =
      usesReviewedCandleglowRuntime || usesReviewedFirstPlumage || usesReviewedCageOfConfinedSin
        ? bindCurrentWEngineFormulaRuntime({
            agentId: selection.agentId,
            engineId: selection.engineId,
            member: input.members?.find((row) => row.agentId === selection.agentId),
            targetAgentId: selection.agentId,
            runtime: input.runtimeByAgentId?.[selection.agentId],
          })
        : null
    const recipientResults =
      hasRuntime && !localBoundRuntime
        ? input.memberIds.map((recipientAgentId) => {
            const bound = bindCurrentWEngineFormulaRuntime({
              agentId: selection.agentId,
              engineId: selection.engineId,
              member: input.members?.find((row) => row.agentId === selection.agentId),
              targetAgentId: recipientAgentId,
              runtime: input.runtimeByAgentId?.[selection.agentId],
            })
            const result = resolveCurrentFormulaWEngineContract({
              stableId: selection.engineId,
              refinement: selection.refinement,
              specialtyMatches,
              runtimePolicy: 'exclude_unobserved',
              runtime: bound,
            })
            return { recipientAgentId, bound, result }
          })
        : null
    const localResult = localBoundRuntime
      ? usesReviewedFirstPlumage
        ? resolveFirstPlumagePassive({
            refinement: selection.refinement,
            specialtyMatches,
            runtimePolicy: 'exclude_unobserved',
            teamAnomalyCritWindowActive: localBoundRuntime.flags?.[FIRST_PLUMAGE_WINDOW_FLAG],
          })
        : usesReviewedCageOfConfinedSin
          ? resolveCageOfConfinedSinPassive({
              refinement: selection.refinement,
              specialtyMatches,
              runtimePolicy: 'exclude_unobserved',
              basicAttackHitWindowActive:
                localBoundRuntime.flags?.[
                  CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS.basicAttackHitWindowActive
                ],
            })
          : resolveTrickOfCandleglowPassive({
              stableId: TRICK_OF_CANDLEGLOW_STABLE_ID,
              refinement: selection.refinement,
              specialtyMatches,
              runtimePolicy: 'exclude_unobserved',
              exSpecialCritWindowActive:
                localBoundRuntime.flags?.[
                  TRICK_OF_CANDLEGLOW_RUNTIME_INPUT_KEYS.exSpecialCritWindowActive
                ],
              enemyHpPercent:
                localBoundRuntime.numbers?.[TRICK_OF_CANDLEGLOW_RUNTIME_INPUT_KEYS.enemyHpPercent],
            })
      : null
    const resolved = localResult
      ? localResult.status === 'supported'
        ? {
            ...localResult,
            // First Plumage's permanent AP is already in the initial panel.
            effects: localResult.effects
              .filter(
                (effect) => !usesReviewedFirstPlumage || effect.stat !== 'anomaly_proficiency',
              )
              .map((effect) => ({
                kind: 'modifier',
                ...effect,
                ...(usesReviewedFirstPlumage
                  ? { stat: 'combat.dmg_.fire' }
                  : usesReviewedCageOfConfinedSin && effect.stat === 'resistance_ignore'
                    ? { stat: 'combat.resIgn_.wind' }
                    : {}),
                recipientAgentIds: [selection.agentId],
              })),
          }
        : localResult
      : recipientResults
        ? {
            status: 'supported' as const,
            active: recipientResults.some(
              (row) => row.result.status === 'supported' && row.result.active,
            ),
            effects: recipientResults.flatMap(({ recipientAgentId, result }) =>
              result.status !== 'supported'
                ? []
                : result.effects
                    .filter(
                      (effect) =>
                        effect.target === 'team' || recipientAgentId === selection.agentId,
                    )
                    .map((effect) => ({ ...effect, recipientAgentIds: [recipientAgentId] })),
            ),
            exclusions: recipientResults.flatMap(({ recipientAgentId, result }) =>
              result.status !== 'supported'
                ? []
                : result.exclusions.map((row) => ({ ...row, recipientAgentId })),
            ),
          }
        : resolveCurrentWEnginePassive(selection.engineId, {
            refinement: selection.refinement,
            specialtyMatches,
            runtimePolicy: 'exclude_unobserved',
          })
    const declaredLevel = input.wEngineLevelsByAgentId?.[selection.agentId]
    const blockers = [
      ...(declaredLevel !== undefined &&
      (!Number.isInteger(declaredLevel) || declaredLevel < 1 || declaredLevel > 60)
        ? ['音擎实际等级必须为1至60整数。']
        : []),
      ...(localBoundRuntime?.blockers ?? []),
      ...(recipientResults?.flatMap(({ bound, result }) => [
        ...bound.blockers,
        ...(result.status === 'unsupported' ? result.blockers : []),
      ]) ?? []),
      ...(staticData ? [] : [`音擎 ${selection.engineId} 缺少 60 级静态权威。`]),
      ...(staticData?.formulaAdoption.status === 'static_only'
        ? [`音擎 ${selection.engineId} 的被动仍为 static_only，不能作为数值 modifier。`]
        : []),
      ...(resolved.status === 'unsupported' ? resolved.blockers : []),
    ]
    const effects =
      resolved.status === 'supported'
        ? 'effects' in resolved
          ? resolved.effects
          : 'outputs' in resolved
            ? resolved.outputs
            : []
        : []
    const exclusions =
      resolved.status === 'supported' &&
      'exclusions' in resolved &&
      Array.isArray(resolved.exclusions)
        ? (resolved.exclusions as Array<Record<string, unknown>>)
        : []
    const core = {
      agentId: selection.agentId,
      runtime: input.runtimeByAgentId?.[selection.agentId],
      engineId: selection.engineId,
      level: declaredLevel ?? 60,
      levelAuthority:
        declaredLevel === undefined
          ? ('legacy_declared_level60' as const)
          : ('explicit_equipment_level' as const),
      staticStatsAuthority: 'catalog_level60_reference' as const,
      refinement: selection.refinement,
      specialtyMatches,
      staticStats: staticData?.staticStats ?? null,
      passiveStatus: blockers.length ? ('unsupported' as const) : ('supported' as const),
      passiveActive: resolved.status === 'supported' ? resolved.active : null,
      effects,
      exclusions,
      blockers: unique(blockers),
      sourceRefs: staticData ? currentWEngineSourceRefs(staticData.source) : [],
    }
    return { ...core, fingerprint: stableContentHash(core) }
  })

  const initialDirectRuntime = compileTargetTeamDirectEquipmentBuckets({
    memberIds: input.memberIds,
    wEngines,
  })
  let dependencyBuckets = initialDirectRuntime.buckets
  for (const engine of wEngines) {
    if (!engine.specialtyMatches || engine.passiveStatus !== 'supported') continue
    for (const target of ['own', 'team'] as const) {
      const recipients = target === 'own' ? [engine.agentId] : input.memberIds
      for (const recipient of recipients) {
        const runtime = input.runtimeByAgentId?.[engine.agentId]
        const boundRuntime = bindCurrentWEngineFormulaRuntime({
          agentId: engine.agentId,
          engineId: engine.engineId,
          member: input.members?.find((row) => row.agentId === engine.agentId),
          targetAgentId: recipient,
          runtime,
        })
        dependencyBuckets = retainPlanningWEngineDependencies32({
          buckets: dependencyBuckets,
          agentId: engine.agentId,
          engineId: engine.engineId,
          refinement: engine.refinement,
          runtime,
          boundRuntime,
          sourceRefs: engine.sourceRefs,
          target,
          recipientAgentIds: [recipient],
        })
      }
    }
  }
  const springReceivers = applyReviewedSpringEmbraceReceivers32(dependencyBuckets)
  const receivers = applyReviewedWEngineReceiverSemantics32(springReceivers.buckets)
  const directRuntimeCore = {
    ...initialDirectRuntime,
    buckets: receivers.buckets,
    exclusions: [
      ...initialDirectRuntime.exclusions,
      ...springReceivers.exclusions,
      ...receivers.exclusions,
    ],
  }
  const directRuntime = { ...directRuntimeCore, fingerprint: stableContentHash(directRuntimeCore) }
  const memberSetValid =
    (input.selectionScope === 'declared_subset'
      ? input.parameters.wEngines.length > 0 &&
        input.parameters.wEngines.every((item) => input.memberIds.includes(item.agentId))
      : input.parameters.wEngines.length === input.memberIds.length &&
        input.memberIds.every((agentId) =>
          input.parameters.wEngines.some((item) => item.agentId === agentId),
        )) &&
    new Set(input.parameters.wEngines.map((item) => item.agentId)).size ===
      input.parameters.wEngines.length
  const blockers = unique([
    ...(memberSetValid ? [] : ['方案音擎参数没有与三名目标成员逐一对应。']),
    ...wEngines.flatMap((item) => item.blockers.map((blocker) => `${item.agentId}：${blocker}`)),
    ...directRuntime.blockers,
  ])
  const core = {
    contract: 'soda-target-team-wengine-modifier-projection/v1' as const,
    status: blockers.length ? ('partial' as const) : ('supported' as const),
    memberSetValid,
    ...(input.selectionScope === 'declared_subset' ? { selectionScope: input.selectionScope } : {}),
    wEngines,
    directRuntime,
    blockers,
    sideEffect: 'read_only' as const,
    boundary:
      '固定 60 级静态值与玩家确认的 P1–P5 参数经过统一白盒 adapter 求值；固定事件切片未观测到的条件效果显式排除并留痕，缺少权威、参数、作用域或不可解释 operator 仍具名 unsupported。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

/** The legacy team projection retains its explicit Bangboo scope. The shared
 * W-Engine projection also serves reviewed three-actor benchmarks without one. */
export function projectTargetTeamEquipmentModifiers(input: {
  baseline?: PlanningBaseline
  memberIds: readonly [string, string, string]
  parameters: TargetTeamEquipmentParameterSelection
  members?: readonly PlanningEffectRuntimeMember[]
  runtimeByAgentId?: Readonly<Record<string, CurrentWEngineFormulaRuntime>>
  wEngineLevelsByAgentId?: Readonly<Record<string, number>>
  selectionScope?: 'complete_team' | 'declared_subset'
  bangbooScope?: 'included' | 'excluded_from_member_model'
}) {
  const engines = projectTargetTeamWEngineModifiers(input)
  const bangbooParameter = evaluateCurrentBangbooPlanningParameter({
    baseline: input.baseline,
    stableId: input.parameters.bangbooId,
    stars: input.parameters.bangbooStars,
    memberIds: input.memberIds,
  })
  const bangboo = {
    ...bangbooParameter,
    bangbooId: input.parameters.bangbooId,
    starModifierStatus: bangbooParameter.status,
  }
  const bangbooScope = input.bangbooScope ?? 'included'
  const blockers = unique([
    ...engines.blockers,
    ...(bangbooScope === 'included' ? bangbooParameter.blockers : []),
  ])
  const core = {
    contract: 'soda-target-team-equipment-modifier-projection/v1' as const,
    status: blockers.length ? ('partial' as const) : ('supported' as const),
    memberSetValid: engines.memberSetValid,
    wEngines: engines.wEngines,
    bangboo,
    bangbooScope,
    directRuntime: engines.directRuntime,
    blockers,
    sideEffect: 'read_only' as const,
    boundary: engines.boundary,
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type TargetTeamEquipmentModifierProjection = ReturnType<
  typeof projectTargetTeamEquipmentModifiers
>
