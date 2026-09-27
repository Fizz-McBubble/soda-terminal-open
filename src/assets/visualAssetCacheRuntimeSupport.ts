export function createVisualAssetStagingCacheName(baseName: string) {
  return `${baseName}:${crypto.randomUUID()}`
}

export async function runBoundedConcurrentTasks<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let cursor = 0
  let failed = false
  let firstError: unknown
  const worker = async () => {
    while (!failed && cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      try {
        await task(item)
      } catch (error) {
        if (!failed) firstError = error
        failed = true
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  if (failed) throw firstError
}

export async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(input, { ...init, signal: controller.signal })
    fetchedResponseBytes.set(response, await response.clone().arrayBuffer())
    return response
  } finally {
    clearTimeout(timeout)
  }
}

const fetchedResponseBytes = new WeakMap<Response, ArrayBuffer>()

export function takeFetchedResponseBytes(response: Response) {
  const bytes = fetchedResponseBytes.get(response)
  fetchedResponseBytes.delete(response)
  return bytes
}

export function getVisualAssetInstallErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('内容哈希不一致')) {
    return '官方图鉴素材内容校验未通过，已保留原有本机素材。请稍后重试。'
  }
  if (message.includes('下载失败') || error instanceof TypeError) {
    return '无法连接官方图鉴素材，已保留原有本机素材。请检查网络后重试。'
  }
  return '官方图鉴素材未能写入本机缓存，已保留原有本机素材。请稍后重试。'
}
