import type { VisualAsset, VisualAssetEntityType, VisualAssetPackState } from './visualAssets'

export function getVisualAssetCoverage(
  assets: readonly VisualAsset[],
  entityTypes: readonly VisualAssetEntityType[],
) {
  const identities = new Map<VisualAssetEntityType, Set<string>>(
    entityTypes.map((entityType) => [entityType, new Set()]),
  )
  assets.forEach((asset) => identities.get(asset.entityType)?.add(asset.entityId))
  return Object.fromEntries(
    [...identities].map(([entityType, entityIds]) => [entityType, entityIds.size]),
  ) as Record<VisualAssetEntityType, number>
}

export const officialCatalogEntityTypes = [
  'agent',
  'bangboo',
  'drive_disc_set',
  'wengine',
  'illustration',
] as const

export function isCatalogVisualAsset(asset: VisualAsset) {
  if (asset.entityType === 'agent')
    return asset.variant === 'square_avatar' || asset.variant === 'full_body'
  if (asset.entityType === 'illustration')
    return /^(attribute|specialty)-/.test(asset.entityId) && asset.variant === 'icon'
  return (
    asset.entityType === 'bangboo' ||
    asset.entityType === 'drive_disc_set' ||
    asset.entityType === 'wengine'
  )
}

export function getOfficialCatalogAssets(assets: readonly VisualAsset[]) {
  return assets.filter(
    (asset) =>
      asset.status === 'verified' &&
      asset.cachePolicy === 'explicit-personal-cache' &&
      isCatalogVisualAsset(asset),
  )
}

export function getOfficialAgentFullBodyAssets(assets: readonly VisualAsset[]) {
  return assets.filter(
    (asset) =>
      asset.entityType === 'agent' &&
      asset.variant === 'full_body' &&
      asset.sourceType === 'official' &&
      asset.cachePolicy === 'explicit-personal-cache',
  )
}

export function isOfficialCatalogPackReady(state: VisualAssetPackState, packVersion: string) {
  return (
    state.packVersion === packVersion &&
    state.catalogProfile === 'r6-purpose-variants-v2' &&
    Boolean(state.activeCache) &&
    officialCatalogEntityTypes.every((entityType) => Boolean(state.activeCaches?.[entityType]))
  )
}
