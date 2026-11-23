import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'

/** Show only missing plan discs; shared or occupied equipment belongs to the impacts surface. */
export function TeamLoadoutPreviewEquipment({
  item,
  agentIds,
}: {
  item: TeamLoadoutOverviewItem
  agentIds: readonly string[]
}) {
  const members = item.memberEquipment
  if (!members) return null
  if (
    agentIds.length !== 3 ||
    new Set(agentIds).size !== 3 ||
    members.length !== 3 ||
    new Set(members.map((row) => row.agentId)).size !== 3 ||
    members.some((row) => !agentIds.includes(row.agentId))
  )
    return null

  const missing = agentIds.flatMap((agentId) => {
    const member = members.find((row) => row.agentId === agentId)!
    return member.missingDiscIds.length
      ? [
          {
            agentId: member.agentId,
            agentName: member.agentName,
            count: member.missingDiscIds.length,
          },
        ]
      : []
  })
  if (!missing.length) return null

  return (
    <section className="f5v-box-team-preview__gaps" aria-label="方案盘缺失">
      <h3>方案盘缺失</h3>
      <ul>
        {missing.map((member) => (
          <li key={member.agentId}>
            <strong>{member.agentName}</strong>：缺 {member.count} 张方案盘
          </li>
        ))}
      </ul>
    </section>
  )
}
