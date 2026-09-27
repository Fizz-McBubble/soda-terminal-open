import { stableContentHash } from './types'

export const qqSheetArchive = {
  id: 'qq-sheet-historical-2.6.0-r14028417',
  title: '附表（停更）',
  sourceUrl: 'https://docs.qq.com/sheet/DUHBodnJVQ1pKcFl4?tab=BB08J2',
  archiveSha256: '17712a9551475848f800ce46d003c1b4a476d67e96f8e99ebe443077780a8ee7',
  bytes: 961358,
  archivedAt: '2026-07-28T00:00:00.000Z',
  originalSnapshotVersion: '2.6.0_R14028417',
  maintenance: 'stopped' as const,
  access: 'user-provided public offline snapshot' as const,
  licenseStatus: 'undeclared' as const,
  boundary:
    '仅限本地非公开候选交叉与字段路径追溯。不得镜像整表、图片或说明文本，不得作为 formal 或运行时在线依赖。',
} as const

export type QQSheetFieldStatus = 'historical_candidate' | 'conflict' | 'missing'

export type QQSheetDerivedField = {
  id: string
  entityType: 'agent' | 'wengine' | 'enemy' | 'bangboo' | 'drive_disc_set' | 'progression'
  fieldPath: string
  sourcePath: string
  status: QQSheetFieldStatus
  value: number | string | readonly (number | string)[]
  comparison: 'consistent' | 'conflict' | 'unknown'
  note: string
}

/**
 * This is not a workbook mirror. It carries the few normalized facts used to verify that the
 * archived 2.6 sheet can describe each combat domain. Its source is deliberately unavailable to
 * production asset loading and candidate values never cross the formal damage gate.
 */
export const qqSheetHistoricalBaseline = {
  ...qqSheetArchive,
  sheets: [
    ['代理人技能数据', 'agent_skill'],
    ['代理人属性', 'agent_base'],
    ['敌人属性', 'enemy'],
    ['敌人强化', 'enemy_enhancement'],
    ['敌人转阶段', 'enemy_phase'],
    ['音擎属性', 'wengine_base'],
    ['音擎描述', 'wengine_passive'],
    ['邦布属性', 'bangboo_base'],
    ['邦布技能', 'bangboo_skill'],
    ['驱动盘描述', 'drive_disc_set'],
    ['驱动盘升级表', 'drive_disc_progression'],
    ['绳网等阶升级表', 'inter_knot_progression'],
    ['代理人升级表', 'agent_progression'],
    ['邦布升级表', 'bangboo_progression'],
    ['音擎升级表', 'wengine_progression'],
  ].map(([sheet, domain]) => ({ sheet, domain })),
  hiddenStructures: {
    sheets: [
      {
        sheet: '驱动盘升级表',
        sheetId: 27,
        status: 'mapped' as const,
        canonicalPaths: ['drive_disc.level.base_stat_growth', 'drive_disc.level.experience'],
      },
      {
        sheet: '绳网等阶升级表',
        sheetId: 28,
        status: 'archived_pending_mapping' as const,
        canonicalPaths: ['player.inter_knot.level.experience'],
      },
      {
        sheet: '代理人升级表',
        sheetId: 29,
        status: 'mapped' as const,
        canonicalPaths: ['agent.level.experience'],
      },
      {
        sheet: '邦布升级表',
        sheetId: 30,
        status: 'mapped' as const,
        canonicalPaths: ['bangboo.level.experience'],
      },
      {
        sheet: '音擎升级表',
        sheetId: 31,
        status: 'mapped' as const,
        canonicalPaths: ['wengine.level.base_atk_growth', 'wengine.level.experience'],
      },
    ],
    columns: [
      {
        sheet: '邦布属性',
        range: 'M:O',
        headers: ['突破生命值加成', '突破攻击力加成', '突破防御力加成'],
        status: 'mapped' as const,
        canonicalPaths: [
          'bangboo.ascension.hp_bonus',
          'bangboo.ascension.atk_bonus',
          'bangboo.ascension.def_bonus',
        ],
      },
    ],
    rule: '隐藏状态仅是原工作簿呈现属性；所有隐藏工作表和列都进入离线 OOXML 解析及字段覆盖审计。',
  },
  fields: [
    {
      id: 'qq-agent-level-progression',
      entityType: 'progression',
      fieldPath: 'agent.level.experience',
      sourcePath: '代理人升级表!A2:C2',
      status: 'historical_candidate',
      value: [1, 50, 0],
      comparison: 'unknown',
      note: '隐藏工作表中的等级、下级经验与总经验字段；尚未作为 3.0 当前曲线使用。',
    },
    {
      id: 'qq-wengine-level-progression',
      entityType: 'progression',
      fieldPath: 'wengine.level.base_atk_growth',
      sourcePath: '音擎升级表!A2:F2',
      status: 'historical_candidate',
      value: ['S', 0, 0, 50, 0, 1],
      comparison: 'unknown',
      note: '隐藏工作表中的稀有度、等级、基础攻击成长及经验字段；需要同版本 delta 才可用于当前面板。',
    },
    {
      id: 'qq-bangboo-level-progression',
      entityType: 'progression',
      fieldPath: 'bangboo.level.experience',
      sourcePath: '邦布升级表!A2:C2',
      status: 'historical_candidate',
      value: [1, 50, 0],
      comparison: 'unknown',
      note: '隐藏工作表中的邦布升级曲线字段；只作为历史数值结构底座。',
    },
    {
      id: 'qq-drive-disc-level-progression',
      entityType: 'progression',
      fieldPath: 'drive_disc.level.base_stat_growth',
      sourcePath: '驱动盘升级表!A2:F2',
      status: 'historical_candidate',
      value: ['S', 0, 0, 480, 0, 0.8],
      comparison: 'unknown',
      note: '隐藏工作表中的驱动盘基础属性成长、经验与回收字段；不得替代当前强化规则核验。',
    },
    {
      id: 'qq-bangboo-hidden-ascension-columns',
      entityType: 'bangboo',
      fieldPath: 'bangboo.ascension.stat_bonus',
      sourcePath: '邦布属性!M:O（隐藏列）',
      status: 'historical_candidate',
      value: ['突破生命值加成', '突破攻击力加成', '突破防御力加成'],
      comparison: 'unknown',
      note: '隐藏列作为邦布突破面板字段解析；无隐藏行，不能因 UI 隐藏状态排除。',
    },
    {
      id: 'qq-billy-standing-fire-lv1',
      entityType: 'agent',
      fieldPath: 'agent-billy.combat.standing_fire.damage_multiplier_lv1',
      sourcePath: '代理人技能数据!D164',
      status: 'historical_candidate',
      value: 0.68,
      comparison: 'consistent',
      note: '与 BWIKI 同技能行 LV1=68% 一致；LV11=130% 为独立等级字段，不参与 LV1 比较。',
    },
    {
      id: 'qq-billy-lv60-base-atk',
      entityType: 'agent',
      fieldPath: 'agent-billy.combat.lv60.base_atk',
      sourcePath: '代理人属性!AA9',
      status: 'historical_candidate',
      value: 712.2765,
      comparison: 'unknown',
      note: '可用于与同版本来源交叉，不证明 3.0 当前适用。',
    },
    {
      id: 'qq-replica-starlight-engine',
      entityType: 'wengine',
      fieldPath: 'wengine-13108.combat.lv60_base_and_passive',
      sourcePath: '音擎属性!F50；音擎描述!G50:K50',
      status: 'historical_candidate',
      value: [624.54, 0.25, 0.36, 8],
      comparison: 'unknown',
      note: '依次为 LV60 基础攻击、LV60 攻击力副属性、精炼1远距物理增伤、持续秒数；触发条件与 3.0 仍待核验。',
    },
    {
      id: 'qq-search-patroller-def-res-daze',
      entityType: 'enemy',
      fieldPath: 'enemy-11011.variant-1.def_res_daze',
      sourcePath: '敌人属性!H2:P2',
      status: 'historical_candidate',
      value: [50, 0, 473, 0.5],
      comparison: 'unknown',
      note: '依次为防御、物理抗性、失衡上限、失衡易伤；不是已选定的 3.0 场景敌人。',
    },
    {
      id: 'qq-penguin-bangboo-active',
      entityType: 'bangboo',
      fieldPath: 'bangboo-penguin.active.damage_daze_anomaly',
      sourcePath: '邦布技能!C2:G2',
      status: 'historical_candidate',
      value: [4.62, 2.7, 346],
      comparison: 'unknown',
      note: '依次为主动技能伤害倍率、失衡倍率与异常积蓄；仅证明邦布字段结构可解析。',
    },
    {
      id: 'qq-woodpecker-electro-set',
      entityType: 'drive_disc_set',
      fieldPath: 'drive_disc_set-31000.two_four_piece_modifier',
      sourcePath: '驱动盘描述!C2:D2',
      status: 'historical_candidate',
      value: [0.08, 0.09, 6],
      comparison: 'unknown',
      note: '依次为两件套暴击率、四件套单层攻击力、持续秒数；触发与层数细节待同版本核验。',
    },
  ] satisfies QQSheetDerivedField[],
  deltaOverlay30: {
    id: 'qq-sheet-2.6-to-3.0-delta-candidate',
    status: 'candidate' as const,
    sourceEvidence: [],
    changedFieldIds: [] as string[],
    additions: [] as string[],
    rule: '只有同版本变更来源可填充新增或受影响字段；未记录变更不改写 2.6 历史值，且在许可未声明与冲突存在时仍仅为候选。',
    rollback: '停用 overlay 后只回到本地历史基线元数据；不改玩家资产、仓库、锁定、标签或计算结果。',
    affectedCalculations: ['所有引用历史候选字段的候选估算需标记为待同版本复核。'],
  },
} as const

export const qqSheetOfflineSnapshotIntegrity = {
  archiveSha256: qqSheetArchive.archiveSha256,
  requiredSheets: qqSheetHistoricalBaseline.sheets.map((sheet) => sheet.sheet),
  requiredFieldDomains: [
    'agent',
    'wengine',
    'enemy',
    'bangboo',
    'drive_disc_set',
    'progression',
  ] as const,
  active: true,
  failurePolicy: '哈希、工作表或字段路径不完整时拒绝激活新快照，继续保留上一有效历史快照。',
} as const

export function canUseQQSheetFieldForFormal(_field: QQSheetDerivedField) {
  void _field
  return false
}

export function qqSheetFieldsForDomain(domain: QQSheetDerivedField['entityType']) {
  return qqSheetHistoricalBaseline.fields.filter((field) => field.entityType === domain)
}

export const qqSheetHistoricalBaselineHash = stableContentHash({
  archive: qqSheetArchive,
  sheets: qqSheetHistoricalBaseline.sheets,
  fields: qqSheetHistoricalBaseline.fields,
  deltaOverlay30: qqSheetHistoricalBaseline.deltaOverlay30,
})
