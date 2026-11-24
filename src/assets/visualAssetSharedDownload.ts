import type { VisualAssetCacheRuntime } from './visualAssetBrowserRuntime'
import { fetchOfficialVisualAsset } from './visualAssetCacheLookup'
import {
  takeFetchedResponseBytes,
  throwIfAborted,
  waitForAbortable,
} from './visualAssetCacheRuntimeSupport'
import type { VisualAsset, VisualAssetManifest } from './visualAssetSchemas'

type Download = {
  image: Promise<Response>
  saved: Promise<void>
  start: () => Promise<void> | undefined
}
const downloadsByFetcher = new WeakMap<typeof fetch, Map<string, Download>>()

export function automaticVisualAssetCacheName(prefix: string, manifest: VisualAssetManifest) {
  return `${prefix}:automatic:${manifest.packVersion}:${manifest.contentHash.slice(-12)}`
}

let visibleSlot: Promise<void | undefined> = Promise.resolve()

/** Share the verified response until its write settles, including across the two queues. */
export function downloadVisualAsset(
  asset: VisualAsset & { remoteUrl: string },
  runtime: VisualAssetCacheRuntime,
  cacheName: string,
  save: (response: Response) => Promise<void>,
  signal: AbortSignal,
  visible = false,
): Download {
  throwIfAborted(signal)
  let pending = downloadsByFetcher.get(runtime.fetcher)
  if (!pending) {
    pending = new Map()
    downloadsByFetcher.set(runtime.fetcher, pending)
  }
  const key = `${cacheName}\n${asset.remoteUrl}\n${asset.contentHash}`
  const existing = pending.get(key)
  if (existing) {
    if (!visible) void existing.start()
    return existing
  }

  const fetchVerified = async () => {
    const requestSignal = visible ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : signal
    const response = await fetchOfficialVisualAsset(asset, runtime, { signal: requestSignal })
    const bytes =
      takeFetchedResponseBytes(response) ??
      (await waitForAbortable(response.clone().arrayBuffer(), requestSignal))
    const digest = await waitForAbortable(runtime.digest(bytes), requestSignal)
    if (digest !== asset.contentHash) throw new Error(`${asset.name} 内容哈希不一致`)
    return response
  }
  let start!: Download['start']
  const image = new Promise<Response>((resolve, reject) => {
    let started = false
    const cancelQueued = () => {
      started = true
      reject(signal.reason)
    }
    signal.addEventListener('abort', cancelQueued, { once: true })
    start = () => {
      if (started) return
      started = true
      signal.removeEventListener('abort', cancelQueued)
      return fetchVerified().then(resolve, reject)
    }
  })
  const saved = image.then((response) => {
    throwIfAborted(signal)
    return waitForAbortable(save(response.clone()), signal)
  })
  const download = { image, saved, start }
  pending.set(key, download)
  const forget = () => pending.delete(key)
  void saved.then(forget, forget)
  // The three library workers can take queued visible work first. The extra slot
  // stays available while they finish existing downloads or check stored images.
  if (visible) visibleSlot = visibleSlot.then(start)
  else void start()
  return download
}
