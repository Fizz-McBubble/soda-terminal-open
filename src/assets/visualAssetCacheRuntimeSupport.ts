export function createVisualAssetStagingCacheName(baseName: string) {
  return `${baseName}:${crypto.randomUUID()}`
}

export async function runBoundedConcurrentTasks<T>(
  items: Iterable<T>,
  concurrency: number,
  task: (item: T) => Promise<void>,
  signal?: AbortSignal,
  shouldStop?: () => boolean,
) {
  const iterator = items[Symbol.iterator]()
  let failed = false
  let firstError: unknown
  const worker = async () => {
    while (!failed && !shouldStop?.()) {
      if (signal?.aborted) {
        failed = true
        firstError = signal.reason ?? new DOMException('Operation aborted', 'AbortError')
        break
      }
      const item = iterator.next()
      if (item.done) break
      try {
        await task(item.value)
      } catch (error) {
        if (!failed) firstError = error
        failed = true
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  if (failed && !signal?.aborted) throw firstError
}

export function isTimeoutError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (('name' in error && error.name === 'TimeoutError') ||
      ('message' in error && typeof error.message === 'string' && error.message.includes('超时'))),
  )
}

export function isCancellationError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (('name' in error && error.name === 'AbortError') ||
      ('message' in error && typeof error.message === 'string' && error.message.includes('取消'))),
  )
}

export function abortReason(signal: AbortSignal, message = 'Operation aborted') {
  return signal.reason ?? new DOMException(message, 'AbortError')
}

export function classifyAbortSignal(signal: AbortSignal): 'cancelled' | 'timeout' | null {
  if (!signal.aborted) return null
  return isTimeoutError(signal.reason) ? 'timeout' : 'cancelled'
}

export function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw abortReason(signal)
}

/** Reject promptly when a browser API ignores AbortSignal; late completion is ignored. */
export async function waitForAbortable<T>(
  operation: PromiseLike<T>,
  signal: AbortSignal,
): Promise<T> {
  throwIfAborted(signal)
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      callback()
    }
    const onAbort = () => finish(() => reject(abortReason(signal)))
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(operation).then(
      (value) =>
        finish(() => {
          if (signal.aborted) reject(abortReason(signal))
          else resolve(value)
        }),
      (error) => finish(() => reject(error)),
    )
  })
}

export async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort(new DOMException('请求超时', 'TimeoutError'))
  }, timeoutMs)

  const onAbort = () => {
    controller.abort(init.signal?.reason ?? new DOMException('Operation aborted', 'AbortError'))
  }

  if (init.signal) {
    if (init.signal.aborted) {
      clearTimeout(timeout)
      throw init.signal.reason ?? new DOMException('Operation aborted', 'AbortError')
    }
    init.signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    const response = await waitForAbortable(
      Promise.resolve().then(() => fetcher(input, { ...init, signal: controller.signal })),
      controller.signal,
    )
    const bytes = await waitForAbortable(response.clone().arrayBuffer(), controller.signal)
    fetchedResponseBytes.set(response, bytes)
    return response
  } finally {
    clearTimeout(timeout)
    if (init.signal) {
      init.signal.removeEventListener('abort', onAbort)
    }
  }
}

const fetchedResponseBytes = new WeakMap<Response, ArrayBuffer>()

export function takeFetchedResponseBytes(response: Response) {
  const bytes = fetchedResponseBytes.get(response)
  fetchedResponseBytes.delete(response)
  return bytes
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
    return true
  }
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') return true
    const message = error.message.toLowerCase()
    return message.includes('quota') || message.includes('storage quota')
  }
  return false
}

export function getVisualAssetInstallErrorMessage(error: unknown) {
  if (isQuotaExceededError(error)) {
    return '浏览器存储空间不足，未能缓存全部素材，已保留已成功图片。请清理空间后重试。'
  }
  if (isTimeoutError(error)) {
    return '素材下载超时，已保留已成功图片。请稍后点击“补齐图片”重试。'
  }
  const message = error instanceof Error ? error.message : ''
  if (isCancellationError(error) || message.includes('用户取消')) {
    return '已取消素材下载，已保留已成功图片。可随时继续下载。'
  }
  if (message.includes('内容哈希不一致')) {
    return '官方图鉴素材内容校验未通过，已保留原有本机素材。请稍后重试。'
  }
  if (message.includes('下载失败') || error instanceof TypeError) {
    return '无法连接官方图鉴素材，已保留原有本机素材。请检查网络后重试。'
  }
  return '官方图鉴素材未能写入本机缓存，已保留原有本机素材。请稍后重试。'
}
