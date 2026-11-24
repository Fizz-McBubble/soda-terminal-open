import type { SavedLuminizeReplay32 } from '../application/savedLuminizeReplay32'
import { FormedTeamReference } from './FormedTeamReference'
import type { FormedTeamReference as Reference } from '../application/publicFormedTeamReference'

import { SavedEquipmentNote } from './SavedEquipmentNote'

export function PlanEditorSavedStateNotices({
  objectiveNote,
  needsTeamRecovery,
  staleNotice,
  reanalyze,
  luminizeSettlement32,
  formedTeamReference,
  currentSavedDiscScore = false,
}: {
  objectiveNote: string | undefined
  needsTeamRecovery: boolean
  staleNotice: string | null | undefined
  reanalyze: () => void
  luminizeSettlement32?: SavedLuminizeReplay32
  formedTeamReference?: Reference
  currentSavedDiscScore?: boolean
}) {
  return (
    <>
      <FormedTeamReference reference={formedTeamReference} saved />
      <SavedEquipmentNote note={objectiveNote} settlement={luminizeSettlement32} />
      {needsTeamRecovery && staleNotice ? (
        <section
          className="panel status-card"
          role="status"
          aria-label={currentSavedDiscScore ? '原盘当前评分说明' : '已保存方案重新匹配'}
        >
          <p>
            {currentSavedDiscScore
              ? '已按最新资料重算原18张驱动盘，历史记录保持原样。'
              : staleNotice}
          </p>
          {!currentSavedDiscScore ? (
            <button className="button button--secondary" type="button" onClick={reanalyze}>
              重新匹配当前队伍
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
