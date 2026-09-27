import { createManifest, type GameDataPackageManifest } from './types'
import { gameBase30CatalogLedger, gameBase30CatalogSummary } from './catalogLedger'
import { buildKnowledge30Coverage, buildKnowledge30Profiles } from './buildKnowledge'
import {
  gameData31CurrentCanonical,
  gameData31CurrentFields,
  gameData31CurrentSources,
} from './gameData31CurrentCanonical'

const officialSite = 'https://zenless.hoyoverse.com/'
const officialCharacter = 'https://zenless.hoyoverse.com/zh-cn/character?catchSpider=1&id=154605'
const checkedAt = '2026-07-27T00:00:00.000Z'

const officialSources = [
  {
    label: '绝区零官方网站',
    url: officialSite,
    checkedAt,
    sourceVersion: '3.0',
    contentHash: gameBase30CatalogLedger.contentHash,
    verification: 'official_verified' as const,
  },
  {
    label: '绝区零官方角色页',
    url: officialCharacter,
    checkedAt,
    sourceVersion: '3.0',
    contentHash: gameBase30CatalogLedger.contentHash,
    verification: 'official_reference' as const,
  },
]

/**
 * The local official catalogue cache proves the calculation-eligible 3.0 directory. Missing
 * release dates remain sorting-quality gaps; a source-missing entry is explicitly excluded from
 * dependent calculations rather than making unrelated verified entries unusable.
 */
export const gameBase30Formal = createManifest({
  id: 'game-base-3.0.1',
  kind: 'game-base',
  gameVersion: '3.0',
  packageVersion: '3.0.1',
  status: 'formal',
  publishedAt: checkedAt,
  effectiveFrom: checkedAt,
  effectiveTo: null,
  sources: officialSources,
  coverage: gameBase30CatalogLedger.entries,
  missing: gameBase30CatalogLedger.missing,
  changesFromPreviousFormal: [
    `核对官方图鉴目录：代理人 ${gameBase30CatalogSummary.agents}、邦布 ${gameBase30CatalogSummary.bangboos}、音擎 ${gameBase30CatalogSummary.wEngines}、驱动盘套装 ${gameBase30CatalogSummary.driveDiscSets}。`,
  ],
  migrationNotes: [
    `缺少 ${gameBase30CatalogSummary.missingReleaseDates} 条逐项官方上线日期时保持稳定源序；${gameBase30CatalogSummary.missingOfficialWEngines} 条来源缺口已隔离，不迁移或重写玩家资产。`,
  ],
  rollbackTo: null,
})

export const gameBase31Current = createManifest({
  id: 'game-base-3.1.0-current',
  kind: 'game-base',
  gameVersion: '3.1',
  packageVersion: '3.1.0-current.1',
  status: 'formal',
  publishedAt: '2026-07-29T00:00:00.000Z',
  effectiveFrom: '2026-07-29T00:00:00.000Z',
  effectiveTo: null,
  sources: gameData31CurrentSources
    .filter((source) => source.evidenceStrength === 'formal')
    .map((source) => ({
      label: source.id,
      url: source.url,
      checkedAt: source.checkedAt,
      sourceVersion: source.sourceVersion ?? '3.1',
      contentHash: source.contentIdentity,
      verification: 'official_verified' as const,
    })),
  coverage: gameData31CurrentFields
    .filter((field) => field.status !== 'missing')
    .map((field) => ({
      stableId: field.id,
      displayName: field.fieldPath,
      status: 'covered' as const,
      note: `${field.status} · ${field.currentApplicability}：${field.note}`,
      sourceUrl:
        gameData31CurrentSources.find((source) => source.id === field.sourceRefs[0])?.url ?? null,
      sourceVersion: field.originalSourceVersion,
      sourceCheckedAt: checkedAt,
      sourceContentHash: gameData31CurrentCanonical.contentHash,
      entityType: null,
      rarity: null,
      classification: `字段强度：${field.status}`,
      calculationEligibility:
        field.status === 'formal' ? ('quality_only' as const) : ('excluded' as const),
      releaseAt: null,
      releaseSourceVersion: null,
    })),
  missing: gameData31CurrentFields
    .filter((field) => field.status === 'missing')
    .map((field) => ({
      stableId: field.id,
      displayName: field.fieldPath,
      status: 'missing' as const,
      note: field.note,
      sourceUrl:
        gameData31CurrentSources.find((source) => source.id === field.sourceRefs[0])?.url ?? null,
      sourceVersion: field.originalSourceVersion,
      sourceCheckedAt: checkedAt,
      sourceContentHash: gameData31CurrentCanonical.contentHash,
      entityType: null,
      rarity: null,
      classification: `字段适用：${field.currentApplicability}`,
      calculationEligibility: 'excluded' as const,
      releaseAt: null,
      releaseSourceVersion: null,
    })),
  changesFromPreviousFormal: [
    '3.1 已切换为 current 读取视图；新增、变化、连续沿用、overlay 与冲突按字段记录。',
  ],
  migrationNotes: [
    'current 仅表示当前版本；candidate/missing 不自动转 formal，3.0 保留为回滚快照。',
  ],
  rollbackTo: gameBase30Formal.id,
})

/** @deprecated The installed 3.1 package is current; field strength is tracked per field. */
export const gameBase31Candidate = gameBase31Current

function supportingFormalPack(
  kind: 'build-knowledge' | 'rotation' | 'visual-catalog',
  displayName: string,
  note: string,
  participatesInCalculation: boolean,
) {
  return createManifest({
    id: `${kind}-3.0.0`,
    kind,
    gameVersion: '3.0',
    packageVersion: '3.0.0',
    status: 'formal',
    publishedAt: checkedAt,
    effectiveFrom: checkedAt,
    effectiveTo: null,
    sources: officialSources,
    coverage: [
      {
        stableId: `${kind}-3.0-coverage`,
        displayName,
        status: 'covered',
        note,
        sourceUrl: officialSite,
        sourceVersion: '3.0',
        sourceCheckedAt: checkedAt,
        sourceContentHash: gameBase30CatalogLedger.contentHash,
        entityType: null,
        rarity: null,
        classification: null,
        calculationEligibility: participatesInCalculation ? 'included' : 'excluded',
        releaseAt: null,
        releaseSourceVersion: null,
      },
    ],
    missing: [],
    changesFromPreviousFormal: ['建立 3.0 首个正式基线。'],
    migrationNotes: [
      participatesInCalculation
        ? '仅在对应资料与场景适用时参与计算。'
        : '不参与玩家资产事实或正式计算。',
    ],
    rollbackTo: null,
  })
}

export const buildKnowledge30Formal = createManifest({
  id: 'build-knowledge-3.0.1',
  kind: 'build-knowledge',
  gameVersion: '3.0',
  packageVersion: '3.0.1',
  status: 'formal',
  publishedAt: checkedAt,
  effectiveFrom: checkedAt,
  effectiveTo: null,
  sources: officialSources,
  coverage: buildKnowledge30Profiles.map((profile) => ({
    stableId: profile.id,
    displayName: profile.agentName,
    status: profile.status === 'missing' ? ('missing' as const) : ('covered' as const),
    note:
      profile.status === 'formal'
        ? '构筑候选、版本、来源与适用前提已核验，可向正式计算提供约束。'
        : profile.gaps.join('；'),
    sourceUrl: profile.sources[0]?.url ?? null,
    sourceVersion: profile.gameVersion,
    sourceCheckedAt: profile.updatedAt,
    sourceContentHash: profile.contentHash,
    entityType: 'agent' as const,
    rarity: null,
    classification: profile.role,
    calculationEligibility:
      profile.status === 'formal' ? ('included' as const) : ('excluded' as const),
    releaseAt: null,
    releaseSourceVersion: null,
  })),
  missing: buildKnowledge30Profiles
    .filter((profile) => profile.status !== 'formal')
    .map((profile) => ({
      stableId: `${profile.id}-gap`,
      displayName: profile.agentName,
      status: 'missing' as const,
      note: profile.gaps.join('；'),
      sourceUrl: profile.sources[0]?.url ?? null,
      sourceVersion: profile.gameVersion,
      sourceCheckedAt: profile.updatedAt,
      sourceContentHash: profile.contentHash,
      entityType: 'agent' as const,
      rarity: null,
      classification: profile.role,
      calculationEligibility: 'excluded' as const,
      releaseAt: null,
      releaseSourceVersion: null,
    })),
  changesFromPreviousFormal: [
    `建立56名代理人的3.0覆盖矩阵；其中${buildKnowledge30Coverage.formal}名资料可参与正式计算。`,
  ],
  migrationNotes: ['候选和缺口资料只可浏览，不能替换正式计算约束或写入玩家资产。'],
  rollbackTo: null,
})
export const rotation30Formal = supportingFormalPack(
  'rotation',
  '当前玩法轮换约束',
  '当前包仅在对应玩法场景计算时参与。',
  true,
)
export const visualCatalog30Formal = supportingFormalPack(
  'visual-catalog',
  '官方图鉴素材清单',
  '只管理来源、校验与本机缓存策略，不影响资产事实。',
  false,
)

export const bundledGameDataPacks: GameDataPackageManifest[] = [
  gameBase30Formal,
  gameBase31Current,
  buildKnowledge30Formal,
  rotation30Formal,
  visualCatalog30Formal,
]
