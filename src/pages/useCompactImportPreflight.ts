import { useEffect, useRef } from 'react'

// Retry is explicit after a failure; a new account, batch or review revision gets its own check.
export function useCompactImportPreflight(
  key: string,
  enabled: boolean,
  busy: boolean,
  run: () => Promise<void>,
) {
  const attempted = useRef(new Set<string>())
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  }, [run])
  useEffect(() => {
    if (!enabled || busy || attempted.current.has(key)) return
    attempted.current.add(key)
    void runRef.current()
  }, [key, enabled, busy])
}
