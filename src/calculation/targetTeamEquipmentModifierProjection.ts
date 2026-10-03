import { currentAgentDirectory } from '../assault/catalog'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { applyReviewedWEngineReceiverSemantics32 } from './reviewedWEngineReceiverSemantics32'
import type { TargetTeamEquipmentParameterSelection } from '../decision/targetTeamAccountBoundBenchmark'
import type { SourceBackedEquipmentModifierBucket } from './currentPlanningTeamDpsRuntime'
import { evaluateCurrentBangbooPlanningParameter } from './currentBangbooPlanningAdapter'
import { resolveCurrentWEnginePassive } from './currentWEnginePassiveAdapters'
import { resolveCurrentFormulaWEngineContract } from './currentFormulaMechanicContracts'
import {
  bindCurrentWEngineFormulaRuntime,
  type CurrentWEngineFormulaRuntime,
} from './currentWEnginePersonalPlanningEffects'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import {
  planningWEngineActions as directActionBySource,
  retainPlanningWEngineDependencies32,
} from './currentPlanningWEngineDependencies32'
import { currentCombatPlanningModifierTargets } from './currentCombatPlanningModifierTargets'

const agentSpecialtyById = new Map(
  currentAgentDirectory.map((agent) => [agent.id, agent.specialty] as const),
)

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

const directApplicationByStat: Readonly<
  Record<string, SourceBackedEquipmentModifierBucket['application']>
> = {
  attack_percent: 'attack_percent',
  crit_rate: 'crit_rate',
  crit_damage: 'crit_damage',
  damage_bonus: 'damage_bonus',
  ...currentCombatPlanningModifierTargets,
}
const explicitlyExcludedDirectStats = new Set([
  'combat.anomBuildup_',
  'combat.anomProf',
  'combat.dazeInc_',
])

function compileDirectRuntimeBuckets(input: {
  memberIds: readonly [string, string, string]
  wEngines: Array<{
    agentId: string
    engineId: string
    passiveStatus: 'supported' | 'unsupported'
    effects: unknown[]
    blockers: string[]
    exclusions: Array<Record<string, unknown>>
    sourceRefs: string[]
  }>
}) {
  const blockers = input.wEngines.flatMap((item) => item.blockers)
  const exclusions: Array<Record<string, unknown>> = input.wEngines.flatMap((item) =>
    item.exclusions.map((exclusion) => ({
      engineId: item.engineId,
      agentId: item.agentId,
      reason: 'unobserved_conditional_effect',
      ...exclusion,
    })),
  )
  const buckets: SourceBackedEquipmentModifierBucket[] = []
  for (const item of input.wEngines) {
    if (item.passiveStatus === 'unsupported') continue
    item.effects.forEach((rawEffect, index) => {
      if (!rawEffect || typeof rawEffect !== 'object') {
        blockers.push(`${item.engineId} 返回了不可识别的被动效果。`)
        return
      }
      const effect = rawEffect as Record<string, unknown>
      if (effect.kind !== 'modifier') {
        blockers.push(
          `${item.engineId} 的 ${String(effect.kind)} 尚未进入固定事件直接伤害 runtime。`,
        )
        return
      }
      const stat = String(effect.stat)
      const channel =
        /^combat\.(dmg_|common_dmg_|crit_dmg_|laceration_dmg_|sharp_dmg_|sheer_dmg_|direct_dmg_|buff_|defIgn_|resIgn_)\.(physical|fire|ice|electric|ether|wind)$/.exec(
          stat,
        )
      const application = channel
        ? directApplicationByStat[`combat.${channel[1]}` as keyof typeof directApplicationByStat]
        : directApplicationByStat[stat as keyof typeof directApplicationByStat]
      if (!application) {
        if (explicitlyExcludedDirectStats.has(String(effect.stat))) {
          exclusions.push({
            engineId: item.engineId,
            agentId: item.agentId,
            effectIndex: index,
            reason: 'outside_fixed_event_direct_damage_domain',
            stat: effect.stat,
            action: effect.action ?? null,
          })
          return
        }
        blockers.push(
          `${item.engineId} 的 modifier ${String(effect.stat)} 不属于当前直接伤害公式域。`,
        )
        return
      }
      if (effect.target !== 'own' && effect.target !== 'team') {
        blockers.push(`${item.engineId} 的 modifier target ${String(effect.target)} 尚未适配。`)
        return
      }
      if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
        blockers.push(`${item.engineId} 的 modifier 数值无效。`)
        return
      }
      const action = effect.action == null ? null : directActionBySource[String(effect.action)]
      if (effect.action != null && !action) {
        exclusions.push({
          engineId: item.engineId,
          agentId: item.agentId,
          effectIndex: index,
          reason: 'outside_fixed_event_action_set',
          action: effect.action,
        })
        return
      }
      buckets.push({
        bucketId: `wengine:${item.agentId}:${item.engineId}:${index}`,
        effectKey: `wengine:${item.engineId}:P:${index}`,
        providerAgentId: item.agentId,
        recipientAgentIds: Array.isArray(effect.recipientAgentIds)
          ? effect.recipientAgentIds.filter(
              (id): id is string => typeof id === 'string' && input.memberIds.includes(id),
            )
          : effect.target === 'team'
            ? [...input.memberIds]
            : [item.agentId],
        receiverPath: null,
        damageType: null,
        action: action ?? null,
        attribute: channel?.[2] ?? (typeof effect.attribute === 'string' ? effect.attribute : null),
        value: effect.value,
        application,
        sourceRefs: item.sourceRefs,
      })
    })
  }
  const core = {
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    buckets,
    exclusions,
    blockers: unique(blockers),
    boundary:
      '静态音擎事实照常进入角色面板；仅可映射的直接伤害 modifier 进入固定事件 runtime。未观测条件效果及异常/失衡等非直接伤害域效果显式排除并留痕，不补零、不伪造触发。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
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
}) {
  const wEngines = input.parameters.wEngines.map((selection) => {
    const staticData = getCurrentWEngineStaticData(selection.engineId)
    const agentSpecialty = agentSpecialtyById.get(selection.agentId) ?? null
    const specialtyMatches = Boolean(
      staticData && agentSpecialty && staticData.specialty === agentSpecialty,
    )
    const recipientResults =
      input.members || input.runtimeByAgentId
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
    const resolved = recipientResults
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
                    (effect) => effect.target === 'team' || recipientAgentId === selection.agentId,
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
      sourceRefs: staticData
        ? [
            `${staticData.source.dataPath}#${staticData.source.dataSha256}`,
            `${staticData.source.formulaPath}#${staticData.source.formulaSha256}`,
          ]
        : [],
    }
    return { ...core, fingerprint: stableContentHash(core) }
  })

  const initialDirectRuntime = compileDirectRuntimeBuckets({ memberIds: input.memberIds, wEngines })
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
  const receivers = applyReviewedWEngineReceiverSemantics32(dependencyBuckets)
  const directRuntimeCore = {
    ...initialDirectRuntime,
    buckets: receivers.buckets,
    exclusions: [...initialDirectRuntime.exclusions, ...receivers.exclusions],
  }
  const directRuntime = { ...directRuntimeCore, fingerprint: stableContentHash(directRuntimeCore) }
  const memberSetValid =
    input.parameters.wEngines.length === input.memberIds.length &&
    new Set(input.parameters.wEngines.map((item) => item.agentId)).size ===
      input.memberIds.length &&
    input.memberIds.every((agentId) =>
      input.parameters.wEngines.some((item) => item.agentId === agentId),
    )
  const blockers = unique([
    ...(memberSetValid ? [] : ['方案音擎参数没有与三名目标成员逐一对应。']),
    ...wEngines.flatMap((item) => item.blockers.map((blocker) => `${item.agentId}：${blocker}`)),
    ...directRuntime.blockers,
  ])
  const core = {
    contract: 'soda-target-team-wengine-modifier-projection/v1' as const,
    status: blockers.length ? ('partial' as const) : ('supported' as const),
    memberSetValid,
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
  memberIds: readonly [string, string, string]
  parameters: TargetTeamEquipmentParameterSelection
  members?: readonly PlanningEffectRuntimeMember[]
  runtimeByAgentId?: Readonly<Record<string, CurrentWEngineFormulaRuntime>>
  wEngineLevelsByAgentId?: Readonly<Record<string, number>>
  bangbooScope?: 'included' | 'excluded_from_member_model'
}) {
  const engines = projectTargetTeamWEngineModifiers(input)
  const bangbooParameter = evaluateCurrentBangbooPlanningParameter({
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
