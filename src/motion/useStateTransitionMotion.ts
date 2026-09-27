import { useRef, type RefObject } from 'react'
import { gsap, useGSAP } from './gsapRuntime'
import { prefersReducedMotion } from './motionPreference'

type StateTransitionMotionOptions = {
  scope: RefObject<HTMLElement | null>
  stateKey: string | number
  target?: string
  includeScope?: boolean
  enabled?: boolean
  animateOnMount?: boolean
}

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
}: StateTransitionMotionOptions) {
  const mounted = useRef(false)

  useGSAP(
    () => {
      if (!scope.current) return
      const targets = stateTransitionTargets(scope.current, target, includeScope)
      if (!targets.length) return

      gsap.killTweensOf(targets)
      if ((!mounted.current && !animateOnMount) || !enabled || prefersReducedMotion()) {
        mounted.current = true
        gsap.set(targets, { clearProps: 'opacity,visibility,transform' })
        return
      }
      mounted.current = true

      gsap.fromTo(
        targets,
        { opacity: 0.88, y: 3 },
        {
          opacity: 1,
          y: 0,
          duration: 0.24,
          ease: 'power3.out',
          overwrite: 'auto',
          clearProps: 'opacity,visibility,transform',
        },
      )
    },
    {
      dependencies: [stateKey, target, includeScope, enabled, animateOnMount],
      scope,
      revertOnUpdate: true,
    },
  )
}
