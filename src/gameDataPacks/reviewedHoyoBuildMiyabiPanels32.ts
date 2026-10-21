import type { AgentProfileField } from './agentProfileFieldProjection'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import type { PlayerBuildSource } from './playerBuildSources'
import { stableContentHash } from './types'

const slug = 'miyabi'
const url = `https://hoyobuild.com/en/zzz/characters/${slug}`
const sourceUpdatedAt = '2026-09-24'
const checkedAt = '2026-10-20'

const mainStats = {
  '4': ['crit_rate', 'atk_percent'],
  '5': ['ice_dmg', 'atk_percent'],
  '6': ['atk_percent'],
} as const
const subStatPriorities = [
  'crit_rate',
  'crit_dmg',
  'atk_percent',
  'anomaly_proficiency',
  'pen',
] as const
const mainStatLines = [
  '4号位：暴击率 / 攻击力百分比',
  '5号位：冰属性伤害 / 攻击力百分比',
  '6号位：攻击力百分比',
]
const subStatLines = [
  '副词条：暴击率、暴击伤害、攻击力百分比、异常精通、穿透值；来源次序只保留优先级，不转成伤害权重。',
]
const targetPanel = {
  critRate: { min: 75, max: 95 },
  critDamage: { min: 150, max: 190 },
  atk: { min: 2500, max: 3600, upperOpen: true },
  anomalyMastery: { min: 116, upperOpen: true },
  anomalyProficiency: { min: 240, upperOpen: true },
} as const
const targetSemantics = {
  critRate: { requirement: 'required', boundary: 'minimum', observation: 'reference' },
  critDamage: { requirement: 'required', boundary: 'minimum', observation: 'reference' },
  atk: { requirement: 'required', boundary: 'minimum', observation: 'reference' },
  anomalyMastery: { requirement: 'required', boundary: 'minimum', observation: 'reference' },
  anomalyProficiency: { requirement: 'required', boundary: 'minimum', observation: 'reference' },
} as const

const source: PlayerBuildSource = {
  id: 'hoyobuild-agent-miyabi-main-targets-32-20261020',
  url,
  sourceVersion: '3.2',
  originalSourceVersion: '3.2',
  authorReviewedVersion: null,
  checkedAt,
  contentHash: stableContentHash({
    url,
    sourceVersion: '3.2',
    sourceUpdatedAt,
    mainStats,
    subStatPriorities,
    targetPanel,
  }),
  licenseBoundary:
    '最小公开页面事实投影；contentHash覆盖本轮抽取的主副词与目标面板，不是原始HTML哈希。',
  verified: true,
  pageUpdatedAt: sourceUpdatedAt,
  retrievedAt: checkedAt,
}

const conditions = [
  'HoyoBuild页面标记Version 3.2；主副词与60级参考面板只用于攻略候选。',
  '暴击率75%–95%；80%只对应冰焰异常积蓄增益封顶，不把更高面板视为额外机制收益。',
  '异常掌控116+只满足折枝剑歌四件套的115门槛；不作为所有分支的通用上限。',
  '页面引用Prydwen、Game8或Icy Veins不另计独立来源；不继承Tier、DPS或最佳队伍声明。',
]

export function getReviewedHoyoBuildMiyabiMainSubStats32(): AgentProfileField | undefined {
  return {
    group: 'build_guidance',
    path: 'build.main_sub_stats',
    value: { mainStats: [...mainStatLines], subStats: [...subStatLines] },
    status: 'candidate',
    gameVersion: '3.2',
    originalSourceVersion: '3.2',
    lastChangeVersion: '3.2',
    currentApplicability: 'continuous',
    sourceRefs: [source],
    verifiedAt: checkedAt,
    authorReviewedVersion: null,
    conflict: null,
    conditions,
    reason:
      'HoyoBuild 3.2页面明确4/5/6主词条与副词条优先级；同一事实同步玩家指导与仓库求解，不生成权重。',
  }
}

export function getReviewedHoyoBuildMiyabiTargetPanel32(): AgentProfileField | undefined {
  return {
    group: 'build_guidance',
    path: 'build.target_panel',
    value: {
      ...targetPanel,
      targetSemantics,
      cultivationReference: {
        keys: ['atk', 'critRate', 'critDamage', 'anomalyProficiency', 'anomalyMastery'],
        conditions,
        sourceVersion: '3.2',
        level: 60,
      },
      sourceMetadata: {
        sourceId: source.id,
        sourceVersion: '3.2',
        pageUpdatedAt: sourceUpdatedAt,
        localReviewedAt: checkedAt,
        localReviewScope: 'hoyobuild_current_60_reference_not_formal',
      },
    },
    status: 'candidate',
    gameVersion: '3.2',
    originalSourceVersion: '3.2',
    lastChangeVersion: '3.2',
    currentApplicability: 'continuous',
    sourceRefs: [source],
    verifiedAt: checkedAt,
    authorReviewedVersion: null,
    conflict: null,
    conditions,
    reason:
      'HoyoBuild 3.2的60级参考面板；仅作培养比较，不参与Formal计算，不替代具名队伍的传统条件面板。',
  }
}

export function withReviewedHoyoBuildMiyabiPanel32(
  constraint: CandidateWarehouseConstraint,
): CandidateWarehouseConstraint {
  if (constraint.agentId !== 'agent-miyabi') return constraint
  const updated: CandidateWarehouseConstraint = {
    ...constraint,
    sources: [...constraint.sources.filter((candidate) => candidate.id !== source.id), source],
    mainStats: {
      '4': [...mainStats['4']],
      '5': [...mainStats['5']],
      '6': [...mainStats['6']],
    },
    subStatWeights: Object.fromEntries(subStatPriorities.map((stat) => [stat, 1])),
  }
  delete (updated as Partial<CandidateWarehouseConstraint>).contentHash
  return { ...updated, contentHash: stableContentHash(updated) }
}
