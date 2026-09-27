import type { TeamExecutionAttributePanel } from './teamExecutionAttributePanel'

/** Keep the same attribute columns for every agent, even when no target is published. */
export function PublicTeamAttributeInspector({
  agentName,
  panel,
}: {
  agentName: string
  panel: TeamExecutionAttributePanel | null
}) {
  if (!panel) {
    return (
      <aside className="team-execution__inspector" aria-label="角色详细属性">
        <h3>角色详细属性</h3>
        <p role="status">属性资料尚未就绪，请重新匹配后查看。</p>
      </aside>
    )
  }
  const accountLabel =
    panel.source.outOfCombat.status === 'exact'
      ? '当前面板'
      : panel.source.outOfCombat.status === 'baseline'
        ? '参考面板'
        : '当前面板'
  const proposedLabel = panel.source.current.status === 'exact' ? '方案后' : '六盘贡献'
  return (
    <aside className="team-execution__inspector" aria-label="角色详细属性">
      <header className="team-execution__attribute-heading">
        <div>
          <p className="team-execution__panel-kicker">{agentName}</p>
          <h3>角色详细属性</h3>
        </div>
      </header>
      {panel.source.target.conditions?.length ? (
        <p className="team-execution__attribute-notes">{panel.copy.target}</p>
      ) : null}
      {panel.source.current.status === 'missing' && panel.copy.current ? (
        <p className="team-execution__attribute-notes">{panel.copy.current}</p>
      ) : null}
      {panel.attackSupport ? (
        <p className="team-execution__attribute-notes">
          入场攻击支援：
          {panel.attackSupport.suggested.status === 'supported'
            ? `全队 +${Math.round(panel.attackSupport.suggested.value!)} 攻击力（不计入初始面板）`
            : panel.attackSupport.suggested.reason}
        </p>
      ) : null}
      <div
        className="team-execution__attribute-table"
        role="table"
        aria-label={`${agentName}角色详细属性`}
      >
        <div className="team-execution__attribute-row is-heading" role="row">
          <span role="columnheader">属性</span>
          <span role="columnheader">{accountLabel}</span>
          <span role="columnheader">{proposedLabel}</span>
          <span role="columnheader">毕业参考</span>
        </div>
        {panel.rows.map((row) => (
          <div
            className={`team-execution__attribute-row${row.isPriority ? ' is-priority' : ''}${row.isBelowTarget ? ' is-below-target' : ''}`}
            key={row.label}
            role="row"
          >
            <strong role="cell">{row.label}</strong>
            <span role="cell">{row.outOfCombatStatus === 'missing' ? '—' : row.outOfCombat}</span>
            <span role="cell" className="team-execution__attribute-proposed">
              {panel.source.current.status === 'exact'
                ? row.current
                : row.contribution === '无可证副词条'
                  ? '—'
                  : row.contribution}
            </span>
            <span role="cell">{row.targetStatus === 'missing' ? '—' : row.target}</span>
          </div>
        ))}
      </div>
      {!panel.rows.some((row) => row.targetStatus !== 'missing') ? (
        <p className="team-execution__attribute-notes">暂无可量化的毕业参考。</p>
      ) : null}
    </aside>
  )
}
