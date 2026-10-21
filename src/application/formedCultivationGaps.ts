import type { AccountRoster } from '../assault/types'
import type { FormedTeamReference } from './publicFormedTeamReference'
import { getAgentName } from './publicRosterNames'

/** Read-only cultivation comparison. No ranking or account defaults here. */
export function formedCultivationGaps(
  reference: FormedTeamReference,
  roster: Pick<AccountRoster, 'agents'>,
) {
  return reference.members.flatMap((target) => {
    const matches = roster.agents.filter((row) => row.agentId === target.agentId)
    const current = matches.length === 1 ? matches[0] : undefined
    const name = getAgentName(target.agentId)
    if (!current?.owned) return [`${name}：尚未拥有或培养资料未确认。`]
    const gaps: string[] = []
    if (current.mindscape == null)
      gaps.push(`${name}：影画未记录，成型参考为${target.mindscape}影。`)
    else if (current.mindscape < target.mindscape)
      gaps.push(`${name}：${current.mindscape}影 → ${target.mindscape}影。`)
    if (target.potential !== null && current.potentialImage == null)
      gaps.push(`${name}：潜能未记录，成型参考为${target.potential}级。`)
    else if (target.potential !== null && current.potentialImage! < target.potential)
      gaps.push(`${name}：潜能${current.potentialImage}级 → ${target.potential}级。`)
    if (current.level < target.level) gaps.push(`${name}：等级${current.level} → ${target.level}。`)
    return gaps
  })
}
