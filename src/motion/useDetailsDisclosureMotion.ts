import { useLayoutEffect, type RefObject } from 'react'
import { waapiMotion } from './waapiRuntime'
import { prefersReducedMotion, subscribeMotionPreference } from './motionPreference'

const OWNED_STYLE_PROPERTIES = ['opacity', 'visibility', 'transform'] as const
const SPRING_OUT_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

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

const FLOATING_CHILD_SELECTOR =
  '[data-motion-floating], [popover], .explanation-popover, .f5v-select-menu-popover, [role="menu"], [role="listbox"], [role="dialog"]'

/** Declarative floating-panel check — avoids forcing layout via getComputedStyle inside MutationObserver. */
export function isFloatingDisclosure(details: HTMLDetailsElement) {
  if (details.hasAttribute('data-motion-floating') || details.classList.contains('source-details'))
    return true
  return detailsDisclosureTargets(details).some(
    (child) =>
      child.style.position === 'absolute' ||
      child.style.position === 'fixed' ||
      child.matches(FLOATING_CHILD_SELECTOR),
  )
}

/** Adds brief compositor feedback after the browser has already committed a details state. */
export function useDetailsDisclosureMotion({
  scope,
  selector = 'details',
}: DetailsDisclosureMotionOptions) {
  useLayoutEffect(() => {
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
      if (isFloatingDisclosure(details)) return
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
            waapiMotion.cancel(targets, OWNED_STYLE_PROPERTIES)
            const nativeTransition =
              typeof CSS !== 'undefined' &&
              typeof CSS.supports === 'function' &&
              CSS.supports('interpolate-size', 'allow-keywords') &&
              CSS.supports('selector(details::details-content)')
            if (!details.open || prefersReducedMotion() || nativeTransition) {
              waapiMotion.clearStyles(targets, OWNED_STYLE_PROPERTIES)
              return
            }
            waapiMotion.fromTo(
              targets,
              { opacity: 0.65, transform: 'translate3d(0, -6px, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
              {
                durationMs: 210,
                easing: SPRING_OUT_EASING,
                ownedProperties: OWNED_STYLE_PROPERTIES,
              },
            )
          }
          details.addEventListener('toggle', onToggle)
          return () => {
            details.removeEventListener('toggle', onToggle)
            const targets = detailsDisclosureTargets(details)
            if (targets.length) {
              waapiMotion.cancel(targets, OWNED_STYLE_PROPERTIES)
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
        waapiMotion.cancel(targets, OWNED_STYLE_PROPERTIES)
      })
    })
    return () => {
      unsubscribe()
      observer.disconnect()
      managed.forEach((_claim, details) => release(details))
    }
  }, [scope, selector])
}
