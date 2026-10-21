import type { SavedLuminizeReplay32 } from '../application/savedLuminizeReplay32'
import { FormedTeamReference } from './FormedTeamReference'
import type { FormedTeamReference as Reference } from '../application/publicFormedTeamReference'

export function PlanEditorSavedStateNotices({
  objectiveNote,
  needsTeamRecovery,
  staleNotice,
  reanalyze,
  luminizeSettlement32,
  formedTeamReference,
}: {
  objectiveNote: string | undefined
  needsTeamRecovery: boolean
  staleNotice: string | null | undefined
  reanalyze: () => void
  luminizeSettlement32?: SavedLuminizeReplay32
  formedTeamReference?: Reference
}) {
  return (
    <>
      <FormedTeamReference reference={formedTeamReference} saved />
      {objectiveNote || luminizeSettlement32 ? (
        <p
          className={
            !objectiveNote && luminizeSettlement32?.status === 'declared_arithmetic'
              ? 'team-execution__evidence'
              : 'team-execution__scheme-degrade'
          }
          role={luminizeSettlement32 ? 'status' : undefined}
        >
          保存时的配装说明：{objectiveNote}
          {objectiveNote && luminizeSettlement32 ? '；' : ''}
          {luminizeSettlement32 ? (
            <span title={luminizeSettlement32.boundary}>
              {luminizeSettlement32.status === 'declared_arithmetic'
                ? `单次辉映 ${luminizeSettlement32.totalDamage!.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（非暴击，按已保存条件结算）`
                : luminizeSettlement32.status === 'stale'
                  ? '机制计算依据已更新，历史快照仍保留；请重新分析后保存。'
                  : '当前无法重算已保存机制结果，历史方案仍可查看；请重新分析后保存。'}
            </span>
          ) : null}
        </p>
      ) : null}
      {needsTeamRecovery && staleNotice ? (
        <section className="panel status-card" role="status" aria-label="已保存方案重新匹配">
          <p>{staleNotice}</p>
          <button className="button button--secondary" type="button" onClick={reanalyze}>
            重新匹配当前队伍
          </button>
        </section>
      ) : null}
    </>
  )
}
