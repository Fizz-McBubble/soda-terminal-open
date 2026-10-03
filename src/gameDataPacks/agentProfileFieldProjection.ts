import {
  getGameData32BuildGuidance,
  getGameData32BuildGuidanceFields,
} from './gameData32BuildGuidance'
import { type VisualAssetEntityType } from '../assets/visualAssets'
import type { canonicalFieldConflictLedger } from './canonicalBaseline'
import { type BuildKnowledgeProfile } from './buildKnowledge'
import type { getCandidateWarehouseConstraint } from './candidateWarehouseConstraints'

export const agentProfileFieldStatuses = [
  'formal',
  'verified_candidate',
  'candidate',
  'missing',
] as const
export type AgentProfileFieldStatus = (typeof agentProfileFieldStatuses)[number]

export type AgentProfileSourceRef = {
  id: string
  url: string
  sourceVersion: string | null
  checkedAt: string | null
  contentHash: string | null
  licenseBoundary: string
}

export type AgentProfileField = {
  group:
    | 'identity_version'
    | 'progression'
    | 'equipment_facts'
    | 'build_guidance'
    | 'damage_input'
    | 'player_projection'
  path: string
  value: unknown | null
  status: AgentProfileFieldStatus
  gameVersion: string
  originalSourceVersion: string | null
  lastChangeVersion: string | null
  currentApplicability: 'continuous' | 'affected_pending' | 'unknown'
  sourceRefs: AgentProfileSourceRef[]
  verifiedAt: string | null
  conflict: (typeof canonicalFieldConflictLedger)[number] | null
  reason: string
  conditions?: readonly string[]
}

export type AgentProfileVisualRef = {
  entityType: VisualAssetEntityType
  entityId: string
  variant: string
  status: 'verified' | 'missing'
  alt: string
  sourcePage: string | null
  sourceVersion: string | null
  verifiedAt: string | null
  contentHash: string | null
  cachePolicy: 'explicit-personal-cache' | 'remote-only' | 'bundled-original' | null
}

/**
 * Semantic seam for the locked upstream baseline. This deliberately records
 * stable source paths rather than claiming that Soda Terminal already speaks
 * upstream implementation-specific field names.
 */
export type UpstreamCompatibilityRef = {
  module: 'zzz-stats' | 'zzz-formula' | 'pando-engine' | 'game-opt-solver'
  status: 'ready' | 'gap'
  sourcePaths: string[]
  mapping: string
  gap: string | null
}

export type UpstreamAgentProfileAdapter = {
  baseline: typeof upstreamOptimizerBaseline
  agentId: string
  upstreamIdentity: {
    stableAgentId: string
    catalogEntityId: string | null
    attribute: string | null
    specialty: string | null
  }
  levelRange: { min: 1; max: 60 }
  refinementRange: { min: 1; max: 5 }
  discSlots: readonly [1, 2, 3, 4, 5, 6]
  refs: UpstreamCompatibilityRef[]
}

export type AgentProfile = {
  agentId: string
  agentName: string
  gameVersion: string
  fields: AgentProfileField[]
  warehouseStatus: 'candidate' | 'missing'
  directDamageStatus: 'formal' | 'candidate' | 'missing'
  visualRefs: AgentProfileVisualRef[]
  upstreamAdapter: UpstreamAgentProfileAdapter
  contentHash: string
}

/** Player-facing current-version view; stored 3.0 source profiles remain unchanged. */
export type ProjectedBuildKnowledgeProfile = Omit<BuildKnowledgeProfile, 'gameVersion'> & {
  gameVersion: string
}

const candidateStatLabels: Record<string, string> = {
  def_percent: '防御力百分比',
  def_flat: '防御力',
  wind_dmg: '风属性伤害',
  atk_percent: '攻击力百分比',
  atk_flat: '攻击力',
  crit_rate: '暴击率',
  crit_dmg: '暴击伤害',
  anomaly_proficiency: '异常精通',
  anomaly_mastery: '异常掌控',
  energy_regen: '能量自动回复',
  pen_ratio: '穿透率',
  pen: '穿透值',
  impact: '冲击力',
  ice_dmg: '冰属性伤害',
  fire_dmg: '火属性伤害',
  electric_dmg: '电属性伤害',
  physical_dmg: '物理属性伤害',
  ether_dmg: '以太属性伤害',
}

function constraintSourceRefs(
  constraint: NonNullable<ReturnType<typeof getCandidateWarehouseConstraint>>,
): AgentProfileSourceRef[] {
  return constraint.sources.map((source) => ({
    id: source.id,
    url: source.url,
    sourceVersion: source.sourceVersion,
    checkedAt: source.checkedAt,
    contentHash: source.contentHash,
    licenseBoundary: source.licenseBoundary,
  }))
}

/**
 * Current-version sidecars already drive warehouse solving. Project their
 * sourced recommendation fields into the same profile adapter so development
 * pages and the solver cannot silently disagree about the input directions.
 */
export function projectedCurrentConstraintFields(
  constraint: NonNullable<ReturnType<typeof getCandidateWarehouseConstraint>>,
): AgentProfileField[] {
  const sourceRefs = constraintSourceRefs(constraint)
  const checkedAt =
    constraint.sources
      .map((source) => source.checkedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  const common = {
    group: 'build_guidance' as const,
    gameVersion: constraint.gameVersion,
    originalSourceVersion: constraint.gameVersion,
    lastChangeVersion: constraint.gameVersion,
    currentApplicability: 'continuous' as const,
    sourceRefs,
    verifiedAt: checkedAt,
    conflict: null,
  }
  const statLines = (['4', '5', '6'] as const).flatMap((slot) => {
    const stats = constraint.mainStats[slot] ?? []
    return stats.length
      ? [`${slot}号位：${stats.map((stat) => candidateStatLabels[stat] ?? stat).join(' / ')}`]
      : []
  })
  const subStats = Object.entries(constraint.subStatWeights)
    .sort(([, left], [, right]) => (right ?? 0) - (left ?? 0))
    .map(([stat]) => candidateStatLabels[stat] ?? stat)
  const completeMainStats = statLines.length === 3 && subStats.length > 0
  const executableSets = constraint.setPlanReadiness.status === 'executable'
  const wEngineIds = constraint.wEngineDirections.flatMap(
    (direction) => direction.match(/wengine-\d+/g) ?? [],
  )
  const completeTeamScenario =
    constraint.teamAndBangbooPreconditions.length > 0 &&
    constraint.teamAndBangbooPreconditions.some((direction) => /邦布|Bangboo/i.test(direction))
  const targetPanel = constraint.targetPanel
  const targetPanelSources = targetPanel
    ? sourceRefs.filter((source) => targetPanel.sourceIds.includes(source.id))
    : []

  return [
    {
      ...common,
      path: 'build.wengines',
      value: wEngineIds.length > 0 ? [...new Set(wEngineIds)] : null,
      status: wEngineIds.length > 0 ? 'verified_candidate' : 'missing',
      reason:
        wEngineIds.length > 0
          ? '当前版本候选音擎已归一化到稳定身份，不推断账户副本。'
          : '当前版本候选约束缺少可归一化的音擎稳定身份。',
    },
    {
      ...common,
      path: 'build.drive_disc_sets',
      value: executableSets ? constraint.setPlanReadiness : null,
      status: executableSets ? 'verified_candidate' : 'missing',
      reason: executableSets
        ? '当前版本候选套装已与仓库求解器使用同一套 4+2 约束。'
        : constraint.setPlanReadiness.status === 'non_executable'
          ? constraint.setPlanReadiness.missingEvidence
          : '当前版本候选套装尚未形成可执行组合。',
    },
    {
      ...common,
      path: 'build.main_sub_stats',
      value: completeMainStats ? [...statLines, `副词条：${subStats.join('、')}`] : null,
      status: completeMainStats ? 'verified_candidate' : 'missing',
      reason: completeMainStats
        ? '当前版本候选主副词条已与仓库求解器使用同一约束。'
        : '当前版本候选约束缺少完整的 4/5/6 号位或副词条方向。',
    },
    {
      ...common,
      path: 'build.progression',
      value: constraint.progressionDirection,
      status: constraint.progressionDirection.length > 0 ? 'candidate' : 'missing',
      reason:
        constraint.progressionDirection.length > 0
          ? '沿用同一当前版本候选约束中的养成方向。'
          : '当前版本候选约束缺少养成方向。',
    },
    {
      ...common,
      path: 'build.team_bangboo_scenario',
      value: completeTeamScenario ? constraint.teamAndBangbooPreconditions : null,
      status: completeTeamScenario ? 'candidate' : 'missing',
      reason: completeTeamScenario
        ? '沿用同一当前版本候选约束中的队伍与邦布前提。'
        : '现有候选约束尚未形成队伍与邦布均完整的同源建议；保留缺口，不外推为完整配队。',
    },
    {
      ...common,
      path: 'build.target_panel',
      value: targetPanel?.values ?? null,
      conditions: targetPanel?.conditions ?? [],
      status: targetPanel && targetPanelSources.length > 0 ? 'candidate' : 'missing',
      sourceRefs: targetPanelSources,
      reason:
        targetPanel && targetPanelSources.length > 0
          ? `${targetPanel.conditions.join('；')} 仅作为攻略参考区间，不参与 Formal 计算。`
          : '当前版本候选约束缺少可追溯的目标面板参考。',
    },
  ]
}

export function projectedReviewedBuild32Fields(agentId: string): AgentProfileField[] {
  const guide = getGameData32BuildGuidance(agentId)
  return getGameData32BuildGuidanceFields(agentId).map((field) =>
    field.path === 'build.wengines' && guide
      ? {
          ...field,
          value: [...guide.wEngineIds],
          conditions: [...(field.conditions ?? []), ...guide.wEngineDirections],
        }
      : field,
  )
}

export const upstreamOptimizerBaseline = {
  repository: 'https://github.com/frzyc/genshin-optimizer',
  commit: '9617fb58334cfe84e26252041fb9510c34057f62',
  license: 'MIT',
  modules: {
    zzzStats: 'libs/zzz/stats',
    zzzFormula: 'libs/zzz/formula',
    pandoEngine: 'libs/pando/engine',
    gameOptSolver: 'libs/game-opt/solver',
  },
} as const
