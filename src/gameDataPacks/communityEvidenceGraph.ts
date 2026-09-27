import { stableContentHash } from './types'
import { qqSheetArchive } from './qqSheetHistoricalBaseline'

export const communityEvidenceConfidence = [
  'historical_candidate',
  'continuous_candidate',
  'strong_candidate',
  'conflict',
  'missing',
] as const
export type CommunityEvidenceConfidence = (typeof communityEvidenceConfidence)[number]

export type CommunityEvidenceNode = {
  id: string
  sourceId: 'baha-damage-mechanics' | 'qq-sheet-historical' | 'bwiki-billy'
  locator: string
  label: string
  conclusionType: 'formula_structure' | 'mechanic' | 'observed' | 'numeric_field'
  fieldPaths: string[]
  originalSourceVersion: string | null
  lastVerifiedAt: string
  applicableVersion: string | null
  confidence: CommunityEvidenceConfidence
  dependencyIds: string[]
  changeMonitoring: string
  licenseBoundary: string
  note: string
}

/**
 * A compact evidence graph, not an article copy. Locators point back to the original article or
 * archived workbook; labels summarize only the formula/field claim needed by project contracts.
 */
export const communityEvidenceGraph: CommunityEvidenceNode[] = [
  {
    id: 'baha-damage-kind-taxonomy',
    sourceId: 'baha-damage-mechanics',
    locator: 'A. 傷害種類',
    label: '伤害类型分层',
    conclusionType: 'mechanic',
    fieldPaths: [
      'damage.direct',
      'damage.anomaly',
      'damage.disorder',
      'damage.penetration',
      'damage.true',
    ],
    originalSourceVersion: null,
    lastVerifiedAt: '2026-07-28T00:00:00.000Z',
    applicableVersion: null,
    confidence: 'historical_candidate',
    dependencyIds: [],
    changeMonitoring: '新版本规则或伤害类型改动时复核该分类，不影响未声明变更的字段。',
    licenseBoundary: '论坛作者文章仅保存结论标签、定位与来源链接；不复制正文或图片。',
    note: '文章为伤害种类与乘区的候选机制交叉来源，未提供同版本 formal 证明。',
  },
  {
    id: 'baha-direct-damage-structure',
    sourceId: 'baha-damage-mechanics',
    locator: 'A. 傷害種類 > 一. 直接傷害(直傷)',
    label: '直接伤害动作结构',
    conclusionType: 'formula_structure',
    fieldPaths: ['damage.direct.skill_multiplier', 'damage.direct.hit_structure'],
    originalSourceVersion: null,
    lastVerifiedAt: '2026-07-28T00:00:00.000Z',
    applicableVersion: null,
    confidence: 'historical_candidate',
    dependencyIds: [],
    changeMonitoring: '仅在直接伤害公式或动作倍率规则出现变更证据时重核。',
    licenseBoundary: '只保存字段结构与段落定位，不复制公式原文。',
    note: '支持比利单动作所需“倍率与命中结构”为独立输入；数值仍需字段级来源。',
  },
  {
    id: 'baha-anomaly-disorder-structure',
    sourceId: 'baha-damage-mechanics',
    locator: 'A. 傷害種類 > 二. 異常傷害',
    label: '异常与紊乱机制范围',
    conclusionType: 'mechanic',
    fieldPaths: ['damage.anomaly', 'damage.disorder', 'rotation.anomaly_buildup_duration'],
    originalSourceVersion: null,
    lastVerifiedAt: '2026-07-28T00:00:00.000Z',
    applicableVersion: null,
    confidence: 'historical_candidate',
    dependencyIds: [],
    changeMonitoring: '异常、紊乱或持续时间规则出现版本改动时重核。',
    licenseBoundary: '只保存机制分类与定位，不复制文章说明。',
    note: '本项目当前直接伤害切片不据此推导异常/紊乱数值。',
  },
  {
    id: 'baha-defense-resistance-structure',
    sourceId: 'baha-damage-mechanics',
    locator: 'D. 防禦區',
    label: '防御、穿透与抗性输入结构',
    conclusionType: 'formula_structure',
    fieldPaths: [
      'enemy.def',
      'enemy.res',
      'player.pen_ratio',
      'player.pen',
      'damage.defense_multiplier',
    ],
    originalSourceVersion: null,
    lastVerifiedAt: '2026-07-28T00:00:00.000Z',
    applicableVersion: null,
    confidence: 'historical_candidate',
    dependencyIds: [],
    changeMonitoring: '防御、穿透、减防或抗性规则出现改动时重核；固定敌人仍需同版本数值。',
    licenseBoundary: '只保存变量关系结论与定位，不复制公式原文。',
    note: '支持敌人 DEF/RES 不可省略的 gate；不提供任何固定场景参数。',
  },
  {
    id: 'baha-multiplier-area-rule',
    sourceId: 'baha-damage-mechanics',
    locator: 'C. 傷害公式＆觀念介紹 > 三. 觀念介紹 > 5',
    label: '乘区内相加、跨乘区相乘',
    conclusionType: 'mechanic',
    fieldPaths: ['damage.multiplier_area', 'damage.vulnerability', 'damage.stun'],
    originalSourceVersion: null,
    lastVerifiedAt: '2026-07-28T00:00:00.000Z',
    applicableVersion: null,
    confidence: 'historical_candidate',
    dependencyIds: [],
    changeMonitoring: '独立乘区、失衡易伤或增伤规则受版本影响时重核。',
    licenseBoundary: '只保存最小结构结论、段落定位和“实测需复核”边界。',
    note: '文章提及社区实测线索；该节点不把实测结论当正式事实。',
  },
  {
    id: 'qq-billy-standing-fire-field',
    sourceId: 'qq-sheet-historical',
    locator: '代理人技能数据!D164；代理人属性!AA9',
    label: '比利站姿开火与 LV60 面板字段',
    conclusionType: 'numeric_field',
    fieldPaths: [
      'agent-billy.combat.standing_fire.damage_multiplier_lv1',
      'agent-billy.combat.lv60.base_atk',
    ],
    originalSourceVersion: qqSheetArchive.originalSnapshotVersion,
    lastVerifiedAt: qqSheetArchive.archivedAt,
    applicableVersion: qqSheetArchive.originalSnapshotVersion,
    confidence: 'strong_candidate',
    dependencyIds: ['baha-direct-damage-structure'],
    changeMonitoring:
      '后续补丁若明确修改比利站姿开火倍率或技能等级表时重核；停更表不单独成为 formal。',
    licenseBoundary: qqSheetArchive.boundary,
    note: '代理人技能数据!D164 的 LV1=0.68 与 BWIKI 同技能行 LV1=68% 一致。',
  },
  {
    id: 'bwiki-billy-standing-fire-levels',
    sourceId: 'bwiki-billy',
    locator: '技能 > 普通攻击：火力全开 > 详细属性 > 站姿开火伤害倍率 > LV1 / LV11',
    label: '比利站姿开火分等级倍率',
    conclusionType: 'numeric_field',
    fieldPaths: [
      'agent-billy.combat.standing_fire.damage_multiplier_lv1',
      'agent-billy.combat.standing_fire.damage_multiplier_lv11',
    ],
    originalSourceVersion: '1.0',
    lastVerifiedAt: '2026-07-30T00:00:00.000Z',
    applicableVersion: '3.1',
    confidence: 'continuous_candidate',
    dependencyIds: ['baha-direct-damage-structure'],
    changeMonitoring: '仅在后续补丁明确修改比利该动作或技能等级表时重核。',
    licenseBoundary: 'CC BY-NC-SA 4.0；仅本地非商业候选交叉，不能直接成为 official/formal。',
    note: '同一公开表格直接列出 LV1=68%、LV11=130%；两个等级保持独立字段。',
  },
  {
    id: 'qq-combat-domain-field-map',
    sourceId: 'qq-sheet-historical',
    locator: '音擎属性/描述、敌人属性/强化/转阶段、邦布属性/技能、驱动盘描述',
    label: '历史战斗字段结构地图',
    conclusionType: 'numeric_field',
    fieldPaths: [
      'wengine.base_and_passive',
      'enemy.def_res_daze_phase',
      'bangboo.skill',
      'drive_disc_set.modifier',
    ],
    originalSourceVersion: qqSheetArchive.originalSnapshotVersion,
    lastVerifiedAt: qqSheetArchive.archivedAt,
    applicableVersion: qqSheetArchive.originalSnapshotVersion,
    confidence: 'historical_candidate',
    dependencyIds: ['baha-defense-resistance-structure', 'baha-multiplier-area-rule'],
    changeMonitoring:
      '新实体、字段变更、规则变更或冲突裁决只更新受影响字段，未声明变更的历史路径保留。',
    licenseBoundary: qqSheetArchive.boundary,
    note: '只记录最小数据模型字段路径；不把离线工作簿作为线上运行时依赖。',
  },
]

export const communityEvidenceSources = {
  'baha-damage-mechanics': {
    label: '巴哈姆特：伤害种类与乘区',
    url: 'https://forum.gamer.com.tw/Co.php?bsn=74860&sn=32943',
    lastVerifiedAt: '2026-07-28T00:00:00.000Z',
    version: '3.0 mechanism article; per-section field version unspecified',
    licenseBoundary: '作者文章仅以最小结论与定位交叉验证，不复制正文、图片或用户作品。',
  },
  'qq-sheet-historical': {
    label: qqSheetArchive.title,
    url: qqSheetArchive.sourceUrl,
    lastVerifiedAt: qqSheetArchive.archivedAt,
    version: qqSheetArchive.originalSnapshotVersion,
    licenseBoundary: qqSheetArchive.boundary,
  },
  'bwiki-billy': {
    label: 'BWIKI：比利·奇德',
    url: 'https://wiki.biligame.com/zzz/%E6%AF%94%E5%88%A9',
    lastVerifiedAt: '2026-07-28T00:00:00.000Z',
    version: '1.0 candidate page',
    licenseBoundary: 'CC BY-NC-SA 4.0；仅本地非商业候选交叉，不能直接成为 official/formal。',
  },
} as const

export const communityEvidenceConflicts: ReadonlyArray<{ id: string }> = []

export const communityEvidenceCrossChecks = [
  {
    id: 'billy-standing-fire-level-separated-consistency',
    fieldPaths: [
      'agent-billy.combat.standing_fire.damage_multiplier_lv1',
      'agent-billy.combat.standing_fire.damage_multiplier_lv11',
    ],
    evidenceIds: ['qq-billy-standing-fire-field', 'bwiki-billy-standing-fire-levels'],
    status: 'consistent' as const,
    comparison: {
      lv1: { qq: 0.68, bwiki: 0.68 },
      lv11: { qq: null, bwiki: 1.3 },
    },
    note: 'LV1 两源一致；LV11 仅由 BWIKI 独立记录，未用 LV11 与 QQ LV1 交叉。',
  },
] as const

export function evidenceForField(fieldPath: string) {
  return communityEvidenceGraph.filter((node) => node.fieldPaths.includes(fieldPath))
}

/** Community evidence can strengthen a candidate; only official/game evidence can make it formal. */
export function canCommunityEvidenceBecomeFormal(_evidence: readonly CommunityEvidenceNode[]) {
  void _evidence
  return false
}

export function communityDeltaImpact(changedFieldPaths: readonly string[]) {
  const affected = communityEvidenceGraph.filter((node) =>
    node.fieldPaths.some((field) => changedFieldPaths.includes(field)),
  )
  return {
    affectedEvidenceIds: affected.map((node) => node.id),
    unaffectedEvidenceIds: communityEvidenceGraph
      .filter((node) => !affected.includes(node))
      .map((node) => node.id),
    rule: '只复核新增、变更或冲突字段；未受影响的历史来源不因版本号前进而自动失效。',
  }
}

export const communityEvidenceGraphHash = stableContentHash({
  sources: communityEvidenceSources,
  evidence: communityEvidenceGraph,
  conflicts: communityEvidenceConflicts,
  crossChecks: communityEvidenceCrossChecks,
})
