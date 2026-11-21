import { useRef, type RefObject } from 'react'
import { gsap, useGSAP } from './gsapRuntime'
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
  content: { opacity: 0.88, y: 3, duration: 0.24 },
  // Keep the scroll owner and floating anchors stationary during navigation.
  route: { opacity: 0.94, y: 0, duration: 0.2 },
  result: { opacity: 0.92, y: 0, duration: 0.24 },
} as const

export function stateTransitionTargets(scope: HTMLElement, target: string, includeScope: boolean) {
  return includeScope ? [scope] : Array.from(scope.querySelectorAll<HTMLElement>(target))
}

/**
 * Adds a visual bridge after React has committed a new state. This hook never
 * decides, delays, or persists that state.
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

  useGSAP(
    () => {
      if (!scope.current) return
      const targets = stateTransitionTargets(scope.current, target, includeScope)
      if (!targets.length) return
      const isResult = transition === 'result'
      const ownedStyles = isResult ? 'opacity,visibility,filter' : 'opacity,visibility,transform'
      const active: { animation?: ReturnType<typeof gsap.fromTo> } = {}

      const clearTransition = () => {
        if (isResult) active.animation?.progress(1)
        active.animation?.kill()
        gsap.killTweensOf(targets)
        gsap.set(targets, { clearProps: ownedStyles })
        targets.forEach((element) => {
          if (isResult) {
            element.style.removeProperty('filter')
          } else {
            element.style.removeProperty('transform')
          }
          element.style.removeProperty('opacity')
          element.style.removeProperty('visibility')
        })
      }
      clearTransition()
      if ((!mounted.current && !animateOnMount) || !enabled || prefersReducedMotion()) {
        mounted.current = true
        return
      }
      mounted.current = true
      const timing = transitions[transition]
      active.animation = gsap.fromTo(
        targets,
        isResult
          ? { opacity: timing.opacity, filter: 'blur(0.8px)' }
          : transition === 'route'
            ? { opacity: timing.opacity }
            : { opacity: timing.opacity, y: timing.y },
        {
          opacity: 1,
          ...(isResult
            ? { filter: 'blur(0px)', stagger: { amount: 0.06 } }
            : transition === 'route'
              ? {}
              : { y: 0 }),
          duration: timing.duration,
          ease: 'power3.out',
          overwrite: 'auto',
          clearProps: ownedStyles,
        },
      )
      const unsubscribe = subscribeMotionPreference(() => {
        if (prefersReducedMotion()) clearTransition()
      })
      return () => {
        unsubscribe()
        clearTransition()
      }
    },
    {
      dependencies: [stateKey, target, includeScope, enabled, animateOnMount, transition],
      scope,
      revertOnUpdate: true,
    },
  )
}
