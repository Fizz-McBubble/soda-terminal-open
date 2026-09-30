import type { Dispatch, SetStateAction } from 'react'
import type { AccountPlanningDraft } from '../../accounts/types'
import { getAgentName } from '../../application/publicRosterNames'
import { remainingBoxPlanReservation } from '../../application/remainingBox'
import type { useAccountDecisionWorld } from '../../application/accountDecisionWorldHooks'

export function TeamRemainingBoxSelector({
  savedTeamPlans,
  decisionWorld,
  reservedPlanIds,
  setReservedPlanIds,
  remainingBoxOpen,
  setRemainingBoxOpen,
  onStartRemainingBoxAnalysis,
  analysisRunning,
  remainingBoxError,
}: {
  savedTeamPlans: AccountPlanningDraft[] | undefined
  decisionWorld: ReturnType<typeof useAccountDecisionWorld>
  reservedPlanIds: string[]
  setReservedPlanIds: Dispatch<SetStateAction<string[]>>
  remainingBoxOpen: boolean
  setRemainingBoxOpen: (open: boolean) => void
  onStartRemainingBoxAnalysis: () => void
  analysisRunning: boolean
  remainingBoxError: string | null
}) {
  if (!savedTeamPlans || savedTeamPlans.length === 0) return null

  return (
    <details
      className="f5v-remaining-box"
      aria-label="用其他角色配队"
      open={remainingBoxOpen}
      onToggle={(event) => setRemainingBoxOpen(event.currentTarget.open)}
    >
      <summary>再组一队</summary>
      <div className="f5v-remaining-box__content">
        <p>保留勾选队伍的成员与驱动盘，为你推荐另一支队伍。</p>
        <div className="f5v-remaining-box__plans">
          {savedTeamPlans.map((plan) => {
            let ready = false
            if (decisionWorld.liveInput) {
              try {
                remainingBoxPlanReservation(plan, decisionWorld.liveInput)
                ready = true
              } catch {
                /* displayed below */
              }
            }
            return (
              <label key={plan.id} className="f5v-remaining-box__plan">
                <input
                  type="checkbox"
                  checked={reservedPlanIds.includes(plan.id)}
                  onChange={(event) =>
                    setReservedPlanIds((ids) =>
                      event.target.checked ? [...ids, plan.id] : ids.filter((id) => id !== plan.id),
                    )
                  }
                />
                <span className="f5v-remaining-box__identity">
                  <strong>{plan.selection.agentIds.map(getAgentName).join(' · ')}</strong>
                </span>
                <span className={`f5v-remaining-box__readiness${ready ? '' : ' is-incomplete'}`}>
                  {ready ? '18 张盘齐全' : '需核对配装'}
                </span>
              </label>
            )
          })}
        </div>
        <button
          className="f5v-box-analysis-entry__action"
          type="button"
          onClick={onStartRemainingBoxAnalysis}
          disabled={!reservedPlanIds.length || analysisRunning}
        >
          推荐另一队
        </button>
        {remainingBoxError ? <p role="alert">{remainingBoxError}</p> : null}
      </div>
    </details>
  )
}
