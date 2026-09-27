import { agentCatalog, bangbooCatalog } from '../assault/catalog'
import wEngineCatalog from '../assault/data/wEngineCatalog.3.0.json'
import { driveDiscData } from '../data/gameData'
import { buildKnowledge30Profiles } from './buildKnowledge'
import { gameBase30CatalogLedger } from './catalogLedger'
import { playerBuildProfileCoverage } from './playerBuildProfiles'
import { combatFieldCoverage30, combatFieldIntakes30 } from './combatFieldIntake'
import { stableContentHash } from './types'
import { qqSheetArchive, qqSheetHistoricalBaseline } from './qqSheetHistoricalBaseline'

export const canonicalFieldStatuses = ['formal', 'candidate', 'missing'] as const
export type CanonicalFieldStatus = (typeof canonicalFieldStatuses)[number]

export type CanonicalSource = {
  id: string
  label: string
  url: string
  tier: 'official' | 'community-candidate' | 'reference-only'
  checkedAt: string
  sourceVersion: string | null
  contentHash: string | null
  snapshotIdentity: string
  licenseBoundary: string
  conversionBoundary: string
}

export const canonicalSourceCensus: CanonicalSource[] = [
  {
    id: 'official-zzz',
    label: '绝区零官方网站与公告',
    url: 'https://zenless.hoyoverse.com/',
    tier: 'official',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: '3.0',
    contentHash: null,
    snapshotIdentity: 'official-3.0-live-2026-07-27',
    licenseBoundary: '仅记录可核验游戏事实、来源定位与最小派生字段；不复制受限页面或图片。',
    conversionBoundary: '可用于正式目录事实；数值须逐字段、同版本核验。',
  },
  {
    id: 'bwiki-zzz',
    label: '绝区零 WIKI（BWIKI）',
    url: 'https://wiki.biligame.com/zzz/%E9%A6%96%E9%A1%B5',
    tier: 'community-candidate',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'bwiki-home-oldid-15378-2026-07-18',
    licenseBoundary:
      'CC BY-NC-SA 4.0：本地非商业候选、保留署名和同许可边界；不得作为官方事实或公开混合分发。',
    conversionBoundary: '仅最小字段摘录与页面级哈希；同版本官方/游戏内核验前不可转正式。',
  },
  {
    id: 'prydwen-zzz',
    label: 'Prydwen 绝区零资料页',
    url: 'https://www.prydwen.gg/zenless/stats',
    tier: 'reference-only',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'prydwen-stats-last-updated-2026-07-24',
    licenseBoundary: '许可与本地转换边界未作为本包的正式输入证明。',
    conversionBoundary: '仅用于人工交叉定位，不能复制、打包或升格。',
  },
  {
    id: 'wikiwiki-zzz',
    label: 'Wikiwiki 绝区零伤害公式页',
    url: 'https://wikiwiki.jp/zenless/%E3%83%80%E3%83%A1%E3%83%BC%E3%82%B8%E8%A8%88%E7%AE%97%E5%BC%8F',
    tier: 'reference-only',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'wikiwiki-damage-last-modified-2026-03-07',
    licenseBoundary: '公式页面可作交叉定位，但当前没有与 3.0 数值包一致的本地转换许可结论。',
    conversionBoundary: '仅保留公式核验线索，不作为正式或候选数值输入。',
  },
  {
    id: 'miyoushe-zzz',
    label: '米游社绝区零社区内容',
    url: 'https://www.miyoushe.com/zzz/',
    tier: 'reference-only',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'miyoushe-zzz-entry-2026-07-27',
    licenseBoundary: '作者内容与复用边界按页面逐项确认；当前未作为可转换来源。',
    conversionBoundary: '只作为官方/游戏内证据的定位线索。',
  },
  {
    id: 'bilibili-zzz',
    label: '哔哩哔哩视频与说明页',
    url: 'https://www.bilibili.com/',
    tier: 'reference-only',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'bilibili-zzz-entry-2026-07-27',
    licenseBoundary: '视频与作者说明不构成可复制的正式数据源。',
    conversionBoundary: '仅可记录版本化交叉验证线索，不提取或打包原文/视频。',
  },
  {
    id: 'forum-zzz',
    label: '社区论坛与攻略讨论',
    url: 'https://www.taptap.cn/app/233287',
    tier: 'reference-only',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'taptap-zzz-entry-2026-07-27',
    licenseBoundary: '作者攻略、论坛讨论与旧版本机制解释不具备统一版本或转换许可。',
    conversionBoundary: '只作待核对线索，不能直接进入数据包。',
  },
  {
    id: 'github-zzz',
    label: '开源计算器与数据仓库线索',
    url: 'https://github.com/search?q=zenless+damage+calculator&type=repositories',
    tier: 'reference-only',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'github-zenless-damage-calculator-search-2026-07-27',
    licenseBoundary: '仓库许可、数据来源与版本需逐仓库确认；当前未确定可转换来源。',
    conversionBoundary: '仅记录定位入口，不克隆、不复制或打包数据。',
  },
  {
    id: 'zenless-data',
    label: 'ZenlessData 固定提交',
    url: 'https://git.mero.moe/dimbreath/ZenlessData/src/commit/d5b8f7935f5e7e7e21b5b6798d66036bbb4f1066',
    tier: 'reference-only',
    checkedAt: '2026-07-27T00:00:00.000Z',
    sourceVersion: 'OSPRODWin3.0.0_R17093596_S17093596_D17093596',
    contentHash: 'd5b8f7935f5e7e7e21b5b6798d66036bbb4f1066',
    snapshotIdentity: 'commit-d5b8f7935f5e7e7e21b5b6798d66036bbb4f1066',
    licenseBoundary: '未形成可本地转换的许可结论，维持 reference-only。',
    conversionBoundary: '只保留提交定位与差异提示，不复制原始内容。',
  },
  {
    id: 'baha-damage-mechanics',
    label: '巴哈姆特伤害种类与乘区文章',
    url: 'https://forum.gamer.com.tw/Co.php?bsn=74860&sn=32943',
    tier: 'reference-only',
    checkedAt: '2026-07-28T00:00:00.000Z',
    sourceVersion: null,
    contentHash: null,
    snapshotIdentity: 'baha-damage-mechanics-2026-07-28',
    licenseBoundary:
      '论坛作者内容只保留最小机制/公式结构结论、段落定位与来源链接；不复制正文、图片或用户作品。',
    conversionBoundary:
      '可与历史数值和独立候选交叉验证，最多形成 continuous/strong candidate；不能单独进入 formal。',
  },
  {
    id: 'qq-sheet-historical',
    label: '用户提供的 QQ 文档历史附表',
    url: qqSheetArchive.sourceUrl,
    tier: 'reference-only',
    checkedAt: qqSheetArchive.archivedAt,
    sourceVersion: qqSheetArchive.originalSnapshotVersion,
    contentHash: qqSheetArchive.archiveSha256,
    snapshotIdentity: qqSheetArchive.id,
    licenseBoundary:
      '许可未声明。仅本地非公开历史快照、字段路径与最小候选交叉；不得镜像整表、图片或说明文本。',
    conversionBoundary:
      '停更 2.6 历史基线。3.0 只可通过独立 delta 覆盖受影响字段；无 delta 或冲突时不能成为 formal。',
  },
]

export type CanonicalField = {
  path: string
  status: CanonicalFieldStatus
  sourceId: string | null
  sourceVersion: string | null
  reason: string
}

export type CanonicalEntity = {
  stableId: string
  displayName: string
  entityType:
    | 'agent'
    | 'wengine'
    | 'bangboo'
    | 'drive_disc_set'
    | 'build_knowledge'
    | 'combat_rule'
    | 'enemy_or_mode'
  fields: CanonicalField[]
}

export type FieldConflict = {
  fieldPath: string
  values: Array<{ sourceId: string; value: string; sourceVersion: string | null }>
  adopted: string | null
  decision: 'adopted' | 'unresolved' | 'excluded'
  reason: string
}

/** Candidate/reference values are retained for review, never silently merged into formal facts. */
export const canonicalFieldConflictLedger: FieldConflict[] = [
  {
    fieldPath: 'agent-billy.combat.lv60_panel',
    values: [
      { sourceId: 'bwiki-zzz', value: '页面级候选，待同版本核验', sourceVersion: null },
      { sourceId: 'zenless-data', value: '固定提交 reference-only', sourceVersion: '3.0' },
    ],
    adopted: null,
    decision: 'unresolved',
    reason: '两条非正式来源不能构成正式战斗字段；保留来源定位，不输出数值。',
  },
  {
    fieldPath: 'wengine-14158.identity.image',
    values: [{ sourceId: 'official-zzz', value: '官方图鉴未核验', sourceVersion: '3.0' }],
    adopted: null,
    decision: 'excluded',
    reason: '未核验官方图鉴项维持来源缺口，不进入正式可用候选。',
  },
]

const formalCatalogField = (path: string): CanonicalField => ({
  path,
  status: 'formal',
  sourceId: 'official-zzz',
  sourceVersion: '3.0',
  reason: '稳定目录身份与分类已有官方来源账本。',
})
const missingCombatField = (path: string): CanonicalField => ({
  path,
  status: 'missing',
  sourceId: null,
  sourceVersion: null,
  reason: '尚无同版本、可复制验证的最小字段证据；不得按模板或文本猜测。',
})

const officialCatalogIds = new Set(gameBase30CatalogLedger.entries.map((entry) => entry.stableId))
const catalogIdentityField = (stableId: string, path: string): CanonicalField =>
  officialCatalogIds.has(stableId)
    ? formalCatalogField(path)
    : {
        ...missingCombatField(path),
        reason: '该目录项尚无可核验的官方图鉴来源，不能作为正式目录或候选池事实。',
      }

const buildField = (
  path: string,
  status: CanonicalFieldStatus,
  sourceId: string | null,
  reason: string,
): CanonicalField => ({
  path,
  status,
  sourceId,
  sourceVersion: status === 'missing' ? null : '3.0',
  reason,
})

function combatFieldsForAgent(stableId: string): CanonicalField[] {
  const intake = combatFieldIntakes30.find((item) => item.agentId === stableId)
  if (!intake) return []
  return intake.fields
    .filter((field) => field.path.startsWith('combat.'))
    .map((field) => ({
      path: field.path,
      status: field.status,
      sourceId: field.source.id,
      sourceVersion: field.source.sourceVersion,
      reason: field.reason,
    }))
}

export const canonicalBaseline30: CanonicalEntity[] = [
  ...agentCatalog
    .filter((item) => item[7] === 'released')
    .map(([stableId, displayName, specialty, , rarity, attribute, faction]) => ({
      stableId,
      displayName,
      entityType: 'agent' as const,
      fields: [
        catalogIdentityField(stableId, 'identity.name'),
        catalogIdentityField(stableId, 'identity.rarity'),
        catalogIdentityField(stableId, 'identity.specialty'),
        catalogIdentityField(stableId, 'identity.attribute'),
        catalogIdentityField(stableId, 'identity.faction'),
        missingCombatField('release.version_date'),
        ...combatFieldsForAgent(stableId),
        {
          ...catalogIdentityField(stableId, 'identity.classification'),
          reason: `${rarity}/${specialty}/${attribute}/${faction}`,
        },
      ],
    })),
  ...wEngineCatalog.items.map((item) => ({
    stableId: item.id,
    displayName: item.name,
    entityType: 'wengine' as const,
    fields: [
      catalogIdentityField(item.id, 'identity.name'),
      catalogIdentityField(item.id, 'identity.rarity'),
      catalogIdentityField(item.id, 'identity.specialty'),
      missingCombatField('release.version_date'),
      missingCombatField('combat.lv60_panel'),
      missingCombatField('combat.level_curve'),
      missingCombatField('combat.passive_refinement_1_5'),
    ],
  })),
  ...bangbooCatalog.map(([stableId, displayName, , rarity]) => ({
    stableId,
    displayName,
    entityType: 'bangboo' as const,
    fields: [
      catalogIdentityField(stableId, 'identity.name'),
      { ...catalogIdentityField(stableId, 'identity.rarity'), reason: `目录稀有度 ${rarity}` },
      missingCombatField('release.version_date'),
      missingCombatField('combat.level_core_curve'),
      missingCombatField('combat.active_chain_extra'),
      missingCombatField('combat.team_condition_frequency'),
    ],
  })),
  ...(driveDiscData?.driveDiscSets ?? []).map((item) => ({
    stableId: item.id as string,
    displayName: item.name as string,
    entityType: 'drive_disc_set' as const,
    fields: [
      catalogIdentityField(item.id as string, 'identity.name'),
      missingCombatField('release.version_date'),
      missingCombatField('combat.two_four_piece_modifier'),
      missingCombatField('rules.slot_main_stat_pool'),
      missingCombatField('rules.substat_initial_rolls_and_values'),
    ],
  })),
  ...buildKnowledge30Profiles.map((profile) => ({
    stableId: `build-knowledge:${profile.agentId}`,
    displayName: `${profile.agentName} 构筑知识`,
    entityType: 'build_knowledge' as const,
    fields: [
      buildField(
        'guidance.wengine_trait',
        profile.constraints.wEngineTrait.status,
        profile.constraints.wEngineTrait.status === 'missing' ? null : 'official-zzz',
        profile.constraints.wEngineTrait.note,
      ),
      buildField(
        'guidance.bangboo',
        profile.constraints.bangboo.status,
        profile.constraints.bangboo.status === 'missing' ? null : 'bwiki-zzz',
        profile.constraints.bangboo.note,
      ),
      buildField(
        'guidance.drive_disc_main_substats',
        profile.constraints.driveDisc.status,
        profile.constraints.driveDisc.status === 'missing' ? null : 'bwiki-zzz',
        profile.constraints.driveDisc.note,
      ),
      buildField(
        'guidance.progression_core_cinema',
        profile.constraints.progression.status,
        profile.constraints.progression.status === 'missing' ? null : 'bwiki-zzz',
        profile.constraints.progression.note,
      ),
      buildField(
        'guidance.team_rotation_scenario',
        profile.constraints.teamScenario.status,
        profile.constraints.teamScenario.status === 'missing' ? null : 'bwiki-zzz',
        profile.constraints.teamScenario.note,
      ),
      buildField(
        'guidance.potential_overlay',
        profile.constraints.potentialOverlay.status,
        profile.constraints.potentialOverlay.status === 'missing' ? null : 'bwiki-zzz',
        profile.constraints.potentialOverlay.note,
      ),
    ],
  })),
  {
    stableId: 'combat-formulas',
    displayName: '战斗基础公式与乘区',
    entityType: 'combat_rule' as const,
    fields: [
      missingCombatField('damage.direct_critical_def_res'),
      missingCombatField('damage.penetration_bonus_vulnerability'),
      missingCombatField('anomaly_disorder_daze'),
      missingCombatField('energy.decibel.assist_chain'),
      missingCombatField('rounding'),
    ],
  },
  {
    stableId: 'enemies-and-modes',
    displayName: '敌人与玩法轮换',
    entityType: 'enemy_or_mode' as const,
    fields: [
      missingCombatField('enemy.def_res_daze'),
      missingCombatField('enemy.phase_immunity_mechanics'),
      missingCombatField('mode.buff_score_window'),
      missingCombatField('mode.team_restriction_effective_period'),
    ],
  },
]

export const canonicalCoverageReport = {
  sourceCensus: canonicalSourceCensus.length,
  entities: canonicalBaseline30.length,
  catalogTotal: canonicalBaseline30.filter((entity) =>
    ['agent', 'wengine', 'bangboo', 'drive_disc_set'].includes(entity.entityType),
  ).length,
  catalogComplete: canonicalBaseline30.filter((entity) =>
    entity.fields.some((field) => field.path === 'identity.name' && field.status === 'formal'),
  ).length,
  buildTotal: playerBuildProfileCoverage.total,
  buildReadable: playerBuildProfileCoverage.readable,
  warehouseSolvable: combatFieldCoverage30.formalWarehouseSolvable,
  candidateWarehouseSolvable: combatFieldCoverage30.candidateWarehouseSolvable,
  candidateTheorySolvable: combatFieldCoverage30.candidateTheorySolvable,
  exactDamageTotal: playerBuildProfileCoverage.total,
  exactDamageSolvable: combatFieldCoverage30.formalExactDamageSolvable,
  missingFields: canonicalBaseline30.flatMap((entity) =>
    entity.fields
      .filter((field) => field.status === 'missing')
      .map((field) => `${entity.stableId}.${field.path}`),
  ),
  unresolvedConflicts: canonicalFieldConflictLedger.filter(
    (conflict) => conflict.decision === 'unresolved',
  ).length,
  contentHash: stableContentHash(canonicalBaseline30),
}

/** Machine-readable backlog for source intake. Missing values remain visible rather than becoming defaults. */
export const canonicalGapReport = canonicalBaseline30.flatMap((entity) =>
  entity.fields
    .filter((field) => field.status === 'missing')
    .map((field) => ({
      stableId: entity.stableId,
      displayName: entity.displayName,
      entityType: entity.entityType,
      fieldPath: field.path,
      reason: field.reason,
    })),
)

/** Historical data is an offline baseline seam, not a replacement for current-version deltas. */
export const canonicalHistoricalBaselineMap = {
  sourceId: 'qq-sheet-historical',
  baselineVersion: qqSheetHistoricalBaseline.originalSnapshotVersion,
  gameVersionTarget: '3.0',
  domains: qqSheetHistoricalBaseline.sheets,
  delta: qqSheetHistoricalBaseline.deltaOverlay30,
  offlineOnly: true,
  boundary: '未有 3.0 变更证据的字段保持历史候选或冲突状态；不得重写历史来源版本或开启正式伤害。',
} as const

export type CanonicalDelta = { added: string[]; changed: string[]; deprecated: string[] }
export function diffCanonicalBaseline(
  previous: CanonicalEntity[],
  next: CanonicalEntity[],
): CanonicalDelta {
  const before = new Map(previous.map((entity) => [entity.stableId, stableContentHash(entity)]))
  const after = new Map(next.map((entity) => [entity.stableId, stableContentHash(entity)]))
  return {
    added: [...after.keys()].filter((id) => !before.has(id)),
    changed: [...after.entries()]
      .filter(([id, hash]) => before.get(id) !== undefined && before.get(id) !== hash)
      .map(([id]) => id),
    deprecated: [...before.keys()].filter((id) => !after.has(id)),
  }
}

export function canPromoteCanonicalEntity(entity: CanonicalEntity) {
  return entity.fields.every((field) => field.status === 'formal')
}

export function hasCanonicalCatalogIdentity(entity: CanonicalEntity) {
  return entity.fields.some((field) => field.path === 'identity.name' && field.status === 'formal')
}
