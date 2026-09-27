import type { VisualAssetEntityType } from './visualAssets'
import type { VisualAssetConsumer, VisualAssetSlotId } from './visualAssetSlots'

/**
 * Dependency-free presentation contract shared by the desktop image pipeline and the public
 * placeholder path. It carries no catalog, cache or media data.
 */
export type VisualEntityImageRequest = {
  entityType: VisualAssetEntityType
  entityId: string
  variant?: string
  fallbackVariants?: string[]
  cacheVersion?: string | null
  slotId?: VisualAssetSlotId
  consumer?: VisualAssetConsumer
}

/**
 * Coordinates a detail-panel selection with its visual. Each new intent wins; an older
 * cache/decode result can never commit an out-of-date detail record.
 */
export function createLatestVisualSelection(
  preload: (request: VisualEntityImageRequest) => Promise<string | null>,
) {
  let latestSelection = 0
  return async (request: VisualEntityImageRequest, commit: () => void) => {
    const selection = ++latestSelection
    await preload(request)
    if (selection === latestSelection) commit()
  }
}
