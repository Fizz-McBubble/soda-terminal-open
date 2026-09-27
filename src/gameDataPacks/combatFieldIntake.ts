import {
  playerBuildProfiles30,
  type PlayerBuildProfile,
  type PlayerBuildSource,
} from './playerBuildProfiles'
import {
  candidateWarehouseCoverage30,
  getCandidateWarehouseConstraint,
} from './candidateWarehouseConstraints'
import { stableContentHash } from './types'

export const combatIntakeStatuses = ['formal', 'candidate', 'missing'] as const
export type CombatIntakeStatus = (typeof combatIntakeStatuses)[number]

export type CombatIntakeField = {
  path: string
  status: CombatIntakeStatus
  source: PlayerBuildSource
  reason: string
}

export type AgentCombatFieldIntake = {
  agentId: string
  agentName: string
  gameVersion: '3.0'
  fields: CombatIntakeField[]
  contentHash: string
}

export type WarehouseConstraintGate = {
  agentId: string
  status: 'candidate' | 'formal' | 'missing'
  missing: string[]
  boundary: string
}

const requiredWarehousePaths = [
  'build.drive_disc_sets',
  'build.main_sub_stats',
  'build.progression',
  'build.team_bangboo_scenario',
] as const

function fieldFor(profile: PlayerBuildProfile, path: string) {
  return profile.fields.find((field) => field.path === path)
}

function sourceFor(profile: PlayerBuildProfile, preferredPath: string): PlayerBuildSource {
  const preferred = fieldFor(profile, preferredPath)?.source
  if (preferred) return preferred
  const fallback = profile.fields.find((field) => field.source)?.source
  if (fallback) return fallback
  throw new Error(`缺少 ${profile.agentId} 的页面级来源定位。`)
}

function copyField(
  profile: PlayerBuildProfile,
  path: string,
  fallbackPath: string,
  reason: string,
): CombatIntakeField {
  const sourceField = fieldFor(profile, path)
  return {
    path,
    status: sourceField?.status ?? 'missing',
    source: sourceField?.source ?? sourceFor(profile, fallbackPath),
    reason: sourceField?.reason ?? reason,
  }
}

function explicitGap(profile: PlayerBuildProfile, path: string, reason: string): CombatIntakeField {
  return { path, status: 'missing', source: sourceFor(profile, 'build.wengines'), reason }
}

function intakeFor(profile: PlayerBuildProfile): AgentCombatFieldIntake {
  const fields: CombatIntakeField[] = [
    copyField(
      profile,
      'progression.lv60_and_ascension',
      'build.wengines',
      '待逐页提取并交叉核验 LV60 面板与突破材料。',
    ),
    copyField(
      profile,
      'progression.skill_core_cinema',
      'build.progression',
      '待逐页提取技能、核心技和影画的版本化优先级。',
    ),
    copyField(
      profile,
      'progression.potential_overlay',
      'build.progression',
      '潜能作为独立 overlay；未核验前不覆盖普通技能或影画。',
    ),
    explicitGap(
      profile,
      'combat.skill_multipliers_lv1_16',
      '缺少技能 1–16 倍率、命中结构与动作时长的同版本字段。',
    ),
    explicitGap(
      profile,
      'combat.core_extra_ability_cinema',
      '缺少核心技、额外能力和影画战斗效果的同版本字段。',
    ),
    explicitGap(
      profile,
      'combat.wengine_base_refinement_passive',
      '缺少适用音擎的基础数值、精炼被动、层数与覆盖率字段。',
    ),
    explicitGap(
      profile,
      'combat.bangboo_scope',
      '邦布只保留构筑方向；伤害、失衡、异常贡献或同版本排除范围待核验。',
    ),
    explicitGap(
      profile,
      'combat.drive_disc_numeric_modifiers',
      '盘套装展示方向尚未归一化为数值 modifier、触发、持续与冷却字段。',
    ),
    explicitGap(
      profile,
      'combat.key_buffs_and_multipliers',
      '缺少可复算的 Buff、乘区与覆盖率字段。',
    ),
    copyField(
      profile,
      'build.drive_disc_sets',
      'build.drive_disc_sets',
      '缺少可追溯的驱动盘套装组合。',
    ),
    copyField(
      profile,
      'build.main_sub_stats',
      'build.main_sub_stats',
      '缺少可追溯的主、副词条方向。',
    ),
    copyField(profile, 'build.progression', 'build.progression', '缺少可追溯的养成优先级。'),
    copyField(
      profile,
      'build.team_bangboo_scenario',
      'build.team_bangboo_scenario',
      '缺少可追溯的队伍与邦布前提。',
    ),
    {
      path: 'warehouse.score_weights',
      status:
        fieldFor(profile, 'build.main_sub_stats')?.status === 'candidate' ? 'candidate' : 'missing',
      source: sourceFor(profile, 'build.main_sub_stats'),
      reason:
        '候选阶段只保留来源明确的词条优先级顺序；未归一化为精确伤害权重，不可用于最高伤害或 DPS 排名。',
    },
    explicitGap(
      profile,
      'warehouse.target_stats',
      '缺少同版本、可量化目标面板或明确不可量化理由。',
    ),
  ]
  const input = {
    agentId: profile.agentId,
    agentName: profile.agentName,
    gameVersion: '3.0' as const,
    fields,
  }
  return { ...input, contentHash: stableContentHash(input) }
}

export const combatFieldIntakes30 = playerBuildProfiles30.map(intakeFor)

export function getWarehouseConstraintGate(
  profile: AgentCombatFieldIntake,
): WarehouseConstraintGate {
  const required = [...requiredWarehousePaths, 'warehouse.score_weights']
  const missing = required.filter((path) => {
    const field = profile.fields.find((item) => item.path === path)
    return !field || field.status === 'missing'
  })
  if (missing.length)
    return {
      agentId: profile.agentId,
      status: 'missing',
      missing,
      boundary: '缺少套装、词条、养成、队伍前提或来源明确的候选评分顺序，不能生成仓库约束。',
    }
  const normalized = getCandidateWarehouseConstraint(profile.agentId)
  return normalized?.status === 'candidate'
    ? {
        agentId: profile.agentId,
        status: 'candidate',
        missing: [],
        boundary:
          '可生成带候选标记的仓库评分约束；来源版本不明或早于 3.0 时保持候选，不输出精确伤害、DPS、最高伤害或正式最优。',
      }
    : {
        agentId: profile.agentId,
        status: 'missing',
        missing: normalized?.gaps ?? ['warehouse.normalization'],
        boundary: '来源尚不能归一化为具体套装、4/5/6号位与有效副词条，资料只可阅读。',
      }
}

export const warehouseConstraintGates30 = combatFieldIntakes30.map(getWarehouseConstraintGate)

export const combatFieldCoverage30 = {
  totalAgents: combatFieldIntakes30.length,
  allFieldsAccountable: combatFieldIntakes30.every((profile) =>
    profile.fields.every((field) => Boolean(field.source) && Boolean(field.reason)),
  ),
  candidateWarehouseSolvable: candidateWarehouseCoverage30.candidate,
  formalWarehouseSolvable: warehouseConstraintGates30.filter((gate) => gate.status === 'formal')
    .length,
  candidateTheorySolvable: 0,
  formalExactDamageSolvable: 0,
  missingCombatFields: combatFieldIntakes30.flatMap((profile) =>
    profile.fields
      .filter((field) => field.status === 'missing')
      .map((field) => `${profile.agentId}.${field.path}`),
  ),
  contentHash: stableContentHash(combatFieldIntakes30),
} as const

export const combatFieldCandidate31Diff = {
  gameVersion: '3.1',
  status: 'candidate' as const,
  changedFieldGroups: [
    'agent.combat',
    'agent.potential_overlay',
    'wengine.base_refinement_passive',
    'bangboo.combat_scope',
    'enemy_and_mode',
  ],
  invalidationBoundary:
    '涉及变化字段的候选仓库约束和所有理论/精确计算须重新核验；回滚仅切回 3.0 数据包，不改玩家资产。',
}
