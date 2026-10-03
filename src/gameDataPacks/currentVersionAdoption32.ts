import { currentScopeManifest } from './currentScopeManifest'
import {
  gameData32CatalogCheckedAt,
  gameData32CatalogEntities,
  gameData32OfficialPhaseTwoUrl,
  gameData32OfficialProgramUrl,
  gameData32UpstreamCommit,
} from './gameData32CatalogEntities'
import { gameData31CurrentCanonical } from './gameData31CurrentCanonical'
import { incremental32AffectedCapabilityIdentity } from './incremental32AffectedCapabilities'
import { incremental32RecoveryPolicy } from './incremental32RecoveryPolicy'
import { createManifest, stableContentHash } from './types'

const adoptionCore = {
  id: 'current-version-adoption-3.2-phase-ii-r1',
  gameVersion: '3.2',
  phase: 'phase_ii',
  lifecycle: 'current',
  packageId: 'game-base-3.2.0-current',
  packageVersion: '3.2.0-current.1',
  previousPackageId: 'game-base-3.1.0-current',
  sourceIdentity: {
    upstreamCommit: gameData32UpstreamCommit,
    deltaIdentity: incremental32AffectedCapabilityIdentity,
    additions: gameData32CatalogEntities.map((entity) => ({
      stableId: entity.id,
      domain: entity.domain,
      sourceId: entity.source.id,
      sourceVersion: entity.source.sourceVersion,
      upstreamPath: entity.fields.upstreamPath,
      rawSha256: entity.fields.upstreamRawSha256,
      releasePhase: entity.fields.releasePhase,
    })),
  },
  scopeIdentity: {
    manifestId: currentScopeManifest.id,
    contentHash: currentScopeManifest.contentHash,
    effectiveAsOf: currentScopeManifest.effectiveAsOf,
    coverage: currentScopeManifest.coverage,
  },
  legacyFieldAuthority: {
    gameVersion: gameData31CurrentCanonical.gameVersion,
    contentHash: gameData31CurrentCanonical.contentHash,
    boundary: gameData31CurrentCanonical.boundary,
  },
  compatibilityRecovery: {
    policyId: incremental32RecoveryPolicy.id,
    disabledCapabilityScope: incremental32RecoveryPolicy.disabledCapabilityScope,
    preservesReleasedIdentities: incremental32RecoveryPolicy.preservesReleasedIdentities,
    preservesAccountAndSavedPlans: incremental32RecoveryPolicy.preservesAccountAndSavedPlans,
    previousResults: incremental32RecoveryPolicy.previousResults,
    capabilityIdentity: incremental32RecoveryPolicy.capabilityIdentity,
  },
  boundary:
    '3.2上下半是当前已采用读取版本；目录、锁定来源与兼容恢复分别绑定。current 不等于全部字段 formal；旧3.1字段、审核和存档保留原版本，精算能力仅按具名已采用模型开放。',
} as const

export const currentVersionAdoption32 = {
  ...adoptionCore,
  contentHash: stableContentHash(adoptionCore),
} as const

/** Installed read-view package. Formal here qualifies the installed package's
 * identity; catalogue coverage cannot promote a combat formula or old review. */
export const gameBase32Current = createManifest({
  id: adoptionCore.packageId,
  kind: 'game-base',
  gameVersion: adoptionCore.gameVersion,
  packageVersion: adoptionCore.packageVersion,
  status: 'formal',
  publishedAt: gameData32CatalogCheckedAt,
  effectiveFrom: `${currentScopeManifest.effectiveAsOf}T00:00:00.000Z`,
  effectiveTo: null,
  sources: [
    {
      label: '3.2 official release scope',
      url: gameData32OfficialProgramUrl,
      checkedAt: gameData32CatalogCheckedAt,
      sourceVersion: '3.2',
      contentHash: null,
      verification: 'official_reference',
    },
    {
      label: '3.2 Phase II official scope',
      url: gameData32OfficialPhaseTwoUrl,
      checkedAt: gameData32CatalogCheckedAt,
      sourceVersion: '3.2',
      contentHash: null,
      verification: 'official_reference',
    },
    ...gameData32CatalogEntities.map((entity) => ({
      label: entity.source.id,
      url: entity.source.url,
      checkedAt: entity.source.checkedAt,
      sourceVersion: entity.source.sourceVersion,
      contentHash: entity.source.contentHash,
      verification: 'community_reference' as const,
    })),
    {
      label: adoptionCore.id,
      url: `https://github.com/frzyc/genshin-optimizer/tree/${gameData32UpstreamCommit}/libs/zzz`,
      checkedAt: gameData32CatalogCheckedAt,
      sourceVersion: '3.2',
      contentHash: currentVersionAdoption32.contentHash,
      verification: 'derived_reference',
    },
  ],
  coverage: currentScopeManifest.entries.map((entry) => {
    const addition = gameData32CatalogEntities.find((entity) => entity.id === entry.stableId)
    return {
      stableId: entry.stableId,
      displayName: entry.displayName,
      status: 'covered' as const,
      note: `目录身份 ${entry.evidence}；发布状态 ${entry.releaseState}，不晋升旧字段或战斗审核。`,
      sourceUrl:
        addition?.source.url ??
        (/^https?:\/\//.test(entry.sourceId) ? entry.sourceId : gameData32OfficialProgramUrl),
      sourceVersion: entry.sourceVersion,
      sourceCheckedAt: addition?.source.checkedAt ?? gameData32CatalogCheckedAt,
      sourceContentHash: addition?.source.contentHash ?? currentScopeManifest.contentHash,
      entityType: entry.domain,
      rarity: null,
      classification: `catalogue_identity:${entry.evidence}`,
      calculationEligibility: 'quality_only' as const,
      releaseAt: entry.releaseAt ? `${entry.releaseAt}T00:00:00.000Z` : null,
      releaseSourceVersion: entry.sourceVersion,
    }
  }),
  missing: [],
  changesFromPreviousFormal: [
    `采用 ${currentScopeManifest.id}#${currentScopeManifest.contentHash}；目录数量由该目录推导。`,
    `新增 ${gameData32CatalogEntities.length} 个目录身份，来源锁定 ${gameData32UpstreamCommit}。`,
    `采用身份 ${currentVersionAdoption32.id}#${currentVersionAdoption32.contentHash}；不重写3.1字段级canonical。`,
  ],
  migrationNotes: [
    currentVersionAdoption32.boundary,
    `恢复引用 ${adoptionCore.compatibilityRecovery.policyId}；${adoptionCore.compatibilityRecovery.previousResults}，保留账户、已发布身份与保存方案。`,
    `来源增量 ${incremental32AffectedCapabilityIdentity.deltaSha256}；旧包 ${adoptionCore.previousPackageId} 仅保留历史，不提供仅切数据的安全代码回退。兼容恢复须通过完整 VITE_SODA_INCREMENTAL32_RECOVERY 发行切换代码、数据与Worker。`,
  ],
  rollbackTo: null,
})
