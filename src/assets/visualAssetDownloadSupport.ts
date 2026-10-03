import type { VisualAsset } from './visualAssets'
import reviewedUrls from './reviewed32-media-urls.json'

const officialVisualAssetSources = [
  { host: 'act-upload.mihoyo.com', pathPrefix: '/nap-obc-indep/', sourceType: 'official' },
  { host: 'fastcdn.hoyoverse.com', pathPrefix: '/content-v2/nap/', sourceType: 'official' },
  { host: 'webstatic.hoyoverse.com', pathPrefix: '/upload/op-public/', sourceType: 'official' },
  { host: 'img.gachabase.net', pathPrefix: '/conv/zzz/assets/', sourceType: 'community' },
  { host: 'i.gachabase.net', pathPrefix: '/', sourceType: 'community' },
  { host: 'static.nanoka.cc', pathPrefix: '/assets/zzz/IconRoleCrop', sourceType: 'community' },
] as const

export function getOfficialVisualAssetDownloadUrl(
  asset: Pick<VisualAsset, 'name' | 'remoteUrl' | 'sourceType'>,
) {
  if (!asset.remoteUrl) throw new Error(`${asset.name} 缺少图鉴图片地址`)
  const remoteUrl = new URL(asset.remoteUrl)
  if (
    remoteUrl.protocol !== 'https:' ||
    (!(asset.sourceType === 'community' && Object.values(reviewedUrls).includes(asset.remoteUrl)) &&
      !officialVisualAssetSources.some(
        (source) =>
          remoteUrl.hostname === source.host &&
          remoteUrl.pathname.startsWith(source.pathPrefix) &&
          asset.sourceType === source.sourceType,
      ))
  ) {
    throw new Error(`${asset.name} 的图片来源暂不可用`)
  }
  return `/official-catalog-cache?source=${encodeURIComponent(asset.remoteUrl)}`
}

export function getOfficialWEngineDownloadUrl(
  asset: Pick<VisualAsset, 'entityType' | 'name' | 'remoteUrl' | 'sourceType'>,
) {
  if (asset.entityType !== 'wengine') throw new Error(`${asset.name} 不属于可验证的官方音擎素材`)
  return getOfficialVisualAssetDownloadUrl(asset)
}
