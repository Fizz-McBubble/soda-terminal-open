import { describe, expect, it, vi } from 'vitest'
import {
  getVisualAssetInstallErrorMessage,
  synchronizeVisualAssetPack,
  type VisualAsset,
} from './visualAssets'
import visualAssetManifest from './visualAssetManifestPublic'
import { assets, automaticRuntime, manifestFor } from './visualAssetsCacheIntegrityFixture'

const uniqueAssets = assets.filter(
  (asset, index) =>
    assets.findIndex((candidate) => candidate.remoteUrl === asset.remoteUrl) === index,
)

export function registerAutomaticVisualAssetCacheCases() {
  describe('automatic full-library personal cache', () => {
    it('loads all verified entries, including non-catalog assets, with bounded concurrency and reuses on refresh', async () => {
      const selected = [
        ...uniqueAssets.slice(0, 8),
        { ...uniqueAssets[8], entityType: 'scene' as const },
      ]
      const { runtime } = automaticRuntime()
      let inFlight = 0
      let peak = 0
      const source = vi.fn(async (asset: VisualAsset) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 1))
        inFlight -= 1
        return new Response(asset.contentHash)
      })
      const manifest = manifestFor(selected)
      const progress = vi.fn()
      expect(
        await synchronizeVisualAssetPack(manifest, runtime, progress, { responseForAsset: source }),
      ).toMatchObject({ installed: 9, total: 9, failed: 0 })
      expect(source).toHaveBeenCalledTimes(9)
      expect(peak).toBe(3)
      expect(progress).toHaveBeenLastCalledWith(
        expect.objectContaining({ completed: 9, total: 9, failed: 0 }),
      )
      source.mockClear()
      await synchronizeVisualAssetPack(manifest, runtime, undefined, { responseForAsset: source })
      expect(source).not.toHaveBeenCalled()
    })

    it('continues after one failure and retains verified entries for missing-only recovery', async () => {
      const selected = uniqueAssets.slice(0, 9)
      const { runtime, contents, deleteCache } = automaticRuntime()
      const before = runtime.getState()
      const source = vi.fn(async (asset: VisualAsset) => {
        if (asset.remoteUrl === selected[0].remoteUrl) throw new Error('unavailable')
        return new Response(asset.contentHash)
      })
      const first = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
      })
      expect(first).toMatchObject({ installed: 8, total: 9, failed: 1 })
      expect(source).toHaveBeenCalledTimes(9)
      expect(runtime.getState().activeCache).toBe(before.activeCache)
      expect(runtime.getState().automaticCache).toBe(first.cacheName)
      expect(contents.get(first.cacheName)?.size).toBe(8)
      expect(deleteCache).not.toHaveBeenCalled()
      source.mockClear().mockImplementation(async (asset) => new Response(asset.contentHash))
      const retried = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
      })
      expect(retried).toMatchObject({
        installed: 9,
        total: 9,
        failed: 0,
        cacheName: first.cacheName,
      })
      expect(source).toHaveBeenCalledTimes(1)
      expect(source.mock.calls[0][0].remoteUrl).toBe(selected[0].remoteUrl)
    })

    it('fetches only changed, added or evicted entries and rejects wrong hashes without clearing successes', async () => {
      const selected = uniqueAssets.slice(0, 3)
      const { runtime, contents } = automaticRuntime()
      const source = vi.fn(async (asset: VisualAsset) => new Response(asset.contentHash))
      const first = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
      })
      const updated = [
        { ...selected[0], contentHash: `sha256-${'f'.repeat(64)}` },
        ...selected.slice(1),
        uniqueAssets[3],
      ]
      source.mockClear()
      const nextManifest = { ...manifestFor(updated), contentHash: `sha256-${'e'.repeat(64)}` }
      const next = await synchronizeVisualAssetPack(nextManifest, runtime, undefined, {
        responseForAsset: source,
      })
      expect(next.failed).toBe(0)
      expect(source.mock.calls.map(([asset]) => asset.remoteUrl)).toEqual([
        selected[0].remoteUrl,
        uniqueAssets[3].remoteUrl,
      ])
      expect(contents.get(first.cacheName)?.size).toBe(3)
      expect(runtime.getState().previousCache).toBe(first.cacheName)
      contents.get(next.cacheName)?.set(updated[0].remoteUrl, new Response('corrupt'))
      contents.get(next.cacheName)?.delete(uniqueAssets[3].remoteUrl)
      source
        .mockClear()
        .mockImplementation(
          async (asset) =>
            new Response(
              asset.remoteUrl === updated[0].remoteUrl ? 'wrong-hash' : asset.contentHash,
            ),
        )
      const repair = await synchronizeVisualAssetPack(nextManifest, runtime, undefined, {
        responseForAsset: source,
      })
      expect(repair).toMatchObject({ installed: 3, failed: 1 })
      expect(source).toHaveBeenCalledTimes(2)
      expect(await contents.get(next.cacheName)?.get(updated[1].remoteUrl)?.text()).toBe(
        updated[1].contentHash,
      )
    })

    it('upgrades an installed 3.1.13 catalogue by caching only the new 3.3 slots and lumiflux icon', async () => {
      const additions = new Set([
        'agent:agent-phoenix:full_body',
        'agent:agent-phoenix:square_avatar',
        'agent:agent-phoenix:interknot',
        'wengine:wengine-14164:catalog_icon',
        'wengine:wengine-13022:catalog_icon',
        'illustration:attribute-lumiflux:icon',
      ])
      const key = (asset: VisualAsset) => `${asset.entityType}:${asset.entityId}:${asset.variant}`
      const oldAssets = visualAssetManifest.assets.filter((asset) => !additions.has(key(asset)))
      const oldManifest = {
        ...manifestFor(oldAssets),
        packVersion: 'zzz-visual-assets-3.1.13',
        gameVersion: '3.1',
      }
      const { runtime, contents } = automaticRuntime()
      const source = vi.fn(async (asset: VisualAsset) => new Response(asset.contentHash))

      const old = await synchronizeVisualAssetPack(oldManifest, runtime, undefined, {
        responseForAsset: source,
      })
      expect(old).toMatchObject({ installed: 364, total: 364, failed: 0 })
      source.mockClear()

      const next = await synchronizeVisualAssetPack(visualAssetManifest, runtime, undefined, {
        responseForAsset: source,
      })

      expect(next).toMatchObject({ installed: 370, total: 370, failed: 0 })
      expect(new Set(source.mock.calls.map(([asset]) => key(asset)))).toEqual(additions)
      expect(source.mock.calls.every(([asset]) => additions.has(key(asset)))).toBe(true)
      expect(runtime.getState()).toMatchObject({
        packVersion: visualAssetManifest.packVersion,
        previousCache: old.cacheName,
      })
      expect(
        visualAssetManifest.assets
          .filter((asset) => asset.remoteUrl && asset.cachePolicy === 'explicit-personal-cache')
          .every((asset) => contents.get(next.cacheName)?.has(asset.remoteUrl!)),
      ).toBe(true)
    })

    it('reuses an unchanged image from an incomplete cache after an update', async () => {
      const selected = uniqueAssets.slice(0, 2)
      const { runtime } = automaticRuntime()
      const source = vi.fn(async (asset: VisualAsset) => {
        if (asset === selected[1] || asset.remoteUrl === selected[1].remoteUrl)
          throw new Error('offline')
        return new Response(asset.contentHash)
      })
      const old = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
      })
      expect(old).toMatchObject({ installed: 1, failed: 1 })

      source.mockReset().mockImplementation(async (asset) => new Response(asset.contentHash))
      const nextManifest = { ...manifestFor(selected), packVersion: 'next-catalog' }
      const next = await synchronizeVisualAssetPack(nextManifest, runtime, undefined, {
        responseForAsset: source,
      })
      expect(next).toMatchObject({ installed: 2, failed: 0 })
      expect(source.mock.calls.map(([asset]) => asset.remoteUrl)).toEqual([selected[1].remoteUrl])
    })

    it('upgrades the 3.1.15 cache by fetching only the three corrected avatars', async () => {
      const oldAssets = visualAssetManifest.assets.map((asset) => {
        if (asset.entityId === 'agent-phoenix' && asset.variant === 'interknot') {
          return {
            ...asset,
            variant: 'social_avatar',
            remoteUrl:
              'https://drive.usercontent.google.com/download?id=17-c96uuYVeqRHq6NShgvXSbLJ3zG17Pn&export=download',
            contentHash: 'sha256-f7880b2af5d2e84ed060cf18d89c0254187e2840bc3dcbaf80afee4c52ac81ad',
          }
        }
        if (
          ['agent-claret', 'agent-roxy'].includes(asset.entityId) &&
          asset.variant === 'square_avatar'
        ) {
          const interknot = visualAssetManifest.assets.find(
            (candidate) =>
              candidate.entityId === asset.entityId && candidate.variant === 'interknot',
          )!
          return { ...asset, remoteUrl: interknot.remoteUrl, contentHash: interknot.contentHash }
        }
        return asset
      })
      const oldManifest = { ...manifestFor(oldAssets), packVersion: 'zzz-visual-assets-3.1.15' }
      const { runtime } = automaticRuntime()
      const source = vi.fn(async (asset: VisualAsset) => new Response(asset.contentHash))
      await synchronizeVisualAssetPack(oldManifest, runtime, undefined, {
        responseForAsset: source,
      })
      source.mockClear()
      const result = await synchronizeVisualAssetPack(visualAssetManifest, runtime, undefined, {
        responseForAsset: source,
      })
      expect(result).toMatchObject({ installed: 370, total: 370, failed: 0 })
      expect(
        source.mock.calls.map(([asset]) => `${asset.entityId}:${asset.variant}`).sort(),
      ).toEqual([
        'agent-claret:square_avatar',
        'agent-phoenix:interknot',
        'agent-roxy:square_avatar',
      ])
    })

    it('updates only the two corrected square avatars from the 3.1.17 cache', async () => {
      const ids = new Set(['agent-claret', 'agent-roxy'])
      const oldAssets = visualAssetManifest.assets.map((asset) => {
        if (!ids.has(asset.entityId) || asset.variant !== 'square_avatar') return asset
        const interknot = visualAssetManifest.assets.find(
          (candidate) => candidate.entityId === asset.entityId && candidate.variant === 'interknot',
        )!
        return { ...asset, remoteUrl: interknot.remoteUrl, contentHash: interknot.contentHash }
      })
      const oldManifest = { ...manifestFor(oldAssets), packVersion: 'zzz-visual-assets-3.1.17' }
      const { runtime } = automaticRuntime()
      const source = vi.fn(async (asset: VisualAsset) => new Response(asset.contentHash))
      await synchronizeVisualAssetPack(oldManifest, runtime, undefined, {
        responseForAsset: source,
      })
      source.mockClear()
      const result = await synchronizeVisualAssetPack(visualAssetManifest, runtime, undefined, {
        responseForAsset: source,
      })
      expect(result).toMatchObject({ installed: 370, total: 370, failed: 0 })
      expect(
        source.mock.calls.map(([asset]) => `${asset.entityId}:${asset.variant}`).sort(),
      ).toEqual(['agent-claret:square_avatar', 'agent-roxy:square_avatar'])
    })

    it('supports AbortSignal cancellation, retains verified partial entries, and stops remaining tasks', async () => {
      const selected = uniqueAssets.slice(0, 6)
      const { runtime, contents } = automaticRuntime()
      const controller = new AbortController()
      let fetchCount = 0

      const source = vi.fn(async (asset: VisualAsset) => {
        fetchCount += 1
        if (fetchCount === 4) {
          controller.abort(new DOMException('User cancelled', 'AbortError'))
        }
        return new Response(asset.contentHash)
      })

      const result = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
        signal: controller.signal,
      })

      expect(result.cancelled).toBe(true)
      expect(result.quotaExceeded).toBe(false)
      expect(result.timedOut).toBe(false)
      expect(result.installed).toBeGreaterThanOrEqual(1)
      expect(result.total).toBe(6)
      // Successfully fetched entries are retained in automaticCache!
      expect(contents.get(result.cacheName)?.size).toBe(result.installed)
      expect(runtime.getState().automaticCache).toBe(result.cacheName)

      // Next run only downloads missing items!
      source.mockClear()
      const nextRun = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
      })
      expect(nextRun.installed).toBe(6)
      expect(nextRun.failed).toBe(0)
      // Only the missing items were downloaded
      expect(source).toHaveBeenCalledTimes(6 - result.installed)
    })

    it('distinguishes QuotaExceededError and stops further writes while preserving prior entries', async () => {
      const selected = uniqueAssets.slice(0, 5)
      const { runtime, contents } = automaticRuntime()
      let putCount = 0

      const originalOpen = runtime.cacheStorage.open
      runtime.cacheStorage.open = async (name) => {
        const cache = await originalOpen(name)
        const originalPut = cache.put
        cache.put = async (key, response) => {
          putCount += 1
          if (putCount === 3) {
            throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
          }
          return originalPut.call(cache, key, response)
        }
        return cache
      }

      const source = vi.fn(async (asset: VisualAsset) => new Response(asset.contentHash))
      const result = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
      })

      expect(result.quotaExceeded).toBe(true)
      expect(result.cancelled).toBe(false)
      expect(result.timedOut).toBe(false)
      expect(result.installed).toBe(2)
      expect(result.failed).toBe(3)
      expect(contents.get(result.cacheName)?.size).toBe(2)
    })

    it('bounds a non-abortable cache digest promise and reports timeout separately from cancel', async () => {
      const selected = uniqueAssets.slice(0, 3)
      const { runtime } = automaticRuntime()
      runtime.digest = () => new Promise<string>(() => {})
      const source = vi.fn(async (asset: VisualAsset) => new Response(asset.contentHash))

      const result = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        responseForAsset: source,
        packTimeoutMs: 20,
      })

      expect(result).toMatchObject({
        installed: 0,
        total: 3,
        failed: 3,
        cancelled: false,
        quotaExceeded: false,
        timedOut: true,
      })
    })

    it('bounds a cache-open promise that ignores AbortSignal', async () => {
      const selected = uniqueAssets.slice(0, 1)
      const { runtime } = automaticRuntime()
      runtime.cacheStorage.open = () => new Promise(() => {})

      const result = await synchronizeVisualAssetPack(manifestFor(selected), runtime, undefined, {
        packTimeoutMs: 20,
      })

      expect(result).toMatchObject({
        installed: 0,
        total: 1,
        failed: 1,
        cancelled: false,
        timedOut: true,
      })
    })

    it('keeps quota, timeout, and user cancellation actionable and distinct', () => {
      expect(
        getVisualAssetInstallErrorMessage(new DOMException('quota exceeded', 'QuotaExceededError')),
      ).toContain('存储空间不足')
      expect(
        getVisualAssetInstallErrorMessage(new DOMException('deadline', 'TimeoutError')),
      ).toContain('下载超时')
      expect(
        getVisualAssetInstallErrorMessage(new DOMException('cancelled', 'AbortError')),
      ).toContain('已取消')
    })
  })
}
