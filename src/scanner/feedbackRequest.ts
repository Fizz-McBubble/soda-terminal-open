/** Bound the whole feedback request, including reading an acknowledgement. */
export async function withFeedbackTimeout<T>(
  timeoutMs: number,
  request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('timeout'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([timeout, request(controller.signal)])
  } finally {
    clearTimeout(timer)
  }
}
