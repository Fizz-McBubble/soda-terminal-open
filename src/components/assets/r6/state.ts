import { useState } from 'react'

export function useReconciledSelection(ids: string[], preferred: string | undefined) {
  const [selected, setSelected] = useState(preferred ?? ids[0] ?? '')
  const reconciled = ids.includes(selected)
    ? selected
    : preferred && ids.includes(preferred)
      ? preferred
      : (ids[0] ?? '')
  return [reconciled, setSelected] as const
}

export function useDraft<T>(source: T, revision: string) {
  const [state, setState] = useState({
    draft: source,
    baseRevision: revision,
    dirty: false,
    awaitingProjection: false,
  })
  const projectionArrived = state.awaitingProjection && state.baseRevision === revision
  const current =
    !projectionArrived && (state.dirty || state.awaitingProjection)
      ? state
      : { draft: source, baseRevision: revision, dirty: false, awaitingProjection: false }
  const setDraft = (draft: T) =>
    setState({ draft, baseRevision: current.baseRevision, dirty: true, awaitingProjection: false })
  // A successful explicit save has already passed the source revision check. Do not leave the
  // editor dirty while its parent refreshes from IndexedDB, otherwise the just-saved draft is
  // immediately treated as stale and a second edit cannot be saved.
  const rebase = (draft: T, baseRevision: string) =>
    setState({ draft, baseRevision, dirty: false, awaitingProjection: true })
  return { ...current, stale: current.dirty && current.baseRevision !== revision, setDraft, rebase }
}
