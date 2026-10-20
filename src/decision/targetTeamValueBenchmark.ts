import { defaultAscensionForLevel } from '../gameDataPacks/panel/wEngineGrowth'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import type { TargetTeamPlanningContextInput } from './targetTeamPlanningContextInput'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkComparisonBasis,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import { stableContentHash } from '../gameDataPacks/types'
import type { TeamBuildExecutionIdentity } from './teamBuildExecutionIdentity'
import {
  projectTargetTeamAccountBoundBenchmark,
  type TargetTeamAccountBoundBenchmark,
  type TargetTeamEquipmentParameterSelection,
} from './targetTeamAccountBoundBenchmark'
import type { TargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import { resolveWEngine } from './wEngineResolver'
import { compareReviewedLuminizeSettlements32 } from '../calculation/reviewedLuminizeSettlement32'
import type { LuminizeEquipmentComparison32 } from '../application/publicLuminizeComparison32'

const teamRuntimeIdentity = 'source-backed-target-team-fixed-event/v2'

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
  const projection =
    input.benchmark.calculationProjection?.status === 'supported'
      ? input.benchmark.calculationProjection
      : null
  const memberModel = projection?.memberModelQualification32
  const memberOnly = projection?.includedScope === 'three_members'
  const dimensions: ValueBenchmarkSide['dimensions'] = {
    game_version: input.benchmark.comparisonBaseline.gameVersion,
    subject: stableContentHash({
      memberIds: input.candidate.memberIds,
      progressionHash: projection?.progressionHash ?? null,
      bangbooId: memberOnly ? null : (parameters?.bangbooId ?? input.candidate.bangbooId),
    }),
    scenario: `${input.benchmark.scenarioIdentity}:${stableContentHash(input.benchmark.eventConditionDeclarationsByAgentId)}:${input.benchmark.resourceTimelineDeclarationIdentity32 ?? 'no-resource-timeline'}${memberModel ? `:${memberModel.policyId}` : ''}`,
    event_set: projection?.eventSetHash ?? input.benchmark.comparisonBaseline.baselineId,
    potential: projection?.potentialHash ?? 'unavailable',
    duration: String(input.benchmark.comparisonBaseline.declaredDurationSeconds),
    formula: input.benchmark.comparisonBaseline.formulaHash,
    runtime: memberModel ? `${teamRuntimeIdentity}:${memberModel.policyId}` : teamRuntimeIdentity,
    disc_loadout: stableContentHash(input.fit.loadouts),
    w_engine: stableContentHash(
      (parameters?.wEngines ?? []).map((row) => ({
        agentId: row.agentId,
        engineId: row.engineId,
        level: row.level ?? 60,
        ascension: row.ascension ?? defaultAscensionForLevel(row.level ?? 60),
        refinement: row.refinement,
      })),
    ),
    bangboo: memberOnly
      ? 'excluded_from_member_model'
      : parameters
        ? `${parameters.bangbooId}:s${parameters.bangbooStars}`
        : 'missing',
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
    totalDamage: memberModel?.totalDamage ?? input.benchmark.totalDamage,
    planningDps: memberModel?.planningDps ?? input.benchmark.planningDps,
    calculationFingerprint: memberModel?.contextComparisonKey ?? input.benchmark.fingerprint,
    reasons: memberModel
      ? []
      : (projection?.coverage.excludedEffects.map((row) => `${row.effectKey}：${row.reason}`) ??
        []),
    coverage:
      memberModel && projection
        ? {
            ...projection.coverage,
            excludedEffects: [],
            exclusionContextFingerprint: memberModel.policyId,
            boundary:
              '三名成员在同一声明准备状态与固定事件内的总伤害；不含邦布、准备动作伤害、异常结算或提前失衡收益。',
          }
        : projection?.coverage,
    ...(projection?.memberModelQualification32
      ? { memberModelQualification32: projection.memberModelQualification32 }
      : {}),
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
  scenarioSelection?: TargetTeamPlanningContextInput['scenarioSelection']
  eventConditionDeclarationsByAgentId?: TargetTeamPlanningContextInput['eventConditionDeclarationsByAgentId']
  resourceTimelineDeclaration32?: TargetTeamPlanningContextInput['resourceTimelineDeclaration32']
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
            ascension:
              agent?.wEngineDetails.id === current.engineId
                ? (agent.wEngineDetails.ascension ?? undefined)
                : undefined,
          },
        ]
      : []
  })
  const currentEquipmentParameters = allSavedPlans
    ? input.equipmentParameters && {
        ...input.equipmentParameters,
        ...(savedTeamPlan?.teamEquipmentParameters?.resourceTimelineDeclaration32 === undefined
          ? {}
          : {
              resourceTimelineDeclaration32:
                savedTeamPlan.teamEquipmentParameters.resourceTimelineDeclaration32,
            }),
      }
    : allCurrentEquipment &&
        input.equipmentParameters &&
        currentWEngines.length === input.candidate.memberIds.length
      ? {
          wEngines: currentWEngines.map(({ agentId, engineId, refinement, level, ascension }) => ({
            agentId,
            engineId,
            refinement,
            level,
            ascension,
          })),
          bangbooId: input.equipmentParameters.bangbooId,
          bangbooStars: input.equipmentParameters.bangbooStars,
          ...(input.equipmentParameters.koledaFixedEventConditions32
            ? {
                koledaFixedEventConditions32:
                  input.equipmentParameters.koledaFixedEventConditions32,
              }
            : {}),
          ...(input.equipmentParameters.luminizeComparison32 === undefined
            ? {}
            : { luminizeComparison32: input.equipmentParameters.luminizeComparison32 }),
          ...(input.equipmentParameters.resourceTimelineDeclaration32 === undefined
            ? {}
            : {
                resourceTimelineDeclaration32:
                  input.equipmentParameters.resourceTimelineDeclaration32,
              }),
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
    scenarioSelection: input.scenarioSelection,
    eventConditionDeclarationsByAgentId: input.eventConditionDeclarationsByAgentId,
    resourceTimelineDeclaration32:
      currentEquipmentParameters?.resourceTimelineDeclaration32 ??
      input.resourceTimelineDeclaration32,
    sourceInputFingerprint: input.targetBenchmark.sourceInputFingerprint,
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
    ...(currentBenchmark.calculationProjection?.status === 'supported' &&
    input.targetBenchmark.calculationProjection?.status === 'supported' &&
    currentBenchmark.calculationProjection.potentialHash !==
      input.targetBenchmark.calculationProjection.potentialHash
      ? (['potential'] as const)
      : []),
    ...(stableContentHash(currentFit.loadouts) === stableContentHash(input.targetFit.loadouts)
      ? []
      : (['disc_loadout'] as const)),
    ...(stableContentHash(
      (currentEquipmentParameters?.wEngines ?? []).map((row) => ({
        ...row,
        level: row.level ?? 60,
        ascension: row.ascension ?? defaultAscensionForLevel(row.level ?? 60),
      })),
    ) ===
    stableContentHash(
      (input.equipmentParameters?.wEngines ?? []).map((row) => ({
        ...row,
        level: row.level ?? 60,
        ascension: row.ascension ?? defaultAscensionForLevel(row.level ?? 60),
      })),
    )
      ? []
      : (['w_engine'] as const)),
  ]
  const currentLuminize = currentBenchmark.luminizeSnapshot32
  const candidateLuminize = input.targetBenchmark.luminizeSnapshot32
  let luminizeComparison32: LuminizeEquipmentComparison32 | undefined
  if (currentLuminize || candidateLuminize) {
    const boundary = candidateLuminize?.boundary ?? currentLuminize!.boundary
    const unavailable = (status: 'unsupported' | 'stale', blockers: string[]) => ({
      status,
      currentDamage: null,
      candidateDamage: null,
      delta: null,
      basis: 'account_equipment_static_preparation' as const,
      boundary,
      blockers,
    })
    if (input.stale) {
      luminizeComparison32 = unavailable('stale', ['账户或仓库已变化，请重新比较辉映。'])
    } else if (
      currentLuminize?.status !== 'supported' ||
      candidateLuminize?.status !== 'supported' ||
      !currentLuminize.snapshot ||
      !candidateLuminize.snapshot
    ) {
      luminizeComparison32 = unavailable('unsupported', [
        ...new Set([
          ...(currentLuminize?.blockers ?? ['比较基线缺少完整的账号配装快照。']),
          ...(candidateLuminize?.blockers ?? ['候选方案缺少完整的账号配装快照。']),
        ]),
      ])
    } else {
      const compared = compareReviewedLuminizeSettlements32(
        currentLuminize.snapshot.declaration,
        candidateLuminize.snapshot.declaration,
      )
      luminizeComparison32 =
        compared.status === 'declared_comparison'
          ? {
              status: 'supported',
              currentDamage: compared.currentDamage,
              candidateDamage: compared.candidateDamage,
              delta: compared.delta,
              basis: 'account_equipment_static_preparation',
              boundary,
              blockers: [],
            }
          : unavailable('unsupported', ['两侧辉映事件、目标或快照准备条件不一致。'])
    }
  }
  return {
    ...(luminizeComparison32 === undefined ? {} : { luminizeComparison32 }),
    ...compareValueBenchmarkSides({
      baseline: side({
        benchmark: currentBenchmark,
        candidate: input.candidate,
        fit: currentFit,
        parameters: currentEquipmentParameters,
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
        candidate: `18盘 Target Fit + 方案装备参数（${input.equipmentParameters?.wEngines.map((row) => `${row.agentId}:${row.engineId} Lv${row.level ?? '60（旧声明）'}/P${row.refinement}`).join('、') ?? '参数未提供'}；音擎维度变化包含养成变化）`,
      },
      baselineSource,
    }),
    scenarioSelection: input.targetBenchmark.scenarioSelection,
    scenarioIdentity: input.targetBenchmark.scenarioIdentity,
  }
}
