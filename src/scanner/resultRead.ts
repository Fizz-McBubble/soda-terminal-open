/** Read-only deadline: cancellation settles even if a transport ignores its signal. */
export async function readScannerResultWithDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => {
      reject(new DOMException('Result read cancelled', 'AbortError'))
      controller.abort()
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      const error = new Error('扫描结果读取超时，请重试或选择扫描结果文件。')
      error.name = 'ScannerResultTimeoutError'
      reject(error)
      controller.abort()
    }, timeoutMs)
  })
  try {
    return await Promise.race([cancelled, operation(controller.signal)])
  } finally {
    clearTimeout(timer)
    if (onAbort) signal?.removeEventListener('abort', onAbort)
  }
}
