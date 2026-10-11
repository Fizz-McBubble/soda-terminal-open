import type { MouseEvent } from 'react'

/** Keep task and guide navigation inside the workspace, including under shell zoom. */
export function focusScannerWorkspaceTarget(target: HTMLElement | null, revealOnly = false) {
  if (!target) return
  const frame = target.closest<HTMLElement>('.f5v-page-frame')
  if (!frame) {
    target.focus()
    return
  }
  const frameBounds = frame.getBoundingClientRect()
  const scale = frame.offsetHeight ? frameBounds.height / frame.offsetHeight : 1
  const targetBounds = target.getBoundingClientRect()
  const top = revealOnly
    ? targetBounds.top < frameBounds.top + 20 * scale
      ? frame.scrollTop + (targetBounds.top - frameBounds.top) / scale - 20
      : targetBounds.bottom > frameBounds.bottom - 20 * scale
        ? frame.scrollTop + (targetBounds.bottom - frameBounds.bottom) / scale + 20
        : frame.scrollTop
    : frame.scrollTop + (targetBounds.top - frameBounds.top) / scale - 20
  // Native fragment/focus scrolling can also move overflow:hidden ancestors and hide the header.
  document.documentElement.scrollTop = 0
  frame.scrollTop = Math.max(0, top)
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1
  target.focus({ preventScroll: true })
}

export function navigateScannerWorkspace(event: MouseEvent<HTMLElement>) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  const link =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null
  const hash = link?.getAttribute('href')
  if (!hash || hash.length < 2) return
  const target = document.getElementById(hash.slice(1))
  if (!target || !event.currentTarget.contains(target)) return
  event.preventDefault()
  focusScannerWorkspaceTarget(target)
  window.history.replaceState(window.history.state, '', hash)
}
