import type { CoreWarehouse } from '../accounts/coreFlow'
import { currentBangbooDirectory } from '../assault/catalog'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { stableContentHash } from '../gameDataPacks/types'
import {
  hasUnresolvedAuthorityScenario,
  type TeamBuildExecutionIdentity,
} from './teamBuildExecutionIdentity'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'

export const targetTeamAccountBoundBenchmarkContract =
  'soda-target-team-account-bound-benchmark/v2' as const

export type TargetTeamEquipmentParameterSelection = {
  wEngines: Array<{
    agentId: string
    engineId: string
    refinement: number
  }>
  bangbooId: string
  bangbooStars: number
}

export const targetTeamEquipmentPlanningBaseline = Object.freeze({
  wEngineLevel: 60 as const,
  bangbooLevel: 60 as const,
  defaultPolicy: 'rarity_based_s1_a5_b5' as const,
})

export function projectTargetTeamAccountBoundBenchmark(input: {
  warehouse: CoreWarehouse
  candidate: TeamBuildExecutionIdentity
  fit: TargetTeamWarehouseFit
  rosterHash: string
  warehouseHash: string
  planningHash: string
  capturedAt: string
  equipmentParameters?: TargetTeamEquipmentParameterSelection
}) {
  const fitGaps = [...new Set(input.fit.gaps)]
  const parameters = input.equipmentParameters
  const selectedAgentIds = parameters?.wEngines.map((item) => item.agentId) ?? []
  const memberIds = [...input.fit.memberIds]
  const parametersMatchMembers =
    parameters !== undefined &&
    selectedAgentIds.length === memberIds.length &&
    new Set(selectedAgentIds).size === memberIds.length &&
    memberIds.every((agentId) => selectedAgentIds.includes(agentId))
  const releasedWEngineIds = new Set(
    currentWEngineDirectory
      .filter((item) => item.releaseState === 'released' && item.accountOwnable)
      .map((item) => item.id),
  )
  const releasedBangbooIds = new Set(
    currentBangbooDirectory
      .filter((item) => item.releaseState === 'released' && item.accountOwnable)
      .map((item) => item.id),
  )
  const parameterGaps = parameters
    ? [
        ...(parametersMatchMembers ? [] : ['音擎参数必须与目标队三名代理人逐一对应。']),
        ...parameters.wEngines.flatMap((item) => [
          ...(releasedWEngineIds.has(item.engineId)
            ? []
            : [`${item.agentId} 选择的音擎不在当前正式候选池。`]),
          ...(Number.isInteger(item.refinement) && item.refinement >= 1 && item.refinement <= 5
            ? []
            : [`${item.agentId} 的音擎精炼必须在 P1–P5。`]),
        ]),
        ...(releasedBangbooIds.has(parameters.bangbooId) ? [] : ['所选邦布不在当前正式候选池。']),
        ...(Number.isInteger(parameters.bangbooStars) &&
        parameters.bangbooStars >= 1 &&
        parameters.bangbooStars <= 5
          ? []
          : ['邦布星级必须在 1–5 星。']),
      ]
    : [
        '请先由玩家确认三名代理人的音擎与精炼，并确认邦布与星级；等级统一采用 60 级规划基线，默认推荐不会自动进入数值计算。',
      ]
  const parametersValid = Boolean(
    parameters && parametersMatchMembers && parameterGaps.length === 0,
  )
  const equipmentModifierProjection =
    parametersValid && parameters
      ? projectTargetTeamEquipmentModifiers({
          memberIds: input.fit.memberIds,
          parameters,
        })
      : null
  const unresolvedAuthorityScenario = hasUnresolvedAuthorityScenario(input.candidate)
  const planningContextCompilation =
    !unresolvedAuthorityScenario && parametersValid && parameters && equipmentModifierProjection
      ? compileTargetTeamPlanningContext({
          warehouse: input.warehouse,
          candidate: input.candidate,
          fit: input.fit,
          parameters,
          modifierProjection: equipmentModifierProjection,
          rosterHash: input.rosterHash,
          warehouseHash: input.warehouseHash,
          planningHash: input.planningHash,
          capturedAt: input.capturedAt,
        })
      : null
  const calculationSupported = planningContextCompilation?.status === 'supported'
  const calculationGaps = unresolvedAuthorityScenario
    ? [
        '来源精确队伍尚未提供可计算的场景条件；已确认的装备参数仍可用于配装展示与保存，但不会补造 CalculationContext、标签或收益。',
      ]
    : planningContextCompilation?.status === 'unsupported'
      ? [
          ...planningContextCompilation.blockers,
          '存在未闭合账号绑定、modifier 或 operator 时 normalized Benchmark 继续 fail closed，不把缺失状态解释为未触发或零收益。',
        ]
      : []
  const core = {
    contract: targetTeamAccountBoundBenchmarkContract,
    candidateId: input.candidate.candidateId,
    status: calculationSupported ? ('supported' as const) : ('unavailable' as const),
    baselineId: calculationSupported ? planningContextCompilation.baselineId : null,
    declaredDurationSeconds: calculationSupported
      ? planningContextCompilation.declaredDurationSeconds
      : null,
    totalDamage: calculationSupported ? planningContextCompilation.totalDamage : null,
    planningDps: calculationSupported ? planningContextCompilation.planningDps : null,
    assetBindingFingerprint: calculationSupported
      ? planningContextCompilation.assetBindingHash
      : null,
    binding: {
      status: input.fit.status,
      discCount: input.fit.uniqueDiscCount,
      discMethod: input.fit.solverMethod,
      discExactWithinModel: input.fit.exactWithinModel,
      equipmentParameterStatus: calculationSupported
        ? ('confirmed_and_calculated' as const)
        : parametersValid
          ? ('confirmed_but_calculation_unsupported' as const)
          : ('awaiting_player_confirmation' as const),
    },
    equipmentParameters: parametersValid ? parameters : null,
    equipmentModifierProjection,
    calculationProjection: planningContextCompilation
      ? planningContextCompilation.status === 'supported'
        ? {
            status: planningContextCompilation.status,
            contextFingerprint: planningContextCompilation.contextFingerprint,
            runtimeHash: planningContextCompilation.runtimeHash,
            interactionBundleHash: planningContextCompilation.interactionBundleHash,
            interactionStateHash: planningContextCompilation.interactionStateHash,
            interactionOperatorCoverage: planningContextCompilation.interactionOperatorCoverage,
            memberDamage: planningContextCompilation.memberDamage,
            bangbooDamage: planningContextCompilation.bangbooDamage,
            equipmentBindingMode: planningContextCompilation.equipmentBindingMode,
            boundary: planningContextCompilation.boundary,
          }
        : {
            status: planningContextCompilation.status,
            blockers: planningContextCompilation.blockers,
            fingerprint: planningContextCompilation.fingerprint,
          }
      : null,
    planningEquipmentBaseline: targetTeamEquipmentPlanningBaseline,
    calculationEvidence: parametersValid
      ? [
          '方案参数已按音擎 60 级与所选精炼、邦布 60 级与所选星级进入白盒 modifier 投影及本次计算指纹。',
          ...(calculationSupported
            ? [
                '账号代理人、18 张实体盘、方案装备参数与 equipment buckets 已编译到同一 CalculationContext。',
              ]
            : []),
        ]
      : [],
    gaps: [...fitGaps, ...parameterGaps, ...calculationGaps],
    sideEffect: 'read_only' as const,
    boundary:
      '账号事实仅绑定代理人与驱动盘。音擎和邦布是玩家选择的方案参数，等级统一为 60；S 级默认 P1/1 星，A/B 级默认 P5/5 星，玩家可手动覆盖。不建立实体库存、副本互斥或精炼消耗账本；只有账号绑定、modifier 与 operator 全部闭合时才开放固定事件 Benchmark，且不代表全账号全局最优或实战轮转 DPS。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type TargetTeamAccountBoundBenchmark = ReturnType<
  typeof projectTargetTeamAccountBoundBenchmark
>
