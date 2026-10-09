import { getVisualAsset, resolveCachedVisualAsset, type VisualAsset } from './visualAssets'
import { resolveVisualAssetSlot, type VisualAssetSlotSpec } from './visualAssetSlots'
import {
  createLatestVisualSelection as createLatestSelection,
  type VisualEntityImageRequest,
} from './visualSelectionQueue'

export type { VisualEntityImageRequest }

// A catalog image can appear in dozens of candidate slots at once. Cache its
// verified blob URL for the browser session so one card unmounting cannot
// revoke the URL another visible card is still painting.
export const sessionVisualSources = new Map<string, string>()
const pendingVisualSources = new Map<string, Promise<string | null>>()
let sourceGeneration = 0

/** Cache replacement/removal invalidates both decoded URLs and in-flight reads. */
export function invalidateSessionVisualSources() {
  sourceGeneration += 1
  pendingVisualSources.clear()
  for (const source of sessionVisualSources.values()) URL.revokeObjectURL(source)
  sessionVisualSources.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('soda-visual-assets-ready', invalidateSessionVisualSources)
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('soda-visual-assets-ready', invalidateSessionVisualSources)
    invalidateSessionVisualSources()
  })
}

export function visualSourceKey(asset: VisualAsset) {
  return `${asset.remoteUrl ?? ''}:${asset.contentHash}`
}

async function decodeVisualSource(source: string) {
  if (typeof Image === 'undefined') return source
  const image = new Image()
  image.src = source
  if (typeof image.decode !== 'function') return source
  await image.decode()
  return source
}

export async function resolveSessionVisualSource(asset: VisualAsset) {
  if (!asset.remoteUrl) return null
  const key = visualSourceKey(asset)
  const existing = sessionVisualSources.get(key)
  if (existing) return existing
  const pending = pendingVisualSources.get(key)
  if (pending) return pending

  const generation = sourceGeneration
  let allocatedUrl: string | null = null
  const resolution = resolveCachedVisualAsset(asset, decodeVisualSource)
    .then(async (objectUrl) => {
      if (!objectUrl) return null
      allocatedUrl = objectUrl
      if (generation !== sourceGeneration) {
        URL.revokeObjectURL(objectUrl)
        return null
      }
      sessionVisualSources.set(key, objectUrl)
      return objectUrl
    })
    .catch(() => {
      if (allocatedUrl) URL.revokeObjectURL(allocatedUrl)
      return null
    })
  pendingVisualSources.set(key, resolution)
  try {
    return await resolution
  } finally {
    if (pendingVisualSources.get(key) === resolution) pendingVisualSources.delete(key)
  }
}

export function resolveVisualEntityImageAsset({
  entityType,
  entityId,
  variant,
  fallbackVariants = [],
  slotId,
  consumer,
}: VisualEntityImageRequest): {
  asset: VisualAsset | null
  slot: VisualAssetSlotSpec | null
  bundledSource: string | null
} {
  if ((slotId && !consumer) || (!slotId && consumer)) {
    throw new Error('visual_asset_slot_requires_slot_and_consumer')
  }
  const slot = slotId && consumer ? resolveVisualAssetSlot(slotId, consumer) : null
  if (slot && slot.entityType !== entityType) {
    throw new Error(`visual_asset_slot_entity_mismatch:${slot.slotId}:${entityType}`)
  }
  const requestedVariant = slot?.variant ?? variant
  const requestedFallbackVariants = slot?.fallbackVariants ?? fallbackVariants
  const asset =
    getVisualAsset(entityType, entityId, requestedVariant) ??
    requestedFallbackVariants
      .map((fallbackVariant) => getVisualAsset(entityType, entityId, fallbackVariant))
      .find(Boolean) ??
    null
  // Every consumer shares the verified catalog cache; historical audit images
  // must not silently replace a catalog asset or enter the public bundle.
  return {
    asset,
    slot,
    bundledSource: null,
  }
}

/**
 * Resolve an image before its consumer is shown. This deliberately uses the
 * same session/pending maps as VisualEntityImage, so a detail panel mounting
 * after a click reuses the already verified object URL instead of opening a
 * second cache/blob/decode chain.
 */
export function preloadVisualEntityImage(request: VisualEntityImageRequest) {
  const { asset, bundledSource } = resolveVisualEntityImageAsset(request)
  if (!asset) return Promise.resolve(null)
  if (bundledSource) return Promise.resolve(bundledSource)
  return resolveSessionVisualSource(asset)
}

export function preloadVisualEntityImages(requests: readonly VisualEntityImageRequest[]) {
  return Promise.all(requests.map((request) => preloadVisualEntityImage(request)))
}

/** Latest-intent-wins selection shared with the public build. */
export function createLatestVisualSelection(
  preload: (request: VisualEntityImageRequest) => Promise<string | null> = preloadVisualEntityImage,
) {
  return createLatestSelection(preload)
}
