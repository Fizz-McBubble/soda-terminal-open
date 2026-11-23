import { useLayoutEffect, useRef, type RefObject } from 'react'
import { waapiMotion } from './waapiRuntime'
import { prefersReducedMotion, subscribeMotionPreference } from './motionPreference'

type StateTransitionMotionOptions = {
  scope: RefObject<HTMLElement | null>
  stateKey: string | number
  target?: string
  includeScope?: boolean
  enabled?: boolean
  animateOnMount?: boolean
  transition?: 'content' | 'route' | 'result'
}

const transitions = {
  content: { opacity: 0.72, y: 7, scale: 0.994, durationMs: 260, staggerTotalMs: 55 },
  // Keep the scroll owner and floating anchors stationary during navigation.
  route: { opacity: 0.84, y: 0, scale: 1, durationMs: 220, staggerTotalMs: 0 },
  // Pure compositor opacity cascade: avoids filter blur fuzziness on CJK text and keeps result grids stationary.
  result: { opacity: 0.68, y: 0, scale: 1, durationMs: 240, staggerTotalMs: 65 },
} as const

const SPRING_OUT_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function stateTransitionTargets(scope: HTMLElement, target: string, includeScope: boolean) {
  return includeScope ? [scope] : Array.from(scope.querySelectorAll<HTMLElement>(target))
}

/**
 * Adds a compositor-native visual bridge after React has committed a new state.
 * This hook never decides, delays, or persists that state.
 */
export function useStateTransitionMotion({
  scope,
  stateKey,
  target = '[data-motion-state-content]',
  includeScope = false,
  enabled = true,
  animateOnMount = false,
  transition = 'content',
}: StateTransitionMotionOptions) {
  const mounted = useRef(false)

  useLayoutEffect(() => {
    if (!scope.current) return
    const targets = stateTransitionTargets(scope.current, target, includeScope)
    if (!targets.length) return
    const isStationary = transition === 'result' || transition === 'route'
    const ownedProperties = isStationary
      ? (['opacity', 'visibility'] as const)
      : (['opacity', 'visibility', 'transform'] as const)

    const clearTransition = () => {
      waapiMotion.cancel(targets, ownedProperties)
    }

    clearTransition()
    if ((!mounted.current && !animateOnMount) || !enabled || prefersReducedMotion()) {
      mounted.current = true
      return
    }
    mounted.current = true

    const timing = transitions[transition]
    const fromKeyframe: Keyframe = isStationary
      ? { opacity: timing.opacity }
      : {
          opacity: timing.opacity,
          transform: `translate3d(0, ${timing.y}px, 0) scale(${timing.scale})`,
        }
    const toKeyframe: Keyframe = isStationary
      ? { opacity: 1 }
      : { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }

    waapiMotion.fromTo(targets, fromKeyframe, toKeyframe, {
      durationMs: timing.durationMs,
      easing: SPRING_OUT_EASING,
      staggerTotalMs: timing.staggerTotalMs,
      ownedProperties,
    })

    const unsubscribe = subscribeMotionPreference(() => {
      if (prefersReducedMotion()) clearTransition()
    })
    return () => {
      unsubscribe()
      clearTransition()
    }
  }, [scope, stateKey, target, includeScope, enabled, animateOnMount, transition])
}
