import { getVisualAsset, visualAssetManifest } from '../assets/visualAssets'
import { agentCatalog, bangbooCatalog } from '../assault/catalogData'
import wEngineCatalog from '../assault/data/wEngineCatalog.3.0.json'
import { driveDiscData } from '../data/gameData'
import { stableContentHash, type GameDataPackageManifest } from './types'
import sourceLedger from './assetSourceLedger.v1.json'

type LedgerEntityType = 'agent' | 'wengine' | 'bangboo' | 'drive_disc_set'
type CoverageEntry = GameDataPackageManifest['coverage'][number]
type SourceRecord = (typeof sourceLedger.records)[number]

export type CatalogLedger = {
  gameVersion: '3.0' | '3.1'
  sourceVersion: string
  entries: CoverageEntry[]
  missing: CoverageEntry[]
  contentHash: string
}

function officialEntry(
  entityType: LedgerEntityType,
  stableId: string,
  displayName: string,
  rarity: 'S' | 'A' | 'B' | null,
  classification: string,
): CoverageEntry | null {
  const release = sourceLedger.records.find(
    (record) =>
      record.stableId === stableId &&
      record.entityType === entityType &&
      record.displayName === displayName,
  )
  // Catalog eligibility is a data-evidence decision, not a UI presentation
  // decision. Agent cards use community square avatars, while their formal
  // identity evidence remains the official full-body record.
  const asset = getVisualAsset(
    entityType,
    stableId,
    entityType === 'agent' ? 'full_body' : undefined,
  )
  if (
    !asset ||
    asset.status !== 'verified' ||
    asset.sourceType !== 'official' ||
    asset.cachePolicy !== 'explicit-personal-cache' ||
    asset.name !== displayName ||
    !release ||
    (!release.releaseAt && !release.releaseVersion)
  ) {
    return null
  }
  return {
    stableId,
    displayName,
    status: 'covered',
    note: '稳定 ID、中文显示名由官方个人缓存目录核对；上线日期或版本键由可追溯来源账本提供，仅用于目录排序。',
    sourceUrl: release.sourceUrl,
    sourceVersion: release.releaseVersion,
    sourceCheckedAt: sourceLedger.generatedAt,
    sourceContentHash: release.sourceContentHash,
    entityType,
    rarity,
    classification,
    calculationEligibility: 'included',
    releaseAt: release.releaseAt,
    releaseSourceVersion: release.releaseVersion,
  }
}

const releasedAgents = agentCatalog.filter((item) => item[7] === 'released')
const discs = driveDiscData?.driveDiscSets ?? []

const entries = [
  ...releasedAgents.flatMap(([id, name, specialty, , rarity, attribute]) => {
    const item = officialEntry(
      'agent',
      id,
      name,
      rarity as 'S' | 'A' | 'B',
      `${specialty} / ${attribute}`,
    )
    return item ? [item] : []
  }),
  ...bangbooCatalog.flatMap(([id, name, , rarity]) => {
    const item = officialEntry('bangboo', id, name, rarity as 'S' | 'A' | 'B', '邦布')
    return item ? [item] : []
  }),
  ...wEngineCatalog.items.flatMap((item) => {
    const entry = officialEntry(
      'wengine',
      item.id,
      item.name,
      item.rarity as 'S' | 'A' | 'B',
      item.specialty,
    )
    return entry ? [entry] : []
  }),
  ...discs.flatMap((item) => {
    const entry = officialEntry('drive_disc_set', item.id, item.name, null, '驱动盘套装')
    return entry ? [entry] : []
  }),
]

const missingReleaseDates: CoverageEntry[] = []

const missingOfficialWEngines = wEngineCatalog.items
  .filter((item) => !entries.some((entry) => entry.stableId === item.id))
  .map<CoverageEntry>((item) => ({
    stableId: item.id,
    displayName: item.name,
    status: 'missing',
    note: '当前官方图鉴缓存账本没有可核验的对应条目；不进入 3.0 正式可用音擎目录。',
    sourceUrl: null,
    sourceVersion: null,
    sourceCheckedAt: null,
    sourceContentHash: null,
    entityType: 'wengine',
    rarity: item.rarity as 'S' | 'A' | 'B',
    classification: item.specialty,
    calculationEligibility: 'excluded',
    releaseAt: null,
    releaseSourceVersion: null,
  }))

const normaSource = sourceLedger.records.find(
  (record): record is SourceRecord => record.stableId === 'agent-norma',
)

const namedCatalogFacts: CoverageEntry[] =
  normaSource && !entries.some((entry) => entry.stableId === normaSource.stableId)
    ? [
        {
          stableId: normaSource.stableId,
          displayName: normaSource.displayName,
          status: 'covered',
          note: '官方 3.0 内容公告核对目录身份与上线事实；排序账本保留来源页面和最小内容哈希。',
          sourceUrl: normaSource.sourceUrl,
          sourceVersion: normaSource.releaseVersion,
          sourceCheckedAt: sourceLedger.generatedAt,
          sourceContentHash: normaSource.sourceContentHash,
          entityType: 'agent',
          rarity: 'S',
          classification: 'stun / fire',
          calculationEligibility: 'included',
          releaseAt: normaSource.releaseAt,
          releaseSourceVersion: normaSource.releaseVersion,
        },
      ]
    : []

const namedReleaseDateGaps = namedCatalogFacts
  .filter((entry) => !entry.releaseAt)
  .map((entry) => ({
    ...entry,
    stableId: `release-at:${entry.stableId}`,
    status: 'missing' as const,
    note: '目录身份可核验，但当前来源账本没有该条目的可核验上线日期；同稀有度只能保持稳定源序。',
    calculationEligibility: 'quality_only' as const,
  }))

const core = {
  gameVersion: '3.0' as const,
  sourceVersion: `${visualAssetManifest.packVersion}+asset-source-ledger.v${sourceLedger.schemaVersion}`,
  entries: [...entries, ...namedCatalogFacts],
  missing: [...missingReleaseDates, ...namedReleaseDateGaps, ...missingOfficialWEngines],
}

export const gameBase30CatalogLedger: CatalogLedger = {
  ...core,
  contentHash: stableContentHash(core),
}

export const gameBase30CatalogSummary = {
  agents: [...entries, ...namedCatalogFacts].filter((entry) => entry.entityType === 'agent').length,
  bangboos: entries.filter((entry) => entry.entityType === 'bangboo').length,
  wEngines: entries.filter((entry) => entry.entityType === 'wengine').length,
  driveDiscSets: entries.filter((entry) => entry.entityType === 'drive_disc_set').length,
  missingReleaseDates: missingReleaseDates.length + namedReleaseDateGaps.length,
  missingOfficialWEngines: missingOfficialWEngines.length,
}

const remielleRelease = sourceLedger.records.find(
  (record) => record.stableId === 'agent-remielle' && record.entityType === 'agent',
)

if (!remielleRelease)
  throw new Error('3.1 current released catalog is missing the agent-remielle source record')

const remielleCurrentEntry: CoverageEntry = {
  stableId: 'agent-remielle',
  displayName: '蕾米埃尔·丹',
  status: 'covered',
  note: '官方 3.1 上线公告闭合发布身份；项目稳定 ID 与旧 candidate-3.1 身份以显式 alias 衔接，战斗字段不随目录升格。',
  sourceUrl: remielleRelease.sourceUrl,
  sourceVersion: remielleRelease.releaseVersion,
  sourceCheckedAt: sourceLedger.generatedAt,
  sourceContentHash: remielleRelease.sourceContentHash,
  entityType: 'agent',
  rarity: 'S',
  classification: 'anomaly / lumiflux',
  calculationEligibility: 'included',
  releaseAt: remielleRelease.releaseAt,
  releaseSourceVersion: remielleRelease.releaseVersion,
}

const current31Core = {
  gameVersion: '3.1' as const,
  sourceVersion: `${gameBase30CatalogLedger.sourceVersion}+official-3.1-phase-i-release-r89`,
  entries: [...gameBase30CatalogLedger.entries, remielleCurrentEntry],
  missing: gameBase30CatalogLedger.missing,
}

/**
 * Formal compatibility directory through 3.1 phase I. Phase II released identities are
 * supplied by currentReleasedIdentityMap/current scope and retain candidate field status
 * until their own source-ledger rows exist.
 */
export const gameCurrent31CatalogLedger: CatalogLedger = {
  ...current31Core,
  contentHash: stableContentHash(current31Core),
}

export const gameCurrent31CatalogSummary = {
  agents: gameCurrent31CatalogLedger.entries.filter((entry) => entry.entityType === 'agent').length,
  bangboos: gameCurrent31CatalogLedger.entries.filter((entry) => entry.entityType === 'bangboo')
    .length,
  wEngines: gameCurrent31CatalogLedger.entries.filter((entry) => entry.entityType === 'wengine')
    .length,
  driveDiscSets: gameCurrent31CatalogLedger.entries.filter(
    (entry) => entry.entityType === 'drive_disc_set',
  ).length,
  total: gameCurrent31CatalogLedger.entries.length,
}
