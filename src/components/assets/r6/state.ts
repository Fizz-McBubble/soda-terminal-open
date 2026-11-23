import { useEffect, useState } from 'react'

export function useReconciledSelection(ids: string[], preferred: string | undefined) {
  const [selected, setSelected] = useState(preferred ?? ids[0] ?? '')
  const reconciled = ids.includes(selected)
    ? selected
    : preferred && ids.includes(preferred)
      ? preferred
      : (ids[0] ?? '')
  return [reconciled, setSelected] as const
}

type DraftState<T> = {
  draft: T
  baseRevision: string
  dirty: boolean
  awaitingProjection: boolean
  previousRevisions?: string[]
}

// Process-memory only. Each entry belongs to one account and one agent and is removed
// when its submitted version has reached the source projection.
const agentDrafts = new Map<string, DraftState<unknown>>()
const draftListeners = new Map<string, Set<() => void>>()
function notifyDraft(key: string) {
  draftListeners.get(key)?.forEach((listener) => listener())
}

export function useDraft<T>(
  source: T,
  revision: string,
  key: string,
  { retainOnUnmount = true }: { retainOnUnmount?: boolean } = {},
) {
  const [, render] = useState(0)
  const [viewDrafts] = useState(() => new Map<string, DraftState<unknown>>())
  const drafts = retainOnUnmount ? agentDrafts : viewDrafts
  const notify = () => (retainOnUnmount ? notifyDraft(key) : render((version) => version + 1))
  useEffect(() => {
    if (!retainOnUnmount) return
    const listeners = draftListeners.get(key) ?? new Set<() => void>()
    const listener = () => render((version) => version + 1)
    listeners.add(listener)
    draftListeners.set(key, listeners)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) draftListeners.delete(key)
    }
  }, [key, retainOnUnmount])
  const stored = drafts.get(key) as DraftState<T> | undefined
  let current = stored ?? {
    draft: source,
    baseRevision: revision,
    dirty: false,
    awaitingProjection: false,
  }
  if (current.awaitingProjection && current.baseRevision === revision) {
    current = current.dirty
      ? { ...current, awaitingProjection: false }
      : { draft: source, baseRevision: revision, dirty: false, awaitingProjection: false }
    if (current.dirty) drafts.set(key, current)
    else drafts.delete(key)
  }
  if (
    current.awaitingProjection &&
    revision !== current.baseRevision &&
    !current.previousRevisions?.includes(revision) &&
    !current.dirty
  ) {
    current = { draft: source, baseRevision: revision, dirty: false, awaitingProjection: false }
    drafts.delete(key)
  }
  const setDraft = (draft: T) => {
    const latest = (drafts.get(key) as DraftState<T> | undefined) ?? current
    drafts.set(key, { ...latest, draft, dirty: true })
    notify()
  }
  const rebase = (submitted: T, baseRevision: string) => {
    const latest = (drafts.get(key) as DraftState<T> | undefined) ?? current
    const changedSinceSubmit = latest.draft !== submitted
    drafts.set(key, {
      draft: changedSinceSubmit ? latest.draft : submitted,
      baseRevision,
      dirty: changedSinceSubmit,
      awaitingProjection: true,
      previousRevisions: [
        ...new Set([
          ...(latest.awaitingProjection ? (latest.previousRevisions ?? []) : []),
          latest.baseRevision,
          revision,
        ]),
      ],
    })
    notify()
  }
  return {
    ...current,
    stale:
      current.dirty &&
      current.baseRevision !== revision &&
      (!current.awaitingProjection || !current.previousRevisions?.includes(revision)),
    setDraft,
    rebase,
  }
}
