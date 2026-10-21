import type { FormedTeamReference as Reference } from '../application/publicFormedTeamReference'
import { getAgentName } from '../application/publicRosterNames'

export function FormedTeamReference({
  reference,
  gaps = [],
  saved = false,
}: {
  reference?: Reference
  gaps?: readonly string[]
  saved?: boolean
}) {
  if (!reference) return null
  return (
    <details className="team-execution__graduation-reference">
      <summary>{saved ? '保存时的成型参考' : '成型参考与培养差距'}</summary>
      <p>
        {reference.members
          .map(
            (row) =>
              `${getAgentName(row.agentId)} ${row.mindscape}影${row.potential === null ? '' : ` · 潜能${row.potential}级`}`,
          )
          .join('；')}
      </p>
      <p>
        角色60级、核心满级，基础技能11级并计入影画加成。按本队成型方向比较；当前配装使用你的实际培养。
      </p>
      {gaps.length ? (
        <ul>
          {gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : null}
      <p>影画和潜能差距用于培养参考；音擎、驱动盘与技能建议见下方角色配装。</p>
    </details>
  )
}
