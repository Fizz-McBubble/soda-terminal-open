import { useEffect, type RefObject } from 'react'
import { prefersReducedMotion } from './motionPreference'

/**
 * Tracks subtle desktop pointer coordinates (`--spot-x`, `--spot-y`) on a focal surface
 * using rAF throttling. Inactive on touch devices or when reduced motion is enabled.
 */
export function usePointerSpotlight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false
    if (!finePointer) return

    let frame = 0
    let nextX = 0
    let nextY = 0

    const flush = () => {
      frame = 0
      element.style.setProperty('--spot-x', `${nextX}px`)
      element.style.setProperty('--spot-y', `${nextY}px`)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || prefersReducedMotion()) return
      const rect = element.getBoundingClientRect()
      nextX = Math.round(event.clientX - rect.left)
      nextY = Math.round(event.clientY - rect.top)
      element.dataset.spotlightActive = 'true'
      if (!frame) frame = window.requestAnimationFrame(flush)
    }

    const onLeave = () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
      delete element.dataset.spotlightActive
    }

    element.addEventListener('pointermove', onMove, { passive: true })
    element.addEventListener('pointerleave', onLeave)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      delete element.dataset.spotlightActive
    }
  }, [ref])
}
