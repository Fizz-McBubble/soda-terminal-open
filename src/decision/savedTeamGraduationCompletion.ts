import type { AccountRoster, RosterAgent } from '../assault/types'
import {
  projectOutOfCombatPanel,
  type OutOfCombatKey,
  type PanelResult,
} from '../calculation/outOfCombatPanel'
import type { DriveDisc } from '../domain/schemas'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import { defaultAscensionForLevel } from '../gameDataPacks/panel/wEngineGrowth'
import {
  readTargetPanelMetricSemantic,
  targetPanelMetricSemanticEntries,
  type TargetPanelMetricSemantic,
} from '../gameDataPacks/targetPanelSemantics'
import { resolveSuggestedWEngineParameters } from '../pages/teamExecutionAttributePanel'
import type { TeamExecution, TeamExecutionMember } from './teamExecutionProjection'
import { resolveSavedGraduationTarget } from './savedGraduationTargetContext'

const graduationPanelKeys = [
  'hp',
  'atk',
  'def',
  'impact',
  'critRate',
  'critDamage',
  'anomalyMastery',
  'anomalyProficiency',
  'penRatio',
  'energyRegen',
] as const satisfies readonly OutOfCombatKey[]

type GraduationPanelKey = (typeof graduationPanelKeys)[number]
type TargetRange = { min?: number; max?: number; upperOpen?: boolean }
type TargetPanelAuthority = NonNullable<ReturnType<typeof getCurrentBuildTargetPanel>>

const targetAliases: Record<GraduationPanelKey, readonly string[]> = {
  hp: ['hp', '生命值', 'hp_flat'],
  atk: ['atk', 'attack', '攻击力'],
  def: ['def', 'defense', '防御力'],
  impact: ['impact', '冲击力'],
  critRate: ['critRate', 'crit_rate', '暴击率'],
  critDamage: ['critDamage', 'crit_dmg', '暴击伤害'],
  anomalyMastery: ['anomalyMastery', 'anomaly_mastery', '异常掌控'],
  anomalyProficiency: ['anomalyProficiency', 'anomaly_proficiency', '异常精通'],
  penRatio: ['penRatio', 'pen_ratio', '穿透率'],
  energyRegen: ['energyRegen', 'energy_regen', '能量自动回复', '能量回复'],
}

const conditionLabels: Record<GraduationPanelKey, readonly string[]> = {
  hp: ['生命值', 'hp'],
  atk: ['攻击力', 'atk'],
  def: ['防御力', 'def'],
  impact: ['冲击力', 'impact'],
  critRate: ['暴击率', 'crit rate'],
  critDamage: ['暴击伤害', 'crit dmg'],
  anomalyMastery: ['异常掌控', 'anomaly mastery'],
  anomalyProficiency: ['异常精通', 'anomaly proficiency'],
  penRatio: ['穿透率', 'pen ratio'],
  energyRegen: ['能量回复', 'energy regen'],
}

const knownExplanatoryTargetConditions = new Set([
  '来源标明其他属性不相关',
  'source marks all other stats not relevant',
  'guide marks all other stats not relevant',
])

export type GraduationMetricCompletion = {
  key: GraduationPanelKey
  comparator: 'at_least' | 'at_most'
  requirement: 'required'
  boundary: TargetPanelMetricSemantic['boundary']
  observation: 'out_of_combat'
  current: number
  target: number
  ratio: number
  met: boolean
}

export type SavedTeamGraduationMemberCompletion =
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

type SavedTeamGraduationCompletionBase = {
  members: readonly SavedTeamGraduationMemberCompletion[]
  meaning: 'quantitative_target_attainment'
  reason: string
}

export type SavedTeamGraduationCompletion = SavedTeamGraduationCompletionBase &
  ({ status: 'scored'; score: number } | { status: 'unknown'; score: null })

function finiteRange(value: unknown): value is TargetRange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const range = value as TargetRange
  const hasMin = range.min !== undefined
  const hasMax = range.max !== undefined
  if (!hasMin && !hasMax) return false
  if (hasMin && !Number.isFinite(range.min)) return false
  if (hasMax && !Number.isFinite(range.max)) return false
  return !(hasMin && hasMax && range.max! < range.min!)
}

function targetMetric(value: unknown, key: GraduationPanelKey) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const raw = targetAliases[key].map((alias) => record[alias]).find((item) => item !== undefined)
  const inferredBoundary =
    finiteRange(raw) && raw.min === undefined ? ('cap' as const) : ('minimum' as const)
  const sourceSemantic = readTargetPanelMetricSemantic(value, key)
  if (sourceSemantic === null || (sourceSemantic && sourceSemantic.boundary !== inferredBoundary))
    return null
  const semantic =
    sourceSemantic ??
    ({
      requirement: 'required',
      boundary: inferredBoundary,
      observation: 'out_of_combat',
    } satisfies TargetPanelMetricSemantic)
  if (semantic.requirement === 'optional' || semantic.observation !== 'out_of_combat') return null
  if (semantic.boundary === 'cap') {
    if (finiteRange(raw) && raw.min === undefined && raw.max !== undefined && raw.max >= 0)
      return { comparator: 'at_most' as const, target: raw.max, semantic }
    return null
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0)
    return { comparator: 'at_least' as const, target: raw, semantic }
  if (finiteRange(raw) && raw.min !== undefined && raw.min >= 0)
    return { comparator: 'at_least' as const, target: raw.min, semantic }
  return null
}

function ratio(
  current: number,
  target: number,
  comparator: GraduationMetricCompletion['comparator'],
) {
  if (comparator === 'at_most') return current <= target ? 1 : target / current
  if (target === 0) return 1
  return Math.min(1, current / target)
}

/** Scores only real quantitative fields; ranges use their graduation floor. */
export function scoreGraduationPanelTargets(
  values: Pick<PanelResult, 'values'>['values'],
  target: unknown,
): { score: number; metrics: readonly GraduationMetricCompletion[] } | null {
  const metrics = graduationPanelKeys.flatMap((key) => {
    const requirement = targetMetric(target, key)
    const current = values[key]
    if (!requirement || !Number.isFinite(current) || current < 0) return []
    const attainment = Math.max(
      0,
      Math.min(1, ratio(current, requirement.target, requirement.comparator)),
    )
    return [
      {
        key,
        comparator: requirement.comparator,
        requirement: 'required',
        boundary: requirement.semantic.boundary,
        observation: 'out_of_combat',
        current,
        target: requirement.target,
        ratio: attainment,
        met: attainment === 1,
      } satisfies GraduationMetricCompletion,
    ]
  })
  if (!metrics.length) return null
  const average = metrics.reduce((sum, metric) => sum + metric.ratio, 0) / metrics.length
  return {
    score: metrics.every((metric) => metric.met) ? 100 : Math.min(99, Math.round(average * 100)),
    metrics,
  }
}

export function targetConditionsAreAutomaticallyApplicable(
  conditions: readonly string[],
  metrics: readonly GraduationMetricCompletion[],
  target?: unknown,
) {
  if (!conditions.length) return true
  const targetSemantics = targetPanelMetricSemanticEntries(target)
  return conditions.every((condition) => {
    const normalized = condition
      .trim()
      .replace(/[。；;.]+$/gu, '')
      .toLocaleLowerCase()
    // Some reviewed target-panel notes deliberately describe what the source does
    // not compare (for example, Sunna's "other stats are not relevant"). They are
    // still shown with the completion evidence, but they do not add an account
    // prerequisite. Keep the allowlist narrow so an unrecognised condition still
    // fails closed instead of turning a source note into a score.
    if (knownExplanatoryTargetConditions.has(normalized)) return true
    if (
      (normalized.includes('可选') || normalized.includes('optional')) &&
      targetSemantics.some(([, semantic]) => semantic.requirement === 'optional')
    )
      return true
    if (
      (normalized.includes('战斗内') || normalized.includes('in combat')) &&
      targetSemantics.some(([, semantic]) => semantic.observation === 'in_combat')
    )
      return true
    if (!normalized.includes('上限') && !normalized.includes('maximum')) return false
    return metrics.some(
      (metric) =>
        metric.comparator === 'at_most' &&
        conditionLabels[metric.key].some((label) => normalized.includes(label)),
    )
  })
}

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
  if (core === null || core < 2 || core > 7) return null
  return projectOutOfCombatPanel({
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

function evaluateMember(input: {
  agentId: string
  execution: TeamExecution
  roster: AccountRoster
  discs: readonly DriveDisc[]
}): SavedTeamGraduationMemberCompletion {
  const member = input.execution.members.find((item) => item.agentId === input.agentId)
  const agent = input.roster.agents.find((item) => item.agentId === input.agentId && item.owned)
  if (!member || !agent) return unknown(input.agentId, '已存队伍成员与当前自有代理人不匹配。')
  if (!member.suggested.wEngine) return unknown(input.agentId, '已存方案没有音擎身份。')
  const discs = selectedDiscs(member, input.discs)
  if (!discs) return unknown(input.agentId, '已存方案缺少六个唯一且可找到的盘位。')
  const target = getCurrentBuildTargetPanel(input.agentId)
  if (!target || !target.sourceRefs.length)
    return unknown(input.agentId, '当前版本没有可用的量化毕业面板目标。')
  // getCurrentBuildTargetPanel already requires a ready, version-qualified source.
  // Numeric panel source revisions are independent of the guide's reviewed version.
  const engine = savedPlanWEngine(member)
  if (!engine) return unknown(input.agentId, '已存方案没有可复算的计划音擎参数。')
  const projection = currentProjection(agent, member, discs)
  if (!projection || projection.status !== 'ok')
    return unknown(
      input.agentId,
      projection?.reason ?? '当前角色、核心技或音擎进度没有可复算的数据。',
    )
  const resolved = resolveSavedGraduationTarget({ agent, engineId: engine.id, discs, target })
  const scored = scoreGraduationPanelTargets(projection.values, resolved?.value ?? target.value)
  if (!scored) return unknown(input.agentId, '毕业目标不含可比的数值字段。')
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
    limitations: resolved?.limitations ?? [],
    appliedConditions: resolved?.applied ?? [],
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
  const members = memberIds.map((agentId) => evaluateMember({ ...input, agentId }))
  const scored = members.filter(
    (member): member is Extract<SavedTeamGraduationMemberCompletion, { status: 'scored' }> =>
      member.status === 'scored',
  )
  if (scored.length !== 3) {
    return {
      status: 'unknown',
      score: null,
      members,
      meaning: 'quantitative_target_attainment',
      reason: '三名成员必须都有完整配装、可比面板和已自动对齐的目标条件。',
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
