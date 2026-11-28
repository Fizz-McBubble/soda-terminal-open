import { targetConditionsAreAutomaticallyApplicable } from './graduationTargetConditions'
export { targetConditionsAreAutomaticallyApplicable } from './graduationTargetConditions'
import type { AccountRoster, RosterAgent } from '../assault/types'
import {
  projectOutOfCombatMenuPanel,
  projectOutOfCombatPanel,
} from '../calculation/outOfCombatPanel'
import type { DriveDisc } from '../domain/schemas'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'
import { targetPanelMetricSemanticEntries } from '../gameDataPacks/targetPanelSemantics'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import { defaultAscensionForLevel } from '../gameDataPacks/panel/wEngineGrowth'
import { resolveSuggestedWEngineParameters } from '../pages/teamExecutionAttributePanel'
import type { TeamExecution, TeamExecutionMember } from './teamExecutionProjection'
import { resolveSavedGraduationTarget } from './savedGraduationTargetContext'
import { resolveReviewedZhaoHpTarget } from '../gameDataPacks/reviewedZhaoSupportTarget'
import {
  resolveSavedGraduationBuildObjective,
  type SavedGraduationBuildObjective,
} from './savedGraduationBuildObjective'
import { candidatePanelInputForSchemeAgent } from '../optimizer/optimizeAccountBuildsPanelInput'
import type { CurrentPlanningScenarioSelection32 } from '../application/publicPlanningScenarioContract'
import type { ReviewedEventConditionDeclarations32 } from '../calculation/reviewedEventConditionDeclarations32'
import { targetTeamBuildDirectionConditions } from '../application/targetTeamEffectivePotentialConditions'

import {
  scoreGraduationPanelTargets,
  type GraduationMetricCompletion,
} from './graduationPanelTargets'
export {
  scoreGraduationPanelTargets,
  type GraduationMetricCompletion,
} from './graduationPanelTargets'

type GraduationPanelKey = GraduationMetricCompletion['key']
type TargetRange = { min?: number; max?: number; upperOpen?: boolean }
type TargetPanelAuthority = NonNullable<ReturnType<typeof getCurrentBuildTargetPanel>>

export type SavedTeamGraduationMemberCompletion = {
  buildObjective?: SavedGraduationBuildObjective
} & (
  | {
      status: 'scored'
      agentId: string
      score: number
      metrics: readonly GraduationMetricCompletion[]
      limitations?: readonly string[]
      appliedConditions?: readonly string[]
      targetStatus: TargetPanelAuthority['status']
      targetSourceIds: readonly string[]
      targetGameVersion: string
      projectionBasis: 'current_saved_loadout'
      progression: {
        agentLevel: number
        coreLevel: number
        wEngineLevel: number
        savedWEngineRefinement: number
      }
    }
  | { status: 'unknown'; agentId: string; score: null; reason: string }
  | {
      status: 'reference'
      agentId: string
      score: null
      reason: string
      referenceMetrics: readonly {
        key: GraduationPanelKey
        current: number
        minimum: number
        difference: number
      }[]
      conditions: readonly string[]
      targetSourceIds: readonly string[]
    }
)

type SavedTeamGraduationCompletionBase = {
  members: readonly SavedTeamGraduationMemberCompletion[]
  meaning: 'quantitative_target_attainment'
  reason: string
}

export type SavedTeamGraduationCompletion = SavedTeamGraduationCompletionBase &
  ({ status: 'scored'; score: number } | { status: 'unknown' | 'reference'; score: null })

export function combineGraduationCompletionScores(scores: readonly number[]) {
  if (!scores.length || scores.some((score) => !Number.isFinite(score) || score < 0 || score > 100))
    return null
  if (scores.every((score) => score === 100)) return 100
  return Math.min(99, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length))
}

function unknown(agentId: string, reason: string): SavedTeamGraduationMemberCompletion {
  return { status: 'unknown', agentId, score: null, reason }
}

function selectedDiscs(member: TeamExecutionMember, warehouse: readonly DriveDisc[]) {
  const ids = member.suggested.discIds
  if (ids.length !== 6 || new Set(ids).size !== 6) return null
  const byId = new Map(warehouse.map((disc) => [disc.id, disc]))
  const selected = ids.map((id) => byId.get(id))
  return selected.every((disc): disc is DriveDisc => Boolean(disc)) ? selected : null
}

function savedPlanWEngine(member: TeamExecutionMember) {
  const planned = resolveSuggestedWEngineParameters(member.suggested.wEngine, null)
  return planned
    ? {
        id: planned.engineId,
        level: planned.level,
        ascension: planned.ascension,
        refinement: planned.refinement,
      }
    : null
}

function currentProjection(
  agent: RosterAgent,
  member: TeamExecutionMember,
  discs: readonly DriveDisc[],
) {
  const agentAnchor = currentPanelData.agents[agent.agentId]
  const engine = savedPlanWEngine(member)
  if (!agentAnchor || !engine || !currentPanelData.wEngines[engine.id]) return null
  if (agentAnchor.kind === 'menu_observed' && agent.mindscape !== agentAnchor.mindscape) return null
  const core = agent.skillLevels.core
  if (core === null || !Number.isInteger(core) || core < 1 || core > 7) return null
  return projectOutOfCombatMenuPanel({
    agentId: agent.agentId,
    level: agent.level,
    ascension: agent.ascension ?? defaultAscensionForLevel(agent.level),
    mindscape: agent.mindscape,
    core: core - 2,
    wEngine: {
      id: engine.id,
      level: engine.level,
      ascension: engine.ascension ?? defaultAscensionForLevel(engine.level),
      refinement: engine.refinement,
    },
    discs: [...discs],
  })
}

/** Shared by saved plans and offline rating preparation; the same conditional
 * target and reference handling must apply before any panel comparison. */
export function evaluateSavedGraduationMember(input: {
  agentId: string
  execution: TeamExecution
  roster: AccountRoster
  discs: readonly DriveDisc[]
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclarationsByAgentId?: ReviewedEventConditionDeclarations32
}): SavedTeamGraduationMemberCompletion {
  const member = input.execution.members.find((item) => item.agentId === input.agentId)
  const agent = input.roster.agents.find((item) => item.agentId === input.agentId && item.owned)
  if (!member || !agent) return unknown(input.agentId, '已存队伍成员与当前自有代理人不匹配。')
  if (!member.suggested.wEngine) return unknown(input.agentId, '已存方案没有音擎身份。')
  const discs = selectedDiscs(member, input.discs)
  if (!discs) return unknown(input.agentId, '已存方案缺少六个唯一且可找到的盘位。')
  const engine = savedPlanWEngine(member)
  if (!engine) return unknown(input.agentId, '已存方案没有可复算的计划音擎参数。')
  const directionConditions = targetTeamBuildDirectionConditions({
    memberIds: input.execution.memberIds,
    roster: input.roster,
  })
  const target = getCurrentBuildTargetPanel(input.agentId, {
    coreLevel: agent.skillLevels.core,
    specialLevel: agent.skillLevels.special,
    engineId: engine.id,
    engineRefinement: engine.refinement,
    agentLevel: agent.level,
    mindscape: agent.mindscape,
    memberIds: input.execution.memberIds,
    ...directionConditions,
  })
  // getCurrentBuildTargetPanel already requires a ready, version-qualified source.
  // Numeric panel source revisions are independent of the guide's reviewed version.
  const projection = currentProjection(agent, member, discs)
  if (!projection || projection.status !== 'ok')
    return unknown(
      input.agentId,
      projection?.reason ?? '当前角色、核心技或音擎进度没有可复算的数据。',
    )
  const resolved = target
    ? resolveSavedGraduationTarget({
        agent,
        engineId: engine.id,
        engineRefinement: engine.refinement,
        discs,
        target,
        memberIds: input.execution.memberIds,
        ...directionConditions,
      })
    : null
  const objective = resolveSavedGraduationBuildObjective({
    agent,
    agents: input.roster.agents,
    memberIds: input.execution.memberIds,
    discs,
    panelInput: candidatePanelInputForSchemeAgent(agent, {
      engineId: engine.id,
      level: engine.level,
      ascension: engine.ascension,
      refinement: engine.refinement,
    }),
    target: resolved?.value,
    scenarioSelection: input.scenarioSelection,
    eventConditionDeclaration: input.eventConditionDeclarationsByAgentId?.[agent.agentId],
  })
  if (objective?.referenceReason)
    return {
      status: 'reference',
      agentId: input.agentId,
      score: null,
      reason: objective.referenceReason,
      referenceMetrics: [],
      conditions: objective.conditions,
      targetSourceIds: [
        ...new Set([
          ...(target?.sourceRefs.map((source) => source.id) ?? []),
          ...objective.evidence.sourceRefs,
        ]),
      ],
      buildObjective: objective.evidence,
    }
  if (!target || !target.sourceRefs.length)
    return unknown(input.agentId, '当前版本没有可用的量化毕业面板目标。')
  let scoreValues = projection.values
  if (
    (target.value &&
      typeof target.value === 'object' &&
      'contextualMechanicTargets' in target.value) ||
    resolveReviewedZhaoHpTarget({
      agentId: agent.agentId,
      coreLevel: agent.skillLevels.core ?? undefined,
    })
  ) {
    // The mechanic reads precise initial HP; menu rounding must not cross the threshold.
    const precise = projectOutOfCombatPanel({
      agentId: agent.agentId,
      level: agent.level,
      ascension: agent.ascension ?? defaultAscensionForLevel(agent.level),
      mindscape: agent.mindscape,
      core: agent.skillLevels.core! - 2,
      wEngine: {
        id: engine.id,
        level: engine.level,
        ascension: engine.ascension ?? defaultAscensionForLevel(engine.level),
        refinement: engine.refinement,
      },
      discs: [...discs],
    })
    if (precise.status !== 'ok' || !Number.isFinite(precise.values.hp))
      return unknown(input.agentId, '初始属性机制目标缺少精确面板。')
    scoreValues = { ...scoreValues, ...precise.values }
  }
  const reference = (
    target.value as { cultivationReference?: { keys: GraduationPanelKey[]; conditions: string[] } }
  ).cultivationReference
  if (reference) {
    const raw = target.value as Record<string, TargetRange>
    const metrics = reference.keys.flatMap((key) => {
      const minimum = raw[key]?.min
      const current = scoreValues[key]
      return typeof minimum === 'number' && Number.isFinite(current)
        ? [{ key, current, minimum, difference: current - minimum }]
        : []
    })
    return {
      status: 'reference',
      agentId: input.agentId,
      score: null,
      reason: `培养参考对照：${metrics.map((metric) => `${metric.key === 'def' ? '防御力' : metric.key} ${metric.current}，作者参考下沿${metric.minimum}，差值${metric.difference >= 0 ? '+' : ''}${metric.difference}`).join('；')}。${reference.conditions.join('；')}`,
      referenceMetrics: metrics,
      conditions: reference.conditions,
      targetSourceIds: target.sourceRefs.map((source) => source.id),
    }
  }
  const activeTarget = resolved?.value ?? target.value
  const scored = scoreGraduationPanelTargets(scoreValues, activeTarget)
  if (!scored) {
    const metrics = targetPanelMetricSemanticEntries(activeTarget)
    const values = activeTarget as Record<string, unknown>
    if (
      metrics.length > 0 &&
      metrics.every(
        ([key, semantic]) => semantic.observation === 'reference' && Number.isFinite(values[key]),
      )
    )
      return {
        status: 'reference',
        agentId: input.agentId,
        score: null,
        reason: target.conditions.join('；') || '攻略数值仅供配装参考。',
        referenceMetrics: [],
        conditions: target.conditions,
        targetSourceIds: target.sourceRefs.map((source) => source.id),
      }
    return unknown(input.agentId, '毕业目标不含可比的数值字段。')
  }
  if (
    !resolved &&
    !targetConditionsAreAutomaticallyApplicable(target.conditions, scored.metrics, target.value)
  )
    return unknown(input.agentId, `毕业目标条件尚未支持核验：${target.conditions.join('；')}`)
  return {
    status: 'scored',
    agentId: input.agentId,
    score: scored.score,
    metrics: scored.metrics,
    limitations: [
      ...(resolved?.limitations ?? target.conditions),
      ...(objective?.conditions ?? []),
    ],
    appliedConditions: resolved?.applied ?? [],
    ...(objective ? { buildObjective: objective.evidence } : {}),
    targetStatus: target.status,
    targetSourceIds: target.sourceRefs.map((source) => source.id),
    targetGameVersion: target.gameVersion,
    projectionBasis: 'current_saved_loadout',
    progression: {
      agentLevel: agent.level,
      coreLevel: agent.skillLevels.core!,
      wEngineLevel: engine.level,
      savedWEngineRefinement: engine.refinement,
    },
  }
}

/** Read-only completion for the exact saved execution; it never uses team strength or warehouse score. */
export function createSavedTeamGraduationCompletion(input: {
  execution: TeamExecution
  roster: AccountRoster
  discs: readonly DriveDisc[]
  scenarioSelection?: CurrentPlanningScenarioSelection32
  eventConditionDeclarationsByAgentId?: ReviewedEventConditionDeclarations32
}): SavedTeamGraduationCompletion {
  const memberIds = input.execution.memberIds
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) {
    return {
      status: 'unknown',
      score: null,
      members: [],
      meaning: 'quantitative_target_attainment',
      reason: '已存队伍不是三个唯一代理人的完整执行快照。',
    }
  }
  const members = memberIds.map((agentId) => evaluateSavedGraduationMember({ ...input, agentId }))
  const scored = members.filter(
    (member): member is Extract<SavedTeamGraduationMemberCompletion, { status: 'scored' }> =>
      member.status === 'scored',
  )
  if (scored.length !== 3) {
    const onlyReference =
      members.every((member) => member.status !== 'unknown') &&
      members.some((member) => member.status === 'reference')
    return {
      status: onlyReference ? 'reference' : 'unknown',
      score: null,
      members,
      meaning: 'quantitative_target_attainment',
      reason: onlyReference
        ? '包含已核来源的培养参考对照；参考差值不并入机制满档完成度。'
        : '三名成员必须都有完整配装、可比面板和已自动对齐的目标条件。',
    }
  }
  return {
    status: 'scored',
    score: combineGraduationCompletionScores(scored.map((member) => member.score))!,
    members,
    meaning: 'quantitative_target_attainment',
    reason: '100 仅表示三名成员的当前量化毕业目标均已达标。',
  }
}
