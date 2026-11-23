import { useRef } from 'react'
import type {
  FormedTeamReference as Reference,
  TeamMemberCultivationFacts,
} from '../application/publicFormedTeamReference'
import { getAgentName } from '../application/publicRosterNames'
import { useDetailsDisclosureMotion } from '../motion/useDetailsDisclosureMotion'
import './team-loadout-reference-badges.css'

export function FormedTeamReference({
  reference,
  gaps,
  saved = false,
  current,
}: {
  reference?: Reference
  gaps?: readonly string[]
  saved?: boolean
  current?: Readonly<Record<string, TeamMemberCultivationFacts>>
}) {
  const containerRef = useRef<HTMLElement>(null)
  useDetailsDisclosureMotion({ scope: containerRef, selector: 'details' })

  if (!reference) return null

  const referenceSummaryText = reference.members
    .map(
      (row) =>
        `${getAgentName(row.agentId)} ${row.mindscape}影${row.potential === null ? '' : ` · 潜能${row.potential}级`}`,
    )
    .join('；')

  return (
    <section
      ref={containerRef}
      className="team-execution__graduation-reference"
      aria-label={saved ? '保存时的成型参考' : '成型参考与培养差距'}
    >
      <div className="team-execution__reference-header">
        <h4 className="team-execution__reference-title">
          {saved ? '保存时的成型参考' : '成型参考与培养差距'}
        </h4>
      </div>
      {current ? (
        <ul className="team-execution__cultivation-members" aria-label="成员当前培养与参考">
          {reference.members.map((target) => {
            const fact = current[target.agentId]
            const actual = fact?.owned === true ? fact : undefined
            return (
              <li key={target.agentId}>
                <strong>{getAgentName(target.agentId)}</strong>
                <span>
                  当前：
                  {fact?.owned === false
                    ? '尚未拥有'
                    : actual?.mindscape == null
                      ? '影画未记录'
                      : `${actual.mindscape}影`}
                  {actual?.potential != null
                    ? ` · 潜能${actual.potential}级`
                    : actual && target.potential !== null
                      ? ' · 潜能未记录'
                      : ''}
                </span>
                <span>
                  参考：{target.mindscape}影
                  {target.potential === null ? '' : ` · 潜能${target.potential}级`}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="team-execution__reference-summary-line">
          <span className="team-execution__reference-subheading">关键参考：</span>
          <span className="team-execution__reference-members-text">{referenceSummaryText}</span>
        </div>
      )}
      <div className="team-execution__reference-gaps-block">
        <span className="team-execution__reference-subheading">培养差距：</span>
        {gaps && gaps.length > 0 ? (
          <ul className="team-execution__reference-gaps-list">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : (
          <span className="team-execution__reference-no-gaps">
            {gaps === undefined
              ? saved
                ? '打开方案后核对当前培养与保存时参考。'
                : '当前培养尚未核对，可先查看本队参考。'
              : '已记录的培养项达到本队参考。'}
          </span>
        )}
      </div>
      <details className="team-execution__reference-rules-disclosure">
        <summary>参考标准与说明</summary>
        <p>
          角色60级、核心满级，基础技能11级并计入影画加成。按本队成型方向比较；当前配装使用你的实际培养。
        </p>
        <p>影画和潜能差距用于培养参考；音擎、驱动盘与技能建议见下方角色配装。</p>
      </details>
    </section>
  )
}
