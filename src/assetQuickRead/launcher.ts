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
  timeoutMs = 30000,
  retryDelayMs = 350,
  maxAttempts,
}: {
  probe: (probeSignal?: AbortSignal, requestTimeoutMs?: number) => Promise<T>
  launchIfMissing?: boolean
  protocolLauncher?: () => void
  signal?: AbortSignal
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  timeoutMs?: number
  retryDelayMs?: number
  maxAttempts?: number
}): Promise<T> {
  signal?.throwIfAborted()
  const deadline = Date.now() + timeoutMs
  const effectiveMaxAttempts = maxAttempts ?? Math.ceil(timeoutMs / retryDelayMs)
  const timeoutError = () =>
    new Error(
      '资产快读尚未启动。请先下载并完成安装，再点击连接；允许浏览器打开资产快读和访问本机设备。',
    )
  const boundedProbe = async () => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw timeoutError()
    const result = await probe(signal, Math.min(3000, remaining))
    signal?.throwIfAborted()
    if (Date.now() >= deadline) throw timeoutError()
    return result
  }
  try {
    return await boundedProbe()
  } catch (error) {
    signal?.throwIfAborted()
    if (!(error instanceof AssetQuickReadUnavailableError) || !launchIfMissing) throw error
  }
  if (Date.now() >= deadline) throw timeoutError()
  protocolLauncher()
  for (let attempt = 0; attempt < effectiveMaxAttempts && Date.now() < deadline; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await sleep(Math.min(retryDelayMs, remaining), signal)
    signal?.throwIfAborted()
    if (Date.now() >= deadline) break
    try {
      return await boundedProbe()
    } catch (error) {
      signal?.throwIfAborted()
      if (!(error instanceof AssetQuickReadUnavailableError)) throw error
    }
  }
  throw timeoutError()
}
