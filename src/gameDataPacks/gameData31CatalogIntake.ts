import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import {
  getRemielleEquipmentField,
  remielleCandidateWarehouseConstraint31,
} from './gameData31RemielleEquipmentIntake'
import { stableContentHash } from './types'
import { sigridReviewedMainStats, sigridReviewedMainStatSources } from './sigridReviewedMainStats'
import {
  type GameData31FieldConflict,
  type GameData31CombatFieldEvidence,
  odeGameEvidenceUrl,
  arielGameEvidenceUrl,
  featheredFateGameEvidenceUrl,
  deadlyAssaultOfficialUrl,
  candidateBoundary,
  source,
  gameEvidenceBoundary,
} from './gameData31CatalogSources'
import { gameData31CatalogEntities } from './gameData31CatalogEntities'
export { gameData31CatalogEntities } from './gameData31CatalogEntities'

export {
  type GameData31CatalogEntity,
  type GameData31FieldConflict,
  type GameData31CombatFieldEvidence,
} from './gameData31CatalogSources'

const arielEvidenceSource = source(
  'game-evidence-3.1-ariel-54023',
  arielGameEvidenceUrl,
  'gachabase-bangboo-54023-3.1.12-active-chain-additional',
  gameEvidenceBoundary,
)
const odeEvidenceSource = source(
  'game-evidence-3.1-wengine-14158',
  odeGameEvidenceUrl,
  'gachabase-wengine-14158-3.1.12-passive-phase-1',
  gameEvidenceBoundary,
)
const featheredFateEvidenceSource = source(
  'game-evidence-3.1-drive-disc-34100',
  featheredFateGameEvidenceUrl,
  'gachabase-drive-disc-34100-3.1.4-set-bonuses',
  gameEvidenceBoundary,
)
const deadlyAssaultOfficialSource = source(
  'official-3.1-deadly-assault-system-update',
  deadlyAssaultOfficialUrl,
  'official-news-165369-2026-07-27-scope',
  '官方系统公告仅确认版本玩法更新范围；未复制图片或未公开敌人/轮换数值。',
)

/**
 * Candidate mechanics may inform player-readable direction only. Missing frequency, refinement,
 * localization, or encounter fields remain explicit and block every damage-calculation context.
 */
export const gameData31CombatFieldEvidence: GameData31CombatFieldEvidence[] = [
  {
    entityId: 'bangboo-ariel',
    fieldPath: 'active.mechanic',
    status: 'candidate',
    value: '聚怪后生成棱镜十字，以太伤害；按聚集敌人数获得 1/2/3 个不重复随机增益。',
    source: arielEvidenceSource,
    locator: 'Skills > Searing Flash > Active Skill',
    effect: '可解释候选邦布定位；没有倍率或频率，不能进入伤害上下文。',
  },
  {
    entityId: 'bangboo-ariel',
    fieldPath: 'additional_ability.team_prerequisite',
    status: 'candidate',
    value: '队伍中存在蕾米埃尔时，主动技保证获得全部增益，邦布连携伤害 +15%。',
    source: arielEvidenceSource,
    locator: "Skills > Angel's Protection > Additional Ability",
    effect: '可作为候选队伍前提；候选资料不自动写队伍或资产。',
  },
  {
    entityId: 'bangboo-ariel',
    fieldPath: 'chain.mechanic',
    status: 'candidate',
    value: '投掷星云，造成以太伤害。',
    source: arielEvidenceSource,
    locator: 'Skills > Radiance > Bangboo Chain Attack',
    effect: '仅记录最小连携机制；无倍率不参与量化。',
  },
  {
    entityId: 'bangboo-ariel',
    fieldPath: 'cycle.frequency',
    status: 'missing',
    value: null,
    source: arielEvidenceSource,
    locator: 'Skills > Searing Flash / Radiance（页面未列冷却或循环频率）',
    effect: '缺频率，禁止作为可计算的邦布循环输入。',
  },
  {
    entityId: 'candidate-3.1-wengine-ode-of-resurrected-wings',
    fieldPath: 'passive.phase_1',
    status: 'candidate',
    value:
      '异常精通 +96；触发 Refringe 后异常伤害 +20%、全队伤害 +30%，均持续 30 秒，重复触发刷新持续时间。',
    source: odeEvidenceSource,
    locator: 'W-Engine Effect > Paradise Lost > v3.1.12 Creator',
    effect: '仅为候选 P1 被动方向；不是 formal 伤害输入。',
  },
  {
    entityId: 'candidate-3.1-wengine-ode-of-resurrected-wings',
    fieldPath: 'passive.refinement_2_to_5',
    status: 'missing',
    value: null,
    source: odeEvidenceSource,
    locator: 'W-Engine Effect > 页面仅可定位 P1 结构化值',
    effect: '精炼成长未知，拒绝用于任何完整候选或 formal 伤害计算。',
  },
  {
    entityId: 'candidate-3.1-drive-disc-feathered-fate',
    fieldPath: 'set_bonus.2_4_piece_en',
    status: 'candidate',
    value:
      '2 件：异常精通 +30；4 件：进场/切换后异常精通 +50，流明属性异常伤害 +15%，持续 15 秒、后台保留。',
    source: featheredFateEvidenceSource,
    locator: 'Set Bonuses > 2-Piece Set / 4-Piece Set > v3.1.4 Beta',
    effect: '只用于候选 set-34100 的英文机制身份；不升级 formal。',
  },
  {
    entityId: 'candidate-3.1-drive-disc-feathered-fate',
    fieldPath: 'identity.localized_name_zh_cn',
    status: 'missing',
    value: null,
    source: featheredFateEvidenceSource,
    locator: '页面未提供可交叉核验的中文套装本地化名',
    effect: '玩家展示只能显示“资料待补齐”，不得从英文名猜译。',
  },
  {
    entityId: 'candidate-3.1-deadly-assault-desperate-mode',
    fieldPath: 'scope.system_update',
    status: 'candidate',
    value: '官方公告确认 3.1 危局强袭战与系统玩法更新范围。',
    source: deadlyAssaultOfficialSource,
    locator: 'Ridu Renovation Talk Vol. 13 > Version 3.1 Deadly Assault updates',
    effect: '仅确认范围；不影响普通候选仓库约束连续性。',
  },
  {
    entityId: 'candidate-3.1-deadly-assault-desperate-mode',
    fieldPath: 'encounter.enemy_rotation_buff_phase',
    status: 'missing',
    value: null,
    source: deadlyAssaultOfficialSource,
    locator: '官方系统公告未公开固定敌人 DEF/RES/失衡、阶段、轮换或增益数值',
    effect: '危局计算上下文继续 stale，禁止 DPS、最高或正式最优。',
  },
]

const sigridPrydwenLiveSource = source(
  'prydwen-sigrid-live-build-2026-09-04',
  'https://www.prydwen.gg/zenless/characters/sigrid',
  '1CC8AD3B6B7BFFB850F14B241323A0001C49EAA5AE313DA1E13AEBCB37C8426F',
  '版权/再分发许可未登记：仅保留实装后构筑、队伍与阈值的最小派生及页面内容哈希，不复制正文，不用于 formal。',
  '2026-09-04T00:00:00.000Z',
)
const sigridIcyVeinsBuildSource = source(
  'icy-veins-sigrid-live-build-2026-08-17',
  'https://www.icy-veins.com/zenless-zone-zero/sigrid-guide-best-builds',
  '035772B0A10ECCA6726270CC31A45D5AAB257E9DBA356A6D01037AF563C24775',
  '版权/再分发许可未登记：仅保留实装后构筑方向与页面内容哈希，不复制正文，不用于 formal。',
  '2026-09-04T00:00:00.000Z',
)
const sigridIcyVeinsTeamSource = source(
  'icy-veins-sigrid-live-team-2026-08-17',
  'https://www.icy-veins.com/zenless-zone-zero/sigrid-teams',
  '52824A77AD11F764067DDA9D2E33C2D9EE904AAA8FEA8483CC8A060004FC86FE',
  '版权/再分发许可未登记：仅保留实装后队伍与邦布方向及页面内容哈希，不复制正文，不用于 formal。',
  '2026-09-04T00:00:00.000Z',
)
const sigridHoyolabLiveSource = source(
  'hoyolab-sigrid-live-build-46380450',
  'https://www.hoyolab.com/article/46380450',
  'DAAE3F973C3120081DF3D6EEAA3AAD2243E97AABF7E575AB57299579CDB35350',
  '社区攻略允许转载，但本地仍只保留最小结构化候选、链接与页面内容哈希，不复制正文，不用于 formal。',
  '2026-09-04T00:00:00.000Z',
)
const sigridMiyousheQingfengSource = source(
  'miyoushe-sigrid-qingfeng-77588722',
  'https://www.miyoushe.com/zzz/article/77588722',
  'E5F2455EFE3F69630B3569A235FF308ED1176C6EC67699A9D89BC3DC9A3447D6',
  '版权/再分发许可未登记：仅保留构筑方向、条件分支、链接与内容哈希，不复制正文，不用于 formal。',
  '2026-09-04T00:00:00.000Z',
)
const sigridMiyousheAsgaterSource = source(
  'miyoushe-sigrid-asgater-77595007',
  'https://www.miyoushe.com/zzz/article/77595007',
  'E3B8F34D9C6F049A526C0D56106D2B0637E0E2DEFED4824E89D9DEA3C0ABD4F5',
  '版权/再分发许可未登记：仅保留构筑方向、条件分支、链接与内容哈希，不复制正文，不用于 formal。',
  '2026-09-04T00:00:00.000Z',
)
const sigridMiyousheYanyuSource = source(
  'miyoushe-sigrid-yanyu-77672965',
  'https://www.miyoushe.com/zzz/article/77672965',
  '5FF05CDAE64760AC8133D81603B5A41C4EC7F6F8B751FF97FF870B056821D36C',
  '版权/再分发许可未登记：仅保留构筑方向、条件分支、链接与内容哈希，不复制正文，不用于 formal。',
  '2026-09-04T00:00:00.000Z',
)
function constraint(
  input: Omit<CandidateWarehouseConstraint, 'contentHash'>,
): CandidateWarehouseConstraint {
  return { ...input, contentHash: stableContentHash(input) }
}

export const candidateWarehouseConstraints31: CandidateWarehouseConstraint[] = [
  constraint({
    agentId: 'candidate-3.1-agent-sigrid',
    agentName: '希格莉德·德拉叙尔',
    gameVersion: '3.1',
    status: 'candidate',
    sources: [
      sigridPrydwenLiveSource,
      sigridIcyVeinsBuildSource,
      sigridIcyVeinsTeamSource,
      sigridHoyolabLiveSource,
      sigridMiyousheQingfengSource,
      sigridMiyousheAsgaterSource,
      sigridMiyousheYanyuSource,
      ...sigridReviewedMainStatSources,
    ],
    setIds: [
      'set-hormone-punk',
      'set-puffer-electro',
      'set-dawns-bloom',
      'set-branch-blade-song',
      'set-polar-metal',
      'set-astral-voice',
    ],
    setPlanReadiness: {
      status: 'executable',
      pattern: '4+2',
      primarySetIds: ['set-hormone-punk', 'set-puffer-electro', 'set-dawns-bloom'],
      secondarySetIds: [
        'set-puffer-electro',
        'set-branch-blade-song',
        'set-polar-metal',
        'set-astral-voice',
      ],
    },
    mainStats: sigridReviewedMainStats,
    subStatWeights: {
      crit_dmg: 1,
      atk_percent: 0.92,
      crit_rate: 0.88,
      pen: 0.72,
      atk_flat: 0.56,
    },
    wEngineDirections: [
      'wengine-14159（骁骑礼赞）',
      '硫磺石、牺牲洁纯、星徽引擎为实装后候选替代；具体排序受精炼与队伍影响。',
    ],
    teamAndBangbooPreconditions: [
      '至少搭配一名击破或支援代理人以满足额外能力；实装后候选以希格莉德 + 击破 + 支援为主。',
      '邦布优先 bangboo-ultra-jake（超极杰克），其次根据队伍选择 bangboo-snap（咔嚓仔）等支援型邦布。',
    ],
    progressionDirection: [
      '核心技与普攻优先，其次终结技/连携技和强化特殊技；暴击率面板约 33.8% 后避免继续堆叠。',
    ],
    targetPanel: {
      level: 60,
      values: {
        atk: { min: 3000, max: 3400, upperOpen: true },
        hp: { min: 9500, upperOpen: true },
        def: { min: 750, upperOpen: true },
        critRate: 33.8,
        critDamage: { min: 150, max: 210, upperOpen: true },
      },
      conditions: [
        '60 级局外角色面板；暴击率 33.8% 按核心被动最多提供 66% 计算，继续堆叠可能溢出。',
        '暴击伤害区间受音擎副属性与 4 号位选择影响；这是攻略参考区间，不是 Formal 或唯一毕业线。',
      ],
      sourceIds: [sigridPrydwenLiveSource.id],
      label: 'guide_reference_range',
    },
    gaps: [
      '不同队伍对四件套与 5 号位存在分支，求解时必须保留队伍条件，不得压成唯一毕业答案。',
      '候选攻略与计算百分比不是 Formal 伤害或真实账户最优证明。',
    ],
    boundary: candidateBoundary,
  }),
  remielleCandidateWarehouseConstraint31,
]

/** Keep source-label disagreements visible until a same-version official/game source resolves them. */
export const gameData31FieldConflicts: GameData31FieldConflict[] = [
  {
    entityId: 'candidate-3.1-agent-remielle',
    fieldPath: 'identity.faction.localized_name',
    candidates: [
      { sourceId: 'bwiki-3.1-remielle-catalog', value: '达识结社' },
      { sourceId: 'icy-veins-3.1-remielle-build', value: 'Covenant of Dayat' },
    ],
    status: 'unresolved',
    effect: '不自动翻译或合并为正式阵营字段；不影响已独立来源化的候选仓库约束。',
  },
]

export const gameData31CatalogIntake = {
  gameVersion: '3.1' as const,
  entities: gameData31CatalogEntities,
  candidateWarehouseConstraints: candidateWarehouseConstraints31,
  fieldConflicts: gameData31FieldConflicts,
  combatFieldEvidence: gameData31CombatFieldEvidence,
  coverage: {
    entities: gameData31CatalogEntities.length,
    resolvedProjectIds: gameData31CatalogEntities.filter(
      (item) => item.identity.kind === 'project_catalog',
    ).length,
    gameEvidenceIdentities: gameData31CatalogEntities.filter(
      (item) => item.identity.kind === 'game_evidence',
    ).length,
    sourceScopedIdentities: gameData31CatalogEntities.filter(
      (item) => item.identity.kind === 'source_page',
    ).length,
    candidateWarehouseConstraints: candidateWarehouseConstraints31.filter(
      (item) => item.status === 'candidate',
    ).length,
    missingWarehouseConstraints: candidateWarehouseConstraints31.filter(
      (item) => item.status === 'missing',
    ).length,
    unresolvedFieldConflicts: gameData31FieldConflicts.length,
    combatCandidateFields: gameData31CombatFieldEvidence.filter(
      (item) => item.status === 'candidate',
    ).length,
    combatMissingFields: gameData31CombatFieldEvidence.filter((item) => item.status === 'missing')
      .length,
  },
  gameplayScope: {
    candidateWarehouseContinuity:
      '未受 3.1 玩法字段影响的普通角色候选仓库约束继续可读；危局专用结果因敌人/轮换字段未闭合而 stale。',
    stale: ['deadly_assault', 'direct_damage', 'rotation'],
    deadlyAssaultContext:
      '官方仅确认 3.1 危局更新范围；敌人、轮换、增益和阶段字段缺失，任何危局候选计算上下文均不可用。',
    billyFormal: '比利 3.0 单动作 formal 缺口独立保留，未因本 intake 改写。',
  },
  boundary: candidateBoundary,
}

export const scannerDriveDiscCatalog31 = gameData31CatalogEntities
  .filter((entity) => entity.domain === 'drive_disc_set')
  .map((entity) => ({
    id: entity.identity.projectStableId,
    gameStableId: entity.identity.gameStableId ?? null,
    name: entity.fields.localizedName ?? entity.displayName,
    aliases: String(entity.fields.ocrAliases ?? entity.fields.localizedName ?? entity.displayName)
      .split('|')
      .filter(Boolean),
    status: entity.status,
    version: entity.source.sourceVersion,
    sourceRefs: [entity.source.id, entity.source.contentHash],
  }))

export function getGameData31CatalogEntity(id: string) {
  return gameData31CatalogEntities.find((entity) => entity.id === id) ?? null
}

export function getCandidateWarehouseConstraint31(agentId: string) {
  return (
    candidateWarehouseConstraints31.find((constraint) => constraint.agentId === agentId) ?? null
  )
}

export const remielleEquipmentCatalogProjection = {
  displayName: getRemielleEquipmentField('agent-1581.identity.display_name_zh_cn')?.value,
  setDisplayName: getRemielleEquipmentField('set-34100.identity.display_name_zh_cn')?.value,
  wEngineDisplayName: getRemielleEquipmentField('wengine-14158.identity.display_name_zh_cn')?.value,
  boundary: candidateBoundary,
}
