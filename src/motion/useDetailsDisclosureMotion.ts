import type { RefObject } from 'react'
import { gsap, useGSAP } from './gsapRuntime'
import { prefersReducedMotion } from './motionPreference'

type DetailsDisclosureMotionOptions = {
  scope: RefObject<HTMLElement | null>
  selector?: string
}

export function detailsDisclosureTargets(details: HTMLDetailsElement) {
  return Array.from(details.children).filter((child): child is HTMLElement => {
    return child instanceof HTMLElement && child.tagName !== 'SUMMARY'
  })
}

/** Adds brief feedback after the browser has already committed a details state. */
export function useDetailsDisclosureMotion({
  scope,
  selector = 'details',
}: DetailsDisclosureMotionOptions) {
  useGSAP(
    () => {
      if (!scope.current) return
      const scopeElement = scope.current
      const cleanups = new Map<HTMLDetailsElement, () => void>()
      const bind = (details: HTMLDetailsElement) => {
        if (cleanups.has(details)) return
        if (details.hasAttribute('data-motion-static')) return
        // Floating explanations have no intrinsic content height; leave their layout alone.
        if (
          detailsDisclosureTargets(details).some((child) =>
            ['absolute', 'fixed'].includes(getComputedStyle(child).position),
          )
        )
          return
        const markedHere = !details.hasAttribute('data-motion-details')
        if (markedHere) details.setAttribute('data-motion-details', '')
        const onToggle = () => {
          const targets = detailsDisclosureTargets(details)
          if (!targets.length) return
          gsap.killTweensOf(targets)
          const nativeTransition =
            typeof CSS !== 'undefined' &&
            typeof CSS.supports === 'function' &&
            CSS.supports('interpolate-size', 'allow-keywords') &&
            CSS.supports('selector(details::details-content)')
          if (!details.open || prefersReducedMotion() || nativeTransition) {
            gsap.set(targets, { clearProps: 'opacity,visibility,transform' })
            return
          }
          gsap.fromTo(
            targets,
            { autoAlpha: 0.74, y: -4 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.18,
              ease: 'power3.out',
              overwrite: 'auto',
              clearProps: 'opacity,visibility,transform',
            },
          )
        }
        details.addEventListener('toggle', onToggle)
        cleanups.set(details, () => {
          details.removeEventListener('toggle', onToggle)
          gsap.killTweensOf(detailsDisclosureTargets(details))
          if (markedHere) details.removeAttribute('data-motion-details')
        })
      }
      const bindWithin = (root: ParentNode) =>
        root.querySelectorAll<HTMLDetailsElement>(selector).forEach(bind)
      bindWithin(scopeElement)
      const observer = new MutationObserver((records) => {
        cleanups.forEach((cleanup, details) => {
          if (scopeElement.contains(details)) return
          cleanup()
          cleanups.delete(details)
        })
        records.forEach((record) =>
          record.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement) || !scopeElement.contains(node)) return
            if (node.matches(selector) && node instanceof HTMLDetailsElement) bind(node)
            bindWithin(node)
          }),
        )
      })
      observer.observe(scopeElement, { childList: true, subtree: true })
      return () => {
        observer.disconnect()
        cleanups.forEach((cleanup) => cleanup())
        cleanups.clear()
      }
    },
    { scope },
  )
}
