import { useCallback, useState, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { currentTeamAnalysisSession } from './teamAnalysisSession'
import { draftFromProfiles } from './planningDraftProjection'
import { assertPlanEditorReservation, planEditorSaveBlockReason } from './planEditorSaveProjection'
import type { PlanEditorProps } from './PlanEditorProps'

type Reservation = Parameters<typeof assertPlanEditorReservation>[0]
type Draft = ReturnType<typeof draftFromProfiles>
type EditorState = { draft: Draft; dirty: boolean; saved: boolean }
// Temporary navigation state only; never persisted to account storage.
const drafts = new Map<string, EditorState>()
const listeners = new Map<string, Set<() => void>>()

export function usePlanEditorDraft({ kind, profiles, warehouse, team, restored }: PlanEditorProps) {
  const key = JSON.stringify([
    warehouse.accountId,
    kind,
    restored?.id ?? null,
    team?.id ?? null,
    profiles.map((profile) => profile.agentId),
  ])
  const makeInitial = (): EditorState => ({
    draft:
      restored ??
      draftFromProfiles(
        kind,
        profiles,
        warehouse.discs.slice(0, 6).map((disc) => disc.id),
        team,
      ),
    dirty: false,
    saved: restored?.state === 'saved',
  })
  const [baseline, setBaseline] = useState(() => ({ key, state: makeInitial() }))
  let initial = baseline.state
  if (baseline.key !== key) {
    initial = makeInitial()
    setBaseline({ key, state: initial })
  }
  const subscribe = useCallback(
    (listener: () => void) => {
      const subscribers = listeners.get(key) ?? new Set<() => void>()
      subscribers.add(listener)
      listeners.set(key, subscribers)
      return () => {
        subscribers.delete(listener)
        if (!subscribers.size) {
          listeners.delete(key)
          const completed = drafts.get(key)
          if (completed && !completed.dirty) {
            queueMicrotask(() => {
              if (!listeners.has(key) && drafts.get(key) === completed) drafts.delete(key)
            })
          }
        }
      }
    },
    [key],
  )
  const getSnapshot = useCallback(() => drafts.get(key) ?? initial, [key, initial])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const latest = () => drafts.get(key) ?? state
  const update = (next: EditorState) => {
    drafts.set(key, next)
    listeners.get(key)?.forEach((notify) => notify())
  }
  const setDraft: Dispatch<SetStateAction<Draft>> = (value) => {
    const previous = latest()
    const draft = typeof value === 'function' ? value(previous.draft) : value
    update({ ...previous, draft, dirty: true, saved: false })
  }
  const setDirty = (dirty: boolean) => {
    const previous = latest()
    update({ ...previous, draft: dirty ? { ...previous.draft } : previous.draft, dirty })
  }
  const setSaved = (saved: boolean) => update({ ...latest(), saved })
  const discard = () => {
    drafts.delete(key)
  }
  const commit = (submitted: Draft, savedDraft: Draft) => {
    if (latest().draft !== submitted) return false
    update({ draft: savedDraft, dirty: false, saved: true })
    return true
  }
  return { ...state, setDraft, setDirty, setSaved, discard, commit }
}

export function claimPlanEditorSave(
  saving: { current: boolean },
  guard: Parameters<typeof planEditorSaveBlockReason>[0],
  setMessage: (message: string) => void,
) {
  if (saving.current) return false
  const blockReason = planEditorSaveBlockReason(guard)
  if (blockReason !== undefined) {
    if (blockReason) setMessage(blockReason)
    return false
  }
  saving.current = true
  return true
}

export function assertCurrentPlanEditorReservation(
  kind: PlanEditorProps['kind'],
  decisionInput: Reservation['decisionInput'],
  liveFingerprint: Reservation['liveFingerprint'],
  targetTeamFit: Reservation['targetTeamFit'],
) {
  const remainingSession = kind === 'team' ? currentTeamAnalysisSession?.result : undefined
  assertPlanEditorReservation({ decisionInput, liveFingerprint, remainingSession, targetTeamFit })
  return remainingSession
}
