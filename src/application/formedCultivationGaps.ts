import type { AccountRoster } from '../assault/types'
import type { FormedTeamReference, TeamMemberCultivationFacts } from './publicFormedTeamReference'
import { getAgentName } from './publicRosterNames'

/** Observation projection; a persisted roster remains a stricter account type. */
type CultivationRoster = {
  agents: readonly (Pick<
    AccountRoster['agents'][number],
    'agentId' | 'owned' | 'potentialImage'
  > & {
    level?: number | null
    mindscape?: number | null
  })[]
}

/** Preserve explicit zero and values above a reference; never parse display text. */
export function currentTeamCultivation(
  agentIds: readonly string[],
  roster: CultivationRoster,
): Record<string, TeamMemberCultivationFacts> {
  const recordedLevel = (value: number | null | undefined) =>
    value != null && Number.isInteger(value) && value >= 0 && value <= 6 ? value : null
  return Object.fromEntries(
    agentIds.map((agentId) => {
      const matches = roster.agents.filter((row) => row.agentId === agentId)
      const current = matches.length === 1 ? matches[0] : undefined
      return [
        agentId,
        {
          owned: current?.owned ?? null,
          mindscape: recordedLevel(current?.mindscape),
          potential: recordedLevel(current?.potentialImage),
        },
      ]
    }),
  )
}

/** Read-only cultivation comparison. No ranking or account defaults here. */
export function formedCultivationGaps(reference: FormedTeamReference, roster: CultivationRoster) {
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
    if (current.level == null || !Number.isInteger(current.level) || current.level < 1)
      gaps.push(`${name}：等级未记录，成型参考为${target.level}级。`)
    else if (current.level < target.level)
      gaps.push(`${name}：等级${current.level} → ${target.level}。`)
    return gaps
  })
}
