import type { VisualAsset, VisualAssetEntityType } from './visualAssets'

const assetKey = (entityType: VisualAssetEntityType, entityId: string, variant?: string) =>
  `${entityType}:${entityId}:${variant ?? ''}`

const defaultVariants: Partial<Record<VisualAssetEntityType, readonly string[]>> = {
  agent: ['square_avatar', 'portrait'],
  bangboo: ['icon'],
  drive_disc_set: ['set_icon'],
  wengine: ['catalog_icon'],
}

export function createVisualAssetIndex(assets: readonly VisualAsset[]) {
  const index = new Map(
    assets.map(
      (asset) => [assetKey(asset.entityType, asset.entityId, asset.variant), asset] as const,
    ),
  )
  for (const asset of assets) {
    const defaultKey = assetKey(asset.entityType, asset.entityId)
    const priorities = defaultVariants[asset.entityType]
    const current = index.get(defaultKey)
    const currentPriority = current ? (priorities?.indexOf(current.variant) ?? -1) : -1
    const nextPriority = priorities?.indexOf(asset.variant) ?? -1
    if (
      !current ||
      (nextPriority >= 0 && (currentPriority < 0 || nextPriority < currentPriority))
    ) {
      index.set(defaultKey, asset)
    }
  }
  return index
}

/** Same default-variant precedence as the index, without building the whole map. */
export function resolveDefaultVisualAsset(
  assets: readonly VisualAsset[],
  entityType: VisualAssetEntityType,
  entityId: string,
) {
  const priorities = defaultVariants[entityType]
  let best: VisualAsset | null = null
  let bestPriority = -1
  for (const asset of assets) {
    if (asset.entityType !== entityType || asset.entityId !== entityId) continue
    const priority = priorities?.indexOf(asset.variant) ?? -1
    if (!best || (priority >= 0 && (bestPriority < 0 || priority < bestPriority))) {
      best = asset
      bestPriority = priority
    }
  }
  return best
}

/** Only verified official assets under the explicit personal-cache policy may be cached. */
export function isOfficialCacheableAsset(asset: VisualAsset | null) {
  return Boolean(
    asset &&
    asset.status === 'verified' &&
    asset.sourceType === 'official' &&
    asset.cachePolicy === 'explicit-personal-cache' &&
    asset.remoteUrl,
  )
}
