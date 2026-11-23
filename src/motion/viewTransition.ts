import { prefersReducedMotion } from './motionPreference'

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => {
    finished: Promise<void>
  }
}

export type ViewTransitionOptions = {
  /** Optional element or selector to focus once the transition settles for keyboard/SR continuity. */
  focusTarget?: HTMLElement | (() => HTMLElement | null) | null
}

function focusResolvedTarget(target: ViewTransitionOptions['focusTarget']) {
  if (!target) return
  const element = typeof target === 'function' ? target() : target
  element?.focus({ preventScroll: true })
}

/**
 * Progressive-enhancement wrapper around `document.startViewTransition()`.
 * Falls back synchronously when unsupported or when system reduced motion is enabled.
 */
export function runViewTransition(
  update: () => void,
  options: ViewTransitionOptions = {},
): void {
  const doc = typeof document !== 'undefined' ? (document as ViewTransitionDocument) : undefined
  if (!doc || typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    update()
    focusResolvedTarget(options.focusTarget)
    return
  }
  try {
    const transition = doc.startViewTransition(() => {
      update()
    })
    void transition.finished.finally(() => {
      focusResolvedTarget(options.focusTarget)
    })
  } catch {
    update()
    focusResolvedTarget(options.focusTarget)
  }
}
