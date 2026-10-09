import { useCallback, useEffect, useEffectEvent, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { LocalDataFileKind } from './localDataFile'

type Handoff = { token: string; kind: LocalDataFileKind; file: File }
// Keep only the latest file in memory. Neither account bytes nor file paths go into history,
// storage, or a request; leaving/reloading the application releases the file.
let pending: Handoff | null = null

export function useLocalDataFileHandoff(
  kind: LocalDataFileKind,
  onReceive: (file: File) => void,
  ready = true,
) {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { localDataFileToken?: unknown } | null
  const token = typeof state?.localDataFileToken === 'string' ? state.localDataFileToken : null
  const received = useRef<Handoff | null>(null)
  const receive = useEffectEvent(onReceive)

  useEffect(() => {
    if (received.current?.token !== token || !ready) received.current = null
    if (!token || !ready) return
    if (pending?.token === token && pending.kind === kind) {
      received.current = pending
      pending = null
    }
    // Retain the claimed file for Strict Mode's effect replay. A later mount cannot replay it.
    if (received.current?.token === token && received.current.kind === kind)
      receive(received.current.file)
  }, [kind, token, ready])

  return useCallback(
    (file: File, destination: LocalDataFileKind) => {
      const next = { token: crypto.randomUUID(), kind: destination, file }
      pending = next
      navigate(
        destination === 'account-backup' ? '/assets/account#restore-backup' : '/system/scanner',
        { state: { localDataFileToken: next.token } },
      )
    },
    [navigate],
  )
}
