import type { RosterAgent } from '../assault/types'
import { playerFacingPlanName } from '../application/savedPlanDisplayName'
import type { DriveDisc, StatKey } from '../domain/schemas'
import type { ProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import {
  readTargetPanelMetricSemantic,
  type TargetPanelMetricKey,
  type TargetPanelMetricSemantic,
} from '../gameDataPacks/targetPanelSemantics'
import type { PanelResult } from '../calculation/outOfCombatPanel'
import {
  getL3AgentDevelopmentEvidence,
  type L3AgentDevelopmentEvidenceStatus,
} from '../gameDataPacks/l3ProductionProjection'

export type CurrentEvidence = '账户组合复算' | '暂不可复算'
export type ContributionEvidence = '盘面贡献' | '无可证贡献'
export type TargetEvidence = 'formal' | 'verified_candidate' | 'candidate' | 'missing'

export const characterPanelLabels = [
  '生命值',
  '攻击力',
  '防御力',
  '冲击力',
  '暴击率',
  '暴击伤害',
  '异常掌控',
  '异常精通',
  '穿透率',
  '能量自动回复',
] as const
type CharacterPanelLabel = (typeof characterPanelLabels)[number]

export type WorkbenchFact = {
  label: CharacterPanelLabel
  current: string
  contribution: string
  target: string
  currentEvidence: CurrentEvidence
  contributionEvidence: ContributionEvidence
  targetEvidence: TargetEvidence
  direction: string | null
}
export type PlannedDiscFact = {
  slot: number
  disc: DriveDisc | null
  state: '方案实体盘' | '已装备实体盘' | '盘位引用缺失'
}
export type CurrentDiscSource = '当前方案' | '当前已装备' | '未关联实体盘'
export type CandidateReferenceFact = {
  id: string
  group: string
  fieldPath: string
  conclusion: string
  strength: 'consensus' | 'limited'
  conditions: readonly string[]
  sourceIds: readonly string[]
  evidenceId: string | null
  contentHashes: readonly string[]
  sourceEvaluation: boolean
}
export type CandidateReferenceGroup = {
  label: string
  facts: readonly CandidateReferenceFact[]
}
export type WorkbenchSlice = {
  currentCombination: {
    level: number
    core: number | null
    wEngine: string
    discCount: number
    availability: 'available' | 'unavailable'
  }
  currentPanel: { availability: 'available' | 'unavailable'; facts: WorkbenchFact[] }
  goalState: { availability: 'available' | 'unavailable'; sourcedFacts: WorkbenchFact[] }
  advice: Array<{
    domain: '驱动盘' | '音擎' | '技能'
    object: string
    action: string
    reason: string
    completion: string
    availability: 'available' | 'unavailable'
  }>
  planState: { availability: 'available' | 'unavailable'; name: string; discCount: number }
  dataFoundation: {
    packageId: string | null
    evidenceStatus: L3AgentDevelopmentEvidenceStatus
    current: '可复算锚点' | '资料不足'
    reference: '参考方向' | '资料不足'
    blockers: readonly ('candidate_only' | 'data_gap')[]
  }
  candidateReferences: {
    availability: 'available' | 'unavailable'
    groups: readonly CandidateReferenceGroup[]
    total: number
  }
}
type DevelopmentPlan = { name: string; warehouseRefs: string[] } | null
type TargetPanel = {
  value: unknown
  status: 'formal' | 'verified_candidate' | 'candidate' | 'missing'
} | null

const contributionLabels: Partial<Record<StatKey, CharacterPanelLabel>> = {
  hp_flat: '生命值',
  atk_flat: '攻击力',
  def_flat: '防御力',
  impact: '冲击力',
  crit_rate: '暴击率',
  crit_dmg: '暴击伤害',
  anomaly_mastery: '异常掌控',
  anomaly_proficiency: '异常精通',
  pen_ratio: '穿透率',
  energy_regen: '能量自动回复',
}
const panelKeys: Record<CharacterPanelLabel, TargetPanelMetricKey> = {
  生命值: 'hp',
  攻击力: 'atk',
  防御力: 'def',
  冲击力: 'impact',
  暴击率: 'critRate',
  暴击伤害: 'critDamage',
  异常掌控: 'anomalyMastery',
  异常精通: 'anomalyProficiency',
  穿透率: 'penRatio',
  能量自动回复: 'energyRegen',
}
const targetKeys: Partial<Record<CharacterPanelLabel, string[]>> = {
  生命值: ['生命值', 'hp', 'hp_flat'],
  攻击力: ['攻击力', 'attack', 'atk'],
  防御力: ['防御力', 'defense', 'def'],
  冲击力: ['冲击力', 'impact'],
  暴击率: ['暴击率', 'critRate', 'crit_rate'],
  暴击伤害: ['暴击伤害', 'critDamage', 'crit_dmg'],
  异常掌控: ['异常掌控', 'anomalyMastery', 'anomaly_mastery'],
  异常精通: ['异常精通', 'anomalyProficiency', 'anomaly_proficiency'],
  穿透率: ['穿透率', 'pen_ratio'],
  能量自动回复: ['能量自动回复', 'energyRegen', 'energy_regen'],
}

function usesPercent(label: CharacterPanelLabel) {
  return ['暴击率', '暴击伤害', '穿透率'].includes(label)
}
function truncateDecimal(value: number, precision: number) {
  const scale = 10 ** precision
  const truncated = Math.floor((value + Number.EPSILON) * scale) / scale
  return truncated
    .toFixed(precision)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1')
}
/**
 * The game menu does not show calculation precision: HP is rounded upward,
 * while the other whole-number panel rows are truncated. Percent rows and
 * energy regeneration retain one visible decimal place.
 */
function displayGameMenuNumber(label: CharacterPanelLabel, value: number) {
  if (label === '生命值') return String(Math.ceil(value))
  if (usesPercent(label) || label === '能量自动回复') return truncateDecimal(value, 1)
  return String(Math.floor(value))
}
function displayPanelValue(label: CharacterPanelLabel, value: number) {
  return `${displayGameMenuNumber(label, value)}${usesPercent(label) ? '%' : ''}`
}
function readTargetValue(panel: TargetPanel, label: CharacterPanelLabel) {
  if (
    !panel ||
    panel.status === 'missing' ||
    !panel.value ||
    typeof panel.value !== 'object' ||
    Array.isArray(panel.value)
  )
    return null
  const values = panel.value as Record<string, unknown>
  const value = targetKeys[label]
    ?.map((key) => values[key])
    .find(
      (item): item is number | { min?: number; max?: number; upperOpen?: boolean } =>
        (typeof item === 'number' && Number.isFinite(item)) ||
        (Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          (typeof (item as { min?: unknown }).min === 'number' ||
            typeof (item as { max?: unknown }).max === 'number')),
    )
  if (value === undefined) return null
  if (
    typeof value !== 'number' &&
    ((value.min !== undefined && !Number.isFinite(value.min)) ||
      (value.max !== undefined &&
        (!Number.isFinite(value.max) || (value.min !== undefined && value.max < value.min))))
  )
    return null
  const inferredBoundary =
    typeof value !== 'number' && value.min === undefined ? ('cap' as const) : ('minimum' as const)
  const semantic = readTargetPanelMetricSemantic(values, panelKeys[label])
  if (semantic === null || (semantic && semantic.boundary !== inferredBoundary)) return null
  return {
    value,
    semantic:
      semantic ??
      ({
        requirement: 'required',
        boundary: inferredBoundary,
        observation: 'out_of_combat',
      } satisfies TargetPanelMetricSemantic),
  }
}

/** Shared lower bound for numeric and range guidance; never synthesizes a target. */
export function targetPanelLowerBound(panel: TargetPanel, label: CharacterPanelLabel) {
  const target = readTargetValue(panel, label)
  if (
    target === null ||
    target.semantic.requirement === 'optional' ||
    target.semantic.boundary === 'cap' ||
    target.semantic.observation !== 'out_of_combat'
  )
    return null
  return typeof target.value === 'number' ? target.value : (target.value.min ?? null)
}

export function targetPanelDisplayValue(panel: TargetPanel, label: CharacterPanelLabel) {
  const target = readTargetValue(panel, label)
  if (target === null) return null
  const { value, semantic } = target
  const base =
    typeof value === 'number'
      ? displayPanelValue(label, value)
      : value.min === undefined
        ? `≤${displayPanelValue(label, value.max!)}`
        : value.max === undefined
          ? `${displayPanelValue(label, value.min)}+`
          : `${displayPanelValue(label, value.min)}–${displayPanelValue(label, value.max)}${value.upperOpen ? '+' : ''}`
  const qualifiers = [
    ...(semantic.requirement === 'optional' ? ['可选'] : []),
    ...(semantic.observation === 'in_combat' ? ['战斗内'] : []),
  ]
  return qualifiers.length ? `${base}（${qualifiers.join(' · ')}）` : base
}

function candidateReferenceGroup(fieldPath: string) {
  const root = fieldPath.split('.', 1)[0]
  if (root === 'build') return '养成配置'
  if (root === 'investment' || root === 'growth' || root === 'core') return '投入与成长'
  if (root === 'mechanics') return '机制说明'
  if (root === 'team' || root === 'relation') return '队伍条件'
  if (root === 'operation' || root === 'scenario') return '操作场景'
  if (root === 'skills') return '技能说明'
  return '其他参考'
}

function candidateReferences(evidence: ReturnType<typeof getL3AgentDevelopmentEvidence>) {
  const facts = (evidence?.candidateFacts ?? []).flatMap((fact) => {
    if (!fact.candidateClaim || typeof fact.value !== 'string') return []
    const claim = fact.candidateClaim
    return [
      {
        id: `${claim.reviewedClaimId ?? 'unreviewed'}:${fact.fieldPath}:${fact.sourceIds.join('|')}`,
        group: candidateReferenceGroup(fact.fieldPath),
        fieldPath: fact.fieldPath,
        conclusion: fact.value,
        strength: claim.strength,
        conditions: claim.conditions,
        sourceIds: fact.sourceIds,
        evidenceId: claim.reviewedClaimId,
        contentHashes: claim.contentHashes,
        sourceEvaluation: claim.sourceEvaluation,
      } satisfies CandidateReferenceFact,
    ]
  })
  const groups = [...new Set(facts.map((fact) => fact.group))].map((label) => ({
    label,
    facts: facts.filter((fact) => fact.group === label),
  }))
  return {
    availability: facts.length ? ('available' as const) : ('unavailable' as const),
    groups,
    total: facts.length,
  }
}

export function createAgentDevelopmentWorkbenchViewModel(input: {
  agent: RosterAgent
  profile: ProjectedBuildKnowledgeProfile
  activePlan: DevelopmentPlan
  discs: DriveDisc[]
  targetPanel?: TargetPanel
  panel?: PanelResult
}) {
  const { agent, profile, activePlan, discs, targetPanel = null, panel } = input
  const l3Evidence = getL3AgentDevelopmentEvidence(agent.agentId)
  const references = candidateReferences(l3Evidence)
  const planIds = activePlan?.warehouseRefs ?? []
  const equippedIds = agent.equippedDiscIds ?? []
  const planDiscCount = discs.filter((disc) => planIds.includes(disc.id)).length
  const equippedDiscCount = discs.filter((disc) => equippedIds.includes(disc.id)).length
  const discSource: CurrentDiscSource =
    planIds.length === 6 && planDiscCount === 6
      ? '当前方案'
      : equippedIds.length === 6 && equippedDiscCount === 6
        ? '当前已装备'
        : '未关联实体盘'
  const currentDiscIds =
    discSource === '当前方案' ? planIds : discSource === '当前已装备' ? equippedIds : []
  const plannedDiscs = [1, 2, 3, 4, 5, 6].map((slot) => {
    const disc =
      discs.find((item) => currentDiscIds.includes(item.id) && item.slot === slot) ?? null
    return {
      slot,
      disc,
      state: disc ? (discSource === '当前已装备' ? '已装备实体盘' : '方案实体盘') : '盘位引用缺失',
    } satisfies PlannedDiscFact
  })
  const contribution = new Map<CharacterPanelLabel, number[]>()
  plannedDiscs
    .flatMap((item) => item.disc?.subStats ?? [])
    .forEach((subStat) => {
      const label = contributionLabels[subStat.stat]
      if (label) contribution.set(label, [...(contribution.get(label) ?? []), subStat.value])
    })
  const direction = profile.recommendation?.subStats.join('、') ?? null
  const facts: WorkbenchFact[] = characterPanelLabels.map((label) => {
    const currentValue = panel?.status === 'ok' ? panel.values[panelKeys[label]] : undefined
    const values = contribution.get(label) ?? []
    const target = targetPanelDisplayValue(targetPanel, label)
    return {
      label,
      current: currentValue === undefined ? '暂不可复算' : displayPanelValue(label, currentValue),
      contribution: values.length
        ? `+${displayPanelValue(
            label,
            values.reduce((total, value) => total + value, 0),
          )}`
        : panel?.status === 'ok'
          ? '已纳入六盘投影'
          : '无可证副词条',
      target: target ?? '资料不足',
      currentEvidence: currentValue === undefined ? '暂不可复算' : '账户组合复算',
      contributionEvidence: values.length || panel?.status === 'ok' ? '盘面贡献' : '无可证贡献',
      targetEvidence: target ? (targetPanel?.status ?? 'missing') : 'missing',
      direction,
    }
  })
  const recordedCurrent = facts
    .filter((fact) => fact.current !== '暂不可复算')
    .map((fact) => fact.label)
  const contributionCount = facts.filter((fact) => fact.contribution !== '无可证副词条').length
  const targetCount = facts.filter((fact) => fact.target !== '资料不足').length
  const diagnosis =
    panel?.status === 'ok'
      ? `可复算锚点：十项游戏当前属性已由${discSource === '当前方案' ? '当前方案' : '已装备'}的实体盘和账户角色/音擎事实复算，并按游戏菜单精度显示。`
      : `资料不足：局外面板暂不支持：${panel?.reason ?? '当前没有可用内核输入。'}`
  const gap = `当前总面板仍缺 ${facts.length - recordedCurrent.length} 项；目标数值已来源化 ${targetCount} 项，其他位置显示资料不足。`
  const actions = [
    recordedCurrent.length
      ? `在游戏局外面板核对项目复算的 ${recordedCurrent.join('、')}。`
      : '补齐可复算的角色、音擎与六盘事实；缺失字段保持 unsupported。',
    contributionCount
      ? `逐项复核当前培养方案的 ${contributionCount} 类盘面副词条贡献。`
      : '当前方案没有可直接证明的面板副词条贡献。',
    direction
      ? `按 candidate 词条方向“${direction}”比较方案；目标数值缺失时不作推导。`
      : '目标资料不足；不要把候选盘面分数当作最终面板。',
  ]
  const sourcedFacts = facts.filter((fact) => fact.targetEvidence !== 'missing')
  const availability = panel?.status === 'ok' ? ('available' as const) : ('unavailable' as const)
  const slices: WorkbenchSlice = {
    currentCombination: {
      level: agent.level,
      core: agent.skillLevels.core ?? null,
      wEngine: agent.wEngineDetails.name ?? '未录入',
      discCount: plannedDiscs.filter((item) => item.disc).length,
      availability:
        agent.wEngineDetails.name && plannedDiscs.every((item) => item.disc)
          ? 'available'
          : 'unavailable',
    },
    currentPanel: { availability, facts },
    goalState: { availability: sourcedFacts.length ? 'available' : 'unavailable', sourcedFacts },
    advice: [
      {
        domain: '驱动盘',
        object:
          discSource === '当前方案'
            ? activePlan
              ? playerFacingPlanName(activePlan.name, [agent.agentId])
              : '当前方案'
            : discSource === '当前已装备'
              ? '当前已装备驱动盘'
              : '当前驱动盘',
        action: plannedDiscs.every((item) => item.disc)
          ? '保留六张已引用实体盘'
          : '补齐六张实体盘引用',
        reason:
          discSource === '当前方案'
            ? '当前方案已提供仓库引用。'
            : discSource === '当前已装备'
              ? '账户已绑定六张实体盘。'
              : '尚无当前方案或已装备六盘来源。',
        completion: plannedDiscs.every((item) => item.disc)
          ? '六盘引用完整'
          : '六盘引用完整后再比较',
        availability: discSource === '未关联实体盘' ? 'unavailable' : 'available',
      },
      {
        domain: '音擎',
        object: agent.wEngineDetails.name ?? '音擎',
        action: agent.wEngineDetails.name ? '维持当前已录入音擎' : '补齐已选音擎',
        reason: agent.wEngineDetails.name ? '账户组合已包含音擎事实。' : '缺少音擎事实。',
        completion: agent.wEngineDetails.name ? '音擎已录入' : '录入音擎后可复算',
        availability: agent.wEngineDetails.name ? 'available' : 'unavailable',
      },
      {
        domain: '技能',
        object: '核心技',
        action: agent.skillLevels.core == null ? '补齐核心技等级' : '维持当前核心技等级',
        reason: agent.skillLevels.core == null ? '核心技未录入。' : '账户已录入核心技等级。',
        completion: agent.skillLevels.core == null ? '录入核心技等级' : '核心技已录入',
        availability: agent.skillLevels.core == null ? 'unavailable' : 'available',
      },
    ],
    planState: {
      availability: activePlan ? 'available' : 'unavailable',
      name: activePlan ? playerFacingPlanName(activePlan.name, [agent.agentId]) : '尚未保存方案',
      discCount: activePlan?.warehouseRefs.length ?? 0,
    },
    dataFoundation: {
      packageId: l3Evidence?.packageId ?? null,
      evidenceStatus: l3Evidence?.status ?? 'unavailable',
      current: panel?.status === 'ok' ? '可复算锚点' : '资料不足',
      reference: l3Evidence?.candidateFacts.length ? '参考方向' : '资料不足',
      blockers: l3Evidence?.blockers.map((blocker) => blocker.code) ?? [],
    },
    candidateReferences: references,
  }
  return { facts, plannedDiscs, discSource, diagnosis, gap, actions, slices }
}
