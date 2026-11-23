import { useLayoutEffect, useRef, type RefObject } from 'react'
import { waapiMotion } from './waapiRuntime'
import { prefersReducedMotion, subscribeMotionPreference } from './motionPreference'

const HIGHLIGHT_PROPERTIES = ['background-color', 'box-shadow'] as const

type ChangedValueHighlightOptions = {
  scope: RefObject<HTMLElement | null>
  values: Readonly<Record<string, string | number | null | undefined>>
  selectorAttribute?: string
  enabled?: boolean
}

/**
 * Briefly highlights only the rows/cells whose committed value changed
 * (e.g. stat deltas or swapped disc slots) without shifting layout geometry.
 */
export function useChangedValueHighlight({
  scope,
  values,
  selectorAttribute = 'data-motion-value-key',
  enabled = true,
}: ChangedValueHighlightOptions) {
  const previousRef = useRef<Readonly<Record<string, string | number | null | undefined>> | null>(
    null,
  )
  const signature = JSON.stringify(values)

  useLayoutEffect(() => {
    const root = scope.current
    const previous = previousRef.current
    previousRef.current = { ...values }
    if (!root || !previous || !enabled || prefersReducedMotion()) return

    const changedKeys = Object.keys(values).filter((key) => previous[key] !== values[key])
    if (!changedKeys.length) return

    const targets: HTMLElement[] = []
    for (const key of changedKeys) {
      root.querySelectorAll<HTMLElement>(`[${selectorAttribute}]`).forEach((element) => {
        if (element.getAttribute(selectorAttribute) === key) targets.push(element)
      })
    }
    if (!targets.length) return

    waapiMotion.fromTo(
      targets,
      {
        backgroundColor: 'rgba(112, 90, 158, 0.16)',
        boxShadow: 'inset 3px 0 0 rgba(112, 90, 158, 0.72)',
      },
      {
        backgroundColor: 'rgba(112, 90, 158, 0)',
        boxShadow: 'inset 3px 0 0 rgba(112, 90, 158, 0)',
      },
      {
        durationMs: 420,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        ownedProperties: HIGHLIGHT_PROPERTIES,
      },
    )

    const unsubscribe = subscribeMotionPreference(() => {
      if (prefersReducedMotion()) waapiMotion.cancel(targets, HIGHLIGHT_PROPERTIES)
    })
    return () => {
      unsubscribe()
      waapiMotion.cancel(targets, HIGHLIGHT_PROPERTIES)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, signature, selectorAttribute, enabled])
}
