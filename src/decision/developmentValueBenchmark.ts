import type { CoreWarehouse } from '../accounts/coreFlow'
import type { AccountPlanningDraft } from '../accounts/types'
import { completePersonalValueBenchmarkCoverage } from '../calculation/personalValueBenchmarkCoverage'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import {
  compileNormalizedAgentEventSchedule,
  currentNormalizedPlanningBaseline,
} from '../calculation/currentNormalizedPlanningBaseline'
import { compileCurrentDriveDiscPlanningEffects } from '../calculation/currentDriveDiscPlanningEffects'
import {
  compileCurrentWEnginePersonalPlanningEffects,
  currentWEnginePersonalPlanningEffectVersion,
} from '../calculation/currentWEnginePersonalPlanningEffects'
import { evaluateSourceBackedPersonalPlanningDps } from '../calculation/currentPlanningTeamDpsRuntime'
import {
  compareValueBenchmarkSides,
  type ValueBenchmarkCoverage,
  type ValueBenchmarkSide,
} from '../calculation/valueBenchmarkComparison'
import type { DriveDisc } from '../domain/schemas'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import {
  accountSkillLevel,
  projectNormalizedAccountFinalStatsDetailed,
} from './normalizedPlanningCandidateEvaluator'
import { resolveWEngine } from './wEngineResolver'

const personalRuntimeIdentity = `source-backed-personal-fixed-event/v6-${currentWEnginePersonalPlanningEffectVersion}`
const personalEventSetIdentity = stableContentHash({
  baselineId: currentNormalizedPlanningBaseline.baselineId,
  selection: 'normalized-agent-fixed-event-schedule',
})

function unsupportedSide(input: {
  agentId: string
  discs: readonly DriveDisc[]
  engineKey: string
  state?: 'unsupported' | 'stale'
  reasons: string[]
}): ValueBenchmarkSide {
  return {
    state: input.state ?? 'unsupported',
    dimensions: {
      game_version: currentVersionProjection.gameVersion,
      subject: `agent:${input.agentId}`,
      scenario: 'scenario:normalized-personal',
      event_set: personalEventSetIdentity,
      duration: String(currentNormalizedPlanningBaseline.declaredDurationSeconds),
      formula: currentNormalizedPlanningBaseline.formulaHash,
      runtime: personalRuntimeIdentity,
      disc_loadout: stableContentHash(input.discs),
      w_engine: input.engineKey,
      bangboo: 'none',
    },
    totalDamage: null,
    planningDps: null,
    calculationFingerprint: null,
    reasons: input.reasons,
  }
}

function evaluateSide(input: {
  warehouse: CoreWarehouse
  agentId: string
  discs: readonly DriveDisc[]
  stale: boolean
  engineMode: 'current' | 'recommended'
}): ValueBenchmarkSide {
  const agent = input.warehouse.roster.agents.find(
    (item) => item.agentId === input.agentId && item.owned,
  )
  const resolution = resolveWEngine({
    agent,
    legacyWEngines: input.warehouse.roster.wEngines,
  })
  const engine = input.engineMode === 'current' ? resolution.current : resolution.recommendedPrimary
  const engineKey = engine
    ? `${engine.engineId}:p${engine.refinement}:lv${engine.level}`
    : 'missing'
  if (input.stale)
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      state: 'stale',
      reasons: ['账户或仓库快照已 stale，请重新分析。'],
    })
  if (!agent || !engine)
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: [
        !agent
          ? '缺少目标代理人。'
          : input.engineMode === 'current'
            ? '未记录当前音擎；六盘方案仍可查看和保存，固定事件数值比较需明确音擎参数。'
            : '当前没有来源化推荐音擎。',
      ],
    })
  if (engine.level !== 60)
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: ['当前试算仅支持 60 级音擎；不会将已记录的音擎等级自动提高后比较。'],
    })
  if (input.discs.length !== 6 || new Set(input.discs.map((disc) => disc.slot)).size !== 6)
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: [`需要六个不同盘位的实体驱动盘，当前为 ${input.discs.length}/6。`],
    })
  const projection = projectNormalizedAccountFinalStatsDetailed({
    agent,
    engineId: engine.engineId,
    discs: [...input.discs],
  })
  const stats = projection.status === 'supported' ? projection.stats : null
  const skillLevels = Object.fromEntries(
    ['basic', 'dodge', 'assist', 'special', 'chain', 'core'].map((skill) => [
      skill,
      accountSkillLevel(agent, skill),
    ]),
  )
  const schedule = compileNormalizedAgentEventSchedule({ agentId: input.agentId, skillLevels })
  if (!stats || schedule.status === 'unsupported')
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: [
        ...(projection.status === 'unsupported' ? projection.reasons : []),
        ...(schedule.status === 'unsupported' ? schedule.blockers : []),
      ],
    })
  const member = {
    agentId: input.agentId,
    mindscape: agent.mindscape,
    potential: agent.potentialImage,
    coreLevel: Math.min(7, accountSkillLevel(agent, 'core')),
    skillLevels,
    initialStats: stats.initialStats,
    finalStats: stats.finalStats,
  }
  const discEffects = compileCurrentDriveDiscPlanningEffects({
    members: [member],
    loadouts: [{ agentId: input.agentId, discs: input.discs }],
  })
  if (discEffects.status !== 'supported')
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: discEffects.blockers,
    })
  const engineEffects = compileCurrentWEnginePersonalPlanningEffects({
    agentId: input.agentId,
    engineId: engine.engineId,
    refinement: engine.refinement,
  })
  if (engineEffects.status !== 'supported')
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: engineEffects.blockers,
    })
  const discCoverage: ValueBenchmarkCoverage = {
    domain: 'fixed_event_direct_damage',
    includedEffectKeys: discEffects.buckets.map((bucket) => bucket.effectKey),
    excludedEffects: discEffects.exclusions.map((exclusion) => ({
      effectKey: `disc:${exclusion.agentId}:${exclusion.setId}:four-piece`,
      reason: exclusion.reason,
      fields: [...exclusion.fields],
      sourceRefs: [...exclusion.sourceRefs],
    })),
    exclusionContextFingerprint: stableContentHash({
      exclusions: discEffects.exclusions,
      initialStats: member.initialStats,
      finalStats: member.finalStats,
    }),
    boundary: discEffects.boundary,
  }
  const runtime = evaluateSourceBackedPersonalPlanningDps({
    member,
    eventUsages: schedule.eventUsages,
    baseline: currentNormalizedPlanningBaseline,
    equipmentModifierBuckets: [...discEffects.buckets, ...engineEffects.buckets],
  })
  if (runtime.status === 'unsupported')
    return unsupportedSide({
      agentId: input.agentId,
      discs: input.discs,
      engineKey,
      reasons: runtime.blockers,
    })
  const coverage = completePersonalValueBenchmarkCoverage({
    discCoverage,
    engine,
    engineSource: getCurrentWEngineStaticData(engine.engineId)?.source ?? null,
    member,
    potentialApplications: runtime.potentialApplications,
    engineEffects,
  })
  const dimensions: ValueBenchmarkSide['dimensions'] = {
    game_version: currentVersionProjection.gameVersion,
    subject: `agent:${input.agentId}`,
    scenario: 'scenario:normalized-personal',
    event_set: personalEventSetIdentity,
    duration: String(runtime.declaredDurationSeconds),
    formula: currentNormalizedPlanningBaseline.formulaHash,
    runtime: personalRuntimeIdentity,
    disc_loadout: stableContentHash(input.discs),
    w_engine: engineKey,
    bangboo: 'none',
  }
  return {
    state: 'supported',
    dimensions,
    totalDamage: runtime.totalDamage,
    planningDps: runtime.planningDps,
    calculationFingerprint: stableContentHash({ dimensions, runtime, coverage }),
    reasons: coverage.excludedEffects.map(
      (effect) =>
        `固定事件未计入 ${effect.effectKey}：${effect.reason}（${effect.fields.join('、') || '无可用条件字段'}）。`,
    ),
    coverage,
  }
}

export function projectDevelopmentValueBenchmarks(input: {
  warehouse: CoreWarehouse
  agentId: string
  baseline: DriveDisc[]
  candidates: CandidateWarehousePlan[]
  savedPlans?: readonly AccountPlanningDraft[]
  stale: boolean
}) {
  const validLoadout = (discs: readonly DriveDisc[]) =>
    discs.length === 6 &&
    new Set(discs.map((disc) => disc.id)).size === 6 &&
    new Set(discs.map((disc) => disc.slot)).size === 6 &&
    discs.every((disc) => input.warehouse.discs.some((owned) => owned.id === disc.id))
  const saved = (input.savedPlans ?? [])
    .filter(
      (plan) =>
        plan.accountId === input.warehouse.accountId &&
        plan.kind === 'agent' &&
        plan.state === 'saved' &&
        plan.savedRole === 'current_reference' &&
        plan.selection.agentIds.length === 1 &&
        plan.selection.agentIds[0] === input.agentId &&
        plan.solutionContext?.scope === 'agent_independent',
    )
    .toSorted(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.revision - left.revision,
    )[0]
  const savedIds =
    saved?.warehouseRefs.length === 6
      ? saved.warehouseRefs
      : (saved?.candidateWarehouse?.loadouts.find((item) => item.agentId === input.agentId)
          ?.discIds ?? [])
  const savedDiscs = savedIds.flatMap((id) => {
    const disc = input.warehouse.discs.find((item) => item.id === id)
    return disc ? [disc] : []
  })
  const firstCandidateDiscs =
    input.candidates[0]?.loadouts
      .find((item) => item.agentId === input.agentId)
      ?.discs.map((item) => item.disc) ?? []
  const actualAvailable = validLoadout(input.baseline)
  const savedAvailable = validLoadout(savedDiscs)
  const candidateAvailable = validLoadout(firstCandidateDiscs)
  const accountAgent = input.warehouse.roster.agents.find(
    (agent) => agent.agentId === input.agentId,
  )
  const currentEngineRecorded = Boolean(
    resolveWEngine({
      agent: accountAgent,
      legacyWEngines: input.warehouse.roster.wEngines,
    }).current,
  )
  const engineLabel = currentEngineRecorded ? '已记录当前音擎' : '音擎未记录'
  const baselineDiscs = actualAvailable
    ? input.baseline
    : savedAvailable
      ? savedDiscs
      : candidateAvailable && input.candidates.length > 1
        ? firstCandidateDiscs
        : []
  const baselineLabel = actualAvailable
    ? `游戏当前实装（已记录六盘，${engineLabel}）`
    : savedAvailable
      ? `已保存方案「${saved!.name}」（仅复用六盘引用，按当前资产与${engineLabel}重算，非游戏实装）`
      : baselineDiscs.length
        ? '仓库方案 1（试算基线，非游戏实装）'
        : '没有第二份可比方案（非游戏实装）'
  const baseline = baselineDiscs.length
    ? evaluateSide({
        warehouse: input.warehouse,
        agentId: input.agentId,
        discs: baselineDiscs,
        stale: input.stale,
        engineMode: 'current',
      })
    : unsupportedSide({
        agentId: input.agentId,
        discs: [],
        engineKey: 'missing',
        state: input.stale ? 'stale' : 'unsupported',
        reasons: [
          input.candidates.length === 1
            ? '仅有一份有效方案，直接查看即可；没有相对游戏实装的提升结论。'
            : '未记录完整的游戏当前实装，也没有可用的保存方案或第二份候选。',
        ],
      })
  return input.candidates.map((plan, index) => {
    const discs = plan.loadouts[0]?.discs.map((item) => item.disc) ?? []
    const candidate = evaluateSide({
      warehouse: input.warehouse,
      agentId: input.agentId,
      discs,
      stale: input.stale,
      engineMode: 'current',
    })
    const changedDimensions = [
      ...(baseline.dimensions.disc_loadout === candidate.dimensions.disc_loadout
        ? []
        : (['disc_loadout'] as const)),
      ...(baseline.dimensions.w_engine === candidate.dimensions.w_engine
        ? []
        : (['w_engine'] as const)),
    ]
    return compareValueBenchmarkSides({
      baselineSource: actualAvailable
        ? { kind: 'actual', referenceId: null }
        : savedAvailable
          ? { kind: 'saved', referenceId: saved!.id }
          : baselineDiscs.length
            ? { kind: 'candidate', referenceId: 'rank:1' }
            : { kind: 'none', referenceId: null },
      baseline:
        !actualAvailable && !savedAvailable && index === 0
          ? unsupportedSide({
              agentId: input.agentId,
              discs: baselineDiscs,
              engineKey: candidate.dimensions.w_engine,
              state: input.stale ? 'stale' : 'unsupported',
              reasons: ['该方案是试算基线；自身不计算相对提升。'],
            })
          : baseline,
      candidate,
      changedDimensions,
      independentCounterfactual: changedDimensions.length === 1,
      labels: {
        baseline: baselineLabel,
        candidate: `仓库方案 ${index + 1}（六张实体盘，${engineLabel}）`,
      },
    })
  })
}
