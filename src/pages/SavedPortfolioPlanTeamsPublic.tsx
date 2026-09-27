import { getCandidateWEngineLabels } from '../application/publicCandidateLabels'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { getAgentName } from '../application/publicRosterNames'
import { PublicSavedDiscList } from './PublicSavedDiscList'
import {
  playerFacingExecutionBlocker,
  presentTeamExecutionPortfolio,
} from './teamExecutionPortfolioPresentation'
import type { SavedPortfolioPlanTeamsProps } from './SavedPortfolioPlanTeamsProps'

/**
 * Public body: the frozen portfolio and its saved 18-disc facts, read straight from local storage.
 * No score, rating or solver default is invented, and nothing is re-matched here.
 */
export function SavedPortfolioPlanTeams({ plan, warehouse }: SavedPortfolioPlanTeamsProps) {
  const snapshot = plan.teamPortfolioSnapshot
  if (!snapshot) return null
  const savedView = presentTeamExecutionPortfolio(snapshot)
  return (
    <>
      <header className="optimizer-portfolio__heading">
        <h2>保存时的方案结论</h2>
        <p>
          历史状态：保存时{savedView.statusLabel}（{savedView.headline}）
          {savedView.equipmentLine ? ` · ${savedView.equipmentLine}` : ''}
        </p>
      </header>
      <p className="panel optimizer-portfolio__why" role="status">
        下方成员与驱动盘按当前仓库资料显示；保存结论是历史记录，不代表当前仓库仍然可用。本页不重新匹配、不重新求解，也不改写这份方案。
      </p>
      <div className="optimizer-portfolio__teams">
        {snapshot.executions.map((execution, index) => {
          const assignedIds = new Set(
            execution.members.flatMap((member) => member.suggested.discIds),
          )
          const unattributedIds = execution.physicalDiscIds.filter((id) => !assignedIds.has(id))
          const savedIds = [...new Set(execution.physicalDiscIds)]
          const presentCount = savedIds.filter((id) =>
            warehouse.discs.some((disc) => disc.id === id),
          ).length
          const missingCount = savedIds.length - presentCount
          const blockerLines = [
            ...new Set(execution.blockers.map((value) => playerFacingExecutionBlocker(value))),
          ]
          return (
            <article className="panel" key={`${execution.memberIds.join('+')}:${index}`}>
              <p className="eyebrow">
                第 {index + 1} 队 · 保存时 {savedIds.length} 张不同驱动盘
              </p>
              <p>
                {execution.memberIds.map(getAgentName).join(' · ')} ·{' '}
                {playerFacingBangbooLabel(execution.bangbooId)}
              </p>
              <p role="status">
                当前仓库核对：{presentCount}/{savedIds.length} 张可找到
                {missingCount
                  ? ` · 缺少 ${missingCount} 张（原记录保留，未自动替换）`
                  : ' · 未发现缺盘'}
              </p>
              {execution.members.map((member) => {
                const discIds = [...new Set(member.suggested.discIds)]
                const engineLabel = member.suggested.wEngine
                  ? getCandidateWEngineLabels([member.suggested.wEngine.engineId])[0]
                  : null
                return (
                  <section className="team-execution__loadout" key={member.agentId}>
                    <h3>{getAgentName(member.agentId)}</h3>
                    {member.suggested.wEngine && engineLabel ? (
                      <p>
                        方案音擎：{engineLabel} · P{member.suggested.wEngine.refinement}
                      </p>
                    ) : (
                      <p>这份方案未记录该成员使用的音擎；其他已保存内容仍保留。</p>
                    )}
                    {discIds.length ? (
                      <PublicSavedDiscList
                        discIds={discIds}
                        warehouse={warehouse}
                        label={`${getAgentName(member.agentId)}的已保存驱动盘`}
                        missingNotice="原记录已保留，未自动缩减或替换。"
                      />
                    ) : (
                      <p className="team-execution__disc-missing">
                        这份方案未记录该成员使用哪些驱动盘，其他已保存内容仍保留。
                      </p>
                    )}
                  </section>
                )
              })}
              {unattributedIds.length ? (
                <section className="team-execution__loadout">
                  <h3>未记录成员归属的已保存驱动盘</h3>
                  <PublicSavedDiscList
                    discIds={unattributedIds}
                    warehouse={warehouse}
                    label="未记录成员归属的已保存驱动盘"
                    missingNotice="原记录已保留，未自动缩减或替换。"
                  />
                </section>
              ) : null}
              {blockerLines.length ? (
                <details className="team-execution__loadout">
                  <summary>查看这支队伍保存时的 {blockerLines.length} 项限制</summary>
                  <ul>
                    {blockerLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          )
        })}
      </div>
    </>
  )
}
