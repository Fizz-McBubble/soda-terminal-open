/** Observe the system preference while motion is active. Re-enabling never replays it. */
export function subscribeMotionPreference(onChange: () => void) {
  const media =
    typeof window === 'undefined'
      ? undefined
      : window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const legacyMedia = media as
    | (MediaQueryList & {
        addListener?: (listener: (event: MediaQueryListEvent) => void) => void
        removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
      })
    | undefined
  if (typeof media?.addEventListener === 'function') media.addEventListener('change', onChange)
  else legacyMedia?.addListener?.(onChange)
  return () => {
    if (typeof media?.removeEventListener === 'function')
      media.removeEventListener('change', onChange)
    else legacyMedia?.removeListener?.(onChange)
  }
}

export function prefersReducedMotion(
  windowRoot: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined'
    ? undefined
    : window,
) {
  if (!windowRoot || typeof windowRoot.matchMedia !== 'function') return true
  return windowRoot.matchMedia('(prefers-reduced-motion: reduce)').matches
}
