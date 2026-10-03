import { registerPublicOfflineShell } from './registerPublicOfflineShell'

/** Keep a complete offline install, but start its network work after page load and a paint/idle turn. */
export function schedulePublicOfflineShell(
  register: () => Promise<unknown> = registerPublicOfflineShell,
): () => void {
  let stopped = false
  let frame: number | undefined
  let idle: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const start = () => {
    if (!stopped) void register().catch(() => {})
  }
  const afterPaint = () => {
    if (stopped) return
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(start, { timeout: 5000 })
    } else {
      timer = setTimeout(start, 1000)
    }
  }
  const afterLoad = () => {
    window.removeEventListener('load', afterLoad)
    if (stopped) return
    // Two frames put registration after the initial rendering opportunity, including cached loads.
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(afterPaint)
    })
  }
  if (document.readyState === 'complete') afterLoad()
  else window.addEventListener('load', afterLoad, { once: true })
  return () => {
    stopped = true
    window.removeEventListener('load', afterLoad)
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    if (idle !== undefined) window.cancelIdleCallback?.(idle)
    if (timer !== undefined) clearTimeout(timer)
  }
}
