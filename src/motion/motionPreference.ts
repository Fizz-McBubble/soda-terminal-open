export const MOTION_MODE_ATTRIBUTE = 'data-soda-motion'

export function prefersReducedMotion(
  windowRoot: Pick<Window, 'matchMedia'> | undefined = typeof window === 'undefined'
    ? undefined
    : window,
  documentRoot: Pick<Document, 'documentElement'> | undefined = typeof document === 'undefined'
    ? undefined
    : document,
) {
  if (documentRoot?.documentElement.getAttribute(MOTION_MODE_ATTRIBUTE) === 'off') return true
  if (!windowRoot || typeof windowRoot.matchMedia !== 'function') return true
  return windowRoot.matchMedia('(prefers-reduced-motion: reduce)').matches
}
