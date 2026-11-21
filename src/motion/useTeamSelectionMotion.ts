import { useRef, type RefObject } from 'react'
import { gsap, useGSAP } from './gsapRuntime'
import { prefersReducedMotion, subscribeMotionPreference } from './motionPreference'

const TEAM_MEMBER_SELECTOR = '[data-team-member-id]'
const OWNED_STYLE_PROPERTIES = 'clipPath,transform,opacity'

type TeamSelectionMotionOptions = {
  scope: RefObject<HTMLElement | null>
  selectionKey: string
  memberIds: readonly string[]
}

function clearTeamMemberMotion(targets: Iterable<HTMLElement>) {
  const elements = [...new Set(targets)]
  if (!elements.length) return
  gsap.getTweensOf(elements).forEach((tween) => tween.progress(1))
  gsap.killTweensOf(elements)
  gsap.set(elements, { clearProps: OWNED_STYLE_PROPERTIES })
  elements.forEach((element) => {
    element.style.removeProperty('clip-path')
    element.style.removeProperty('transform')
    element.style.removeProperty('opacity')
  })
}

export function newlySelectedTeamMemberIds(
  previousMemberIds: ReadonlySet<string>,
  memberIds: readonly string[],
) {
  const seen = new Set<string>()
  return memberIds.filter((memberId) => {
    if (previousMemberIds.has(memberId) || seen.has(memberId)) return false
    seen.add(memberId)
    return true
  })
}

export function teamSelectionMemberTargets(scope: HTMLElement, memberIds: readonly string[]) {
  const requestedIds = new Set(memberIds)
  const targetsById = new Map<string, HTMLElement>()
  scope.querySelectorAll<HTMLElement>(TEAM_MEMBER_SELECTOR).forEach((target) => {
    const memberId = target.getAttribute('data-team-member-id')
    if (memberId && requestedIds.has(memberId) && !targetsById.has(memberId)) {
      targetsById.set(memberId, target)
    }
  })
  return [...new Set(memberIds)].flatMap((memberId) => {
    const target = targetsById.get(memberId)
    return target ? [target] : []
  })
}

/**
 * Bridges only the member cards added by a committed selection change. The
 * settled React state and its data attributes remain authoritative throughout.
 */
export function useTeamSelectionMotion({
  scope,
  selectionKey,
  memberIds,
}: TeamSelectionMotionOptions) {
  const previousMemberIds = useRef<ReadonlySet<string> | null>(null)
  const activeTargets = useRef<Set<HTMLElement>>(new Set())
  const memberSignature = JSON.stringify(memberIds)

  useGSAP(
    () => {
      const scopeElement = scope.current
      if (!scopeElement) return

      const stopActiveMotion = () => {
        clearTeamMemberMotion(activeTargets.current)
        activeTargets.current.clear()
      }
      stopActiveMotion()

      const currentMemberIds = [...memberIds]
      const previousMembers = previousMemberIds.current
      previousMemberIds.current = new Set(currentMemberIds)
      const shouldAnimate = previousMembers !== null && !prefersReducedMotion()

      if (shouldAnimate) {
        const addedMemberIds = newlySelectedTeamMemberIds(previousMembers, currentMemberIds)
        const targets = teamSelectionMemberTargets(scopeElement, addedMemberIds)
        if (targets.length) {
          targets.forEach((target) => activeTargets.current.add(target))
          gsap.fromTo(
            targets,
            {
              clipPath: 'inset(0 0 8% 0)',
              opacity: 0.86,
              y: 6,
            },
            {
              clipPath: 'inset(0 0 0% 0)',
              opacity: 1,
              y: 0,
              duration: 0.22,
              ease: 'power3.out',
              overwrite: 'auto',
              clearProps: OWNED_STYLE_PROPERTIES,
            },
          )
        }
      }

      const unsubscribe = subscribeMotionPreference(() => {
        if (prefersReducedMotion()) stopActiveMotion()
      })

      return () => {
        unsubscribe()
        stopActiveMotion()
      }
    },
    {
      dependencies: [selectionKey, memberSignature],
      scope,
      revertOnUpdate: true,
    },
  )
}
