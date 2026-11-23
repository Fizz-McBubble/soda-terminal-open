import { currentScopeManifest33 } from './currentScopeManifest'
import { currentVersionAdoption32, gameBase32Current } from './currentVersionAdoption32'
import {
  gameData33CatalogCheckedAt,
  gameData33CatalogEntities,
  gameData33OfficialPhaseOneUrl,
  gameData33OfficialPhaseTwoMirrorUrl,
  gameData33OfficialPhaseTwoUrl,
  gameData33OfficialUpdateUrl,
  gameData33ProviderManifestSha256,
  gameData33SourceDeltaSha256,
  gameData33SourceIdentities,
} from './gameData33CatalogEntities'
import { incremental33RecoveryPolicy } from './incremental33RecoveryPolicy'
import { createManifest, stableContentHash } from './types'

const adoptionCore = {
  id: 'current-version-adoption-3.3-phase-ii-r1',
  gameVersion: '3.3',
  phase: 'phase_ii',
  lifecycle: 'current',
  packageId: 'game-base-3.3.0-current',
  packageVersion: '3.3.0-current.3',
  previousPackageId: gameBase32Current.id,
  previousPackageContentHash: gameBase32Current.contentHash,
  sourceIdentity: {
    provider: 'nanoka',
    providerManifestSha256: gameData33ProviderManifestSha256,
    deltaSha256: gameData33SourceDeltaSha256,
    additions: gameData33CatalogEntities.map((entity) => ({
      stableId: entity.id,
      domain: entity.domain,
      sourceId: entity.source.id,
      sourceVersion: entity.source.sourceVersion,
      sourceUrl: entity.source.url,
      rawSha256: entity.source.contentHash,
    })),
    scheduledNotAdopted: gameData33SourceIdentities.filter(
      ({ releaseState }: { releaseState: string }) => releaseState === 'scheduled',
    ),
  },
  scopeIdentity: {
    manifestId: currentScopeManifest33.id,
    contentHash: currentScopeManifest33.contentHash,
    effectiveAsOf: currentScopeManifest33.effectiveAsOf,
    coverage: currentScopeManifest33.coverage,
  },
  legacyFieldAuthority: currentVersionAdoption32.legacyFieldAuthority,
  compatibilityRecovery: {
    policyId: incremental33RecoveryPolicy.id,
    disabledCapabilityScope: incremental33RecoveryPolicy.disabledCapabilityScope,
    preservesReleasedIdentities: incremental33RecoveryPolicy.preservesReleasedIdentities,
    preservesAccountAndSavedPlans: incremental33RecoveryPolicy.preservesAccountAndSavedPlans,
    previousResults: incremental33RecoveryPolicy.previousResults,
    capabilityIdentity: incremental33RecoveryPolicy.capabilityIdentity,
  },
  boundary:
    '截至2026-11-11T12:00:00+08:00，3.3下半正式采用赛维里安与禁罪囚笼，并保留上半菲欧妮、涅槃初翎及活动音擎烛光诡计；复刻诺姆与首席跟班沿既有已发布身份不重复新增；旧3.1/3.2字段、哈希与审核保留原来源。current与formal包身份不晋升字段、战斗事件、Import、精确伤害或媒体许可。',
} as const

export const currentVersionAdoption33 = {
  ...adoptionCore,
  contentHash: stableContentHash(adoptionCore),
} as const

export const gameBase33Current = createManifest({
  id: adoptionCore.packageId,
  kind: 'game-base',
  gameVersion: adoptionCore.gameVersion,
  packageVersion: adoptionCore.packageVersion,
  status: 'formal',
  publishedAt: gameData33CatalogCheckedAt,
  effectiveFrom: currentScopeManifest33.effectiveAsOf,
  effectiveTo: null,
  sources: [
    ...gameBase32Current.sources,
    ...[
      gameData33OfficialUpdateUrl,
      gameData33OfficialPhaseOneUrl,
      gameData33OfficialPhaseTwoUrl,
      gameData33OfficialPhaseTwoMirrorUrl,
    ].map((url) => ({
      label:
        url === gameData33OfficialUpdateUrl
          ? '3.3 official release scope'
          : url === gameData33OfficialPhaseOneUrl
            ? '3.3 Phase I official scope'
            : '3.3 Phase II official scope',
      url,
      checkedAt:
        url === gameData33OfficialPhaseTwoUrl || url === gameData33OfficialPhaseTwoMirrorUrl
          ? currentScopeManifest33.effectiveAsOf
          : gameData33CatalogCheckedAt,
      sourceVersion: '3.3',
      contentHash: null,
      verification: 'official_reference' as const,
    })),
    ...gameData33CatalogEntities.map((entity) => ({
      label: entity.source.id,
      url: entity.source.url,
      checkedAt: entity.source.checkedAt,
      sourceVersion: entity.source.sourceVersion,
      contentHash: entity.source.contentHash,
      verification: 'community_reference' as const,
    })),
  ],
  coverage: currentScopeManifest33.entries.map((entry) => {
    const inherited = gameBase32Current.coverage.find((item) => item.stableId === entry.stableId)
    if (inherited) return inherited
    const addition = gameData33CatalogEntities.find((entity) => entity.id === entry.stableId)
    if (!addition) throw new Error(`3.3 adopted scope has no field source: ${entry.stableId}`)
    return {
      stableId: entry.stableId,
      displayName: entry.displayName,
      status: 'covered' as const,
      note: `目录身份 ${entry.identityEvidence}；数值字段 ${entry.evidence}，不晋升战斗审核。`,
      sourceUrl: addition.source.url,
      sourceVersion: addition.source.sourceVersion,
      sourceCheckedAt: addition.source.checkedAt,
      sourceContentHash: addition.source.contentHash,
      entityType: entry.domain,
      rarity: 'S' as const,
      classification: `catalogue_identity:${entry.evidence}`,
      calculationEligibility: 'quality_only' as const,
      releaseAt: entry.releaseAt
        ? new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(entry.releaseAt)
              ? `${entry.releaseAt}T00:00:00+08:00`
              : entry.releaseAt,
          ).toISOString()
        : null,
      releaseSourceVersion: entry.sourceVersion,
    }
  }),
  missing: [],
  changesFromPreviousFormal: [
    `采用 ${currentScopeManifest33.id}#${currentScopeManifest33.contentHash}；保留原60代理人、100音擎、30盘套与41生产邦布，新增菲欧妮、赛维里安、涅槃初翎、禁罪囚笼与烛光诡计。`,
    `采用 ${currentVersionAdoption33.id}#${currentVersionAdoption33.contentHash}；Nanoka provider ${gameData33ProviderManifestSha256}。`,
  ],
  migrationNotes: [
    currentVersionAdoption33.boundary,
    `旧包 ${gameBase32Current.id}#${gameBase32Current.contentHash} 保留历史；账户与保存方案守恒，旧结果须重新分析。`,
    '兼容恢复需完整代码、数据及Worker一起切换 VITE_SODA_INCREMENTAL33_RECOVERY；只切换历史数据包不能证明代码回退安全。',
  ],
  rollbackTo: null,
})
