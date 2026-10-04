import { useCallback, useLayoutEffect, useRef } from 'react'

// Capture the committed page identity before starting async work. A response
// from a page the player has left must not update or navigate the new page.
export function usePageOperationScope(identity: string) {
  const generation = useRef(0)
  useLayoutEffect(() => {
    generation.current += 1
    return () => {
      generation.current += 1
    }
  }, [identity])
  return useCallback(() => {
    const captured = generation.current
    return () => captured === generation.current
  }, [])
}
