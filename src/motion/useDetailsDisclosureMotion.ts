import type { RefObject } from 'react'
import { gsap, useGSAP } from './gsapRuntime'
import { prefersReducedMotion, subscribeMotionPreference } from './motionPreference'

type DetailsDisclosureMotionOptions = {
  scope: RefObject<HTMLElement | null>
  selector?: string
}

export function detailsDisclosureTargets(details: HTMLDetailsElement) {
  return Array.from(details.children).filter((child): child is HTMLElement => {
    return child instanceof HTMLElement && child.tagName !== 'SUMMARY'
  })
}

type DisclosureBinding = {
  scope: HTMLElement
  start: () => () => void
}
type DisclosureEntry = {
  bindings: Set<DisclosureBinding>
  owner?: DisclosureBinding
  stop?: () => void
}

// One DOM resource per details node. Other mounted consumers retain a claim so
// removing or moving its current owner can hand it over without another listener.
const disclosureEntries = new WeakMap<HTMLDetailsElement, DisclosureEntry>()

function reconcileDisclosure(details: HTMLDetailsElement, entry: DisclosureEntry) {
  const ownerIsCurrent =
    entry.owner && entry.bindings.has(entry.owner) && entry.owner.scope.contains(details)
  if (!ownerIsCurrent) {
    entry.stop?.()
    entry.stop = undefined
    entry.owner = undefined
    const next = Array.from(entry.bindings).find((binding) => binding.scope.contains(details))
    if (next) {
      entry.owner = next
      entry.stop = next.start()
    }
  }
  if (!entry.bindings.size) disclosureEntries.delete(details)
}

/** Adds brief feedback after the browser has already committed a details state. */
export function useDetailsDisclosureMotion({
  scope,
  selector = 'details',
}: DetailsDisclosureMotionOptions) {
  useGSAP(
    () => {
      const scopeElement = scope.current
      if (!scopeElement) return
      const managed = new Map<
        HTMLDetailsElement,
        {
          binding: DisclosureBinding
          entry: DisclosureEntry
        }
      >()
      const bind = (details: HTMLDetailsElement) => {
        if (managed.has(details) || details.hasAttribute('data-motion-static')) return
        if (
          detailsDisclosureTargets(details).some((child) =>
            ['absolute', 'fixed'].includes(getComputedStyle(child).position),
          )
        )
          return
        const entry = disclosureEntries.get(details) ?? {
          bindings: new Set<DisclosureBinding>(),
        }
        const binding: DisclosureBinding = {
          scope: scopeElement,
          start: () => {
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
            return () => {
              details.removeEventListener('toggle', onToggle)
              const targets = detailsDisclosureTargets(details)
              if (targets.length) {
                gsap.killTweensOf(targets)
                gsap.set(targets, { clearProps: 'opacity,visibility,transform' })
              }
              if (markedHere) details.removeAttribute('data-motion-details')
            }
          },
        }
        managed.set(details, { binding, entry })
        entry.bindings.add(binding)
        disclosureEntries.set(details, entry)
        reconcileDisclosure(details, entry)
      }
      const release = (details: HTMLDetailsElement) => {
        const claim = managed.get(details)
        if (!claim) return
        managed.delete(details)
        claim.entry.bindings.delete(claim.binding)
        reconcileDisclosure(details, claim.entry)
      }
      const bindWithin = (root: ParentNode) =>
        root.querySelectorAll<HTMLDetailsElement>(selector).forEach(bind)
      bindWithin(scopeElement)
      const observer = new MutationObserver((records) => {
        managed.forEach((_claim, details) => {
          if (!scopeElement.contains(details)) release(details)
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
      const unsubscribe = subscribeMotionPreference(() => {
        if (!prefersReducedMotion()) return
        managed.forEach(({ binding, entry }, details) => {
          if (entry.owner !== binding) return
          const targets = detailsDisclosureTargets(details)
          gsap.killTweensOf(targets)
          gsap.set(targets, { clearProps: 'opacity,visibility,transform' })
        })
      })
      return () => {
        unsubscribe()
        observer.disconnect()
        managed.forEach((_claim, details) => release(details))
      }
    },
    { scope, dependencies: [selector], revertOnUpdate: true },
  )
}
