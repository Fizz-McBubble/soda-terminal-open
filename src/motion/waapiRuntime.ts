export type WaapiMotionHandle = {
  element: HTMLElement
  cancel: () => void
  finish: () => void
}

export type WaapiFromToOptions = {
  durationMs: number
  easing?: string
  staggerTotalMs?: number
  ownedProperties?: readonly string[]
}

const DEFAULT_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const activeHandles = new WeakMap<HTMLElement, Set<WaapiMotionHandle>>()

function trackHandle(element: HTMLElement, handle: WaapiMotionHandle) {
  let set = activeHandles.get(element)
  if (!set) {
    set = new Set()
    activeHandles.set(element, set)
  }
  set.add(handle)
}

function untrackHandle(element: HTMLElement, handle: WaapiMotionHandle) {
  const set = activeHandles.get(element)
  if (!set) return
  set.delete(handle)
  if (set.size === 0) activeHandles.delete(element)
}

function clearOwnedStyles(elements: Iterable<HTMLElement>, properties: readonly string[]) {
  for (const element of elements) {
    for (const property of properties) {
      element.style.removeProperty(property)
    }
  }
}

export const waapiMotion = {
  fromTo(
    targets: readonly HTMLElement[],
    from: Keyframe,
    to: Keyframe,
    options: WaapiFromToOptions,
  ): WaapiMotionHandle[] {
    const uniqueTargets = [...new Set(targets)]
    if (!uniqueTargets.length) return []
    const easing = options.easing ?? DEFAULT_EASING
    const staggerStepMs =
      options.staggerTotalMs && uniqueTargets.length > 1
        ? options.staggerTotalMs / (uniqueTargets.length - 1)
        : 0
    const ownedProperties = options.ownedProperties ?? []

    this.cancel(uniqueTargets, ownedProperties)

    return uniqueTargets.map((element, index) => {
      const delay = Math.round(index * staggerStepMs)
      let settled = false
      let nativeAnimation: Animation | null = null

      const finalize = (mode: 'cancel' | 'finish') => {
        if (settled) return
        settled = true
        if (nativeAnimation) {
          try {
            if (mode === 'finish') nativeAnimation.finish()
            else nativeAnimation.cancel()
          } catch {
            // Animation may already be idle or detached.
          }
          nativeAnimation = null
        }
        untrackHandle(element, handle)
        if (ownedProperties.length) clearOwnedStyles([element], ownedProperties)
      }

      const handle: WaapiMotionHandle = {
        element,
        cancel: () => finalize('cancel'),
        finish: () => finalize('finish'),
      }

      trackHandle(element, handle)

      if (typeof element.animate === 'function') {
        try {
          const animation = element.animate([from, to], {
            duration: options.durationMs,
            delay,
            easing,
            fill: 'none',
          })
          nativeAnimation = animation
          animation.addEventListener('finish', () => {
            if (settled) return
            settled = true
            nativeAnimation = null
            untrackHandle(element, handle)
            if (ownedProperties.length) clearOwnedStyles([element], ownedProperties)
          })
          animation.addEventListener('cancel', () => {
            if (settled) return
            settled = true
            nativeAnimation = null
            untrackHandle(element, handle)
          })
        } catch {
          // Graceful fallback in environments with partial WAAPI support.
          finalize('cancel')
        }
      }

      return handle
    })
  },

  cancel(targets: Iterable<HTMLElement>, ownedProperties: readonly string[] = []) {
    const uniqueTargets = [...new Set(targets)]
    for (const element of uniqueTargets) {
      const handles = activeHandles.get(element)
      if (handles) {
        for (const handle of [...handles]) handle.cancel()
      }
    }
    if (ownedProperties.length) clearOwnedStyles(uniqueTargets, ownedProperties)
  },

  getActive(targets: HTMLElement | Iterable<HTMLElement>): WaapiMotionHandle[] {
    const list = targets instanceof HTMLElement ? [targets] : [...new Set(targets)]
    const result: WaapiMotionHandle[] = []
    for (const element of list) {
      const handles = activeHandles.get(element)
      if (handles) result.push(...handles)
    }
    return result
  },

  clearStyles(targets: Iterable<HTMLElement>, properties: readonly string[]) {
    clearOwnedStyles(targets, properties)
  },
}
