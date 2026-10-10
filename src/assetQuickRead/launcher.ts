export const assetQuickReadLaunchUri = 'soda-asset-quick-read://launch'
export class AssetQuickReadUnavailableError extends Error {}
export function launchAssetQuickReadService() {
  const anchor = document.createElement('a')
  anchor.href = assetQuickReadLaunchUri
  anchor.click()
}
function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}
/** Call with launchIfMissing only from an explicit user connection action. Never starts capture. */
export async function awaitAssetQuickReadService<T>({
  probe,
  launchIfMissing = false,
  protocolLauncher = launchAssetQuickReadService,
  signal,
  sleep = pause,
}: {
  probe: () => Promise<T>
  launchIfMissing?: boolean
  protocolLauncher?: () => void
  signal?: AbortSignal
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}): Promise<T> {
  signal?.throwIfAborted()
  try {
    return await probe()
  } catch (error) {
    signal?.throwIfAborted()
    if (!(error instanceof AssetQuickReadUnavailableError) || !launchIfMissing) throw error
  }
  protocolLauncher()
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(350, signal)
    signal?.throwIfAborted()
    try {
      return await probe()
    } catch (error) {
      signal?.throwIfAborted()
      if (!(error instanceof AssetQuickReadUnavailableError)) throw error
    }
  }
  throw new Error(
    '独立工具尚未启动。请先下载并完成安装，再点击连接；允许浏览器打开独立工具和访问本机设备。',
  )
}
