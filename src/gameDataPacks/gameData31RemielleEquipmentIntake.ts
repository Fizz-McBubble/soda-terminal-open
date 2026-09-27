import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import type { PlayerBuildSource } from './playerBuildProfiles'
import { stableContentHash } from './types'
import {
  remielleEquipmentIntakeVersion,
  remielleEquipmentIntakeSchema,
  type IntakeSource,
  type IntakeField,
} from './remielleEquipmentIntakeSchema'
export {
  remielleEquipmentIntakeVersion,
  remielleEquipmentIntakeSchema,
} from './remielleEquipmentIntakeSchema'

const verifiedAt = '2026-07-30T00:00:00.000Z'

function source(
  input: Omit<IntakeSource, 'contentIdentityHash' | 'hashKind'> & { observedFacts: unknown },
): IntakeSource {
  const { observedFacts, ...record } = input
  return {
    ...record,
    contentIdentityHash: stableContentHash({
      url: record.url,
      sourceVersion: record.sourceVersion,
      locator: record.locator,
      observedFacts,
    }),
    hashKind: 'minimal-derived-facts',
  }
}

const officialLaunch = source({
  id: 'official-zzz-3.1-remielle-launch',
  url: 'https://zenless.hoyoverse.com/en-us/news/165249?catchSpider=1',
  sourceType: 'official',
  sourceVersion: '3.1 / 2026-07-29',
  checkedAt: verifiedAt,
  locator: 'Version 3.1 launch scope > first-generation Void Hunter Remielle',
  license: {
    status: 'official_minimal_facts',
    reuse: 'minimal_fact_only',
    boundary: '官方页面仅保存版本、上线与身份最小事实；不复制图片或宣传正文。',
  },
  observedFacts: { version: '3.1', releaseAt: '2026-07-29', agent: 'Remielle' },
})

const officialChineseCatalog = source({
  id: 'official-zzz-cn-remielle-catalog',
  url: 'https://zenless.hoyoverse.com/zh-cn/main?catchSpider=1',
  sourceType: 'official',
  sourceVersion: '3.1 current catalog',
  checkedAt: verifiedAt,
  locator: '角色介绍 > 蕾米埃尔·丹',
  license: {
    status: 'official_minimal_facts',
    reuse: 'minimal_fact_only',
    boundary: '官方目录只保存玩家名和目录存在事实。',
  },
  observedFacts: { displayName: '蕾米埃尔·丹' },
})

const gachabaseAgent = source({
  id: 'gachabase-remielle-1581-3.1.12',
  url: 'https://zzz.gachabase.net/agents/1581/remielle/creator?lang=en',
  sourceType: 'structured_database',
  sourceVersion: '3.1.12 creator',
  checkedAt: verifiedAt,
  locator: 'agent 1581 > identity, specialty, attribute and skill groups',
  license: {
    status: 'unverified',
    reuse: 'reference_only',
    boundary: '许可未声明；只保存页面直接暴露的稳定ID、字段定位与最小派生，不复制原文。',
  },
  observedFacts: { id: '1581', rarity: 'S', specialty: 'anomaly', attribute: 'lumiflux' },
})

const gachabaseSet312 = source({
  id: 'gachabase-set-34100-3.1.2',
  url: 'https://zzz.gachabase.net/drive-discs/34100/feathered-fate/beta/3.1.2/16857772',
  sourceType: 'structured_database',
  sourceVersion: '3.1.2 beta / D16857772',
  checkedAt: verifiedAt,
  locator: 'ID 34100 > Set Bonuses > 2-Piece Set',
  license: {
    status: 'unverified',
    reuse: 'reference_only',
    boundary: '许可未声明；仅保留旧版字段身份，用于版本差异，不进入当前候选值。',
  },
  observedFacts: { id: '34100', twoPiece: 'atk_percent +10' },
})

const gachabaseSet314 = source({
  id: 'gachabase-set-34100-3.1.4',
  url: 'https://zzz.gachabase.net/drive-discs/34100/feathered-fate/beta/3.1.4/17256074',
  sourceType: 'structured_database',
  sourceVersion: '3.1.4 beta / D17256074',
  checkedAt: verifiedAt,
  locator: 'ID 34100 > Set Bonuses > 2-Piece / 4-Piece',
  license: {
    status: 'unverified',
    reuse: 'reference_only',
    boundary: '许可未声明；只保存套装ID和最小结构化效果字段，不能单源升格 formal。',
  },
  observedFacts: {
    id: '34100',
    twoPiece: 'anomaly_proficiency +30',
    fourPiece: { anomalyProficiency: 50, lumifluxAnomalyDamagePercent: 15, durationSeconds: 15 },
  },
})

const gachabaseWEngine = source({
  id: 'gachabase-wengine-14158-3.1.12',
  url: 'https://zzz.gachabase.net/w-engines/14158/ode-of-resurrected-wings/creator/3.1.12/17599459',
  sourceType: 'structured_database',
  sourceVersion: '3.1.12 creator / D17599459',
  checkedAt: verifiedAt,
  locator: 'ID 14158 > Lv60 Stats > W-Engine Effect',
  license: {
    status: 'unverified',
    reuse: 'reference_only',
    boundary: '许可未声明；只保存ID、LV60面板与页面默认P1最小字段，不复制描述正文。',
  },
  observedFacts: {
    id: '14158',
    baseAtk: 743,
    atkPercent: 36,
    p1: { anomalyProficiency: 96, anomalyDamagePercent: 20, squadDamagePercent: 30, duration: 30 },
  },
})

const gameWithBuild = source({
  id: 'gamewith-remielle-build-2026-07-30',
  url: 'https://gamewith.jp/zenless/550725',
  sourceType: 'community',
  sourceVersion: '3.1 live guide / 2026-07-30 22:05',
  checkedAt: verifiedAt,
  locator: 'recommended build, target stats, W-Engine effect and Drive Disc sections',
  license: {
    status: 'unverified',
    reuse: 'reference_only',
    boundary: '许可未声明；仅保存排序、数值与字段定位的最小派生，不复制攻略正文。',
  },
  observedFacts: {
    slots: { 4: ['anomaly_proficiency'], 5: ['atk_percent'], 6: ['atk_percent'] },
    substats: ['atk_percent', 'anomaly_proficiency', 'atk_flat'],
    target: { atk: 4006, anomalyProficiency: 412 },
    set: { twoPiece: 30, fourPiece: [50, 15, 15] },
    wengineRange: { p1: [96, 20, 30], p5: [135, 32, 48], duration: 30 },
  },
})

const gamelandBuild = source({
  id: 'gameland-remielle-build-2026-07-27',
  url: 'https://gameland.gg/remielle-build-guide-best-teams-w-engines-drive-discs/',
  sourceType: 'community',
  sourceVersion: '3.1 live guide / 2026-07-27',
  checkedAt: verifiedAt,
  locator: 'Drive Disc slots, stat breakpoint and W-Engine stats',
  license: {
    status: 'unverified',
    reuse: 'reference_only',
    boundary: '许可未声明；仅保存最小结构化方向和交叉数值，不复制攻略正文。',
  },
  observedFacts: {
    slots: { 4: ['anomaly_proficiency', 'atk_percent'], 5: ['atk_percent'], 6: ['atk_percent'] },
    substats: ['atk_percent', 'anomaly_proficiency', 'atk_flat'],
    atkTarget: 4000,
    wengine: { baseAtk: 743, atkPercent: 36, p1AnomalyProficiency: 96 },
  },
})

const chineseNames = source({
  id: 'hoyolab-cn-3.1-equipment-names',
  url: 'https://www.hoyolab.com/article/45890340',
  sourceType: 'community',
  sourceVersion: '3.1 preview summary / 2026-07-17',
  checkedAt: verifiedAt,
  locator: '全新武器 / 新增驱动盘',
  license: {
    status: 'unverified',
    reuse: 'reference_only',
    boundary: '社区摘要仅用于中文名称交叉；不得当作官方数值或复制正文。',
  },
  observedFacts: { wengine: '空羽复归之诗', driveDiscSet: '谶羽之誓' },
})

const sources = [
  officialLaunch,
  officialChineseCatalog,
  gachabaseAgent,
  gachabaseSet312,
  gachabaseSet314,
  gachabaseWEngine,
  gameWithBuild,
  gamelandBuild,
  chineseNames,
]

const noConflict = {
  status: 'none' as const,
  refs: [] as string[],
  resolution: '未发现同字段同版本数值冲突。',
}

function field(
  input: Omit<IntakeField, 'verifiedAt' | 'license'> & { license?: string },
): IntakeField {
  return {
    ...input,
    verifiedAt,
    license: input.license ?? '数值/构筑仅为多源候选；官方身份事实与社区/结构化候选严格分层。',
  }
}

const fields: IntakeField[] = [
  field({
    path: 'agent-1581.identity.display_name_zh_cn',
    value: '蕾米埃尔·丹',
    status: 'formal',
    sourceRefs: [officialChineseCatalog.id],
    sourceVersion: '3.1',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'verified_current',
      changeEvidence: '当前官方中文角色目录直接列名。',
    },
    conflict: noConflict,
    note: '只确认玩家名，不把角色战斗字段一并 formal 化。',
  }),
  field({
    path: 'agent-1581.identity.game_stable_id',
    value: '1581',
    status: 'candidate',
    sourceRefs: [gachabaseAgent.id, officialLaunch.id],
    sourceVersion: '3.1.12 creator + official 3.1 identity',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '结构化页直接暴露 ID 1581；官方仅交叉角色身份，不证明数字ID。',
    },
    conflict: noConflict,
    note: '稳定ID不是由名称、顺序或译名推断。',
  }),
  field({
    path: 'agent-1581.catalog.rarity_specialty_attribute',
    value: { rarity: 'S', specialty: 'anomaly', attribute: 'lumiflux' },
    status: 'candidate',
    sourceRefs: [gachabaseAgent.id, gameWithBuild.id],
    sourceVersion: '3.1 current',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '两个当前来源字段一致；仍缺同字段官方文字证据。',
    },
    conflict: noConflict,
    note: '可用于候选仓库约束，不进入 formal 伤害。',
  }),
  field({
    path: 'agent-1581.warehouse.main_stats.slot_4_5_6',
    value: {
      4: ['anomaly_proficiency', 'atk_percent'],
      5: ['atk_percent'],
      6: ['atk_percent'],
    },
    status: 'verified_candidate',
    sourceRefs: [gameWithBuild.id, gamelandBuild.id],
    sourceVersion: '3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'verified_current',
      changeEvidence: '两个独立3.1构筑页对4/5/6号位方向一致。',
    },
    conflict: noConflict,
    note: '4号位允许异常精通或攻击力；5/6号位为攻击力候选方向。',
  }),
  field({
    path: 'agent-1581.warehouse.substat_priority',
    value: ['atk_percent', 'anomaly_proficiency', 'atk_flat'],
    status: 'verified_candidate',
    sourceRefs: [gameWithBuild.id, gamelandBuild.id],
    sourceVersion: '3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'verified_current',
      changeEvidence: '两个独立3.1构筑页列出相同三项候选副词条。',
    },
    conflict: noConflict,
    note: '仓库评分权重由明确的顺序归一化，不代表伤害权重。',
  }),
  field({
    path: 'agent-1581.warehouse.target_panel',
    value: { atk: 4000, anomalyProficiency: 412 },
    status: 'candidate',
    sourceRefs: [gameWithBuild.id, gamelandBuild.id],
    sourceVersion: '3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '攻击力4000由两源一致，异常精通412只由GameWith样例给出。',
    },
    conflict: noConflict,
    note: '仅作目标面板候选，不称唯一毕业或正式最优。',
  }),
  field({
    path: 'set-34100.identity.game_stable_id',
    value: '34100',
    status: 'candidate',
    sourceRefs: [gachabaseSet314.id],
    sourceVersion: '3.1.4 beta',
    continuity: {
      originalSourceVersion: '3.1.2',
      lastChangeVersion: '3.1.4',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '同一路径后续修订仍直接暴露 ID 34100。',
    },
    conflict: noConflict,
    note: '候选稳定ID来自页面字段，不由英文或中文名称推断。',
  }),
  field({
    path: 'set-34100.identity.display_name_zh_cn',
    value: '谶羽之誓',
    status: 'candidate',
    sourceRefs: [chineseNames.id, gameWithBuild.id],
    sourceVersion: '3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '中文3.1摘要与日文当前构筑页的同一套装位置可交叉，但无官方文字ID映射。',
    },
    conflict: noConflict,
    note: '仅为玩家中文候选名；若映射丢失仍回退“资料待补齐”。',
  }),
  field({
    path: 'set-34100.effect.two_piece',
    value: { anomalyProficiency: 30 },
    status: 'verified_candidate',
    sourceRefs: [gachabaseSet314.id, gameWithBuild.id],
    sourceVersion: '3.1.4 beta + 3.1 live',
    continuity: {
      originalSourceVersion: '3.1.2',
      lastChangeVersion: '3.1.4',
      currentApplicability: 'verified_current',
      changeEvidence: '3.1.2 的攻击力+10%被3.1.4改为异常精通+30，当前构筑页与后者一致。',
    },
    conflict: {
      status: 'resolved',
      refs: [gachabaseSet312.id, gachabaseSet314.id, gameWithBuild.id],
      resolution: '按同源修订顺序采用3.1.4，并由3.1当前构筑页交叉；旧值保留为superseded。',
    },
    note: '旧3.1.2值不再进入当前候选仓库约束。',
  }),
  field({
    path: 'set-34100.effect.four_piece',
    value: {
      anomalyProficiency: 50,
      lumifluxAnomalyDamagePercent: 15,
      durationSeconds: 15,
      offFieldRetention: 'always',
      trigger: ['enter_field', 'switch_to_active'],
    },
    status: 'verified_candidate',
    sourceRefs: [gachabaseSet314.id, gameWithBuild.id],
    sourceVersion: '3.1.4 beta + 3.1 live',
    continuity: {
      originalSourceVersion: '3.1.2',
      lastChangeVersion: '3.1.4',
      currentApplicability: 'verified_current',
      changeEvidence: '后期结构化页与当前构筑页的数值、时长和后台保留一致。',
    },
    conflict: noConflict,
    note: '仅供候选套装命中解释；不是 formal 伤害输入。',
  }),
  field({
    path: 'wengine-14158.identity.game_stable_id',
    value: '14158',
    status: 'candidate',
    sourceRefs: [gachabaseWEngine.id, officialLaunch.id],
    sourceVersion: '3.1.12 creator + official 3.1 scope',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '结构化页直接暴露ID，官方范围仅交叉所属版本。',
    },
    conflict: noConflict,
    note: '不凭音擎名称推断数字ID。',
  }),
  field({
    path: 'wengine-14158.identity.display_name_zh_cn',
    value: '空羽复归之诗',
    status: 'candidate',
    sourceRefs: [chineseNames.id, gameWithBuild.id],
    sourceVersion: '3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '中文3.1摘要与日文当前构筑页的专属音擎位置一致。',
    },
    conflict: noConflict,
    note: '候选玩家名不改变其 reference-only 数值来源边界。',
  }),
  field({
    path: 'wengine-14158.stats.lv60',
    value: { baseAtk: 743, secondary: { stat: 'atk_percent', value: 36 } },
    status: 'verified_candidate',
    sourceRefs: [gachabaseWEngine.id, gameWithBuild.id, gamelandBuild.id],
    sourceVersion: '3.1.12 creator + 3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'verified_current',
      changeEvidence: '三个独立当前来源一致。',
    },
    conflict: noConflict,
    note: '可作为候选音擎面板，不进入 formal 伤害。',
  }),
  field({
    path: 'wengine-14158.passive.refinement_p1',
    value: {
      anomalyProficiency: 96,
      anomalyDamagePercent: 20,
      squadDamagePercent: 30,
      durationSeconds: 30,
      refreshesDuration: true,
    },
    status: 'verified_candidate',
    sourceRefs: [gachabaseWEngine.id, gameWithBuild.id],
    sourceVersion: '3.1.12 creator + 3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'verified_current',
      changeEvidence: '结构化页默认P1与当前构筑页区间下限一致。',
    },
    conflict: noConflict,
    note: '触发依赖蕾米埃尔的升华/Refringe反应；只作为候选条件。',
  }),
  ...(['p2', 'p3', 'p4'] as const).map((refinement) =>
    field({
      path: `wengine-14158.passive.refinement_${refinement}`,
      value: null,
      status: 'missing',
      sourceRefs: [gachabaseWEngine.id, gameWithBuild.id],
      sourceVersion: '3.1 current',
      continuity: {
        originalSourceVersion: '3.1',
        lastChangeVersion: '3.1',
        currentApplicability: 'missing',
        changeEvidence: '已检查页面只提供P1默认值和P1~P5区间，未直接列出中间精炼档。',
      },
      conflict: null,
      note: '禁止按P1/P5线性推算。',
    }),
  ),
  field({
    path: 'wengine-14158.passive.refinement_p5',
    value: {
      anomalyProficiency: 135,
      anomalyDamagePercent: 32,
      squadDamagePercent: 48,
      durationSeconds: 30,
    },
    status: 'candidate',
    sourceRefs: [gameWithBuild.id],
    sourceVersion: '3.1 live',
    continuity: {
      originalSourceVersion: '3.1',
      lastChangeVersion: '3.1',
      currentApplicability: 'continuous_candidate',
      changeEvidence: '当前构筑页明确给出P1~P5区间上限；尚无第二独立P5数值源。',
    },
    conflict: noConflict,
    note: 'P5独立候选值，不反推P2–P4。',
  }),
]

const sourceById = new Map(sources.map((item) => [item.id, item]))
for (const item of fields)
  for (const sourceRef of item.sourceRefs)
    if (!sourceById.has(sourceRef)) throw new Error(`未知R1F来源引用：${sourceRef}`)

function asPlayerBuildSource(item: IntakeSource): PlayerBuildSource {
  return {
    id: item.id,
    url: item.url,
    sourceVersion: item.sourceVersion,
    checkedAt: item.checkedAt,
    contentHash: item.contentIdentityHash,
    licenseBoundary: item.license.boundary,
    verified: true,
  }
}

const warehouseConstraintCore: Omit<CandidateWarehouseConstraint, 'contentHash'> = {
  agentId: 'candidate-3.1-agent-remielle',
  agentName: '蕾米埃尔·丹',
  gameVersion: '3.1',
  status: 'candidate',
  sources: [gameWithBuild, gamelandBuild, gachabaseSet314, gachabaseWEngine].map(
    asPlayerBuildSource,
  ),
  setIds: [
    'set-34100',
    'set-freedom-blues',
    'set-chaos-jazz',
    'set-hormone-punk',
    'set-astral-voice',
  ],
  setPlanReadiness: {
    status: 'executable',
    pattern: '4+2',
    primarySetIds: ['set-34100'],
    secondarySetIds: [
      'set-freedom-blues',
      'set-chaos-jazz',
      'set-hormone-punk',
      'set-astral-voice',
    ],
  },
  mainStats: {
    '4': ['anomaly_proficiency', 'atk_percent'],
    '5': ['atk_percent'],
    '6': ['atk_percent'],
  },
  subStatWeights: { atk_percent: 1, anomaly_proficiency: 0.88, atk_flat: 0.76 },
  wEngineDirections: [
    '空羽复归之诗（wengine-14158，P1与P5为候选；P2–P4资料待补齐）',
    '双生泣星、嵌合编译器或触电唇彩仅作候选替代方向',
  ],
  teamAndBangbooPreconditions: ['优先三名异常代理人；当前目标面板按攻击力4000候选前提解释。'],
  progressionDirection: ['先满足攻击力目标，再比较异常精通；不把候选仓库分解释为伤害。'],
  gaps: [
    '专属音擎P2–P4没有直接证据，禁止推算。',
    '角色/套装/音擎的数值来源仍为candidate/reference-only，不能进入formal或DPS。',
  ],
  boundary:
    '候选仓库评分只消费逐字段来源化的套装、主副词条与目标面板；不是DPS、最高伤害、正式最优，也不写玩家资产。',
}

export const remielleCandidateWarehouseConstraint31: CandidateWarehouseConstraint = {
  ...warehouseConstraintCore,
  contentHash: stableContentHash(warehouseConstraintCore),
}

const deltas = [
  {
    id: 'r1f-add-remielle-warehouse-fields',
    entityId: 'candidate-3.1-agent-remielle',
    operation: 'add' as const,
    fieldPaths: fields
      .filter((item) => item.path.startsWith('agent-1581.'))
      .map((item) => item.path),
    sourceRefs: [officialChineseCatalog.id, gachabaseAgent.id, gameWithBuild.id, gamelandBuild.id],
    rollbackRef: 'game-data-3.1-catalog-intake',
    affects: ['catalog', 'warehouse'] as const,
    note: '只新增候选仓库字段，不替换3.0 rollback或任何玩家资产。',
  },
  {
    id: 'r1f-change-set-34100-two-piece',
    entityId: 'set-34100',
    operation: 'change' as const,
    fieldPaths: ['set-34100.effect.two_piece'],
    sourceRefs: [gachabaseSet312.id, gachabaseSet314.id, gameWithBuild.id],
    rollbackRef: gachabaseSet312.id,
    affects: ['warehouse', 'damage'] as const,
    note: '保留3.1.2旧值，当前候选采用3.1.4且不宣称formal。',
  },
  {
    id: 'r1f-add-wengine-14158-fields',
    entityId: 'wengine-14158',
    operation: 'add' as const,
    fieldPaths: fields
      .filter((item) => item.path.startsWith('wengine-14158.'))
      .map((item) => item.path),
    sourceRefs: [gachabaseWEngine.id, gameWithBuild.id, gamelandBuild.id, chineseNames.id],
    rollbackRef: 'game-data-3.1-catalog-intake',
    affects: ['catalog', 'warehouse', 'damage'] as const,
    note: 'P2–P4保持missing，任何伤害能力仍由既有formal gate阻断。',
  },
]

const conflicts = [
  {
    id: 'set-34100-two-piece-beta-revision',
    fieldPath: 'set-34100.effect.two_piece',
    status: 'resolved' as const,
    candidateValues: [
      { sourceRef: gachabaseSet312.id, value: { atkPercent: 10 } },
      { sourceRef: gachabaseSet314.id, value: { anomalyProficiency: 30 } },
    ],
    resolution: '采用时间更后的3.1.4修订，并由3.1当前GameWith页面交叉；旧值保留为回滚证据。',
  },
]

const gaps = (['p2', 'p3', 'p4'] as const).map((refinement) => ({
  fieldPath: `wengine-14158.passive.refinement_${refinement}`,
  status: 'missing' as const,
  checkedSourceRefs: [gachabaseWEngine.id, gameWithBuild.id],
  nextEvidence: `需同版本游戏内或明确逐档资料直接列出${refinement.toUpperCase()}，不得由P1/P5推算。`,
}))

const intakeCore = {
  version: remielleEquipmentIntakeVersion,
  gameVersion: '3.1' as const,
  status: 'candidate' as const,
  sources,
  fields,
  deltas,
  conflicts,
  gaps,
  warehouseConstraintHash: remielleCandidateWarehouseConstraint31.contentHash,
  rollback: {
    previousCatalogIntake: 'game-data-3.1-catalog-intake' as const,
    rule: '新字段包校验或hash失败时保留原3.1候选目录/约束；不修改玩家资产。',
  },
  boundary:
    '多社区一致最多verified_candidate；只有官方/游戏内同版本字段可formal。candidate不得进入D0、DPS、最高或资产写入。',
}

const normalizedIntakeCore = remielleEquipmentIntakeSchema
  .omit({ contentHash: true })
  .parse(intakeCore)

export const gameData31RemielleEquipmentIntake = remielleEquipmentIntakeSchema.parse({
  ...normalizedIntakeCore,
  contentHash: stableContentHash(normalizedIntakeCore),
})

export function getRemielleEquipmentField(path: string) {
  return gameData31RemielleEquipmentIntake.fields.find((item) => item.path === path) ?? null
}

export function validateRemielleEquipmentIntake(input: unknown) {
  const parsed = remielleEquipmentIntakeSchema.safeParse(input)
  if (!parsed.success)
    return {
      success: false as const,
      reason: 'R1F字段包结构或完整性无效，保留上一候选目录。',
    }
  const { contentHash, ...content } = parsed.data
  if (contentHash !== stableContentHash(content))
    return {
      success: false as const,
      reason: 'R1F字段包hash不匹配，保留上一候选目录。',
    }
  return { success: true as const, intake: parsed.data }
}
