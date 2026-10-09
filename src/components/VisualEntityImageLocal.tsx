import './visual-entity-image.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type VisualAssetEntityType } from '../assets/visualAssets'
import {
  resolveSessionVisualSource,
  resolveVisualEntityImageAsset,
  sessionVisualSources,
  visualSourceKey,
} from '../assets/visualEntityImageSource'
import type { VisualAssetConsumer, VisualAssetSlotId } from '../assets/visualAssetSlots'

export function VisualEntityImage({
  entityType,
  entityId,
  name,
  variant,
  fallbackVariants = [],
  className,
  cacheVersion,
  slotId,
  consumer,
  compactFallback = false,
}: {
  entityType: VisualAssetEntityType
  entityId: string
  name: string
  variant?: string
  fallbackVariants?: string[]
  className?: string
  cacheVersion?: string | null
  slotId?: VisualAssetSlotId
  consumer?: VisualAssetConsumer
  compactFallback?: boolean
}) {
  const [runtimeRevision, setRuntimeRevision] = useState(0)
  const { asset, slot, bundledSource } = resolveVisualEntityImageAsset({
    entityType,
    entityId,
    variant,
    fallbackVariants,
    cacheVersion,
    slotId,
    consumer,
  })
  const slotPresentation =
    slot && asset ? (slot.variantPresentation?.[asset.variant] ?? slot) : slot
  const minimumSize = slot
    ? ((consumer ? slot.minimumSizeByConsumer?.[consumer] : undefined) ?? slot.minimumSize)
    : null
  const isCompactFallback =
    compactFallback || Boolean(minimumSize && minimumSize.width <= 64 && minimumSize.height <= 64)
  const [imageElement, setImageElement] = useState<HTMLElement | null>(null)
  const [nearViewport, setNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )
  const eager = slotId === 'agent.hero' || (!slotId && variant === 'full_body')
  useEffect(() => {
    if (eager || nearViewport || !imageElement) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '160px' },
    )
    observer.observe(imageElement)
    return () => observer.disconnect()
  }, [eager, nearViewport, imageElement])
  const shouldResolve = eager || nearViewport
  const assetKey = asset ? visualSourceKey(asset) : null
  const retryKey = `${assetKey ?? ''}:${cacheVersion ?? ''}`
  const retries = useRef({ key: retryKey, count: 0 })
  const currentImage = useRef('')
  const imageIdentity = `${retryKey}:${runtimeRevision}`
  useLayoutEffect(() => {
    if (retries.current.key !== retryKey) retries.current = { key: retryKey, count: 0 }
    currentImage.current = imageIdentity
  }, [retryKey, imageIdentity])
  const sessionSource = assetKey ? sessionVisualSources.get(assetKey) : null
  const [cachedSource, setCachedSource] = useState<{
    assetKey: string
    objectUrl: string | null
    revision: number
  } | null>(null)
  const [failedSource, setFailedSource] = useState<{
    assetKey: string | null
    source: string
    revision: number
    cacheVersion?: string | null
  } | null>(null)
  const source =
    bundledSource ??
    sessionSource ??
    (cachedSource?.assetKey === assetKey && cachedSource?.revision === runtimeRevision
      ? cachedSource.objectUrl
      : null)
  const failed =
    !source ||
    (failedSource?.assetKey === assetKey &&
      failedSource.source === source &&
      failedSource.revision === runtimeRevision &&
      failedSource.cacheVersion === cacheVersion)
  const resolving =
    Boolean(asset) &&
    !source &&
    (cachedSource?.assetKey !== assetKey || cachedSource?.revision !== runtimeRevision)

  useEffect(() => {
    const refresh = () => setRuntimeRevision((value) => value + 1)
    window.addEventListener('soda-visual-assets-ready', refresh)
    return () => window.removeEventListener('soda-visual-assets-ready', refresh)
  }, [])

  useEffect(() => {
    let active = true
    if (asset && !bundledSource && shouldResolve) {
      void resolveSessionVisualSource(asset).then((cachedUrl) => {
        if (!active) return
        if (assetKey) setCachedSource({ assetKey, objectUrl: cachedUrl, revision: runtimeRevision })
      })
    }
    return () => {
      active = false
    }
  }, [asset, assetKey, bundledSource, cacheVersion, runtimeRevision, shouldResolve])

  useEffect(() => {
    // Cache access and browser decoding can fail transiently. Retry only this
    // mounted image, without downloading assets or restarting the whole pack.
    if (!asset?.remoteUrl || !shouldResolve || resolving || !failed || retries.current.count >= 2)
      return
    const identity = imageIdentity
    const delay = retries.current.count === 0 ? 300 : 1200
    const timer = setTimeout(() => {
      if (currentImage.current !== identity) return
      retries.current.count += 1
      setRuntimeRevision((value) => value + 1)
    }, delay)
    return () => clearTimeout(timer)
  }, [asset?.remoteUrl, shouldResolve, resolving, failed, imageIdentity])

  if (!source || failed) {
    const fallbackLabel = resolving
      ? '图片加载中'
      : asset?.remoteUrl || bundledSource
        ? '图片未加载'
        : '此图暂缺'
    return (
      <span
        ref={setImageElement}
        className={`visual-asset-fallback${isCompactFallback ? ' is-compact' : ''} ${className ?? ''}`}
        data-visual-slot={slot?.slotId}
        data-visual-slot-minimum={
          minimumSize ? `${minimumSize.width}x${minimumSize.height}` : undefined
        }
        role="img"
        aria-busy={resolving || undefined}
        aria-label={`${name}${fallbackLabel}`}
        style={
          slot
            ? {
                aspectRatio: slot.aspectRatio,
                objectFit: slot.objectFit,
                objectPosition: slot.objectPosition,
              }
            : undefined
        }
      >
        {isCompactFallback ? Array.from(name).slice(0, 1).join('') : asset ? fallbackLabel : name}
      </span>
    )
  }

  return (
    <img
      ref={setImageElement}
      decoding="async"
      key={`${assetKey ?? `missing:${entityType}:${entityId}`}:${runtimeRevision}:${cacheVersion ?? ''}`}
      alt={`${name}图鉴图像`}
      className={`visual-entity-image ${className ?? ''}`}
      data-visual-variant={asset?.variant}
      data-visual-slot={slot?.slotId}
      data-visual-slot-minimum={
        minimumSize ? `${minimumSize.width}x${minimumSize.height}` : undefined
      }
      loading={eager ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      src={source}
      style={
        slot
          ? {
              aspectRatio: slot.aspectRatio,
              objectFit: slotPresentation?.objectFit,
              objectPosition: slotPresentation?.objectPosition,
              clipPath: 'inset(0)',
              transform:
                slotPresentation?.contentScale === 1
                  ? undefined
                  : `scale(${slotPresentation?.contentScale})`,
              transformOrigin:
                slotPresentation?.contentScale === 1 ? undefined : slotPresentation?.objectPosition,
            }
          : undefined
      }
      onError={() => {
        if (currentImage.current === imageIdentity)
          setFailedSource({ assetKey, source, revision: runtimeRevision, cacheVersion })
      }}
    />
  )
}
