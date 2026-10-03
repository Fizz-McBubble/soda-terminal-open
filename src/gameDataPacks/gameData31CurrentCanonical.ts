import { gameBase30CatalogSummary } from './catalogLedger'
import { canonicalBaselinePack30, createCanonicalPack } from './canonicalPack'
import { gameData31CatalogIntake } from './gameData31CatalogIntake'
import { gameBase31FieldContinuityLedger } from './fieldContinuity'
import { currentSourceSnapshots } from './sourceIntake'
import { stableContentHash } from './types'

export type CurrentCanonicalFieldStatus = 'formal' | 'candidate' | 'missing'
export type CurrentApplicability = 'verified_current' | 'continuous' | 'stale' | 'not_applicable'
export type CurrentDeltaEffect =
  | 'add'
  | 'change'
  | 'carry_forward'
  | 'deprecate'
  | 'overlay'
  | 'conflict'

export type CurrentCanonicalSource = {
  id: string
  url: string
  sourceType: 'official' | 'community' | 'offline_snapshot' | 'upstream'
  evidenceStrength: 'formal' | 'candidate' | 'reference_only'
  sourceVersion: string | null
  checkedAt: string
  contentIdentity: string
  licenseBoundary: string
}

export type CurrentCanonicalField = {
  id: string
  domain: 'package' | 'agent' | 'wengine' | 'bangboo' | 'drive_disc' | 'combat_rule' | 'playmode'
  fieldPath: string
  status: CurrentCanonicalFieldStatus
  effect: CurrentDeltaEffect
  originalSourceVersion: string
  lastChangeVersion: string
  currentApplicability: CurrentApplicability
  affectedVersion: string | null
  sourceRefs: string[]
  conflictRefs: string[]
  affectsCalculations: string[]
  note: string
}

const checkedAt = '2026-07-30T00:00:00.000Z'
const official31 = currentSourceSnapshots.find(
  (snapshot) => snapshot.id === 'official-3.1-live-scope-2026-07-29',
)!
const officialDeadlyAssault = currentSourceSnapshots.find(
  (snapshot) => snapshot.id === 'official-3.1-deadly-assault-2026-07-27',
)!

export const gameData31CurrentSources: CurrentCanonicalSource[] = [
  {
    id: 'official-zzz',
    url: 'https://zenless.hoyoverse.com/',
    sourceType: 'official',
    evidenceStrength: 'formal',
    sourceVersion: '1.0–3.0',
    checkedAt,
    contentIdentity: 'existing-official-catalog-ledger-carried-to-3.1',
    licenseBoundary:
      '既有官方目录事实按字段连续性沿用；没有变化证据时不重写原始来源版本，也不宣称由3.1重新核验。',
  },
  {
    id: official31.id,
    url: official31.url,
    sourceType: 'official',
    evidenceStrength: 'formal',
    sourceVersion: '3.1',
    checkedAt: official31.observedAt,
    contentIdentity: official31.contentHash,
    licenseBoundary:
      '官方页面仅用于版本上线与页面直接列出的目录范围；未公开战斗数值不从页面名称推导。',
  },
  {
    id: officialDeadlyAssault.id,
    url: officialDeadlyAssault.url,
    sourceType: 'official',
    evidenceStrength: 'formal',
    sourceVersion: '3.1',
    checkedAt: officialDeadlyAssault.observedAt,
    contentIdentity: officialDeadlyAssault.contentHash,
    licenseBoundary:
      '官方系统说明只确认玩法变化范围；固定敌人、数值、轮换和增益未公开时保持 missing。',
  },
  {
    id: 'qq-sheet-historical-2.6-offline-2026-07-28',
    url: 'https://docs.qq.com/sheet/DUHBodnJVQ1pKcFl4?tab=BB08J2',
    sourceType: 'offline_snapshot',
    evidenceStrength: 'reference_only',
    sourceVersion: '2.6.0_R14028417',
    checkedAt,
    contentIdentity: 'sha256-3edec5eda6d8af45b2a31da4246d8e1b93037f9220fd72f5fe4c8bf25fc502ad',
    licenseBoundary:
      '用户提供、停更且许可未声明的本地历史快照；仅引用项目既有字段路径与哈希，不复制工作簿或升格 formal。',
  },
  {
    id: 'bwiki-zzz',
    url: 'https://wiki.biligame.com/zzz/%E9%A6%96%E9%A1%B5',
    sourceType: 'community',
    evidenceStrength: 'candidate',
    sourceVersion: null,
    checkedAt,
    contentIdentity: 'bwiki-home-oldid-15378-2026-07-18',
    licenseBoundary:
      'CC BY-NC-SA 4.0：仅本地非商业、保留署名与相同许可边界；社区字段不能单独成为 formal。',
  },
  {
    id: 'baha-damage-mechanics-2026-07-28',
    url: 'https://forum.gamer.com.tw/C.php?bsn=74860&snA=6498',
    sourceType: 'community',
    evidenceStrength: 'reference_only',
    sourceVersion: null,
    checkedAt,
    contentIdentity: 'sha256-8aefa97f0f3e9fafb4202698e608ebaa53453183e0a64d74340d95b040fe46ce',
    licenseBoundary:
      '仅保存公式/乘区定位与页面身份；不复制文章正文、图片或作者作品，不能单独开启 formal。',
  },
  {
    id: 'github-zzz-calculator-3a2e838-reference',
    url: 'https://github.com/ZztIsolation/zzz_calculator/tree/3a2e838adb0e91e501b575d0503a272f9d6ce06d',
    sourceType: 'upstream',
    evidenceStrength: 'reference_only',
    sourceVersion: '3.1-current-2026-07-30',
    checkedAt,
    contentIdentity: 'commit-3a2e838adb0e91e501b575d0503a272f9d6ce06d',
    licenseBoundary: '未检测到根 LICENSE；只记录提交与数据契约定位，不复制代码或数据。',
  },
  {
    id: 'github-scanner-next-b4f3b53-mit',
    url: 'https://github.com/ZztIsolation/ZZZ-Scanner.Next/tree/b4f3b53f6e9acb1f42af1a68c63cfe326bf912d4',
    sourceType: 'upstream',
    evidenceStrength: 'reference_only',
    sourceVersion: '3.1-current-2026-07-30',
    checkedAt,
    contentIdentity: 'commit-b4f3b53f6e9acb1f42af1a68c63cfe326bf912d4',
    licenseBoundary: 'MIT；本节点仅记录数据/契约参考，不接扫描流程、不复制实现。',
  },
  {
    id: 'github-frzyc-zzz-9617fb-mit',
    url: 'https://github.com/frzyc/genshin-optimizer/tree/9617fb58334cfe84e26252041fb9510c34057f62/libs/zzz',
    sourceType: 'upstream',
    evidenceStrength: 'reference_only',
    sourceVersion: null,
    checkedAt,
    contentIdentity: 'commit-9617fb58334cfe84e26252041fb9510c34057f62',
    licenseBoundary: 'MIT 锁定提交；沿用项目既有 NOTICE，本节点不修改公式或求解实现。',
  },
]

export const gameData31CurrentFields: CurrentCanonicalField[] = [
  {
    id: 'package-current-version-3.1',
    domain: 'package',
    fieldPath: 'package.current_version',
    status: 'formal',
    effect: 'change',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    affectedVersion: '3.1',
    sourceRefs: [official31.id],
    conflictRefs: [],
    affectsCalculations: ['all-versioned-results'],
    note: '3.1 已于 2026-07-29 正式上线；这只确认当前版本，不代表每个战斗字段均已 formal。',
  },
  {
    id: 'catalog-existing-identity-continuity',
    domain: 'agent',
    fieldPath: 'catalog.existing.identity',
    status: 'formal',
    effect: 'carry_forward',
    originalSourceVersion: '1.0',
    lastChangeVersion: '1.0',
    currentApplicability: 'continuous',
    affectedVersion: null,
    sourceRefs: ['official-zzz'],
    conflictRefs: [],
    affectsCalculations: [],
    note: '3.1 delta 未记录既有稳定目录身份变化；沿用原始来源，不宣称已由 3.1 重新核验。',
  },
  {
    id: 'catalog-3.1-announced-agent-scope',
    domain: 'agent',
    fieldPath: 'catalog.agent.3.1.release_scope',
    status: 'formal',
    effect: 'add',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    affectedVersion: '3.1',
    sourceRefs: [official31.id],
    conflictRefs: [],
    affectsCalculations: ['guidance', 'warehouse', 'damage'],
    note: '官方公告确认新增代理人范围；未在官方页出现的稳定数值 ID 与战斗字段仍单独保留候选/缺口。',
  },
  {
    id: 'catalog-3.1-agent-stable-identities',
    domain: 'agent',
    fieldPath: 'catalog.agent.3.1.stable_identity',
    status: 'candidate',
    effect: 'add',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    affectedVersion: '3.1',
    sourceRefs: ['bwiki-zzz', 'github-zzz-calculator-3a2e838-reference'],
    conflictRefs: ['candidate-3.1-agent-remielle.identity.faction.localized_name'],
    affectsCalculations: ['guidance', 'warehouse', 'damage'],
    note: '社区/公开数据视图可定位候选身份，但不能代替官方或游戏内稳定映射。',
  },
  {
    id: 'catalog-3.1-equipment-fields',
    domain: 'wengine',
    fieldPath: 'catalog.wengine.3.1.base_passive_refinement',
    status: 'candidate',
    effect: 'add',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    affectedVersion: '3.1',
    sourceRefs: ['bwiki-zzz', 'github-zzz-calculator-3a2e838-reference'],
    conflictRefs: [],
    affectsCalculations: ['warehouse', 'damage'],
    note: '候选字段可支撑资料定位；精炼和同版本数值未完成 formal 核验。',
  },
  {
    id: 'catalog-3.1-drive-disc-fields',
    domain: 'drive_disc',
    fieldPath: 'catalog.drive_disc.3.1.set_effects',
    status: 'candidate',
    effect: 'add',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    affectedVersion: '3.1',
    sourceRefs: ['bwiki-zzz', 'github-zzz-calculator-3a2e838-reference'],
    conflictRefs: [],
    affectsCalculations: ['warehouse', 'damage'],
    note: '候选套装映射保留来源与许可；中文名或同版本字段不完整时不升格 formal。',
  },
  {
    id: 'historical-2.6-structured-values',
    domain: 'combat_rule',
    fieldPath: 'historical.agent_wengine_bangboo_enemy_rules',
    status: 'candidate',
    effect: 'carry_forward',
    originalSourceVersion: '2.6',
    lastChangeVersion: '2.6',
    currentApplicability: 'continuous',
    affectedVersion: null,
    sourceRefs: ['qq-sheet-historical-2.6-offline-2026-07-28'],
    conflictRefs: [],
    affectsCalculations: ['damage'],
    note: '未发现变化只维持历史候选连续性；停更/许可未声明的快照不能成为 3.1 formal。',
  },
  {
    id: 'community-formula-structure',
    domain: 'combat_rule',
    fieldPath: 'damage.formula.multiplier_structure',
    status: 'candidate',
    effect: 'carry_forward',
    originalSourceVersion: '2.6',
    lastChangeVersion: '2.6',
    currentApplicability: 'continuous',
    affectedVersion: null,
    sourceRefs: ['baha-damage-mechanics-2026-07-28', 'github-frzyc-zzz-9617fb-mit'],
    conflictRefs: [],
    affectsCalculations: ['damage'],
    note: '社区公式与 MIT 上游只提供交叉验证/适配身份；正式公式仍需字段级同版本门。',
  },
  {
    id: 'potential-overlay-3.1',
    domain: 'agent',
    fieldPath: 'agent.potential_overlay',
    status: 'missing',
    effect: 'overlay',
    originalSourceVersion: '3.0',
    lastChangeVersion: '3.0',
    currentApplicability: 'stale',
    affectedVersion: '3.1',
    sourceRefs: [],
    conflictRefs: [],
    affectsCalculations: ['guidance', 'warehouse', 'damage'],
    note: '潜能 overlay 独立待核验，不改写影画、普通技能或角色基础字段。',
  },
  {
    id: 'deadly-assault-3.1-change-scope',
    domain: 'playmode',
    fieldPath: 'mode.deadly_assault.change_scope',
    status: 'formal',
    effect: 'change',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'verified_current',
    affectedVersion: '3.1',
    sourceRefs: [officialDeadlyAssault.id],
    conflictRefs: [],
    affectsCalculations: ['deadly_assault-results'],
    note: '官方只确认玩法更新范围；普通仓库候选不因此失效。',
  },
  {
    id: 'deadly-assault-3.1-context-fields',
    domain: 'playmode',
    fieldPath: 'mode.deadly_assault.enemy_rotation_buffs',
    status: 'missing',
    effect: 'change',
    originalSourceVersion: '3.1',
    lastChangeVersion: '3.1',
    currentApplicability: 'stale',
    affectedVersion: '3.1',
    sourceRefs: [officialDeadlyAssault.id],
    conflictRefs: [],
    affectsCalculations: ['deadly_assault-results', 'damage'],
    note: '固定敌人 DEF/RES/失衡、阶段、轮换和增益未闭合；危局计算保持 stale。',
  },
  {
    id: 'billy-standing-fire-lv1-cross-check',
    domain: 'agent',
    fieldPath: 'agent-billy.combat.standing_fire.damage_multiplier_lv1',
    status: 'candidate',
    effect: 'carry_forward',
    originalSourceVersion: '2.6',
    lastChangeVersion: '2.6',
    currentApplicability: 'continuous',
    affectedVersion: null,
    sourceRefs: ['qq-sheet-historical-2.6-offline-2026-07-28', 'bwiki-zzz'],
    conflictRefs: [],
    affectsCalculations: ['damage'],
    note: 'QQ LV1=0.68 与 BWIKI LV1=68% 一致；候选连续有效不等于 formal。',
  },
  {
    id: 'billy-standing-fire-lv11-candidate',
    domain: 'agent',
    fieldPath: 'agent-billy.combat.standing_fire.damage_multiplier_lv11',
    status: 'candidate',
    effect: 'carry_forward',
    originalSourceVersion: '1.0',
    lastChangeVersion: '1.0',
    currentApplicability: 'continuous',
    affectedVersion: null,
    sourceRefs: ['bwiki-zzz'],
    conflictRefs: [],
    affectsCalculations: ['damage'],
    note: 'BWIKI 同技能表独立列出 LV11=130%；未与 QQ LV1 混比，仍非 official/game formal。',
  },
]

export const gameData31CurrentDelta = gameData31CurrentFields.map((field) => ({
  id: field.id,
  effect: field.effect,
  status: field.status,
  currentApplicability: field.currentApplicability,
  affectedVersion: field.affectedVersion,
  sourceRefs: field.sourceRefs,
  affectsCalculations: field.affectsCalculations,
}))

function countBy<T extends string>(values: T[]) {
  return Object.fromEntries(
    values.map((value) => [value, values.filter((candidate) => candidate === value).length]),
  ) as Record<T, number>
}

const sourceIds = new Set(gameData31CurrentFields.flatMap((field) => field.sourceRefs))
const currentSources = gameData31CurrentSources.filter((source) => sourceIds.has(source.id))

export const gameData31CurrentCoverage = {
  currentVersion: '3.1',
  rollbackVersion: '3.0',
  directory: {
    carriedForward: {
      agents: gameBase30CatalogSummary.agents,
      wEngines: gameBase30CatalogSummary.wEngines,
      bangboos: gameBase30CatalogSummary.bangboos,
      driveDiscSets: gameBase30CatalogSummary.driveDiscSets,
    },
    announcedAgentAdditions: 2,
    candidateStableAgentMappings: gameData31CatalogIntake.entities.filter(
      (entity) => entity.domain === 'agent' && entity.status === 'candidate',
    ).length,
    unresolvedStableMappings: gameData31CatalogIntake.entities.filter(
      (entity) => entity.identity.kind === 'source_page' || entity.identity.kind === 'unresolved',
    ).length,
  },
  fields: {
    total: gameData31CurrentFields.length,
    byStatus: countBy(gameData31CurrentFields.map((field) => field.status)),
    byApplicability: countBy(gameData31CurrentFields.map((field) => field.currentApplicability)),
    byEffect: countBy(gameData31CurrentFields.map((field) => field.effect)),
    continuous: gameData31CurrentFields.filter(
      (field) => field.currentApplicability === 'continuous',
    ).length,
    affectedPending: gameData31CurrentFields.filter(
      (field) =>
        field.currentApplicability === 'stale' &&
        (field.status === 'candidate' || field.status === 'missing'),
    ).length,
    conflicts: gameData31CurrentFields.filter((field) => field.effect === 'conflict').length,
  },
  sources: {
    total: currentSources.length,
    byStrength: countBy(currentSources.map((source) => source.evidenceStrength)),
    byType: countBy(currentSources.map((source) => source.sourceType)),
  },
  contentHash: stableContentHash({
    fields: gameData31CurrentFields,
    sources: currentSources,
  }),
} as const

const packCore = {
  id: 'game-data-current-3.1.0',
  schemaVersion: 1 as const,
  gameVersion: '3.1' as const,
  reviewedForVersion: '3.1' as const,
  lifecycle: 'current' as const,
  installedAt: checkedAt,
  previousPackId: canonicalBaselinePack30.id,
  rollbackTo: canonicalBaselinePack30.id,
  sourceRefs: currentSources.map((source) => source.id),
  fields: gameData31CurrentFields,
  delta: gameData31CurrentDelta,
  staleCalculationIds: [
    ...new Set(
      gameData31CurrentFields
        .filter((field) => field.currentApplicability === 'stale')
        .flatMap((field) => field.affectsCalculations),
    ),
  ],
  coverageHash: gameData31CurrentCoverage.contentHash,
  continuityLedgerHash: stableContentHash(gameBase31FieldContinuityLedger),
  boundary:
    '3.1 是当前读取版本；字段 formal/candidate/missing 独立决定结论强度，current 不等于全部字段 formal。',
}

export const gameData31CurrentCanonical = {
  ...packCore,
  contentHash: stableContentHash(packCore),
} as const

export const canonicalCurrentPack31 = createCanonicalPack({
  id: 'canonical-current-3.1.0',
  schemaVersion: 1,
  gameVersion: '3.1',
  status: 'current',
  createdAt: checkedAt,
  sourceSnapshotIds: currentSources.map((source) => source.id),
  baselineHash: gameData31CurrentCanonical.contentHash,
  delta: {
    added: gameData31CurrentFields
      .filter((field) => field.effect === 'add')
      .map((field) => field.id),
    changed: gameData31CurrentFields
      .filter((field) => ['change', 'overlay', 'conflict'].includes(field.effect))
      .map((field) => field.id),
    deprecated: gameData31CurrentFields
      .filter((field) => field.effect === 'deprecate')
      .map((field) => field.id),
  },
  coverage: {
    catalogComplete: gameData31CurrentCoverage.directory.carriedForward.agents,
    buildReadable: 0,
    warehouseSolvable: 0,
    exactDamageSolvable: 0,
    missingFields: gameData31CurrentCoverage.fields.byStatus.missing ?? 0,
  },
  migrationNotes: [
    '3.1 成为 current；未受影响历史字段按 originalSourceVersion/lastChangeVersion 连续沿用。',
    'candidate/missing 字段不因 current 安装而升格，受影响计算只标记 stale。',
  ],
  affectedCalculations: packCore.staleCalculationIds,
  rollbackTo: canonicalBaselinePack30.id,
})

export { validateGameData31CurrentCanonical } from './gameData31CurrentCanonicalValidation'
