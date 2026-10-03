import type { CoreWarehouse } from '../accounts/coreFlow'
import type { TargetTeamEquipmentDisplayParameters } from '../application/publicTargetTeamEquipmentFingerprint'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { currentBangbooDirectory } from '../assault/catalog'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import { projectTargetTeamEquipmentModifiers } from '../calculation/targetTeamEquipmentModifierProjection'
import { stableContentHash } from '../gameDataPacks/types'
import {
  incremental32RecoveryPolicy,
  incremental32RecoveryReason,
} from '../gameDataPacks/incremental32RecoveryPolicy'
import {
  hasUnresolvedAuthorityScenario,
  type TeamBuildExecutionIdentity,
} from './teamBuildExecutionIdentity'
import { compileTargetTeamPlanningContext } from './targetTeamPlanningContext'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'

export const targetTeamAccountBoundBenchmarkContract =
  'soda-target-team-account-bound-benchmark/v2' as const

export type TargetTeamEquipmentParameterSelection = TargetTeamEquipmentDisplayParameters

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
        ...Object.entries(parameters.potentialByAgentId ?? {}).flatMap(([id, value]) =>
          memberIds.includes(id) &&
          supportsPotentialImage(id) &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 6
            ? []
            : [`${id} 的显式潜能参数无效。`],
        ),
        ...parameters.wEngines.flatMap((item) => [
          ...(item.level === undefined ||
          (Number.isInteger(item.level) && item.level >= 1 && item.level <= 60)
            ? []
            : [`${item.agentId} 的音擎等级需在 1–60。`]),
          ...(item.ascension === undefined ||
          (Number.isInteger(item.ascension) && item.ascension >= 0 && item.ascension <= 5)
            ? []
            : [`${item.agentId} 的音擎突破需在 0–5。`]),
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
          wEngineLevelsByAgentId: Object.fromEntries(
            parameters.wEngines.map((row) => [row.agentId, row.level ?? 60]),
          ),
        })
      : null
  const unresolvedAuthorityScenario = hasUnresolvedAuthorityScenario(input.candidate)
  const planningContextCompilation =
    (!unresolvedAuthorityScenario ||
      input.fit.memberIds.includes('agent-koleda') ||
      incremental32RecoveryPolicy.enabled) &&
    parametersValid &&
    parameters &&
    equipmentModifierProjection
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
  const koledaMetadata =
    planningContextCompilation &&
    'koledaFixedEventConditionsMetadata32' in planningContextCompilation
      ? planningContextCompilation.koledaFixedEventConditionsMetadata32
      : undefined
  const calculationGaps = unresolvedAuthorityScenario
    ? [
        ...(planningContextCompilation?.status === 'unsupported'
          ? planningContextCompilation.blockers.filter(
              (blocker) => blocker === incremental32RecoveryReason,
            )
          : []),
        '来源精确队伍尚未提供可计算的场景条件；已确认的装备参数仍可用于配装展示与保存，但不会补造 CalculationContext、标签或收益。',
      ]
    : planningContextCompilation?.status === 'unsupported'
      ? [
          ...planningContextCompilation.blockers,
          '存在未闭合账号绑定、modifier 或 operator 时 normalized Benchmark 继续 fail closed，不把缺失状态解释为未触发或零收益。',
        ]
      : []
  const core = {
    ...(koledaMetadata ? { koledaFixedEventConditionsMetadata32: koledaMetadata } : {}),
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
    equipmentModifierProjection: calculationSupported
      ? planningContextCompilation.modifierProjection
      : equipmentModifierProjection,
    calculationProjection: planningContextCompilation
      ? planningContextCompilation.status === 'supported'
        ? {
            status: planningContextCompilation.status,
            coverage: planningContextCompilation.coverage,
            eventSetHash: planningContextCompilation.eventSetHash,
            progressionHash: planningContextCompilation.progressionHash,
            potentialHash: planningContextCompilation.potentialHash,
            contextFingerprint: planningContextCompilation.contextFingerprint,
            runtimeHash: planningContextCompilation.runtimeHash,
            interactionBundleHash: planningContextCompilation.interactionBundleHash,
            interactionStateHash: planningContextCompilation.interactionStateHash,
            interactionOperatorCoverage: planningContextCompilation.interactionOperatorCoverage,
            memberDamage: planningContextCompilation.memberDamage,
            memberModelQualification32: planningContextCompilation.memberModelQualification32,
            bangbooDamage: planningContextCompilation.bangbooDamage,
            includedScope: planningContextCompilation.includedScope,
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
          '方案参数按显式音擎等级与突破、所选精炼计算；未提供等级的旧参数保留声明式60级基线。邦布仍采用60级与所选星级。',
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
      '账号事实仅绑定代理人与驱动盘。音擎和邦布是玩家选择的方案参数，音擎可采用显式1–60级及突破，旧未提供参数保留声明式60级；邦布等级为60；S 级默认 P1/1 星，A/B 级默认 P5/5 星，玩家可手动覆盖。不建立实体库存、副本互斥或精炼消耗账本；只有账号绑定、modifier 与 operator 全部闭合时才开放固定事件 Benchmark，且不代表全账号全局最优或实战轮转 DPS。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type TargetTeamAccountBoundBenchmark = ReturnType<
  typeof projectTargetTeamAccountBoundBenchmark
>
