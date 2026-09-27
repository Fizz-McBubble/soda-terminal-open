export function PlanEditorSavedStateNotices({
  objectiveNote,
  needsTeamRecovery,
  staleNotice,
  reanalyze,
}: {
  objectiveNote: string | undefined
  needsTeamRecovery: boolean
  staleNotice: string | null | undefined
  reanalyze: () => void
}) {
  return (
    <>
      {objectiveNote ? (
        <p className="team-execution__scheme-degrade">保存时的配装说明：{objectiveNote}</p>
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
