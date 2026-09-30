import { useState } from 'react'
import { currentTeamAnalysisSession } from './teamAnalysisSession'
import { draftFromProfiles } from './planningDraftProjection'
import { assertPlanEditorReservation, planEditorSaveBlockReason } from './planEditorSaveProjection'
import type { PlanEditorProps } from './PlanEditorProps'

type Reservation = Parameters<typeof assertPlanEditorReservation>[0]

export function usePlanEditorDraft({ kind, profiles, warehouse, team, restored }: PlanEditorProps) {
  return useState(
    () =>
      restored ??
      draftFromProfiles(
        kind,
        profiles,
        warehouse.discs.slice(0, 6).map((disc) => disc.id),
        team,
      ),
  )
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
