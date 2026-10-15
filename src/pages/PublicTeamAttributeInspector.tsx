import { TeamExecutionGraduationReference } from './TeamExecutionGraduationReference'
import { ExplanationPopover } from '../components/ExplanationPopover'
import { TeamExecutionAttributeTable } from './TeamExecutionAttributeTable'
import { detailedTeamAttributeRows, visibleTeamAttributeRows } from './teamExecutionAttributeRows'
import type { TeamExecutionAttributePanel } from './teamExecutionAttributePanel'

/** Reuses the local field identities while preserving public projection boundaries. */
export function PublicTeamAttributeInspector({
  agentName,
  agentId,
  accountId,
  panel,
}: {
  agentName: string
  agentId?: string
  accountId?: string
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
  const rows = visibleTeamAttributeRows(panel.rows)
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
        <div className="team-execution__attribute-actions">
          {panel.rows.length ? (
            <ExplanationPopover
              key={`${accountId ?? ''}:${agentId ?? agentName}`}
              label="查看完整面板"
              title="角色完整面板"
              closeLabel="关闭完整面板"
              className="team-execution__more-attributes"
            >
              <TeamExecutionAttributeTable
                rows={detailedTeamAttributeRows(panel.rows)}
                label={`${agentName}完整面板`}
                accountLabel={accountLabel}
                proposedLabel={proposedLabel}
                hasFinalPanel={panel.source.current.status === 'exact'}
              />
            </ExplanationPopover>
          ) : null}
          <TeamExecutionGraduationReference
            panel={panel}
            identity={`${accountId ?? ''}:${agentId ?? agentName}`}
          />
        </div>
      </header>
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
      <TeamExecutionAttributeTable
        rows={rows}
        label={`${agentName}角色详细属性`}
        accountLabel={accountLabel}
        proposedLabel={proposedLabel}
        hasFinalPanel={panel.source.current.status === 'exact'}
      />
      {!panel.rows.some((row) => row.targetStatus !== 'missing') ? (
        <p className="team-execution__attribute-notes">暂无可量化的毕业参考。</p>
      ) : null}
    </aside>
  )
}
