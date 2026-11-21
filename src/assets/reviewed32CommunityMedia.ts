import reviewedUrls from './reviewed32-media-urls.json'
import type { VisualAsset } from './visualAssetSchemas'

export function isReviewed32CommunityMedia(
  asset: Pick<VisualAsset, 'entityId' | 'sourceType' | 'remoteUrl' | 'variant'>,
) {
  return (
    asset.sourceType === 'community' &&
    asset.remoteUrl !== null &&
    (reviewedUrls[asset.entityId as keyof typeof reviewedUrls] === asset.remoteUrl ||
      (asset.variant === 'square_avatar' &&
        reviewedUrls[`${asset.entityId}-square` as keyof typeof reviewedUrls] === asset.remoteUrl))
  )
}
