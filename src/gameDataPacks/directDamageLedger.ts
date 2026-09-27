import { z } from 'zod'
import { stableContentHash } from './types'
import { communityEvidenceCrossChecks, evidenceForField } from './communityEvidenceGraph'
import { qqSheetArchive, qqSheetHistoricalBaseline } from './qqSheetHistoricalBaseline'

/**
 * Evidence-only intake for a future exact direct-damage slice. It intentionally stores no
 * combat numbers until each number has a same-version, traceable source.
 */
export const directDamageFieldStatusSchema = z.enum(['formal', 'candidate', 'missing'])
export const directDamageFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: directDamageFieldStatusSchema,
  requiredForFormal: z.boolean(),
  sourceUrl: z.string().url().nullable(),
  sourceType: z.enum(['official_game_fact', 'community_assumption', 'calculation_scope']),
  sourceVersion: z.string().min(1).nullable(),
  checkedAt: z.string().datetime().nullable(),
  sourceContentHash: z.string().min(1).nullable(),
  licenseBoundary: z.string().min(1),
  continuity: z
    .object({
      originalSourceVersion: z.string().min(1).nullable(),
      lastVerifiedVersion: z.string().min(1).nullable(),
      changeEffect: z.enum(['unchanged', 'changed', 'unknown', 'not_applicable']),
      currentApplicability: z.enum(['continuous', 'verified_current', 'unverified']),
      evidence: z.string().min(1),
    })
    .default({
      originalSourceVersion: null,
      lastVerifiedVersion: null,
      changeEffect: 'unknown',
      currentApplicability: 'unverified',
      evidence: '尚无足以证明字段连续性的版本差异证据。',
    }),
  note: z.string().min(1),
})

export const directDamageSliceSchema = z.object({
  id: z.string().min(1),
  gameVersion: z.string().min(1),
  status: directDamageFieldStatusSchema,
  agentId: z.string().min(1),
  displayName: z.string().min(1),
  fields: z.array(directDamageFieldSchema).min(1),
})

export const directDamageSourceLedgerSchema = z.object({
  id: z.string().min(1),
  gameVersion: z.string().min(1),
  packageVersion: z.string().min(1),
  checkedAt: z.string().datetime(),
  sources: z.array(
    z.object({
      label: z.string().min(1),
      url: z.string().url(),
      sourceType: z.enum(['official_game_fact', 'community_assumption']),
      sourceVersion: z.string().min(1),
      checkedAt: z.string().datetime(),
      contentHash: z.string().min(1).nullable(),
      licenseBoundary: z.string().min(1),
    }),
  ),
  slices: z.array(directDamageSliceSchema),
  candidate31Fields: z.array(directDamageFieldSchema),
  contentHash: z.string().min(1),
})

export type DirectDamageSlice = z.infer<typeof directDamageSliceSchema>
export type DirectDamageSourceLedger = z.infer<typeof directDamageSourceLedgerSchema>

const officialBillyUrl = 'https://zenless.hoyoverse.com/zh-cn/character?catchSpider=1&id=102769'
const officialSite = 'https://zenless.hoyoverse.com/'
const officialWikiCharacterCatalog = 'https://baike.mihoyo.com/zzz/wiki/channel/map/2/43'
const officialWikiEnemyCatalog = 'https://baike.mihoyo.com/zzz/wiki/channel/map/2/65'
const bwikiBillyUrl = 'https://wiki.biligame.com/zzz/%E6%AF%94%E5%88%A9'
const checkedAt = '2026-07-28T00:00:00.000Z'

const unverifiedContinuity = {
  originalSourceVersion: null,
  lastVerifiedVersion: null,
  changeEffect: 'unknown' as const,
  currentApplicability: 'unverified' as const,
  evidence: '当前公开目录没有逐字段、同版本的变更或连续性证据。',
}

const missingFormalFields = [
  {
    id: 'agent-skill-multipliers',
    label: '角色等级与技能倍率',
    status: 'candidate' as const,
    requiredForFormal: true,
    sourceUrl: qqSheetArchive.sourceUrl,
    sourceType: 'community_assumption' as const,
    sourceVersion: qqSheetArchive.originalSnapshotVersion,
    checkedAt,
    sourceContentHash: qqSheetArchive.archiveSha256,
    licenseBoundary: qqSheetArchive.boundary,
    continuity: {
      originalSourceVersion: qqSheetArchive.originalSnapshotVersion,
      lastVerifiedVersion: qqSheetArchive.originalSnapshotVersion,
      changeEffect: 'unknown' as const,
      currentApplicability: 'unverified' as const,
      evidence:
        'QQ LV1=0.68 与 BWIKI LV1=68% 已按相同技能等级交叉一致；BWIKI LV11=130% 保持独立。尚无 official/game formal 证据或完整命中结构。',
    },
    note: '历史离线表与 BWIKI 已闭合 LV1 候选交叉；仍需同版本 official/game 动作、命中结构与连续性证据才能 formal。',
  },
  {
    id: 'wengine-base-and-passive',
    label: '音擎基础数值与被动',
    status: 'candidate' as const,
    requiredForFormal: true,
    sourceUrl: qqSheetArchive.sourceUrl,
    sourceType: 'community_assumption' as const,
    sourceVersion: qqSheetArchive.originalSnapshotVersion,
    checkedAt,
    sourceContentHash: qqSheetArchive.archiveSha256,
    licenseBoundary: qqSheetArchive.boundary,
    continuity: unverifiedContinuity,
    note: '离线表可定位仿制星徽引擎的基础/被动字段，但没有选定 3.0 音擎与同版本精炼/触发核验。',
  },
  {
    id: 'bangboo-treatment',
    label: '邦布伤害或明确排除范围',
    status: 'candidate' as const,
    requiredForFormal: true,
    sourceUrl: qqSheetArchive.sourceUrl,
    sourceType: 'community_assumption' as const,
    sourceVersion: qqSheetArchive.originalSnapshotVersion,
    checkedAt,
    sourceContentHash: qqSheetArchive.archiveSha256,
    licenseBoundary: qqSheetArchive.boundary,
    continuity: {
      originalSourceVersion: '3.0',
      lastVerifiedVersion: '3.0',
      changeEffect: 'not_applicable' as const,
      currentApplicability: 'unverified' as const,
      evidence: '离线表可定位邦布属性与技能字段，但未选定邦布、循环或同版本纳入/排除范围。',
    },
    note: '离线表证明邦布战斗字段可供候选交叉；固定切片仍须声明具体邦布纳入或排除。',
  },
  {
    id: 'player-final-stats',
    label: '六盘与最终属性快照',
    status: 'candidate' as const,
    requiredForFormal: true,
    sourceUrl: null,
    sourceType: 'calculation_scope' as const,
    sourceVersion: '3.0',
    checkedAt,
    sourceContentHash: null,
    licenseBoundary: '只接受运行时账户作用域快照；不写入来源账本或测试夹具。',
    continuity: {
      originalSourceVersion: null,
      lastVerifiedVersion: null,
      changeEffect: 'not_applicable' as const,
      currentApplicability: 'unverified' as const,
      evidence: '该字段是每次计算的玩家运行时事实，当前任务禁止读取真实账户，不能预置为 formal。',
    },
    note: '由正式计算时的玩家快照提供；本数据包不保存玩家资产。',
  },
  {
    id: 'enemy-def-res-stun',
    label: '敌人 DEF、RES 与失衡参数',
    status: 'candidate' as const,
    requiredForFormal: true,
    sourceUrl: qqSheetArchive.sourceUrl,
    sourceType: 'community_assumption' as const,
    sourceVersion: qqSheetArchive.originalSnapshotVersion,
    checkedAt,
    sourceContentHash: qqSheetArchive.archiveSha256,
    licenseBoundary: qqSheetArchive.boundary,
    continuity: unverifiedContinuity,
    note: '离线表可定位敌人 DEF、属性抗性、失衡、强化与转阶段字段；尚未选定 3.0 固定敌人或同版本参数。',
  },
  {
    id: 'fixed-cycle-and-buffs',
    label: '固定循环、动作时长与 Buff 覆盖',
    status: 'candidate' as const,
    requiredForFormal: true,
    sourceUrl: null,
    sourceType: 'community_assumption' as const,
    sourceVersion: '3.0',
    checkedAt,
    sourceContentHash: null,
    licenseBoundary: '社区循环只能作为具版本与前提的候选；不能升格为官方游戏事实。',
    continuity: unverifiedContinuity,
    note: '尚无具来源、可复算且与技能倍率同版本的固定循环假设；因此不能把固定秒数或 Buff 覆盖率作为 formal 常数。',
  },
]

const directDamage30SourceLedgerCore = {
  id: 'direct-damage-source-ledger-3.0.0',
  gameVersion: '3.0',
  packageVersion: '3.0.0-candidate.1',
  checkedAt,
  sources: [
    {
      label: '《绝区零》官方网站：星徽·比利',
      url: officialBillyUrl,
      sourceType: 'official_game_fact',
      sourceVersion: '3.0',
      checkedAt,
      contentHash: null,
      licenseBoundary: '仅保存URL、核验时间与字段可用性；不下载或打包页面内容。',
    },
    {
      label: 'QQ 文档附表（停更）离线历史快照',
      url: qqSheetArchive.sourceUrl,
      sourceType: 'community_assumption',
      sourceVersion: qqSheetArchive.originalSnapshotVersion,
      checkedAt,
      contentHash: qqSheetArchive.archiveSha256,
      licenseBoundary: qqSheetArchive.boundary,
    },
    {
      label: '绝区零官方 Wiki：代理人与音擎目录',
      url: officialWikiCharacterCatalog,
      sourceType: 'official_game_fact',
      sourceVersion: '3.0',
      checkedAt,
      contentHash: 'source-identity-official-wiki-agent-catalog-2026-07-28',
      licenseBoundary: '仅保存来源身份与可见目录字段；不复制图片、正文或未核验战斗数值。',
    },
    {
      label: '绝区零官方 Wiki：敌人目录',
      url: officialWikiEnemyCatalog,
      sourceType: 'official_game_fact',
      sourceVersion: '3.0',
      checkedAt,
      contentHash: 'source-identity-official-wiki-enemy-catalog-2026-07-28',
      licenseBoundary: '仅保存目录与字段可用性；没有数值表时不推断 DEF、RES 或失衡。',
    },
    {
      label: 'BWIKI：比利·奇德（候选交叉）',
      url: bwikiBillyUrl,
      sourceType: 'community_assumption',
      sourceVersion: '1.0',
      checkedAt,
      contentHash: 'source-identity-bwiki-billy-2026-07-28',
      licenseBoundary:
        'CC BY-NC-SA 4.0；仅本地非商业、保留署名/链接与同许可边界；不能升格为官方事实。',
    },
    {
      label: '《绝区零》官方网站',
      url: officialSite,
      sourceType: 'official_game_fact',
      sourceVersion: '3.0',
      checkedAt,
      contentHash: null,
      licenseBoundary: '仅作为官方目录和后续数值来源核验入口，不进行前端热链。',
    },
  ],
  slices: [
    {
      id: 'agent-billy-direct-3.0-intake',
      gameVersion: '3.0',
      status: 'missing',
      agentId: 'agent-billy',
      displayName: '比利·奇德',
      fields: [
        {
          id: 'agent-identity',
          label: '角色目录身份',
          status: 'formal',
          requiredForFormal: true,
          sourceUrl: officialBillyUrl,
          sourceType: 'official_game_fact',
          sourceVersion: '3.0',
          checkedAt,
          sourceContentHash: null,
          licenseBoundary: '仅保存稳定目录身份与来源链接。',
          continuity: {
            originalSourceVersion: '3.0',
            lastVerifiedVersion: '3.0',
            changeEffect: 'unchanged',
            currentApplicability: 'verified_current',
            evidence:
              '官方 3.0 首页与官方角色目录均列出比利·奇德；此项仅覆盖身份，不覆盖战斗数值。',
          },
          note: '官方角色目录可核验比利·奇德的目录身份。',
        },
        ...missingFormalFields,
      ],
    },
  ],
  candidate31Fields: [
    {
      id: '3.1-direct-damage-official-intake',
      label: '3.1 直接伤害字段核验',
      status: 'missing',
      requiredForFormal: true,
      sourceUrl: 'https://zenless.hoyoverse.com/zh-tw/news/165248?catchSpider=1',
      sourceType: 'official_game_fact',
      sourceVersion: '3.1-candidate',
      checkedAt,
      sourceContentHash: null,
      licenseBoundary: '候选公告只能列更新范围；上线后须以正式资料逐字段核验。',
      note: '3.1候选包尚缺角色倍率、音擎/邦布战斗数值、敌人和固定循环，不能参与排名。',
    },
  ],
}

export const directDamage30SourceLedger = directDamageSourceLedgerSchema.parse({
  ...directDamage30SourceLedgerCore,
  contentHash: stableContentHash(directDamage30SourceLedgerCore),
})

export function formalDirectDamageFields(slice: DirectDamageSlice) {
  return slice.fields.filter((field) => field.requiredForFormal && field.status !== 'formal')
}

export function isFormalDirectDamageSlice(slice: DirectDamageSlice) {
  return slice.status === 'formal' && formalDirectDamageFields(slice).length === 0
}

/** No real slice is exposed as calculable until every required field is formal and same-version. */
export function getFormalDirectDamageSlice(gameVersion: string) {
  return directDamage30SourceLedger.slices.find(
    (slice) => slice.gameVersion === gameVersion && isFormalDirectDamageSlice(slice),
  )
}

/**
 * Player-facing, machine-readable closure state for M7 U-02/U-03. It exposes
 * only the next evidence need; no candidate value can cross the formal gate.
 */
export function getBillyFormalEvidenceClosure() {
  const slice = directDamage30SourceLedger.slices.find((item) => item.agentId === 'agent-billy')!
  const gaps = formalDirectDamageFields(slice).map((field) => ({
    id: field.id,
    label: field.label,
    status: field.status,
    sourceUrl: field.sourceUrl,
    continuity: field.continuity,
    nextEvidence: field.note,
  }))
  return {
    gameVersion: slice.gameVersion,
    status: isFormalDirectDamageSlice(slice) ? ('formal' as const) : ('unsupported' as const),
    sliceId: slice.id,
    gaps,
    nextAction:
      '提供同一 3.0 固定敌人/玩法下的游戏内或官方证据包：比利动作倍率与命中、选定音擎基础/被动、敌人 DEF/RES/失衡、固定时长与 Buff 覆盖；随后才可逐字段复核。',
    boundary: 'BWIKI 候选与固定假设不能单独转为 formal，也不会写入任何玩家资产。',
    communityEvidence: {
      formulaEvidenceIds: evidenceForField('damage.direct.skill_multiplier').map(
        (evidence) => evidence.id,
      ),
      historicalFieldEvidenceIds: evidenceForField(
        'agent-billy.combat.standing_fire.damage_multiplier_lv1',
      ).map((evidence) => evidence.id),
      levelSeparatedCrossCheckIds: communityEvidenceCrossChecks
        .filter((crossCheck) =>
          crossCheck.fieldPaths.includes('agent-billy.combat.standing_fire.damage_multiplier_lv1'),
        )
        .map((crossCheck) => crossCheck.id),
      unresolvedConflictIds: [] as string[],
    },
  }
}

export const qqSheetBillyCrossCheck = {
  sourceId: qqSheetArchive.id,
  fields: qqSheetHistoricalBaseline.fields.map((field) => ({
    id: field.id,
    sourcePath: field.sourcePath,
    status: field.status,
    comparison: field.comparison,
  })),
  boundary:
    '历史基线只增加候选交叉与具名冲突；没有 3.0 delta 和同版本 formal 证据时，getBillyFormalEvidenceClosure() 仍为 unsupported。',
} as const
