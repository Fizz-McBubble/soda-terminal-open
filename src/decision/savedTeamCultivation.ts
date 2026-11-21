import type { AccountRoster, RosterAgent } from '../assault/types'
import type { TeamExecution } from './teamExecutionProjection'

import {
  savedTeamCultivationSchema,
  type SavedTeamCultivation,
} from '../domain/savedTeamCultivationSchema'
export {
  savedTeamCultivationSchema,
  type SavedTeamCultivation,
} from '../domain/savedTeamCultivationSchema'

/** Freeze the account projection used by this solve; never apply full-level defaults. */
export function captureTeamCultivation(agent: RosterAgent | undefined) {
  if (!agent) return undefined
  const result = savedTeamCultivationSchema.safeParse({
    projectionVersion: 'solve-input/v1',
    level: agent.level,
    ascension: agent.ascension,
    mindscape: agent.mindscape,
    potentialImage: agent.potentialImage,
    skillLevels: agent.skillLevels,
  })
  return result.success ? result.data : undefined
}

/** Detached calculation input. Legacy views stay readable; exact replay may require capture. */
export function savedTeamCultivationRoster(
  execution: TeamExecution | undefined,
  roster: AccountRoster,
  requireCaptured = false,
): AccountRoster | undefined {
  const members = execution?.members ?? []
  if (!members.some((member) => member.cultivation !== undefined))
    return requireCaptured ? undefined : roster
  if (
    !execution ||
    execution.memberIds.length !== 3 ||
    members.length !== 3 ||
    new Set(members.map((member) => member.agentId)).size !== 3 ||
    members.some((member) => !execution.memberIds.includes(member.agentId))
  )
    return undefined
  const facts = new Map<string, SavedTeamCultivation>()
  for (const member of members) {
    const parsed = savedTeamCultivationSchema.safeParse(member.cultivation)
    if (
      !parsed.success ||
      roster.agents.filter((agent) => agent.agentId === member.agentId).length !== 1
    )
      return undefined
    facts.set(member.agentId, parsed.data)
  }
  return {
    ...roster,
    agents: roster.agents.map((agent) => {
      const saved = facts.get(agent.agentId)
      if (!saved) return agent
      const { projectionVersion, ...cultivation } = saved
      return {
        ...agent,
        ...cultivation,
        ascension: projectionVersion ? saved.ascension : (saved.ascension ?? null),
        potentialImage: projectionVersion ? saved.potentialImage : (saved.potentialImage ?? null),
        skillLevels: { ...saved.skillLevels },
        observedFacts: undefined,
      }
    }),
  }
}
