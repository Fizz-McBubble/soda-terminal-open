/** Settle and cancel stalled reads even when a transport ignores AbortSignal. */
export async function withScannerRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutError: () => Error,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => {
      reject(new DOMException('Scanner request cancelled', 'AbortError'))
      controller.abort()
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      reject(timeoutError())
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
