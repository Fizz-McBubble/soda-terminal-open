import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkComparisonBasis,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import {
  hasUnresolvedAuthorityScenario,
  type TeamBuildExecutionIdentity,
} from './teamBuildExecutionIdentity'
import {
  projectTargetTeamAccountBoundBenchmark,
  type TargetTeamAccountBoundBenchmark,
  type TargetTeamEquipmentParameterSelection,
} from './targetTeamAccountBoundBenchmark'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import { resolveWEngine } from './wEngineResolver'

const teamRuntimeIdentity = 'source-backed-target-team-fixed-event/v1'

function memberKey(memberIds: readonly string[]) {
  return [...memberIds].sort().join('|')
}

function validPhysicalSix(warehouse: CoreWarehouse, discIds: readonly string[]) {
  if (discIds.length !== 6 || new Set(discIds).size !== 6) return false
  const byId = new Map(warehouse.discs.map((disc) => [disc.id, disc]))
  const discs = discIds.map((id) => byId.get(id))
  return discs.every(Boolean) && new Set(discs.map((disc) => disc?.slot)).size === 6
}

function latestSavedTeamLoadouts(input: {
  candidate: TeamBuildExecutionIdentity
  drafts: AccountPlanningDraft[]
  warehouse: CoreWarehouse
}) {
  const expectedMemberKey = memberKey(input.candidate.memberIds)
  return input.drafts
    .filter(
      (draft) =>
        draft.kind === 'team' &&
        draft.accountId === input.warehouse.accountId &&
        draft.state === 'saved' &&
        memberKey(draft.selection.agentIds) === expectedMemberKey &&
        draft.selection.bangbooId === input.candidate.bangbooId &&
        draft.candidateWarehouse?.scope === 'team',
    )
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id),
    )
    .find((draft) => {
      const loadouts = draft.candidateWarehouse?.loadouts ?? []
      const discIds = loadouts.flatMap((loadout) => loadout.discIds)
      return (
        loadouts.length === input.candidate.memberIds.length &&
        input.candidate.memberIds.every((agentId) =>
          validPhysicalSix(
            input.warehouse,
            loadouts.find((loadout) => loadout.agentId === agentId)?.discIds ?? [],
          ),
        ) &&
        discIds.length === 18 &&
        new Set(discIds).size === 18
      )
    })
}

function activeDiscIds(input: {
  agentId: string
  warehouse: CoreWarehouse
  drafts: AccountPlanningDraft[]
  activePlanIds: Record<string, string | null | undefined>
  savedTeamPlan: AccountPlanningDraft | undefined
}) {
  const savedTeamLoadout = input.savedTeamPlan?.candidateWarehouse?.loadouts.find(
    (loadout) => loadout.agentId === input.agentId,
  )
  if (savedTeamLoadout && validPhysicalSix(input.warehouse, savedTeamLoadout.discIds))
    return {
      discIds: savedTeamLoadout.discIds,
      source: 'saved_team' as const,
      referenceId: input.savedTeamPlan!.id,
    }
  const active = input.drafts.find(
    (draft) =>
      draft.id === input.activePlanIds[input.agentId] &&
      draft.accountId === input.warehouse.accountId &&
      draft.kind === 'agent' &&
      draft.selection.agentIds.length === 1 &&
      draft.selection.agentIds[0] === input.agentId,
  )
  const candidateLoadout = active?.candidateWarehouse?.loadouts.find(
    (loadout) => loadout.agentId === input.agentId,
  )
  if (
    active?.state === 'saved' &&
    candidateLoadout &&
    validPhysicalSix(input.warehouse, candidateLoadout.discIds)
  )
    return {
      discIds: candidateLoadout.discIds,
      source: 'saved_agent' as const,
      referenceId: active.id,
    }
  if (
    active?.state === 'saved' &&
    active.kind === 'agent' &&
    active.selection.agentIds.length === 1 &&
    active.selection.agentIds[0] === input.agentId &&
    validPhysicalSix(input.warehouse, active.warehouseRefs)
  )
    return { discIds: active.warehouseRefs, source: 'saved_agent' as const, referenceId: active.id }
  const agent = input.warehouse.roster.agents.find((item) => item.agentId === input.agentId)
  const equippedDiscIds = agent?.equippedDiscIds ?? []
  return validPhysicalSix(input.warehouse, equippedDiscIds)
    ? { discIds: equippedDiscIds, source: 'current_equipment' as const, referenceId: null }
    : { discIds: [], source: 'unrecorded' as const, referenceId: null }
}

function side(input: {
  benchmark: TargetTeamAccountBoundBenchmark
  candidate: TeamBuildExecutionIdentity
  fit: TargetTeamWarehouseFit
  parameters?: TargetTeamEquipmentParameterSelection
  unsupportedReasons?: string[]
  stale: boolean
}): ValueBenchmarkSide {
  const parameters = input.parameters
  const dimensions: ValueBenchmarkSide['dimensions'] = {
    game_version: currentVersionProjection.gameVersion,
    subject: stableContentHash({
      memberIds: input.candidate.memberIds,
      bangbooId: parameters?.bangbooId ?? input.candidate.bangbooId,
    }),
    scenario: input.candidate.scenarioTags.length
      ? `scenario:${input.candidate.scenarioTags.join('+')}`
      : hasUnresolvedAuthorityScenario(input.candidate)
        ? 'scenario:unresolved'
        : 'scenario:normalized',
    event_set: currentNormalizedPlanningBaseline.baselineId,
    duration: String(currentNormalizedPlanningBaseline.declaredDurationSeconds),
    formula: currentNormalizedPlanningBaseline.formulaHash,
    runtime: teamRuntimeIdentity,
    disc_loadout: stableContentHash(input.fit.loadouts),
    w_engine: stableContentHash(parameters?.wEngines ?? []),
    bangboo: parameters ? `${parameters.bangbooId}:s${parameters.bangbooStars}` : 'missing',
  }
  if (input.stale)
    return {
      state: 'stale',
      dimensions,
      totalDamage: null,
      planningDps: null,
      calculationFingerprint: null,
      reasons: ['账户或仓库快照已 stale，请重新分析。'],
    }
  if (input.benchmark.status !== 'supported')
    return {
      state: 'unsupported',
      dimensions,
      totalDamage: null,
      planningDps: null,
      calculationFingerprint: null,
      reasons: input.unsupportedReasons?.length
        ? input.unsupportedReasons
        : input.benchmark.gaps.length
          ? input.benchmark.gaps
          : ['当前方案缺少完整 CalculationContext。'],
    }
  return {
    state: 'supported',
    dimensions,
    totalDamage: input.benchmark.totalDamage,
    planningDps: input.benchmark.planningDps,
    calculationFingerprint: input.benchmark.fingerprint,
    reasons: [],
  }
}

export function projectTargetTeamValueBenchmark(input: {
  warehouse: CoreWarehouse
  drafts: AccountPlanningDraft[]
  activePlanIds: Record<string, string | null | undefined>
  candidate: TeamBuildExecutionIdentity
  targetFit: TargetTeamWarehouseFit
  targetBenchmark: TargetTeamAccountBoundBenchmark
  rosterHash: string
  warehouseHash: string
  planningHash: string
  capturedAt: string
  equipmentParameters?: TargetTeamEquipmentParameterSelection
  stale: boolean
}) {
  const savedTeamPlan = latestSavedTeamLoadouts({
    candidate: input.candidate,
    drafts: input.drafts,
    warehouse: input.warehouse,
  })
  const baselineMembers = input.candidate.memberIds.map((agentId) => ({
    agentId,
    ...activeDiscIds({
      agentId,
      warehouse: input.warehouse,
      drafts: input.drafts,
      activePlanIds: input.activePlanIds,
      savedTeamPlan,
    }),
  }))
  const loadouts = baselineMembers.map(({ agentId, discIds }) => ({ agentId, discIds }))
  const allSavedPlans = baselineMembers.every(
    (member) => member.source === 'saved_team' || member.source === 'saved_agent',
  )
  const allCurrentEquipment = baselineMembers.every(
    (member) => member.source === 'current_equipment',
  )
  const anySavedPlan = baselineMembers.some(
    (member) => member.source === 'saved_team' || member.source === 'saved_agent',
  )
  const anyCurrentEquipment = baselineMembers.some(
    (member) => member.source === 'current_equipment',
  )
  const baselineSource: ValueBenchmarkComparisonBasis['baselineSource'] = allSavedPlans
    ? {
        kind: 'saved',
        referenceId: savedTeamPlan
          ? savedTeamPlan.id
          : JSON.stringify(baselineMembers.map((member) => member.referenceId)),
      }
    : allCurrentEquipment
      ? { kind: 'actual', referenceId: null }
      : { kind: 'none', referenceId: null }
  const baselineLabel = allSavedPlans
    ? savedTeamPlan
      ? `已保存队伍方案「${savedTeamPlan.name}」（按当前资产与本次方案参数重算，非游戏实装）`
      : '已保存单人方案组合（按当前资产与本次方案参数重算，非游戏实装）'
    : allCurrentEquipment
      ? '游戏当前实装（18张实体盘 + 当前音擎）'
      : anySavedPlan && anyCurrentEquipment
        ? '已保存方案与游戏实装的混合参考（非完整游戏实装）'
        : anySavedPlan
          ? '部分已保存方案参考（未形成完整十八盘基线）'
          : anyCurrentEquipment
            ? '部分已记录游戏实装（未形成完整十八盘基线）'
            : '尚无完整十八盘比较基线'
  const discIds = loadouts.flatMap((loadout) => loadout.discIds)
  const currentWEngines = input.candidate.memberIds.flatMap((agentId) => {
    const agent = input.warehouse.roster.agents.find((item) => item.agentId === agentId)
    const current = resolveWEngine({
      agent,
      legacyWEngines: input.warehouse.roster.wEngines,
    }).current
    return current
      ? [
          {
            agentId,
            engineId: current.engineId,
            refinement: current.refinement,
            level: current.level,
          },
        ]
      : []
  })
  const currentEngineLevelReasons = allCurrentEquipment
    ? currentWEngines
        .filter((engine) => engine.level !== 60)
        .map(
          (engine) =>
            `“${engine.agentId}”当前音擎为 ${engine.level} 级；游戏当前实装比较仅支持全员当前音擎 60 级，不会自动升满后计算。`,
        )
    : []
  const currentEquipmentParameters = allSavedPlans
    ? input.equipmentParameters
    : allCurrentEquipment &&
        input.equipmentParameters &&
        currentWEngines.length === input.candidate.memberIds.length &&
        currentEngineLevelReasons.length === 0
      ? {
          wEngines: currentWEngines.map(({ agentId, engineId, refinement }) => ({
            agentId,
            engineId,
            refinement,
          })),
          bangbooId: input.equipmentParameters.bangbooId,
          bangbooStars: input.equipmentParameters.bangbooStars,
        }
      : undefined
  const ready =
    loadouts.every((loadout) => loadout.discIds.length === 6) && new Set(discIds).size === 18
  const currentFit = {
    ...input.targetFit,
    status: ready
      ? ('ready' as const)
      : discIds.length
        ? ('partial' as const)
        : ('unavailable' as const),
    discCount: discIds.length,
    uniqueDiscCount: new Set(discIds).size,
    loadouts,
    gaps: ready
      ? []
      : input.candidate.memberIds.flatMap((agentId) => {
          const count = loadouts.find((loadout) => loadout.agentId === agentId)?.discIds.length ?? 0
          return count === 6 ? [] : [`当前实装或已保存参考中“${agentId}”只有 ${count}/6 张实体盘。`]
        }),
    boundary:
      '比较基线优先读取同一精确队伍的保存方案，再读取已保存单人方案或游戏实装；保存方案按当前资产及本次明确方案参数重算，不能称为游戏当前实装。实装侧音擎只读取当前事实。',
    fingerprint: stableContentHash({
      candidateId: input.candidate.candidateId,
      memberIds: input.candidate.memberIds,
      loadouts,
      source: savedTeamPlan ? `saved-team:${savedTeamPlan.id}` : 'active-plan-or-equipped',
    }),
  } satisfies TargetTeamWarehouseFit
  const currentBenchmark = projectTargetTeamAccountBoundBenchmark({
    warehouse: input.warehouse,
    candidate: input.candidate,
    fit: currentFit,
    rosterHash: input.rosterHash,
    warehouseHash: input.warehouseHash,
    planningHash: input.planningHash,
    capturedAt: input.capturedAt,
    equipmentParameters: currentEquipmentParameters,
  })
  const changedDimensions = [
    ...(stableContentHash(currentFit.loadouts) === stableContentHash(input.targetFit.loadouts)
      ? []
      : (['disc_loadout'] as const)),
    ...(stableContentHash(currentEquipmentParameters?.wEngines ?? []) ===
    stableContentHash(input.equipmentParameters?.wEngines ?? [])
      ? []
      : (['w_engine'] as const)),
  ]
  return compareValueBenchmarkSides({
    baseline: side({
      benchmark: currentBenchmark,
      candidate: input.candidate,
      fit: currentFit,
      parameters: currentEquipmentParameters,
      unsupportedReasons: currentEngineLevelReasons,
      stale: input.stale,
    }),
    candidate: side({
      benchmark: input.targetBenchmark,
      candidate: input.candidate,
      fit: input.targetFit,
      parameters: input.equipmentParameters,
      stale: input.stale,
    }),
    changedDimensions,
    independentCounterfactual: changedDimensions.length === 1,
    labels: {
      baseline: baselineLabel,
      candidate: '18 盘 Target Fit + 方案装备参数',
    },
    baselineSource,
  })
}
