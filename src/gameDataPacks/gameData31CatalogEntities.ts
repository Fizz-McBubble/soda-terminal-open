import {
  type GameData31CatalogEntity,
  bwiki31Url,
  remielleGameEvidenceUrl,
  sigridGameEvidenceUrl,
  odeGameEvidenceUrl,
  knightsExtolmentGameEvidenceUrl,
  arielGameEvidenceUrl,
  featheredFateGameEvidenceUrl,
  thornedRoseGameEvidenceUrl,
  source,
  gameEvidenceBoundary,
} from './gameData31CatalogSources'

/**
 * Minimal derived fields only: no page body, image, or third-party guide prose is bundled.
 * `source_page` keys remain separate from game IDs. `game_evidence` IDs only appear when
 * the evidence page itself exposes the numeric field; they remain candidate, never formal.
 */
export const gameData31CatalogEntities: GameData31CatalogEntity[] = [
  {
    id: 'candidate-3.1-agent-remielle',
    domain: 'agent',
    displayName: '蕾米埃尔·丹',
    identity: {
      kind: 'game_evidence',
      projectStableId: 'agent-remielle',
      gameStableId: '1581',
      sourceLocator: 'gachabase:agent:1581 + bwiki:agent:蕾米埃尔·丹',
    },
    status: 'candidate',
    fields: { rarity: 'S', specialty: 'anomaly', attribute: 'lumiflux', releaseAt: '2026-07-29' },
    source: source(
      'game-evidence-3.1-remielle-1581',
      remielleGameEvidenceUrl,
      'gachabase-agent-1581-3.1.12-identity',
      gameEvidenceBoundary,
    ),
    gaps: ['动作倍率与完整战斗字段未进入本候选目录；装备仓库字段由R1F独立候选包提供。'],
  },
  {
    id: 'candidate-3.1-agent-sigrid',
    domain: 'agent',
    displayName: '希格莉德·德拉叙尔',
    identity: {
      kind: 'game_evidence',
      projectStableId: null,
      gameStableId: '1591',
      sourceLocator: 'gachabase:agent:1591 + bwiki:agent:希格莉德·德拉叙尔',
    },
    status: 'candidate',
    fields: { rarity: 'S', specialty: 'damage', attribute: 'ice', releaseAt: '2026-08-19' },
    source: source(
      'game-evidence-3.1-sigrid-1591',
      sigridGameEvidenceUrl,
      'gachabase-agent-1591-3.1.5-identity',
      gameEvidenceBoundary,
    ),
    gaps: ['专属音擎稳定 ID 待同版本图鉴或游戏内字段核验。'],
  },
  {
    id: 'candidate-3.1-wengine-ode-of-resurrected-wings',
    domain: 'wengine',
    displayName: '空羽复归之诗',
    identity: {
      kind: 'project_catalog',
      projectStableId: 'wengine-14158',
      sourceLocator: 'project-catalog:wengine-14158 + gachabase:wengine:14158',
    },
    status: 'candidate',
    fields: {
      rarity: 'S',
      specialty: 'anomaly',
      releaseAt: '2026-07-29',
      baseAtkLv60: 743,
      atkPercentLv60: 36,
      passiveP1: '异常精通+96；触发后异常伤害+20%、全队伤害+30%，持续30秒（candidate）',
      passiveP5: '异常精通+135；异常伤害+32%、全队伤害+48%，持续30秒（single-source candidate）',
      passiveP2ToP4: null,
    },
    source: source(
      'game-evidence-3.1-wengine-14158',
      odeGameEvidenceUrl,
      'gachabase-wengine-14158-3.1.12-identity',
      gameEvidenceBoundary,
    ),
    gaps: ['P2–P4 精炼逐档值待核验；P5仅单源候选，全部不得进入formal伤害。'],
  },
  {
    id: 'candidate-3.1-wengine-knights-extolment',
    domain: 'wengine',
    displayName: '骁骑礼赞',
    identity: {
      kind: 'game_evidence',
      projectStableId: 'wengine-14159',
      gameStableId: '14159',
      sourceLocator: 'official:3.1-phase-ii + gachabase:wengine:14159 + GO:KnightsExtolment',
    },
    status: 'candidate',
    fields: {
      rarity: 'S',
      specialty: 'damage',
      releaseAt: '2026-08-19',
      baseAtkLv60: 713,
      critDamagePercentLv60: 48,
      passiveP1:
        '普攻或强化特殊技重击命中各可提供1层兵锋；每层暴击伤害+32%，持续25秒，2层时无视20%冰属性抗性（candidate）',
      passiveRefinementCritDamagePercent: '32/36.8/41.6/46.4/51.2',
      passiveRefinementIceResistanceIgnorePercent: '20/23/26/29/32',
    },
    source: source(
      'game-evidence-3.1-wengine-14159',
      knightsExtolmentGameEvidenceUrl,
      'gachabase-wengine-14159-3.1.12-18172372',
      gameEvidenceBoundary,
    ),
    gaps: [
      '公开结构化值已与 frzyc/genshin-optimizer@eabba1f 的 KnightsExtolment.json 逐档交叉；仍缺正式图形资产与生产 Calculation adapter。',
    ],
  },
  {
    id: 'bangboo-ariel',
    domain: 'bangboo',
    displayName: '艾瑞儿',
    identity: {
      kind: 'game_evidence',
      projectStableId: 'bangboo-ariel',
      gameStableId: '54023',
      sourceLocator: 'gachabase:bangboo:54023 + bwiki:bangboo:艾瑞儿',
    },
    status: 'candidate',
    fields: {
      rarity: 'S',
      additionalAbilityPrerequisite: '队伍中存在蕾米埃尔·丹（candidate game evidence）',
      chainAttribute: 'ether',
    },
    source: source(
      'game-evidence-3.1-ariel-54023',
      arielGameEvidenceUrl,
      'gachabase-bangboo-54023-3.1.12-identity-and-prerequisite',
      gameEvidenceBoundary,
    ),
    gaps: ['主动/连携的完整数值、目标与循环频率待同版本正式或游戏内字段。'],
  },
  {
    id: 'candidate-3.1-drive-disc-feathered-fate',
    domain: 'drive_disc_set',
    displayName: '谶羽之誓',
    identity: {
      kind: 'game_evidence',
      projectStableId: 'set-34100',
      gameStableId: '34100',
      sourceLocator: 'gachabase:drive-disc:34100',
    },
    status: 'candidate',
    fields: {
      twoPiece: 'anomaly_proficiency +30',
      fourPiece:
        'enter_or_switch: anomaly_proficiency +50; lumiflux attribute_anomaly_damage +15%; duration 15s; persists_off_field',
      localizedName: '谶羽之誓',
      playerFacingLocalizedName: '谶羽之誓（候选）',
    },
    source: source(
      'game-evidence-3.1-drive-disc-34100',
      featheredFateGameEvidenceUrl,
      'gachabase-drive-disc-34100-3.1.4-17256074',
      gameEvidenceBoundary,
    ),
    gaps: ['中文名与效果为多源candidate，缺官方文字ID映射，不能升级formal。'],
  },
  {
    id: 'candidate-3.1-drive-disc-thorned-rose',
    domain: 'drive_disc_set',
    displayName: '棘刺玫瑰',
    identity: {
      kind: 'game_evidence',
      projectStableId: 'set-34200',
      gameStableId: '34200',
      sourceLocator: 'gachabase:drive-disc:34200',
    },
    status: 'candidate',
    fields: {
      localizedName: '棘刺玫瑰',
      playerFacingLocalizedName: '棘刺玫瑰（候选）',
      ocrAliases: '棘刺玫瑰|荆棘玫瑰|Thorned Rose|ThornedRose',
      twoPiece: 'defense +16%',
      fourPiece:
        'four_piece: common_damage +15%; initial_defense >=1000 => crit_rate +8%; initial_defense >=1800 => crit_rate +16%',
    },
    source: source(
      'game-evidence-3.1-drive-disc-34200',
      thornedRoseGameEvidenceUrl,
      'gachabase-drive-disc-34200-3.1.2-16857772',
      gameEvidenceBoundary,
    ),
    gaps: [
      '中文本地化与四件套机制已由游戏证据和锁定上游公式交叉；两件套采用上游 PR #3273 修复后的 defense +16%，保持 Candidate，待正式消费绑定。',
    ],
  },
  {
    id: 'candidate-3.1-deadly-assault-desperate-mode',
    domain: 'enemy_mode',
    displayName: '危局强袭战：绝境模式',
    identity: {
      kind: 'source_page',
      projectStableId: null,
      sourceLocator: 'bwiki:3.1:deadly-assault:desperate-mode',
    },
    status: 'candidate',
    fields: { scope: 'deadly_assault_mode_change' },
    source: source(
      'bwiki-3.1-deadly-assault',
      bwiki31Url,
      'bwiki-3.1-preview-deadly-assault-desperate-mode',
      'CC BY-NC-SA 4.0：仅保存玩法范围定位；敌人/轮换数值不复制。',
    ),
    gaps: ['固定敌人、DEF/RES/失衡、阶段、轮换与增益字段未闭合。'],
  },
]
